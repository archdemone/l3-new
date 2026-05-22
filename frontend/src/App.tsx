import { useState } from 'react';
import ProjectContext from './components/ProjectContext';
import './App.css';

function App() {
  const [workspace, setWorkspace] = useState('');
  const [workspaceInput, setWorkspaceInput] = useState('');

  const handleSelectWorkspace = () => {
    if (workspaceInput.trim()) {
      setWorkspace(workspaceInput.trim());
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>L3 Studio</h1>
        <p className="subtitle">Graphify-powered Project Context</p>
      </header>

      <main className="app-main">
        <section className="workspace-selector">
          <h2>Select Project Workspace</h2>
          <div className="workspace-input-group">
            <input
              type="text"
              placeholder="Enter workspace path (e.g., /path/to/project)"
              value={workspaceInput}
              onChange={(e) => setWorkspaceInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSelectWorkspace();
                }
              }}
            />
            <button onClick={handleSelectWorkspace} className="btn-select">
              Load
            </button>
          </div>
          {workspace && (
            <div className="workspace-info">
              Current workspace: <code>{workspace}</code>
            </div>
          )}
        </section>

        {workspace ? (
          <section className="project-context-section">
            <ProjectContext workspace={workspace} />
          </section>
        ) : (
          <section className="empty-state">
            <div className="empty-state-content">
              <h3>No Workspace Selected</h3>
              <p>Enter a workspace path above to get started.</p>
              <p>The workspace should be the root directory of your project.</p>
              <details>
                <summary>Example paths</summary>
                <ul>
                  <li>/home/user/my-project</li>
                  <li>C:\Users\user\projects\app</li>
                  <li>~/dev/repo</li>
                </ul>
              </details>
            </div>
          </section>
        )}
      </main>

      <footer className="app-footer">
        <p>L3 Studio v0.1.0 | Graphify Context Layer</p>
      </footer>
    </div>
  );
}

export default App;
