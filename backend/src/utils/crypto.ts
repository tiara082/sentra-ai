import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const SECRET_KEY = crypto.scryptSync(
    process.env.ENCRYPTION_KEY || 'edupolicy-lab-super-secure-encryption-key-2026', 
    'salt', 
    32
);

/**
 * Encrypts plaintext using AES-256-GCM
 */
export function encryptText(text: string): string {
    if (!text) return '';
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGORITHM, SECRET_KEY, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag().toString('hex');
    
    // Format: iv:encrypted:tag
    return `${iv.toString('hex')}:${encrypted}:${tag}`;
}

/**
 * Decrypts ciphertext. If the format does not match iv:encrypted:tag, 
 * it returns the original text to maintain backward compatibility with legacy plaintext.
 */
export function decryptText(encryptedText: string): string {
    if (!encryptedText) return '';
    const parts = encryptedText.split(':');
    if (parts.length !== 3) {
        return encryptedText;
    }
    
    try {
        const iv = Buffer.from(parts[0], 'hex');
        const encrypted = parts[1];
        const tag = Buffer.from(parts[2], 'hex');
        
        const decipher = crypto.createDecipheriv(ALGORITHM, SECRET_KEY, iv);
        decipher.setAuthTag(tag);
        
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    } catch (err) {
        // Fallback to original if decryption fails (e.g. if it is actually plaintext)
        return encryptedText;
    }
}
