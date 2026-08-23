import express from 'express';
import { apiRouter } from '../src/server/apiHandler';

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Support both /api/* and /* paths (depending on how Vercel rewrites the route)
app.use('/api', apiRouter);
app.use('/', apiRouter);

// Export the Express app for Vercel's serverless environment
export default app;
