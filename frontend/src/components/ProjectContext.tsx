import React, { useState, useEffect, useCallback } from 'react';
import projectContextClient, { GraphStatus, QueryResult } from '../api/projectContextClient';
import './ProjectContext.css';

interface ProjectContextProps {
  workspace: string;
}

export const ProjectContext: React.FC<ProjectContextProps> = ({ workspace }) => {
  const [graphStatus, setGraphStatus] = useState<GraphStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [buildProgress, setBuildProgress] = useState(false);
  const [queryInput, setQueryInput] = useState('');
  const [queryResults, setQueryResults] = useState<QueryResult | null>(null);
  const [queryLoading, setQueryLoading] = useState(false);

  // Fetch graph status on mount and when workspace changes
  const refreshStatus = useCallback(async () => {
    if (!workspace) {
      setError('No workspace selected');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const status = await projectContextClient.getGraphStatus(workspace);
      setGraphStatus(status);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch status');
      setGraphStatus(null);
    } finally {
      setLoading(false);
    }
  }, [workspace]);

  useEffect(() => {
    refreshStatus();
  }, [workspace, refreshStatus]);

  const handleBuildGraph = useCallback(async () => {
    if (!workspace) {
      setError('No workspace selected');
      return;
    }

    try {
      setBuildProgress(true);
      setError(null);
      const result = await projectContextClient.buildGraph(workspace);

      if (result.success) {
        // Refresh status after successful build
        await refreshStatus();
      } else {
        setError(result.error || 'Build failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to build graph');
    } finally {
      setBuildProgress(false);
    }
  }, [workspace, refreshStatus]);

  const handleQuery = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace || !queryInput.trim()) {
      return;
    }

    try {
      setQueryLoading(true);
      setError(null);
      const result = await projectContextClient.queryGraph(workspace, queryInput);
      setQueryResults(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Query failed');
    } finally {
      setQueryLoading(false);
    }
  }, [workspace, queryInput]);

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const getGraphAgeText = (dateString?: string): string => {
    if (!dateString) return 'Unknown age';
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  if (loading && !graphStatus) {
    return (
      <div className="project-context">
        <div className="loading-spinner"></div>
        <p>Loading graph status...</p>
      </div>
    );
  }

  return (
    <div className="project-context">
      <div className="status-card">
        <h2>Project Graph Context</h2>

        {error && (
          <div className="error-message">
            <span className="error-icon">⚠️</span>
            {error}
          </div>
        )}

        <div className="status-info">
          <div className="status-row">
            <span className="label">Graphify:</span>
            <span className="value">
              {graphStatus?.graphifyAvailable ? (
                <>
                  <span className="status-badge available">✓ Available</span>
                  {graphStatus.graphifyVersion && (
                    <span className="version">(v{graphStatus.graphifyVersion})</span>
                  )}
                </>
              ) : (
                <span className="status-badge unavailable">✗ Not installed</span>
              )}
            </span>
          </div>

          <div className="status-row">
            <span className="label">Graph:</span>
            <span className="value">
              {graphStatus?.graphExists ? (
                <span className="status-badge exists">✓ Exists</span>
              ) : (
                <span className="status-badge missing">✗ Not built</span>
              )}
            </span>
          </div>

          {graphStatus?.graphExists && (
            <>
              <div className="status-row">
                <span className="label">Size:</span>
                <span className="value">
                  {graphStatus.nodeCount !== undefined && graphStatus.edgeCount !== undefined
                    ? `${graphStatus.nodeCount} nodes, ${graphStatus.edgeCount} edges`
                    : 'Unknown'}
                </span>
              </div>

              <div className="status-row">
                <span className="label">Freshness:</span>
                <span className="value">
                  {graphStatus.isStale ? (
                    <span className="status-badge stale">⟳ Stale</span>
                  ) : (
                    <span className="status-badge fresh">✓ Fresh</span>
                  )}
                </span>
              </div>

              <div className="status-row">
                <span className="label">Generated:</span>
                <span className="value">
                  {getGraphAgeText(graphStatus.generatedAt)}
                  <span className="timestamp" title={formatDate(graphStatus.generatedAt)}>
                    ({formatDate(graphStatus.generatedAt)})
                  </span>
                </span>
              </div>
            </>
          )}
        </div>

        <div className="actions">
          <button
            className="btn btn-primary"
            onClick={handleBuildGraph}
            disabled={buildProgress}
          >
            {buildProgress ? (
              <>
                <span className="spinner-small"></span>
                Building...
              </>
            ) : graphStatus?.graphExists ? (
              'Update Project Graph'
            ) : (
              'Build Project Graph'
            )}
          </button>

          <button
            className="btn btn-secondary"
            onClick={refreshStatus}
            disabled={loading}
          >
            Refresh Status
          </button>
        </div>

        {graphStatus?.graphExists && (
          <form onSubmit={handleQuery} className="query-form">
            <input
              type="text"
              placeholder="Ask project graph... (e.g., 'where is auth handled')"
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              disabled={queryLoading}
            />
            <button
              type="submit"
              className="btn btn-icon"
              disabled={queryLoading || !queryInput.trim()}
              title="Query the project graph"
            >
              {queryLoading ? '⟳' : '→'}
            </button>
          </form>
        )}

        {queryResults && (
          <div className="query-results">
            <h3>Query Results</h3>
            {queryResults.success && queryResults.results.length > 0 ? (
              <ul className="results-list">
                {queryResults.results.map((result, idx) => (
                  <li key={idx} className="result-item">
                    <span className="result-type">{result.type}</span>
                    <span className="result-label">{result.label}</span>
                    {result.context && (
                      <span className="result-context">{result.context}</span>
                    )}
                    {result.confidence !== undefined && (
                      <span className="result-confidence">
                        {Math.round(result.confidence * 100)}%
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="no-results">
                {queryResults.limitations?.[0] || 'No results found'}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectContext;
