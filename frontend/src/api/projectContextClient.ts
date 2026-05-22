import axios, { AxiosInstance } from 'axios';

export interface GraphStatus {
  graphifyAvailable: boolean;
  graphifyVersion?: string;
  graphExists: boolean;
  nodeCount?: number;
  edgeCount?: number;
  generatedAt?: string;
  isStale?: boolean;
  graphJsonPath?: string;
  reportPath?: string;
  error?: string;
}

export interface BuildResult {
  success: boolean;
  workspacePath: string;
  duration: number;
  graphJsonPath?: string;
  reportPath?: string;
  stdoutLines: string[];
  stderrLines: string[];
  error?: string;
}

export interface QueryResult {
  success: boolean;
  query: string;
  results: Array<{
    type: string;
    label: string;
    context?: string;
    confidence?: number;
  }>;
  limitations?: string[];
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

class ProjectContextClient {
  private client: AxiosInstance;

  constructor(baseURL: string = '/api/project-context') {
    this.client = axios.create({
      baseURL,
      timeout: 120000, // 2 minutes for graph builds
    });
  }

  async getGraphStatus(workspace: string): Promise<GraphStatus> {
    try {
      const response = await this.client.get<ApiResponse<GraphStatus>>('/graphify/status', {
        params: { workspace },
      });

      if (response.data.success && response.data.data) {
        return response.data.data;
      } else {
        throw new Error(response.data.error || 'Failed to get graph status');
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(error.response?.data?.error || error.message);
      }
      throw error;
    }
  }

  async buildGraph(workspace: string): Promise<BuildResult> {
    try {
      const response = await this.client.post<ApiResponse<BuildResult>>('/graphify/build', {
        workspace,
      });

      if (response.data.success && response.data.data) {
        return response.data.data;
      } else {
        throw new Error(response.data.error || 'Failed to build graph');
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(error.response?.data?.error || error.message);
      }
      throw error;
    }
  }

  async queryGraph(workspace: string, query: string, maxResults: number = 10): Promise<QueryResult> {
    try {
      const response = await this.client.post<ApiResponse<QueryResult>>('/graphify/query', {
        workspace,
        query,
        maxResults,
      });

      if (response.data.success && response.data.data) {
        return response.data.data;
      } else {
        throw new Error(response.data.error || 'Failed to query graph');
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(error.response?.data?.error || error.message);
      }
      throw error;
    }
  }
}

export default new ProjectContextClient();
