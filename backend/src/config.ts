import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '../.env') });

export const config = {
    port: process.env.PORT || 8000,
    dbUrl: process.env.DATABASE_URL || 'postgresql://postgres@localhost:5432/sentra_ai',
    jwtSecret: process.env.JWT_SECRET || 'edupolicy-lab-ai-super-secret-key-2026',
    jwtExpiresIn: '30m',
    
    // Default weights for School Health Score
    healthWeights: {
        academic: 0.20,
        teacher: 0.20,
        infrastructure: 0.15,
        finance: 0.10,
        parentSatisfaction: 0.15,
        studentWelfare: 0.15,
        governance: 0.05
    },

    // Trust Score configuration weights
    trustWeights: {
        validReportBonus: 5,        // +5 per valid report, up to max
        identityVerifiedBonus: 25,  // +25 if identity verified
        spamPenalty: -100,          // -100 per spam (floor at 0)
        duplicatePenalty: -40       // -40 per duplicate
    }
};
