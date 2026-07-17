import { query } from './db';
import fs from 'fs';
import path from 'path';

async function migrate() {
    console.log('Running database schema migration...');
    const schemaPath = path.join(__dirname, 'schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');
    
    try {
        await query(sql);
        console.log('Schema migration completed successfully.');
    } catch (e) {
        console.error('Migration failed:', e);
        process.exit(1);
    }
}

migrate();
