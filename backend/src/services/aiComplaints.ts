import fs from 'fs';
import path from 'path';
import { query } from '../db';
import { pipeline } from '@xenova/transformers';
import { decryptText } from '../utils/crypto';

// Models cache
interface LabeledEmbedding {
    text: string;
    label: string;
    embedding: number[];
}

let categoryEmbeddings: LabeledEmbedding[] = [];
let sentimentEmbeddings: LabeledEmbedding[] = [];
let isCategoryModelLoaded = false;
let isSentimentModelLoaded = false;

// Lazy loaders for Pipelines
let embedderPipeline: any = null;
let sentimentPipeline: any = null;

async function getEmbedder() {
    if (!embedderPipeline) {
        embedderPipeline = await pipeline('feature-extraction', 'Xenova/multilingual-e5-small');
    }
    return embedderPipeline;
}

async function getSentimentClassifier() {
    if (!sentimentPipeline) {
        sentimentPipeline = await pipeline('sentiment-analysis', 'Xenova/bert-base-multilingual-uncased-sentiment');
    }
    return sentimentPipeline;
}

// Helper to compute embedding with query/passage prefixing
export async function getEmbedding(text: string, type: 'query' | 'passage' = 'query'): Promise<number[]> {
    const embedder = await getEmbedder();
    const prefix = type === 'query' ? 'query: ' : 'passage: ';
    const output = await embedder(`${prefix}${text}`, {
        pooling: 'mean',
        normalize: true
    });
    return Array.from(output.data);
}

// Helper for Cosine Similarity (vectors are already normalized)
function cosineSimilarity(vecA: number[], vecB: number[]): number {
    let dotProduct = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
    }
    return dotProduct;
}

const MODELS_DIR = path.join(__dirname, '../../models');

export function reloadModels() {
    isCategoryModelLoaded = false;
    isSentimentModelLoaded = false;
    try {
        const catPath = path.join(MODELS_DIR, 'category_model.json');
        if (fs.existsSync(catPath)) {
            categoryEmbeddings = JSON.parse(fs.readFileSync(catPath, 'utf8'));
            isCategoryModelLoaded = categoryEmbeddings.length > 0;
        }
    } catch (e) {
        console.warn('Failed to load Category Model JSON:', e);
    }

    try {
        const sentPath = path.join(MODELS_DIR, 'sentiment_model.json');
        if (fs.existsSync(sentPath)) {
            sentimentEmbeddings = JSON.parse(fs.readFileSync(sentPath, 'utf8'));
            isSentimentModelLoaded = sentimentEmbeddings.length > 0;
        }
    } catch (e) {
        console.warn('Failed to load Sentiment Model JSON:', e);
    }
}

// Initial load
reloadModels();

// Fixed categories
export type ComplaintCategory = 'Bullying' | 'Teacher Absenteeism' | 'Facilities' | 'Illegal Fees' | 'Safety' | 'Learning Quality' | 'Other';
export type UrgencyLevel = 'Low' | 'Medium' | 'High' | 'Critical';
export type SentimentLevel = 'Positive' | 'Neutral' | 'Negative';

// Category dictionary for fallback Keyword classification
const categoryKeywords: Record<ComplaintCategory, string[]> = {
    Bullying: [
        'bully', 'perundungan', 'dirundung', 'diejek', 'dihina', 'diancam', 'dipukul', 
        'intimidasi', 'pemalakan', 'dipalak', 'dikeroyok', 'diejek', 'dilecehkan', 'kasar'
    ],
    'Teacher Absenteeism': [
        'bolos', 'absen', 'tidak masuk', 'jarang mengajar', 'kelas kosong', 'guru telat', 
        'meninggalkan kelas', 'tanpa keterangan', 'tidak mengajar', 'tidak hadir'
    ],
    Facilities: [
        'rusak', 'kotor', 'jorok', 'bocor', 'atap roboh', 'toilet bau', 'air mati', 
        'ac mati', 'bangku patah', 'meja rusak', 'lapangan becek', 'jendela pemecah', 'fasilitas'
    ],
    'Illegal Fees': [
        'pungli', 'pungutan', 'iuran', 'uang kas', 'wajib bayar', 'seragam mahal', 
        'buku paket wajib', 'lks', 'denda', 'pemerasan', 'biaya tambahan', 'sumbangan paksa'
    ],
    Safety: [
        'tawuran', 'senjata tajam', 'sajam', 'narkoba', 'miras', 'rokok', 'pencurian', 
        'hilang', 'pelecehan', 'pagar roboh', 'kabel terkelupas', 'kebakaran', 'gerbang rusak'
    ],
    'Learning Quality': [
        'membingungkan', 'tidak paham', 'guru galak', 'nilai dimanipulasi', 'ujian bocor', 
        'materi minim', 'kurang buku', 'tidak diajarkan', 'tugas terlalu banyak', 'salah info'
    ],
    Other: []
};

// Indonesian Sentiment Lexicon for fallback
const positiveWords = [
    'baik', 'bagus', 'senang', 'puas', 'bersih', 'ramah', 'aman', 'tertib', 'disiplin', 
    'lengkap', 'juara', 'nyaman', 'hebat', 'pintar', 'membantu', 'terbuka', 'adil'
];

const negativeWords = [
    'buruk', 'jelek', 'kecewa', 'takut', 'marah', 'sakit', 'rusak', 'kotor', 'lambat', 
    'kasar', 'mahal', 'bohong', 'rugi', 'kejam', 'sedih', 'bahaya', 'terganggu', 'kehilangan',
    'sulit', 'kurang', 'lemah', 'payah', 'mengecewakan', 'parah', 'menakutkan', 'terancam',
    'bully', 'dibully', 'diejek', 'dihina', 'dipalak', 'pungli', 'bolos', 'khawatir', 'cemas'
];

const criticalSafetyWords = [
    'pisau', 'senjata', 'sajam', 'darah', 'pukul', 'luka', 'cedera', 'narkoba', 'sabu', 
    'pelecehan', 'cabul', 'perkosa', 'ancam bunuh', 'pingsan', 'darurat'
];

function tokenizeAndNormalize(text: string): string[] {
    return text
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ') // Remove punctuation
        .split(/\s+/)
        .filter(token => token.length > 1);
}

/**
 * Classifies a complaint using Hugging Face Embeddings + KNN, falling back to keywords if no model loaded.
 */
export async function classifyComplaint(text: string): Promise<{ category: ComplaintCategory; confidence: number }> {
    // If model not loaded in memory, try to reload it
    if (!isCategoryModelLoaded) {
        reloadModels();
    }

    if (isCategoryModelLoaded) {
        try {
            const inputEmbedding = await getEmbedding(text);
            const similarities = categoryEmbeddings.map(item => ({
                text: item.text,
                label: item.label,
                similarity: cosineSimilarity(inputEmbedding, item.embedding)
            }));
            
            // Sort by descending similarity
            similarities.sort((a, b) => b.similarity - a.similarity);

            // Weighted KNN voting (k=3)
            const votes: Record<string, number> = {};
            const topK = Math.min(3, similarities.length);
            for (let i = 0; i < topK; i++) {
                const item = similarities[i];
                votes[item.label] = (votes[item.label] || 0) + item.similarity;
            }

            let bestCategory: ComplaintCategory = 'Other';
            let maxVote = 0;
            for (const [label, vote] of Object.entries(votes)) {
                if (vote > maxVote) {
                    maxVote = vote;
                    bestCategory = label as ComplaintCategory;
                }
            }

            const confidence = similarities[0] ? similarities[0].similarity : 0.5;
            return {
                category: bestCategory,
                confidence: parseFloat(confidence.toFixed(2))
            };
        } catch (e) {
            console.error('Error during KNN category classification:', e);
        }
    }

    // Fallback: Keyword-based matching
    const tokens = tokenizeAndNormalize(text);
    if (tokens.length === 0) {
        return { category: 'Other', confidence: 1.0 };
    }

    const scores: Record<ComplaintCategory, number> = {
        Bullying: 0,
        'Teacher Absenteeism': 0,
        Facilities: 0,
        'Illegal Fees': 0,
        Safety: 0,
        'Learning Quality': 0,
        Other: 0
    };

    let totalScore = 0;
    for (const [category, keywords] of Object.entries(categoryKeywords)) {
        if (category === 'Other') continue;
        let matches = 0;
        tokens.forEach(token => {
            keywords.forEach(keyword => {
                if (token.includes(keyword)) {
                    matches += 1.5;
                }
            });
        });
        scores[category as ComplaintCategory] = matches;
        totalScore += matches;
    }

    if (totalScore === 0) {
        return { category: 'Other', confidence: 0.5 };
    }

    let bestCategory: ComplaintCategory = 'Other';
    let maxScore = 0;
    for (const [cat, score] of Object.entries(scores)) {
        if (score > maxScore) {
            maxScore = score;
            bestCategory = cat as ComplaintCategory;
        }
    }

    const confidence = maxScore / totalScore;
    return { category: bestCategory, confidence: parseFloat(confidence.toFixed(2)) };
}

/**
 * Analyzes the sentiment using Hugging Face bert-base-multilingual-uncased-sentiment
 */
export async function analyzeSentiment(text: string): Promise<{ sentiment: SentimentLevel; score: number }> {
    if (!isSentimentModelLoaded) {
        reloadModels();
    }

    // 1. Check for human override via nearest neighbor
    if (isSentimentModelLoaded) {
        try {
            const inputEmbedding = await getEmbedding(text);
            const similarities = sentimentEmbeddings.map(item => ({
                label: item.label,
                similarity: cosineSimilarity(inputEmbedding, item.embedding)
            }));
            similarities.sort((a, b) => b.similarity - a.similarity);

            // If a very close match exists (>0.85), respect the human-in-the-loop override
            if (similarities[0] && similarities[0].similarity > 0.85) {
                const matchedLabel = similarities[0].label as SentimentLevel;
                const score = matchedLabel === 'Positive' ? similarities[0].similarity : (matchedLabel === 'Negative' ? -similarities[0].similarity : 0);
                return { sentiment: matchedLabel, score: parseFloat(score.toFixed(2)) };
            }
        } catch (e) {
            console.error('Error during KNN sentiment lookup:', e);
        }
    }

    // 2. Fallback to Pre-trained Hugging Face Sentiment Model
    try {
        const classifier = await getSentimentClassifier();
        const res = await classifier(text);
        const prediction = res[0];

        const labelMap: Record<string, SentimentLevel> = {
            '5 stars': 'Positive',
            '4 stars': 'Positive',
            '3 stars': 'Neutral',
            '2 stars': 'Negative',
            '1 star': 'Negative'
        };

        const sentiment = labelMap[prediction.label] || 'Neutral';
        let score = 0;

        if (sentiment === 'Positive') {
            score = prediction.score;
        } else if (sentiment === 'Negative') {
            score = -prediction.score;
        }

        return {
            sentiment,
            score: parseFloat(score.toFixed(2))
        };
    } catch (e) {
        console.warn('Hugging Face sentiment pipeline failed, falling back to Lexicon:', e);
    }

    // 3. Fallback: Lexicon-based matching
    const tokens = tokenizeAndNormalize(text);
    if (tokens.length === 0) {
        return { sentiment: 'Neutral', score: 0 };
    }

    let posMatches = 0;
    let negMatches = 0;

    tokens.forEach(token => {
        if (positiveWords.some(w => token.includes(w))) posMatches++;
        if (negativeWords.some(w => token.includes(w))) negMatches++;
    });

    const totalMatches = posMatches + negMatches;
    if (totalMatches === 0) {
        return { sentiment: 'Neutral', score: 0 };
    }

    const score = (posMatches - negMatches) / totalMatches;
    let sentiment: SentimentLevel = 'Neutral';
    if (score > 0.15) {
        sentiment = 'Positive';
    } else if (score < -0.15) {
        sentiment = 'Negative';
    }
    return { sentiment, score: parseFloat(score.toFixed(2)) };
}

/**
 * Determines urgency tier for a complaint based on categories, keywords, and history.
 */
export async function determineUrgency(
    text: string, 
    category: ComplaintCategory, 
    schoolId: string
): Promise<{ urgency: UrgencyLevel; explanation: string }> {
    const tokens = tokenizeAndNormalize(text);
    
    const containsCriticalWord = tokens.some(token => 
        criticalSafetyWords.some(w => token.includes(w))
    );

    if (containsCriticalWord || category === 'Safety') {
        return { 
            urgency: 'Critical', 
            explanation: `Critical because category=${category} or high-risk safety keywords matched.` 
        };
    }

    try {
        const recentComplaints = await query(
            `SELECT COUNT(*) FROM complaints WHERE school_id = $1 AND created_at > NOW() - INTERVAL '7 days'`,
            [schoolId]
        );
        const count = parseInt(recentComplaints.rows[0].count);

        if (count >= 3) {
            return {
                urgency: 'High',
                explanation: `High urgency: Repeated complaints (${count} reports) submitted at this school in the last 7 days.`
            };
        }
    } catch (e) {
        console.error('Error fetching recent complaints count', e);
    }

    if (category === 'Bullying') {
        return { urgency: 'High', explanation: 'High urgency by default for bullying reports.' };
    }
    if (category === 'Teacher Absenteeism' || category === 'Illegal Fees') {
        return { urgency: 'Medium', explanation: 'Medium urgency by default for administrative/personnel concerns.' };
    }
    
    return { urgency: 'Low', explanation: 'Low urgency by default for facilities and learning quality reports.' };
}

/**
 * Detects if a complaint is a duplicate of a recent open complaint at the same school using Sentence Embeddings Cosine Similarity.
 */
export async function detectDuplicate(
    text: string, 
    schoolId: string, 
    category: ComplaintCategory
): Promise<{ isDuplicate: boolean; duplicateOfId: string | null; similarity: number }> {
    const recentComplaints = await query(
        `SELECT complaint_id, text, category FROM complaints 
         WHERE school_id = $1 AND category = $2 AND status != 'Resolved' AND created_at > NOW() - INTERVAL '30 days'`,
        [schoolId, category]
    );

    if (recentComplaints.rowCount === 0) {
        return { isDuplicate: false, duplicateOfId: null, similarity: 0 };
    }
    try {
        console.log(`[detectDuplicate] Found ${recentComplaints.rowCount} recent complaints for category ${category}`);
        const newEmbedding = await getEmbedding(text, 'query');
        let maxSimilarity = 0;
        let duplicateOfId: string | null = null;

        for (const row of recentComplaints.rows) {
            const decryptedRowText = decryptText(row.text);
            const rowEmbedding = await getEmbedding(decryptedRowText, 'passage');
            const similarity = cosineSimilarity(newEmbedding, rowEmbedding);
            console.log(`[detectDuplicate] Comparing with ID ${row.complaint_id}, text length: ${decryptedRowText.length}, Similarity: ${similarity}`);

            if (similarity > maxSimilarity) {
                maxSimilarity = similarity;
                duplicateOfId = row.complaint_id;
            }
        }
        console.log(`[detectDuplicate] Max similarity: ${maxSimilarity}, isDuplicate: ${maxSimilarity >= 0.85}`);

        // Sentence embeddings duplicate threshold set conservatively to 0.85
        const isDuplicate = maxSimilarity >= 0.85;

        return { 
            isDuplicate, 
            duplicateOfId: isDuplicate ? duplicateOfId : null, 
            similarity: parseFloat(maxSimilarity.toFixed(2)) 
        };
    } catch (e) {
        console.error('Sentence embedding duplicate detection failed, fallback to Jaccard:', e);
    }

    // Fallback: Jaccard Similarity
    const tokens = tokenizeAndNormalize(text);
    if (tokens.length === 0) {
        return { isDuplicate: false, duplicateOfId: null, similarity: 0 };
    }

    let maxSimilarity = 0;
    let duplicateOfId: string | null = null;

    for (const row of recentComplaints.rows) {
        const decryptedRowText = decryptText(row.text);
        const rowTokens = tokenizeAndNormalize(decryptedRowText);
        const similarity = calculateJaccardSimilarity(tokens, rowTokens);

        if (similarity > maxSimilarity) {
            maxSimilarity = similarity;
            duplicateOfId = row.complaint_id;
        }
    }

    const isDuplicate = maxSimilarity >= 0.5;
    return { 
        isDuplicate, 
        duplicateOfId: isDuplicate ? duplicateOfId : null, 
        similarity: parseFloat(maxSimilarity.toFixed(2)) 
    };
}

function calculateJaccardSimilarity(tokens1: string[], tokens2: string[]): number {
    const set1 = new Set(tokens1);
    const set2 = new Set(tokens2);
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    if (union.size === 0) return 0;
    return intersection.size / union.size;
}
