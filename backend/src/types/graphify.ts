export interface GraphifyStatus {
  available: boolean;
  version?: string;
  helpSnippet?: string;
  error?: string;
}

export interface GraphifyBuildResult {
  success: boolean;
  workspacePath: string;
  duration: number;
  stdoutLines: string[];
  stderrLines: string[];
  graphJsonPath?: string;
  reportPath?: string;
  error?: string;
}

export interface GraphMetadata {
  graphExists: boolean;
  nodeCount?: number;
  edgeCount?: number;
  generatedAt?: string;
  isStale?: boolean;
  graphJsonPath?: string;
  reportPath?: string;
  error?: string;
}

export interface GraphNode {
  id: string;
  type: string;
  label: string;
  file?: string;
  [key: string]: any;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: string;
  [key: string]: any;
}

export interface GraphJSON {
  nodes?: GraphNode[];
  edges?: GraphEdge[];
  [key: string]: any;
}

export interface GraphQueryResult {
  success: boolean;
  query: string;
  results: QueryResultItem[];
  limitations?: string[];
}

export interface QueryResultItem {
  type: 'file' | 'symbol' | 'concept' | 'relationship';
  label: string;
  context?: string;
  confidence?: number;
}

export interface QueryOptions {
  maxResults?: number;
}
