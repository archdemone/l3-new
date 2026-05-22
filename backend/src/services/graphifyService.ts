import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execFileAsync = promisify(execFile);
import {
  GraphifyStatus,
  GraphifyBuildResult,
  GraphMetadata,
  GraphQueryResult,
  QueryOptions,
  GraphJSON,
} from '../types/graphify';

const GRAPHIFY_OUT_DIR = 'graphify-out';
const GRAPH_JSON_FILE = 'graph.json';
const GRAPH_REPORT_FILE = 'GRAPH_REPORT.md';
const BUILD_TIMEOUT_MS = 60000;

function validateWorkspacePath(workspacePath: string): { valid: boolean; error?: string } {
  if (!workspacePath) {
    return { valid: false, error: 'Workspace path is required' };
  }

  try {
    // Resolve to absolute path
    const absPath = path.resolve(workspacePath);

    // Ensure path does not escape via traversal
    if (!absPath.startsWith(path.resolve('/'))) {
      return { valid: false, error: 'Invalid workspace path' };
    }

    // Check if path exists and is a directory
    const stat = fs.statSync(absPath);
    if (!stat.isDirectory()) {
      return { valid: false, error: 'Workspace path must be a directory' };
    }

    return { valid: true };
  } catch (err) {
    return { valid: false, error: `Path validation failed: ${String(err)}` };
  }
}

export async function checkGraphifyAvailable(): Promise<GraphifyStatus> {
  try {
    const { stdout } = await execFileAsync('graphify', ['--help'], {
      encoding: 'utf-8',
      timeout: 5000,
      shell: false,
    });

    if (stdout) {
      const versionMatch = stdout.match(/graphify version ([^\s]+)/i);
      const version = versionMatch ? versionMatch[1] : 'unknown';

      return {
        available: true,
        version,
        helpSnippet: stdout.split('\n').slice(0, 5).join('\n'),
      };
    } else {
      return {
        available: false,
        error: 'Graphify command returned no output',
      };
    }
  } catch (err) {
    return {
      available: false,
      error: `Graphify check failed: ${String(err)}`,
    };
  }
}

export async function buildGraphifyGraph(
  workspacePath: string,
  options?: { timeout?: number }
): Promise<GraphifyBuildResult> {
  const validation = validateWorkspacePath(workspacePath);
  if (!validation.valid) {
    return {
      success: false,
      workspacePath,
      duration: 0,
      stdoutLines: [],
      stderrLines: [],
      error: validation.error,
    };
  }

  const timeout = options?.timeout ?? BUILD_TIMEOUT_MS;
  const startTime = Date.now();
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  try {
    // Check if Graphify is available first
    const graphifyStatus = await checkGraphifyAvailable();
    if (!graphifyStatus.available) {
      const duration = Date.now() - startTime;
      return {
        success: false,
        workspacePath,
        duration,
        stdoutLines,
        stderrLines,
        error: graphifyStatus.error || 'Graphify not available',
      };
    }

    // Run graphify update in the workspace directory
    // Use execFile with argument array for safety (no shell interpolation)
    // Workspace path is passed via cwd, never interpolated into command
    try {
      const { stdout, stderr } = await execFileAsync('graphify', ['update', '.'], {
        cwd: workspacePath,
        encoding: 'utf-8',
        timeout,
        shell: false,
        maxBuffer: 1024 * 1024, // 1MB buffer for large outputs
      });

      if (stdout) {
        stdoutLines.push(...stdout.split('\n').filter(l => l.trim()));
      }
      if (stderr) {
        stderrLines.push(...stderr.split('\n').filter(l => l.trim()));
      }
    } catch (err: any) {
      const stderr = err.stderr || err.message || '';
      if (stderr) {
        stderrLines.push(...stderr.split('\n').filter((l: string) => l.trim()));
      }
    }

    // Check if graph output was created
    const graphJsonPath = path.join(workspacePath, GRAPHIFY_OUT_DIR, GRAPH_JSON_FILE);
    const reportPath = path.join(workspacePath, GRAPHIFY_OUT_DIR, GRAPH_REPORT_FILE);
    const graphJsonExists = fs.existsSync(graphJsonPath);
    const reportExists = fs.existsSync(reportPath);

    const duration = Date.now() - startTime;

    if (graphJsonExists || reportExists) {
      return {
        success: true,
        workspacePath,
        duration,
        stdoutLines,
        stderrLines,
        graphJsonPath: graphJsonExists ? graphJsonPath : undefined,
        reportPath: reportExists ? reportPath : undefined,
      };
    } else {
      return {
        success: false,
        workspacePath,
        duration,
        stdoutLines,
        stderrLines,
        error: 'Graphify build completed but no output files found',
      };
    }
  } catch (err) {
    const duration = Date.now() - startTime;
    return {
      success: false,
      workspacePath,
      duration,
      stdoutLines,
      stderrLines,
      error: `Build failed: ${String(err)}`,
    };
  }
}

export async function readGraphifyStatus(workspacePath: string): Promise<GraphMetadata> {
  const validation = validateWorkspacePath(workspacePath);
  if (!validation.valid) {
    return {
      graphExists: false,
      error: validation.error,
    };
  }

  const graphJsonPath = path.join(workspacePath, GRAPHIFY_OUT_DIR, GRAPH_JSON_FILE);
  const reportPath = path.join(workspacePath, GRAPHIFY_OUT_DIR, GRAPH_REPORT_FILE);

  try {
    const graphJsonExists = fs.existsSync(graphJsonPath);
    const reportExists = fs.existsSync(reportPath);

    if (!graphJsonExists && !reportExists) {
      return { graphExists: false };
    }

    let nodeCount: number | undefined;
    let edgeCount: number | undefined;
    let generatedAt: string | undefined;
    let isStale: boolean | undefined;

    if (graphJsonExists) {
      const graphData: GraphJSON = JSON.parse(fs.readFileSync(graphJsonPath, 'utf-8'));
      nodeCount = graphData.nodes?.length ?? 0;
      edgeCount = graphData.edges?.length ?? 0;

      // Check if graph is stale (source files newer than graph)
      const graphStat = fs.statSync(graphJsonPath);
      const graphTime = graphStat.mtime.getTime();
      generatedAt = graphStat.mtime.toISOString();

      // Simple stale detection: check common source file extensions in workspace
      try {
        const sourceExts = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java'];
        const checkForNewerFiles = (dir: string, maxDepth = 3): boolean => {
          if (maxDepth === 0) return false;
          try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
              if (entry.name.startsWith('.')) continue;
              const fullPath = path.join(dir, entry.name);
              if (entry.isDirectory()) {
                if (checkForNewerFiles(fullPath, maxDepth - 1)) return true;
              } else if (sourceExts.some(ext => entry.name.endsWith(ext))) {
                const fileStat = fs.statSync(fullPath);
                if (fileStat.mtime.getTime() > graphTime) {
                  return true;
                }
              }
            }
          } catch {
            // Ignore errors during stale detection
          }
          return false;
        };

        isStale = checkForNewerFiles(workspacePath);
      } catch {
        isStale = undefined;
      }
    }

    return {
      graphExists: true,
      nodeCount,
      edgeCount,
      generatedAt,
      isStale,
      graphJsonPath: graphJsonExists ? graphJsonPath : undefined,
      reportPath: reportExists ? reportPath : undefined,
    };
  } catch (err) {
    return {
      graphExists: false,
      error: `Status check failed: ${String(err)}`,
    };
  }
}

export async function queryGraphifyContext(
  workspacePath: string,
  query: string,
  options?: QueryOptions
): Promise<GraphQueryResult> {
  const validation = validateWorkspacePath(workspacePath);
  if (!validation.valid) {
    return {
      success: false,
      query,
      results: [],
      limitations: [validation.error || 'Invalid workspace path'],
    };
  }

  const maxResults = options?.maxResults ?? 10;

  // First, try to use Graphify query command if available
  // Use execFile with argument array for safety (no shell interpolation)
  try {
    const { stdout } = await execFileAsync('graphify', ['query', query], {
      cwd: workspacePath,
      encoding: 'utf-8',
      timeout: 10000,
      shell: false,
      maxBuffer: 1024 * 1024,
    });

    // If successful, parse and return results
    if (stdout) {
      const results = fallbackQuerySearch(workspacePath, query, maxResults);
      if (results.length > 0) {
        return {
          success: true,
          query,
          results,
        };
      }
    }
  } catch {
    // Fall through to fallback search
  }

  // Fallback: search graph.json and GRAPH_REPORT.md locally
  const results = fallbackQuerySearch(workspacePath, query, maxResults);

  return {
    success: results.length > 0,
    query,
    results,
    limitations: results.length === 0
      ? ['No matching context found in project graph']
      : undefined,
  };
}

function fallbackQuerySearch(
  workspacePath: string,
  query: string,
  maxResults: number
): Array<{ type: any; label: string; context?: string; confidence?: number }> {
  const results: Array<{ type: any; label: string; context?: string; confidence?: number }> = [];
  const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 0);

  const graphJsonPath = path.join(workspacePath, GRAPHIFY_OUT_DIR, GRAPH_JSON_FILE);
  const reportPath = path.join(workspacePath, GRAPHIFY_OUT_DIR, GRAPH_REPORT_FILE);

  try {
    // Search graph.json
    if (fs.existsSync(graphJsonPath)) {
      const graphData: GraphJSON = JSON.parse(fs.readFileSync(graphJsonPath, 'utf-8'));

      // Search nodes
      if (graphData.nodes) {
        for (const node of graphData.nodes) {
          if (results.length >= maxResults) break;

          const nodeLabel = (node.label || node.id || '').toLowerCase();
          const nodeFile = (node.file || '').toLowerCase();
          const matchCount = queryTerms.filter(
            t => nodeLabel.includes(t) || nodeFile.includes(t)
          ).length;

          if (matchCount > 0) {
            results.push({
              type: 'symbol',
              label: node.label || node.id || 'unknown',
              context: node.file || undefined,
              confidence: Math.min(matchCount / queryTerms.length, 1),
            });
          }
        }
      }
    }

    // Search GRAPH_REPORT.md
    if (fs.existsSync(reportPath) && results.length < maxResults) {
      const reportContent = fs.readFileSync(reportPath, 'utf-8');
      const lines = reportContent.split('\n');
      let currentContext = '';

      for (const line of lines) {
        if (results.length >= maxResults) break;

        if (line.trim().length === 0) {
          currentContext = '';
          continue;
        }

        const lineLower = line.toLowerCase();
        const matchCount = queryTerms.filter(t => lineLower.includes(t)).length;

        if (matchCount > 0) {
          // Extract context: filename or section header
          if (line.startsWith('#')) {
            currentContext = line.replace(/^#+\s+/, '').trim();
          }

          if (!results.some(r => r.label === line.trim())) {
            results.push({
              type: 'concept',
              label: line.trim().substring(0, 100),
              context: currentContext || undefined,
              confidence: Math.min(matchCount / queryTerms.length, 1),
            });
          }
        }
      }
    }
  } catch (err) {
    // Ignore parse errors
  }

  return results;
}
