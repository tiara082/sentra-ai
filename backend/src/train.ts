import fs from 'fs';
import path from 'path';
import { query } from './db';
import { pipeline } from '@xenova/transformers';
import { decryptText } from './utils/crypto';

export interface LabeledExample {
    text: string;
    label: string;
}

const MODELS_DIR = path.join(__dirname, '../models');

export async function trainModel() {
    console.log('=== AI TRAINING PIPELINE INITIALIZED ===');

    // 1. Ensure models directory exists
    if (!fs.existsSync(MODELS_DIR)) {
        fs.mkdirSync(MODELS_DIR, { recursive: true });
        console.log(`Created models directory at: ${MODELS_DIR}`);
    }

    // 2. Initialize training data arrays (loaded from database dynamically)
    let finalCategoryData: LabeledExample[] = [];
    let finalSentimentData: LabeledExample[] = [];

    // 3. Load reviewed complaints from Database (Human-in-the-loop retraining)
    try {
        console.log('Fetching reviewed complaints from database...');
        const dbComplaints = await query(`
            SELECT c.text, c.category, c.sentiment 
            FROM complaints c
            JOIN complaint_ai_metadata am ON c.complaint_id = am.complaint_id
            WHERE am.review_status IN ('Confirmed', 'Overridden')
        `);

        if (dbComplaints.rowCount && dbComplaints.rowCount > 0) {
            console.log(`Found ${dbComplaints.rowCount} human-reviewed complaints in database.`);
            
            dbComplaints.rows.forEach(row => {
                const decryptedText = decryptText(row.text);
                if (row.category) {
                    finalCategoryData.push({
                        text: decryptedText,
                        label: row.category
                    });
                }
                if (row.sentiment) {
                    finalSentimentData.push({
                        text: decryptedText,
                        label: row.sentiment
                    });
                }
            });
        } else {
            console.log('No reviewed complaints found in database. Training empty.');
        }
    } catch (e) {
        console.warn('Could not query database. Using empty array.');
    }

    // 4. Load Hugging Face feature-extraction pipeline
    console.log('Loading Hugging Face embedding pipeline (Xenova/multilingual-e5-small)...');
    const embedder = await pipeline('feature-extraction', 'Xenova/multilingual-e5-small');

    // Helper to compute embedding
    async function getEmbedding(text: string): Promise<number[]> {
        const output = await embedder(`passage: ${text}`, {
            pooling: 'mean',
            normalize: true
        });
        return Array.from(output.data);
    }

    // 5. Train Category Classifier (Precompute Sentence Embeddings)
    console.log(`Training Category Classifier (Computing embeddings for ${finalCategoryData.length} records)...`);
    const categoryModelData = [];
    for (const item of finalCategoryData) {
        const embedding = await getEmbedding(item.text);
        categoryModelData.push({
            text: item.text,
            label: item.label,
            embedding
        });
    }
    const categoryModelPath = path.join(MODELS_DIR, 'category_model.json');
    fs.writeFileSync(categoryModelPath, JSON.stringify(categoryModelData), 'utf8');
    console.log(`✓ Category Classifier trained and saved to: ${categoryModelPath}`);

    // 6. Train Sentiment Classifier (Precompute Sentence Embeddings)
    console.log(`Training Sentiment Classifier (Computing embeddings for ${finalSentimentData.length} records)...`);
    const sentimentModelData = [];
    for (const item of finalSentimentData) {
        const embedding = await getEmbedding(item.text);
        sentimentModelData.push({
            text: item.text,
            label: item.label,
            embedding
        });
    }
    const sentimentModelPath = path.join(MODELS_DIR, 'sentiment_model.json');
    fs.writeFileSync(sentimentModelPath, JSON.stringify(sentimentModelData), 'utf8');
    console.log(`✓ Sentiment Classifier trained and saved to: ${sentimentModelPath}`);

    console.log('=== AI TRAINING PIPELINE COMPLETE ===\n');
}

// Execute if run directly
if (require.main === module) {
    trainModel()
        .then(() => process.exit(0))
        .catch(err => {
            console.error('Training failed:', err);
            process.exit(1);
        });
}
