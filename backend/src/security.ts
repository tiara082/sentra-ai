import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { config } from './config';

// User structure encoded in JWT
export interface UserPayload {
    userId: string;
    email: string;
    name: string;
    role: 'Admin' | 'Dinas Analyst' | 'Supervisor' | 'Principal' | 'Compliance Officer';
    districtScope: string;
}

// Parent structure encoded in Parent Session Token
export interface ParentPayload {
    parentId: string;
    phoneHash: string;
    schoolIds: string[];
}

// Extend Request type to include user and parent fields
export interface AuthenticatedRequest extends Request {
    user?: UserPayload;
    parent?: ParentPayload;
}

/**
 * Hashing utility
 */
export async function hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
}

/**
 * JWT Token Utilities
 */
export function generateStaffToken(payload: UserPayload): string {
    return jwt.sign(payload as any, config.jwtSecret, { expiresIn: config.jwtExpiresIn as any });
}

export function generateParentToken(payload: ParentPayload): string {
    // Parent tokens last longer for convenience (e.g. 30 days)
    return jwt.sign(payload as any, config.jwtSecret, { expiresIn: '30d' as any });
}

/**
 * Middleware to authenticate staff JWT tokens
 */
export function authenticateStaff(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error_code: 'UNAUTHORIZED', message: 'No credentials provided' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, config.jwtSecret) as UserPayload;
        
        // Ensure this is not a parent payload (checking properties)
        if (!decoded.role) {
            return res.status(403).json({ error_code: 'FORBIDDEN', message: 'Access denied: invalid staff credentials' });
        }

        req.user = decoded;
        next();
    } catch (e) {
        return res.status(401).json({ error_code: 'UNAUTHORIZED', message: 'Invalid or expired session token' });
    }
}

/**
 * Middleware to authenticate parent session tokens
 */
export function authenticateParent(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error_code: 'UNAUTHORIZED', message: 'No credentials provided' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, config.jwtSecret) as ParentPayload;
        
        // Ensure this is not a staff payload
        if ('role' in decoded) {
            return res.status(403).json({ error_code: 'FORBIDDEN', message: 'Access denied: invalid parent credentials' });
        }

        req.parent = decoded;
        next();
    } catch (e) {
        return res.status(401).json({ error_code: 'UNAUTHORIZED', message: 'Invalid or expired parent session' });
    }
}

/**
 * Middleware to restrict access to specific roles (RBAC)
 */
export function requireRoles(roles: string[]) {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({ error_code: 'UNAUTHORIZED', message: 'Authentication required' });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ 
                error_code: 'FORBIDDEN', 
                message: `Access denied. Required roles: [${roles.join(', ')}]. Current role: ${req.user.role}` 
            });
        }

        next();
    };
}
