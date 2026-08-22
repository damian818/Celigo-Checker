import express from 'express';
import { apiRouter } from '../src/server/apiHandler';

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Mount the API router
app.use('/api', apiRouter);

// Export the Express app for Vercel's serverless environment
export default app;
