import express from 'express';
import cors from 'cors';
import { config } from './config';
import authRouter from './api/auth';
import parentsRouter from './api/parents';
import complaintsRouter from './api/complaints';
import schoolsRouter from './api/schools';
import simulationsRouter from './api/simulations';
import recommendationsRouter from './api/recommendations';
import adminRouter from './api/admin';
import alertsRouter from './api/alerts';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
    // console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/parents', parentsRouter);
app.use('/api/v1/parent-pulse', parentsRouter); // Mount on parent-pulse as well
app.use('/api/v1/complaints', complaintsRouter);
app.use('/api/v1/schools', schoolsRouter);
app.use('/api/v1', schoolsRouter); // For /api/v1/risk-map
app.use('/api/v1/simulations', simulationsRouter);
app.use('/api/v1/recommendations', recommendationsRouter);
app.use('/api/v1/alerts', alertsRouter);
app.use('/api/v1', adminRouter); // For /api/v1/data-integration/import and /api/v1/audit-logs

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled error:', err);
    
    const traceId = Math.random().toString(36).substring(2, 15);
    res.status(err.status || 500).json({
        error_code: err.errorCode || 'INTERNAL_SERVER_ERROR',
        message: err.message || 'An unexpected error occurred',
        trace_id: traceId
    });
});

// Start the server
const server = app.listen(config.port, () => {
    console.log(`EduPolicy Lab AI Backend running on port ${config.port}`);
});

export default app;
