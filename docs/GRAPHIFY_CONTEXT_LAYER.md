# Graphify Context Layer for L3 Studio

## Overview

The Graphify Context Layer is a backend service that enables L3 Studio to understand project structure and relationships by integrating with [Graphify](https://github.com/codemod-com/graphify).

**What it does:**
- Detects whether Graphify is installed on your system
- Builds a knowledge graph of your project repository
- Reads and caches graph metadata (`graph.json`, `GRAPH_REPORT.md`)
- Queries the graph to find relevant files, symbols, and relationships
- Falls back to local search if Graphify CLI query is unavailable

**Key features:**
- **Optional**: The app works fine without Graphify installed
- **Safe**: Strong path validation prevents directory traversal attacks
- **Fast**: Fallback search over graph JSON and Markdown reports
- **Extensible**: Backend API ready for future UI and agent integration

---

## Installation

### Prerequisites
- Python 3.7+ (Graphify is a Python package)
- L3 Studio backend (this repository)

### Install Graphify

Choose your installation method:

#### Option 1: `uv` (Recommended)
```bash
uv tool install graphifyy
```

#### Option 2: `pipx`
```bash
pipx install graphifyy
```

#### Option 3: `pip`
```bash
pip install graphifyy
```

#### Verify Installation
```bash
graphify --help
```

You should see Graphify's help output. If the command is not found, check your PATH.

---

## Building the Project Graph

### From the Backend API

Use the HTTP POST endpoint:

```bash
curl -X POST http://localhost:3000/api/project-context/graphify/build \
  -H "Content-Type: application/json" \
  -d '{ "workspace": "/path/to/your/project" }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "workspacePath": "/path/to/your/project",
    "duration": 5234,
    "graphJsonPath": "/path/to/your/project/graphify-out/graph.json",
    "reportPath": "/path/to/your/project/graphify-out/GRAPH_REPORT.md",
    "stdoutLines": ["Building graph...", "Done!"],
    "stderrLines": []
  }
}
```

### From the Command Line

You can also run Graphify directly in your project:

```bash
cd /path/to/your/project
graphify .
```

This creates:
- `graphify-out/graph.json` — Knowledge graph in JSON format
- `graphify-out/GRAPH_REPORT.md` — Human-readable graph report
- `graphify-out/graph.html` — Interactive visualization (optional)

---

## API Endpoints

### 1. Get Graph Status
**GET** `/api/project-context/graphify/status?workspace=<path>`

Returns the current status of the project graph and Graphify availability.

**Response:**
```json
{
  "success": true,
  "data": {
    "graphifyAvailable": true,
    "graphifyVersion": "0.1.0",
    "graphExists": true,
    "nodeCount": 42,
    "edgeCount": 78,
    "generatedAt": "2026-05-22T10:30:00.000Z",
    "isStale": false,
    "graphJsonPath": "/path/to/workspace/graphify-out/graph.json",
    "reportPath": "/path/to/workspace/graphify-out/GRAPH_REPORT.md"
  }
}
```

### 2. Build Graph
**POST** `/api/project-context/graphify/build`

Builds a new project graph for the specified workspace.

**Request:**
```json
{
  "workspace": "/path/to/your/project"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "workspacePath": "/path/to/your/project",
    "duration": 5234,
    "graphJsonPath": "...",
    "reportPath": "...",
    "stdoutLines": ["..."],
    "stderrLines": []
  }
}
```

### 3. Query Graph Context
**POST** `/api/project-context/graphify/query`

Queries the project graph for context relevant to a question.

**Request:**
```json
{
  "workspace": "/path/to/your/project",
  "query": "where is login handled",
  "maxResults": 10
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "query": "where is login handled",
    "results": [
      {
        "type": "symbol",
        "label": "loginController",
        "context": "src/auth/loginController.ts",
        "confidence": 0.95
      },
      {
        "type": "symbol",
        "label": "authService",
        "context": "src/auth/authService.ts",
        "confidence": 0.85
      }
    ],
    "limitations": null
  }
}
```

---

## Testing

### Run Unit Tests

```bash
npm test
```

Tests cover:
- Graphify availability detection
- Graph building with path validation
- Graph status reading (including stale detection)
- Query and fallback search over sample graphs

### Run Smoke Test

```bash
npm run test:smoke
```

The smoke test:
1. Creates a temporary fixture repository with realistic files
2. Builds a Graphify graph (if Graphify is installed)
3. Tests status reading
4. Tests query functionality
5. Prints `GRAPHIFY_CONTEXT_LAYER_SMOKE_PASS` on success

**If Graphify is not installed**, the test prints:
```
GRAPHIFY_CONTEXT_LAYER_SMOKE_SKIPPED_GRAPHIFY_NOT_INSTALLED
```

This is expected and not a failure. The backend gracefully handles missing Graphify.

---

## Graph Format

### graph.json
Structure:
```json
{
  "nodes": [
    { "id": "node_1", "label": "loginController", "file": "src/auth/loginController.ts", ... },
    { "id": "node_2", "label": "authService", "file": "src/auth/authService.ts", ... }
  ],
  "edges": [
    { "source": "node_1", "target": "node_2", "type": "imports", ... }
  ]
}
```

Each node represents a file, class, function, or concept.
Each edge represents a relationship (imports, uses, calls, etc.).

### GRAPH_REPORT.md
Human-readable Markdown summary including:
- Project overview
- Key modules and relationships
- Entry points and important symbols
- Architecture patterns

---

## Configuration

### Environment Variables
Currently, no environment variables are required. Future versions may support:
- `GRAPHIFY_COMMAND` — Custom Graphify command path
- `GRAPHIFY_TIMEOUT` — Build timeout in milliseconds

### Backend Configuration
The service can be configured at runtime via API options:
- `maxResults` — Limit query results (default: 10)
- `timeout` — Build timeout in milliseconds (default: 60000)

---

## Roadmap: v1.5 and Beyond

### v1.5 (Next)
- [ ] Frontend UI component for Graph Status and Build
- [ ] Agent/runtime context injection
- [ ] Timeline events for graph builds and queries
- [ ] Query result caching

### v2.0
- [ ] Interactive graph visualization
- [ ] Graph updates on file changes
- [ ] Symbol search and navigation
- [ ] Dependency analysis and warnings

### v3.0+
- [ ] Multi-workspace graph federation
- [ ] Graph-powered code refactoring suggestions
- [ ] Custom graph traversal queries
- [ ] Integration with LSP for editor support

---

## Known Limitations

1. **Graphify must be installed separately** — The Graphify Python package is not included with L3 Studio. Install it via `uv`, `pipx`, or `pip`.

2. **Graph builds take time** — First build can take 10–60 seconds depending on project size.

3. **Stale detection is heuristic** — The service uses simple modification time checks; it may not catch all changes.

4. **Query falls back to local search** — If Graphify CLI doesn't expose a query command, results are limited to text search.

5. **Large graphs may be slow** — Fallback search over 10,000+ nodes is slower than native Graphify query.

6. **No real-time updates** — Graphs must be manually rebuilt; file changes don't auto-update the graph.

---

## Troubleshooting

### "Graphify command not found"
**Solution:** Install Graphify with `uv tool install graphifyy` or similar, and ensure it's in your PATH.

### "Graph build timed out"
**Solution:** Large projects may need more time. Try increasing the timeout via the API:
```json
{ "workspace": "...", "timeout": 120000 }
```

### "graph.json exists but query returns no results"
**Solution:** The fallback search is text-based. Try more specific queries or check the `GRAPH_REPORT.md` for available symbols.

### "path traversal error"
**Solution:** Ensure your workspace path is an absolute path and does not contain `..` or symlinks pointing outside.

---

## Contributing

To extend the Graphify Context Layer:

1. **Add new query types** in `queryGraphifyContext()` to support different question styles
2. **Enhance stale detection** to watch for specific file types or patterns
3. **Implement caching** to speed up repeated queries
4. **Add graph visualization** in v1.5 frontend

See the service and tests for extension points.

---

## License

L3 Studio is MIT licensed. Graphify has its own license (typically MIT or similar).
