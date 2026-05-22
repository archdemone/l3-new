import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  checkGraphifyAvailable,
  buildGraphifyGraph,
  readGraphifyStatus,
  queryGraphifyContext,
} from '../src/services/graphifyService';

describe('GraphifyService', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'graphify-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  describe('checkGraphifyAvailable', () => {
    it('should return available status (result may vary by system)', async () => {
      const status = await checkGraphifyAvailable();
      expect(status).toHaveProperty('available');
      expect(typeof status.available).toBe('boolean');
    });

    it('should handle unavailable graphify gracefully', async () => {
      const status = await checkGraphifyAvailable();
      // If graphify is not installed, this should not throw
      expect(status.available === false || status.available === true).toBe(true);
    });
  });

  describe('buildGraphifyGraph', () => {
    it('should return error for invalid workspace path', async () => {
      const result = await buildGraphifyGraph('/nonexistent/path/12345');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle empty workspace gracefully', async () => {
      // Create an empty directory
      const emptyDir = fs.mkdtempSync(path.join(tempDir, 'empty-'));
      const result = await buildGraphifyGraph(emptyDir);
      // Result depends on whether graphify is installed
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('workspacePath');
      expect(result).toHaveProperty('duration');
    });

    it('should accept valid workspace path and handle missing graphify', async () => {
      const result = await buildGraphifyGraph(tempDir);
      // Should not crash, but may fail if graphify is not installed
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('stdoutLines');
      expect(result).toHaveProperty('stderrLines');
    });

    it('should respect timeout option', async () => {
      const result = await buildGraphifyGraph(tempDir, { timeout: 1000 });
      expect(result).toHaveProperty('duration');
      expect(result.duration).toBeLessThanOrEqual(2000); // Allow some margin
    });
  });

  describe('readGraphifyStatus', () => {
    it('should return graphExists false for empty workspace', async () => {
      const status = await readGraphifyStatus(tempDir);
      expect(status.graphExists).toBe(false);
    });

    it('should return error for invalid workspace path', async () => {
      const status = await readGraphifyStatus('/nonexistent/path/12345');
      expect(status.graphExists).toBe(false);
      expect(status.error).toBeDefined();
    });

    it('should detect existing graph.json file', async () => {
      const outDir = path.join(tempDir, 'graphify-out');
      fs.mkdirSync(outDir, { recursive: true });

      const graphJson = {
        nodes: [
          { id: 'node1', label: 'File1', file: 'src/index.ts' },
          { id: 'node2', label: 'File2', file: 'src/utils.ts' },
        ],
        edges: [{ source: 'node1', target: 'node2', type: 'imports' }],
      };

      fs.writeFileSync(
        path.join(outDir, 'graph.json'),
        JSON.stringify(graphJson)
      );

      const status = await readGraphifyStatus(tempDir);
      expect(status.graphExists).toBe(true);
      expect(status.nodeCount).toBe(2);
      expect(status.edgeCount).toBe(1);
      expect(status.generatedAt).toBeDefined();
    });

    it('should detect existing GRAPH_REPORT.md file', async () => {
      const outDir = path.join(tempDir, 'graphify-out');
      fs.mkdirSync(outDir, { recursive: true });

      fs.writeFileSync(
        path.join(outDir, 'GRAPH_REPORT.md'),
        '# Project Graph\n\n## Summary\nProject has 5 nodes and 3 edges.'
      );

      const status = await readGraphifyStatus(tempDir);
      expect(status.graphExists).toBe(true);
    });

    it('should handle malformed graph.json gracefully', async () => {
      const outDir = path.join(tempDir, 'graphify-out');
      fs.mkdirSync(outDir, { recursive: true });

      fs.writeFileSync(
        path.join(outDir, 'graph.json'),
        'not valid json {'
      );

      // Should not throw
      expect(() => {
        readGraphifyStatus(tempDir);
      }).not.toThrow();
    });
  });

  describe('queryGraphifyContext', () => {
    it('should return error for invalid workspace path', async () => {
      const result = await queryGraphifyContext('/nonexistent/path/12345', 'test');
      expect(result.success).toBe(false);
      expect(result.limitations).toBeDefined();
    });

    it('should search graph.json for matching nodes', async () => {
      const outDir = path.join(tempDir, 'graphify-out');
      fs.mkdirSync(outDir, { recursive: true });

      const graphJson = {
        nodes: [
          { id: 'auth1', label: 'loginController', file: 'src/auth/loginController.ts' },
          { id: 'auth2', label: 'authService', file: 'src/auth/authService.ts' },
          { id: 'billing1', label: 'paymentService', file: 'src/billing/paymentService.ts' },
        ],
        edges: [
          { source: 'auth1', target: 'auth2', type: 'imports' },
          { source: 'auth2', target: 'auth1', type: 'uses' },
        ],
      };

      fs.writeFileSync(
        path.join(outDir, 'graph.json'),
        JSON.stringify(graphJson)
      );

      const result = await queryGraphifyContext(tempDir, 'login', { maxResults: 10 });
      expect(result.success).toBe(true);
      expect(result.results.length).toBeGreaterThan(0);
      const labels = result.results.map(r => r.label.toLowerCase());
      expect(labels.some(l => l.includes('login'))).toBe(true);
    });

    it('should search GRAPH_REPORT.md for matching content', async () => {
      const outDir = path.join(tempDir, 'graphify-out');
      fs.mkdirSync(outDir, { recursive: true });

      const reportContent = `# Project Graph Report

## Authentication Module
The authentication module handles user login and session management.

### Key Files
- src/auth/loginController.ts: Handles HTTP login requests
- src/auth/authService.ts: Core authentication logic
- src/auth/sessionStore.ts: Session storage

## Payment Module
The payment module processes transactions.
`;

      fs.writeFileSync(
        path.join(outDir, 'GRAPH_REPORT.md'),
        reportContent
      );

      const result = await queryGraphifyContext(tempDir, 'login auth', { maxResults: 10 });
      expect(result.results.length).toBeGreaterThan(0);
    });

    it('should return empty results for no matches', async () => {
      const outDir = path.join(tempDir, 'graphify-out');
      fs.mkdirSync(outDir, { recursive: true });

      const graphJson = { nodes: [], edges: [] };
      fs.writeFileSync(
        path.join(outDir, 'graph.json'),
        JSON.stringify(graphJson)
      );

      const result = await queryGraphifyContext(tempDir, 'nonexistent12345xyz', {
        maxResults: 10,
      });
      expect(result.success).toBe(false);
      expect(result.limitations).toBeDefined();
    });

    it('should respect maxResults option', async () => {
      const outDir = path.join(tempDir, 'graphify-out');
      fs.mkdirSync(outDir, { recursive: true });

      const graphJson = {
        nodes: Array.from({ length: 50 }, (_, i) => ({
          id: `node${i}`,
          label: `file${i}`,
          file: `src/file${i}.ts`,
        })),
        edges: [],
      };

      fs.writeFileSync(
        path.join(outDir, 'graph.json'),
        JSON.stringify(graphJson)
      );

      const result = await queryGraphifyContext(tempDir, 'file', { maxResults: 5 });
      expect(result.results.length).toBeLessThanOrEqual(5);
    });

    it('should handle missing graph gracefully', async () => {
      const result = await queryGraphifyContext(tempDir, 'test');
      expect(result.success).toBe(false);
      expect(result.limitations).toBeDefined();
    });
  });
});
