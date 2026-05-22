import { Router, Request, Response } from 'express';
import {
  checkGraphifyAvailable,
  buildGraphifyGraph,
  readGraphifyStatus,
  queryGraphifyContext,
} from '../services/graphifyService';

const router = Router();

interface StatusQuery {
  workspace?: string;
}

interface BuildRequest {
  workspace: string;
}

interface QueryRequest {
  workspace: string;
  query: string;
  maxResults?: number;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// GET /api/project-context/graphify/status
router.get('/graphify/status', async (req: Request<never, never, never, StatusQuery>, res: Response) => {
  const workspace = req.query.workspace;

  if (!workspace || typeof workspace !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'workspace query parameter is required',
    } as ApiResponse<any>);
  }

  try {
    const graphifyStatus = await checkGraphifyAvailable();
    const graphMetadata = await readGraphifyStatus(workspace);

    res.json({
      success: true,
      data: {
        graphifyAvailable: graphifyStatus.available,
        graphifyVersion: graphifyStatus.version,
        graphExists: graphMetadata.graphExists,
        nodeCount: graphMetadata.nodeCount,
        edgeCount: graphMetadata.edgeCount,
        generatedAt: graphMetadata.generatedAt,
        isStale: graphMetadata.isStale,
        graphJsonPath: graphMetadata.graphJsonPath,
        reportPath: graphMetadata.reportPath,
        error: graphMetadata.error,
      },
    } as ApiResponse<any>);
  } catch (err) {
    res.status(500).json({
      success: false,
      error: `Status check failed: ${String(err)}`,
    } as ApiResponse<any>);
  }
});

// POST /api/project-context/graphify/build
router.post('/graphify/build', async (req: Request<never, never, BuildRequest>, res: Response) => {
  const { workspace } = req.body;

  if (!workspace || typeof workspace !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'workspace field is required in request body',
    } as ApiResponse<any>);
  }

  try {
    const result = await buildGraphifyGraph(workspace);

    res.json({
      success: result.success,
      data: {
        workspacePath: result.workspacePath,
        duration: result.duration,
        graphJsonPath: result.graphJsonPath,
        reportPath: result.reportPath,
        stdoutLines: result.stdoutLines,
        stderrLines: result.stderrLines,
        error: result.error,
      },
    } as ApiResponse<any>);
  } catch (err) {
    res.status(500).json({
      success: false,
      error: `Build failed: ${String(err)}`,
    } as ApiResponse<any>);
  }
});

// POST /api/project-context/graphify/query
router.post('/graphify/query', async (req: Request<never, never, QueryRequest>, res: Response) => {
  const { workspace, query, maxResults } = req.body;

  if (!workspace || typeof workspace !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'workspace field is required in request body',
    } as ApiResponse<any>);
  }

  if (!query || typeof query !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'query field is required in request body',
    } as ApiResponse<any>);
  }

  if (maxResults !== undefined && (typeof maxResults !== 'number' || maxResults < 1)) {
    return res.status(400).json({
      success: false,
      error: 'maxResults must be a positive number',
    } as ApiResponse<any>);
  }

  try {
    const result = await queryGraphifyContext(workspace, query, {
      maxResults,
    });

    res.json({
      success: result.success,
      data: {
        query: result.query,
        results: result.results,
        limitations: result.limitations,
      },
    } as ApiResponse<any>);
  } catch (err) {
    res.status(500).json({
      success: false,
      error: `Query failed: ${String(err)}`,
    } as ApiResponse<any>);
  }
});

export default router;
