# Error Bot — Phase-by-Phase Build Prompts

One self-contained prompt per phase. Use them in order with your coding agent (e.g. Claude Code) — paste as-is, or tweak wording to match your repo's conventions.

---

## Phase 0 — Environment & Tooling

```
Set up my local dev environment for a new project called "error-bot". Confirm/install Node.js LTS and npm. Confirm Ollama is installed (ollama.com) and `ollama --version` works. Pull these models: qwen2.5-coder:7b, qwen2.5-coder:3b, nomic-embed-text. Verify Ollama is serving locally via `curl http://localhost:11434/api/tags`. Initialize a git repo with a .gitignore covering node_modules, dist, *.db, and .env. Set up ESLint + Prettier config I can reuse across the project.
```

## Phase 1 — Project Scaffold

```
Scaffold a new project called "error-bot" using Vite + React + TypeScript (`npm create vite@latest error-bot -- --template react-ts`). Confirm `npm run dev` runs and opens in the browser. Set up this folder structure: /src for the frontend, /backend for a Fastify server, /shared for types and schemas used by both. Install zustand, @tanstack/react-query, and zod in the frontend. Set up a shared ESLint/Prettier config that applies to both /src and /backend.
```

## Phase 2 — Frontend Skeleton

```
Build the basic frontend layout for error-bot: an input textarea, a submit button, a result panel, and a history sidebar. Create a Zustand store with state for currentInput, currentResult, historyList, and ollamaStatus. Wire the textarea and submit button to update the store (no backend calls yet). Set up a TanStack Query provider at the app root. Build reusable loading, empty, and error state components for use across the app.
```

## Phase 3 — Backend Skeleton (Fastify)

```
Scaffold a Fastify app in /backend for error-bot. Add a POST /analyze route that returns a hardcoded mock AnalyzeResponse. Add a GET /status route that always returns ok for now. Enable CORS for the frontend's local dev origin. Add an npm script (using concurrently or similar) to run the frontend and backend together with one command. Then wire the frontend's submit action to call POST /analyze via TanStack Query and render the mock response end-to-end.
```

## Phase 4 — Ollama Integration

```
Integrate Ollama into the error-bot Fastify backend. Call Ollama's /api/chat endpoint with a simple test prompt to confirm connectivity. Implement GET /status for real: check that Ollama is reachable and that the required models (qwen2.5-coder:7b, qwen2.5-coder:3b, nomic-embed-text) are pulled. Write a system prompt template that instructs the model to return JSON only, matching a defined schema. Define a Zod schema for AnalyzeResponse with fields: language, framework, rootCause, fixSteps, confidence, sources. Parse and validate the LLM's response against that schema, with one automatic retry on validation failure. Add a model picker (7b vs 3b) in settings that's passed through to the Ollama call.
```

## Phase 5 — Language/Framework Detection

```
Build a language/framework detector for error-bot. Write regex/heuristic rules that recognize common stack trace shapes for JS/Node, Python, Java, and other common languages. If heuristics are inconclusive, fall back to asking the LLM to classify the input. Write unit tests for the detector against a sample set of real stack traces covering each supported language.
```

## Phase 6 — RAG Pipeline

```
Build the RAG pipeline for error-bot. Pick initial documentation sources for 2-3 languages/frameworks (e.g. MDN for JS, official Python docs). Write a scraping/export script that pulls those doc pages into clean markdown/text. Write a chunking script that splits the docs into ~300-500 token chunks with overlap. Set up SQLite with sqlite-vec, and create a doc_chunks table with a vector index. Write an indexing script that embeds each chunk via nomic-embed-text and stores it in the vector index; run it and spot-check the resulting embeddings and chunk count. Implement a retrieval function that embeds a query and does top-k similarity search filtered by detected language. Wire retrieved chunks into the LLM prompt as context, and add source citations (title, URL, snippet) to both the response schema and the UI.
```

## Phase 7 — Full Analyze Pipeline (End-to-End)

```
Wire together the full error-bot analyze pipeline: detect language/framework → retrieve relevant doc chunks → build prompt → generate via Ollama → validate against the Zod schema → persist the result → respond to the frontend. Add confidence scoring that comes from the model output but is adjusted down if no relevant sources were found. Handle edge cases: empty input, garbage/non-stack-trace input, and no relevant doc chunks found. Then manually test the pipeline with 10-15 real-world stack traces across the supported languages and report any failures.
```

## Phase 8 — Search History

```
Add search history to error-bot. Create a history table in SQLite. Save each completed analysis (input, result, timestamp) after it passes validation. Build GET /history (paginated, searchable by keyword) and GET /history/:id endpoints. Build a history sidebar in the UI that lists past analyses and lets the user click one to reload its result. Add an action to delete a single history item or clear all history.
```

## Phase 9 — Settings & Status UI

```
Build the settings and status UI for error-bot. Create a settings panel with a model picker (7b vs 3b) and a live "Ollama status" indicator. Add clear UI states for "Ollama not running" and "required model not pulled," each with actionable instructions to fix it. Add a "rebuild doc index" action in settings wired to a POST /index/rebuild endpoint. Add a reconnect/retry UI that appears if the backend server becomes unreachable.
```

## Phase 10 — Polish

```
Do a polish pass on error-bot. Apply a consistent visual style across all screens: input, results, history, and settings. Add keyboard shortcuts (Cmd+Enter to submit, Cmd+K to open history search). Add copy-to-clipboard buttons for fix steps. Add proper empty states and a first-run onboarding flow that clearly explains the Ollama dependency and how to set it up. Do an accessibility pass: visible focus states, sufficient color contrast, and screen-reader labels on interactive elements.
```

## Phase 11 — Testing & QA

```
Write tests for error-bot. Add unit tests for the language/framework detector, the Zod schemas, and the retrieval scoring logic. Add an integration test that runs the full /analyze flow against a real running Ollama instance. Walk me through a manual test plan for a clean machine/user account with no dev environment but Ollama pre-installed. Add explicit tests for failure paths: Ollama stopped mid-session, malformed model output, and an empty doc index. Also tell me how to monitor memory/CPU usage during a typical session so I can check it manually.
```

## Phase 12 — Packaging & Distribution

```
Prepare error-bot for production deployment. Configure production build settings: environment variables, app name, favicon and meta tags. Make sure the pre-indexed doc corpus and SQLite file ship alongside the backend. Set the database path via a DATA_DIR environment variable for the deployed backend. Set up `npm run build` to produce the static frontend bundle, and configure Fastify to serve it (or document how to deploy the frontend separately). Write install instructions covering the Ollama dependency, including the exact download link and model pull commands. Write a short README describing setup and usage.
```

## Phase 13 — Post-Launch

```
Help me plan post-launch maintenance for error-bot. Propose a lightweight changelog/versioning approach for future updates. Propose a cadence for refreshing the doc corpus (how often to re-scrape and re-index). Set up a simple way for me to log real user-reported errors so I can expand test coverage over time. Also draft a backlog list covering: additional languages/frameworks, an editor plugin, and an optional cloud fallback model.
```
