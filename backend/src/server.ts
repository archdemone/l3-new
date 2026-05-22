import express from 'express';
import * as path from 'path';
import projectContextRoutes from './api/projectContextRoutes';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

const app = express();

// Middleware
app.use(express.json());

// API Routes
app.use('/api/project-context', projectContextRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve frontend static files (if built)
const frontendDistPath = path.join(__dirname, '../../frontend/dist');
try {
  app.use(express.static(frontendDistPath));

  // Fallback to index.html for SPA routing
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
} catch (err) {
  console.warn('Frontend dist not found, serving API only');

  // Fallback: API-only mode if frontend not built
  app.get('/', (req, res) => {
    res.json({
      name: 'L3 Studio Backend',
      version: '0.1.0',
      features: ['graphify-context-layer'],
      note: 'Frontend not built. Run "npm run build" from frontend/ directory.',
    });
  });
}

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
  console.log(`L3 Studio listening on port ${PORT}`);
  console.log(`  Backend API: http://localhost:${PORT}/api`);
  console.log(`  Frontend: http://localhost:${PORT}`);
});

export default app;
