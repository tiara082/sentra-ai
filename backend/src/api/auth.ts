import { Router, Response } from 'express';
import { query } from '../db';
import { comparePassword, generateStaffToken, authenticateStaff, AuthenticatedRequest } from '../security';
import { logAudit } from '../utils/auditLogger';

const router = Router();

/**
 * @route   POST /api/v1/auth/login
 * @desc    Authenticate staff/government users & get token
 * @access  Public
 */
router.post('/login', async (req: AuthenticatedRequest, res: Response) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error_code: 'BAD_REQUEST', message: 'Email and password are required' });
    }

    try {
        const userQuery = await query('SELECT * FROM users WHERE email = $1 AND status = \'Active\'', [email]);
        
        if (userQuery.rowCount === 0) {
            return res.status(401).json({ error_code: 'UNAUTHORIZED', message: 'Invalid credentials' });
        }

        const user = userQuery.rows[0];
        const isMatch = await comparePassword(password, user.password_hash);

        if (!isMatch) {
            return res.status(401).json({ error_code: 'UNAUTHORIZED', message: 'Invalid credentials' });
        }

        // Generate JWT
        const token = generateStaffToken({
            userId: user.user_id,
            email: user.email,
            name: user.name,
            role: user.role,
            districtScope: user.district_scope
        });

        // Audit Log
        await logAudit(user.user_id, 'USER_LOGIN', 'users', user.user_id, { email: user.email });

        return res.status(200).json({
            token,
            user: {
                userId: user.user_id,
                email: user.email,
                name: user.name,
                role: user.role,
                districtScope: user.district_scope,
                mfaEnabled: user.mfa_enabled
            }
        });
    } catch (e) {
        console.error('Error logging in user:', e);
        return res.status(500).json({ error_code: 'INTERNAL_SERVER_ERROR', message: 'Database error occurred' });
    }
});

/**
 * @route   GET /api/v1/auth/me
 * @desc    Get current user profile
 * @access  Private (Staff)
 */
router.get('/me', authenticateStaff, async (req: AuthenticatedRequest, res: Response) => {
    return res.status(200).json({ user: req.user });
});

export default router;
