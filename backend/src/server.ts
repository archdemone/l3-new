import express from 'express';
import projectContextRoutes from './api/projectContextRoutes';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

const app = express();

// Middleware
app.use(express.json());

// Routes
app.use('/api/project-context', projectContextRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'L3 Studio Backend',
    version: '0.1.0',
    features: ['graphify-context-layer'],
  });
});

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`L3 Studio backend listening on port ${PORT}`);
});

export default app;
