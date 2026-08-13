# Error Bot — AI Error Analyzer

Paste an error message or stack trace and get an instant root-cause analysis with concrete fix steps, powered by a local LLM via [Ollama](https://ollama.com).

Supports Python, JavaScript, TypeScript, Java, Ruby, Go, C#, PHP, and Rust errors with framework-specific detection (Django, React, Spring, Rails, Laravel, and more).

---

## Prerequisites

| Requirement | Minimum Version |
|---|---|
| **Node.js** | 20+ |
| **npm** | 10+ |
| **Ollama** | Latest |

### Installing Ollama

Download and install Ollama from the official site:

**https://ollama.com/download**

- **macOS:** Download the `.dmg` or install via Homebrew: `brew install ollama`
- **Linux:** `curl -fsSL https://ollama.com/install.sh | sh`
- **Windows:** Download the installer from the link above

After installation, verify Ollama is running:

```bash
ollama --version
curl http://localhost:11434/api/tags   # should return JSON
```

### Pull Required Models

Error Bot uses three models. Pull them before first use:

```bash
ollama pull qwen2.5-coder:3b      # Fast analysis model (~2GB)
ollama pull qwen2.5-coder:7b      # Accurate analysis model (~4.5GB)
ollama pull nomic-embed-text       # Embedding model for RAG (~275MB)
```

Verify all models are available:

```bash
ollama list
```

---

## Quick Start (Development)

```bash
# 1. Clone the repository
git clone <repo-url> error-bot
cd error-bot

# 2. Install dependencies
npm install

# 3. Build the vector index (one-time, uses the shipped doc corpus)
npm run dev:backend &
sleep 2
curl -X POST http://localhost:3001/index/rebuild
kill %1

# 4. Start both frontend and backend
npm run dev:all
```

Open http://localhost:5173 in your browser.

---

## Production Deployment

### 1. Install and build

```bash
npm install
npm run build:prod
```

This produces:
- `dist/` — optimized static frontend bundle (served by Fastify)
- Backend runs directly from TypeScript via `tsx`

### 2. Configure environment

Copy the example and edit as needed:

```bash
cp .env.example .env
```

Key production settings:

```env
PORT=3001
HOST=0.0.0.0
OLLAMA_BASE_URL=http://localhost:11434
DATA_DIR=/var/lib/error-bot/data
VITE_API_BASE_URL=
```

| Variable | Description | Default |
|---|---|---|
| `PORT` | API server port | `3001` |
| `HOST` | Bind address (`0.0.0.0` for external access) | `127.0.0.1` |
| `OLLAMA_BASE_URL` | Ollama API endpoint | `http://localhost:11434` |
| `DATA_DIR` | Directory for SQLite DB, chunks.json, and docs | `./backend/data` |
| `CORS_ORIGIN` | CORS origin (only needed for split deployments) | `http://localhost:5173` |
| `VITE_API_BASE_URL` | Baked into frontend at build time. Empty = same-origin | `http://localhost:3001` |

### 3. Initialize the data directory

If you set a custom `DATA_DIR`, copy the shipped corpus there:

```bash
mkdir -p /var/lib/error-bot/data
cp backend/data/chunks.json /var/lib/error-bot/data/
cp -r backend/data/docs /var/lib/error-bot/data/
```

### 4. Start the server

```bash
npm start
```

The server will:
- Serve the API on the configured port
- Serve the frontend static bundle from `dist/`
- Handle SPA routing (all non-API routes serve `index.html`)

### 5. Build the vector index

On first run (or after adding new docs), rebuild the index:

```bash
curl -X POST http://localhost:3001/index/rebuild
```

### 6. Verify

```bash
curl http://localhost:3001/status
```

Expected: `{"ok": true, "ollamaReachable": true, "models": [...]}`

---

## Deploying Frontend Separately

If you prefer to serve the frontend from a CDN or separate web server:

1. Build with your API URL:
   ```bash
   VITE_API_BASE_URL=https://api.yourdomain.com npm run build
   ```

2. Deploy the `dist/` folder to your static hosting (Vercel, Netlify, S3, nginx, etc.)

3. Set `CORS_ORIGIN=https://yourdomain.com` on the backend

---

## Project Structure

```
error-bot/
├── backend/
│   ├── src/
│   │   ├── server.ts        # Fastify server (API + static serving)
│   │   ├── analyze.ts       # Analysis orchestrator
│   │   ├── detect.ts        # Heuristic language/framework detector
│   │   ├── classify.ts      # LLM fallback classifier
│   │   ├── ollama.ts        # Ollama API client
│   │   ├── prompt.ts        # System prompts
│   │   ├── history.ts       # Analysis history CRUD
│   │   └── rag/             # RAG pipeline (embed, retrieve, index)
│   └── data/
│       ├── chunks.json      # Pre-chunked documentation corpus
│       └── docs/            # Scraped documentation sources
├── src/                     # React frontend
├── shared/
│   ├── schema.ts            # Zod schemas (API contract)
│   └── types.ts             # Shared TypeScript types
├── dist/                    # Production frontend build (gitignored)
├── .env.example             # Environment variable reference
└── TESTING.md               # Test plan and monitoring guide
```

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/status` | Health check (Ollama + models) |
| `POST` | `/analyze` | Analyze an error/stack trace |
| `GET` | `/history` | Paginated analysis history |
| `GET` | `/history/:id` | Single history item |
| `DELETE` | `/history/:id` | Delete history item |
| `DELETE` | `/history` | Clear all history |
| `POST` | `/index/rebuild` | Rebuild the RAG vector index |

---

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Start Vite frontend dev server |
| `npm run dev:backend` | Start backend with hot reload |
| `npm run dev:all` | Start both frontend and backend |
| `npm run build` | Build frontend (dev, points to localhost:3001) |
| `npm run build:prod` | Build frontend (production, same-origin) |
| `npm start` | Start production server |
| `npm test` | Run all tests (unit + integration) |
| `SKIP_INTEGRATION=1 npm test` | Run only unit tests (no Ollama needed) |

---

## Testing

See [TESTING.md](./TESTING.md) for the full test plan including:
- 122 automated tests (unit + integration)
- Manual test plan for clean machines
- Failure-path test procedures
- Memory/CPU monitoring guide

---

## Tech Stack

- **Frontend:** React 19, Zustand, TanStack Query, Vite
- **Backend:** Fastify, better-sqlite3, sqlite-vec
- **AI:** Ollama (local), Qwen 2.5 Coder models
- **RAG:** nomic-embed-text embeddings, vector similarity search
- **Validation:** Zod schemas shared between frontend and backend

---

## License

Private — not published.
