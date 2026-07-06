import { Pool, QueryResult } from 'pg';
import { config } from './config';

// Create a new connection pool
export const pool = new Pool({
    connectionString: config.dbUrl
});

// Helper for executing queries
export async function query(text: string, params?: any[]): Promise<QueryResult> {
    const start = Date.now();
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    
    // Log query metadata if needed (optional)
    // console.log('executed query', { text, duration, rows: res.rowCount });
    
    return res;
}

// Transaction helper
export async function transaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
}
