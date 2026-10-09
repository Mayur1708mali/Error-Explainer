# Error Bot — Architecture & Data Flow

This document details the system architecture, component breakdown, and end-to-end data flows of **Error Bot**, a local-first AI error and stack trace analysis application.

---

## 1. High-Level System Architecture

Error Bot is structured as a client-server application backed by a local AI runtime and an embedded vector database:

- **Frontend**: React 19 single-page application built with Vite, styled with CSS modules / custom styles, using Zustand for global client state and TanStack Query for server mutations and cache management.
- **Backend API**: Fastify HTTP server written in TypeScript (executed via `tsx`), providing REST endpoints for analysis, history management, vector indexing, and health checks. In production, Fastify also serves the pre-compiled static frontend.
- **RAG & Storage**: SQLite database powered by `better-sqlite3` and `sqlite-vec` (vector extension), persisting analysis history and indexing documentation chunks using 768-dimensional embeddings.
- **Local AI Engine**: [Ollama](https://ollama.com) running locally, serving quantized code LLMs (`qwen2.5-coder:3b`, `qwen2.5-coder:7b`) and embedding models (`nomic-embed-text`).

```mermaid
flowchart TB
    subgraph Client["Frontend Client (Browser / React 19)"]
        UI["UI Layer\n(InputPanel, ResultPanel, HistorySidebar, SettingsPanel)"]
        State["State Management\n(Zustand store: useErrorBotStore)"]
        Query["Async Mutation / Cache Layer\n(TanStack Query: useAnalyze, useStatus)"]
        UI <--> State
        UI <--> Query
    end

    subgraph Server["Backend Server (Fastify @ Node.js)"]
        Router["HTTP Router\n(/analyze, /status, /history, /index/rebuild)"]
        Static["Static File Server\n(fastify-static / dist)"]

        subgraph Orchestration["Analysis Orchestration"]
            Orchestrator["Analysis Engine\n(analyze.ts)"]
            Detector["Language & Framework Detector\n(detect.ts - Heuristics)"]
            Classifier["Fallback Classifier\n(classify.ts - LLM)"]
            PromptEng["Prompt Engine\n(prompt.ts)"]
            Validator["Schema Validation & Normalization\n(Zod schema.ts)"]
        end

        subgraph RAG["Retrieval-Augmented Generation (rag/)"]
            Retriever["Vector Retriever\n(retrieve.ts)"]
            Embedder["Embedding Client\n(embed.ts)"]
            Indexer["Index Rebuilder\n(rebuild.ts)"]
        end

        History["History Manager\n(history.ts)"]
    end

    subgraph Storage["Persistence & Knowledge Base"]
        DocCorpus["Documentation Corpus\n(backend/data/chunks.json, docs/)"]
        SQLiteDB[("SQLite Database (errorbot.db)\n- doc_chunks: metadata & text\n- vec_chunks: sqlite-vec 768-dim embeddings\n- analyses: history CRUD")]
    end

    subgraph AI["Local AI Runtime (Ollama Daemon)"]
        ChatLLM["Chat Models\n- qwen2.5-coder:3b (Fast)\n- qwen2.5-coder:7b (Accurate)"]
        EmbedModel["Embedding Model\n- nomic-embed-text (768-dim)"]
    end

    %% Communication connections
    Query -->|"HTTP POST /analyze, GET /history, GET /status"| Router
    Router --> Orchestrator
    Router --> History
    Router --> Indexer
    Router --> Static

    Orchestrator --> Detector
    Detector -.->|"Inconclusive fallback"| Classifier
    Classifier -.->|"POST /api/chat"| ChatLLM

    Orchestrator --> Retriever
    Retriever --> Embedder
    Embedder -->|"POST /api/embeddings"| EmbedModel
    Retriever -->|"L2 vector KNN MATCH + Filter"| SQLiteDB

    Orchestrator --> PromptEng
    PromptEng -->|"POST /api/chat (JSON format)"| ChatLLM
    ChatLLM -->|"JSON output"| Orchestrator
    Orchestrator --> Validator
    Validator -->|"Persist validated result"| History
    History -->|"CRUD SQL Queries"| SQLiteDB

    Indexer --> Embedder
    Indexer --> DocCorpus
    Indexer -->|"Rebuild doc_chunks & vec_chunks"| SQLiteDB
```

---

## 2. Core Analysis Request & Data Flow (`POST /analyze`)

The primary workflow handles user error input, heuristic identification, RAG document retrieval, grounded prompt construction, LLM generation, validation with 1-shot retry, and persistence.

```mermaid
sequenceDiagram
    autonumber
    actor User as User
    participant Frontend as Frontend (InputPanel / useAnalyze)
    participant Server as Fastify Server (/analyze)
    participant Engine as Analyze Orchestrator (analyze.ts)
    participant Detector as Detector (detect.ts)
    participant Retriever as RAG Retriever (retrieve.ts)
    participant Ollama as Ollama API
    participant DB as SQLite + sqlite-vec (errorbot.db)
    participant History as History Store (history.ts)

    User->>Frontend: Paste error / stack trace & press Analyze (Cmd+Enter)
    Frontend->>Server: POST /analyze { input, model }
    Server->>Server: Validate length (8 <= len <= 20,000 chars)

    Server->>Engine: runAnalysis(input, model)
    Engine->>Detector: detectLanguage(input)
    Note over Detector: Weighted regex scoring across<br/>Python, JS, TS, Java, Ruby, Go, C#, PHP, Rust

    alt Language Detected
        Detector-->>Engine: { language, framework, confidence }
        Engine->>Retriever: retrieve(input, { language, topK: 4 })
        Retriever->>Ollama: POST /api/embeddings (nomic-embed-text)
        Ollama-->>Retriever: 768-dim Float32Array vector
        Retriever->>DB: KNN vector search (vec_chunks MATCH + d.language)
        DB-->>Retriever: Candidate doc chunks
        Retriever-->>Engine: Filtered by MAX_RELEVANT_DISTANCE (<= 20)
    else Unknown / Inconclusive
        Engine->>Engine: Skip doc retrieval (prevent cross-language contamination)
    end

    Engine->>Engine: buildAnalyzeMessages(input, retrievedContext)
    Engine->>Ollama: POST /api/chat { model, messages, format: "json", temp: 0.2 }
    Ollama-->>Engine: Raw JSON response text

    rect rgb(240, 245, 255)
        Note over Engine: Parsing & Validation Phase
        Engine->>Engine: extractJson() + normalizeCandidate()
        alt Schema Valid (analyzeResponseSchema)
            Engine->>Engine: Finalize confidence score & attach real sources
        else Schema Validation Fails
            Engine->>Ollama: Retry POST /api/chat with validation error prompt (1 retry)
            Ollama-->>Engine: Retry JSON response
            Engine->>Engine: parseAndValidate(retry)
        end
    end

    Engine-->>Server: Validated AnalyzeResponse
    Server->>History: saveAnalysis(input, result)
    History->>DB: INSERT INTO analyses (id, input, result, language, ...)
    Server-->>Frontend: HTTP 200 AnalyzeResponse JSON
    Frontend->>Frontend: Update Zustand store (currentResult) & invalidate history
    Frontend-->>User: Render ResultPanel (Root cause, fix steps, code diffs, citations)
```

---

## 3. End-to-End Decision Logic in the Analysis Pipeline

```mermaid
flowchart TD
    Start(["Client submits input"]) --> ValidateInput{"8 <= input.length <= 20,000?"}
    ValidateInput -- "No" --> Ret400["Return HTTP 400/413 error"]
    ValidateInput -- "Yes" --> RunDetect["Run Regex Heuristic Detection (RULES)"]

    RunDetect --> DetectKnown{"Language signature matched?"}
    DetectKnown -- "Yes" --> QueryEmbed["Query nomic-embed-text for input vector"]
    DetectKnown -- "No" --> NoRAG["Skip RAG retrieval (context = undefined)"]

    QueryEmbed --> VecSearch["sqlite-vec KNN search on vec_chunks WHERE language = ?"]
    VecSearch --> DistFilter{"Chunks with L2 distance <= 20?"}
    DistFilter -- "Yes" --> AssembleContext["Format chunks into numbered context blocks"]
    DistFilter -- "No" --> NoRAG

    AssembleContext --> BuildPrompt["buildAnalyzeMessages(input, context)"]
    NoRAG --> BuildPrompt

    BuildPrompt --> CallOllama1["Attempt 1: Ollama chat(model, messages, format: 'json')"]
    CallOllama1 --> Parse1["extractJson() & normalizeCandidate()"]
    Parse1 --> Validate1{"Zod schema parse OK?"}

    Validate1 -- "Pass" --> FinalizeResult["Finalize result:\n- Attach real RAG sources\n- adjustConfidence(modelConf, hasSources)"]
    Validate1 -- "Fail" --> BuildRetry["Append previous response + buildRetryMessage(reason)"]

    BuildRetry --> CallOllama2["Attempt 2 (Retry): Ollama chat(model, retryMessages)"]
    CallOllama2 --> Parse2["extractJson() & normalizeCandidate()"]
    Parse2 --> Validate2{"Zod schema parse OK?"}

    Validate2 -- "Pass" --> FinalizeResult
    Validate2 -- "Fail" --> Ret502["Throw AnalyzeError -> Return HTTP 502"]

    FinalizeResult --> SaveHistory["saveAnalysis(input, result) -> SQLite 'analyses' table"]
    SaveHistory --> Ret200(["Return 200 AnalyzeResponse JSON"])
```

---

## 4. Documentation Ingestion & RAG Indexing Flow

Error Bot includes a modular scraping, chunking, and vector indexing pipeline that prepares official documentation for retrieval:

```mermaid
flowchart LR
    subgraph Sources["Source Documents"]
        WebDocs["MDN Web Docs / Python Docs"]
        RawDocs["JSON doc files\n(backend/data/docs/*.json)"]
    end

    subgraph Pipeline["Ingestion Pipeline (backend/src/rag/)"]
        Scraper["scrape.ts\n(Cheerio + Turndown HTML to Markdown)"]
        Chunker["chunk.ts\n(Splits headers/sections into ~800 char chunks)"]
        CorpusFile[("chunks.json")]
        Rebuilder["rebuild.ts\n(rebuildIndex function)"]
    end

    subgraph IndexStorage["Vector Database (errorbot.db)"]
        EmbedCall["embed.ts\n(Ollama nomic-embed-text)"]
        TableDoc["doc_chunks Table\n(chunk_id, language, framework, title, url, text)"]
        TableVec["vec_chunks Virtual Table\n(vec0 768-float embedding)"]
    end

    WebDocs -->|Fetch & convert| Scraper
    Scraper --> RawDocs
    RawDocs -->|Chunk by section| Chunker
    Chunker --> CorpusFile
    CorpusFile -->|"Read chunks"| Rebuilder
    Rebuilder --> EmbedCall
    EmbedCall -->|"Float32Array[768]"| TableVec
    Rebuilder -->|"Metadata + Text"| TableDoc
```

---

## 5. Health Check & Monitoring Flow (`GET /status`)

The frontend continuously monitors backend and Ollama connectivity:

```mermaid
sequenceDiagram
    autonumber
    participant UI as Frontend (useStatus / OllamaStatusBadge)
    participant API as Fastify Server (/status)
    participant Ollama as Ollama Daemon (/api/tags)

    UI->>API: GET /status (every 10s or on mount)
    alt Backend Unreachable
        API--xUI: Connection refused / timeout
        UI->>UI: setBackendStatus('unreachable'), setOllamaStatus('error')
    else Backend Reachable
        API->>Ollama: isReachable() (HTTP GET /api/tags, 3s timeout)
        alt Ollama Offline
            Ollama--xAPI: Error / timeout
            API-->>UI: { ok: false, ollamaReachable: false, models: [...] }
            UI->>UI: setOllamaStatus('disconnected')
        else Ollama Online
            API->>Ollama: listModels() (HTTP GET /api/tags)
            Ollama-->>API: List of installed model tags
            API->>API: Check required models:\n- qwen2.5-coder:3b\n- qwen2.5-coder:7b\n- nomic-embed-text
            API-->>UI: { ok: true, ollamaReachable: true, models: [{name, present}] }
            UI->>UI: setOllamaStatus('connected'), update model availability badges
        end
    end
```

---

## 6. History Management Data Flow

Past analyses are indexed and searchable directly in the user interface:

```mermaid
flowchart TD
    subgraph UI["History UI (HistorySidebar.tsx)"]
        SearchInput["Search Filter Input (q)"]
        List["History List (Virtualized/Paginated)"]
        Actions["Actions: Click to view, Delete single, Clear all"]
    end

    subgraph Store["Zustand Store (useErrorBotStore.ts)"]
        StoreAction["fetchHistoryFromBackend(), removeHistoryItem(), clearHistory()"]
    end

    subgraph Endpoints["Backend Endpoints (server.ts)"]
        GET_HIST["GET /history?page=1&pageSize=50&q=..."]
        GET_BY_ID["GET /history/:id"]
        DEL_ITEM["DELETE /history/:id"]
        CLEAR_ALL["DELETE /history"]
    end

    subgraph DB["SQLite Database (history.ts)"]
        SQL_SELECT["SELECT ... FROM analyses WHERE input LIKE ? OR result LIKE ?"]
        SQL_DEL["DELETE FROM analyses WHERE id = ?"]
    end

    SearchInput -->|"Keyup / Debounce"| StoreAction
    Actions --> StoreAction
    StoreAction --> GET_HIST
    StoreAction --> DEL_ITEM
    StoreAction --> CLEAR_ALL

    GET_HIST --> SQL_SELECT
    DEL_ITEM --> SQL_DEL
    CLEAR_ALL --> SQL_DEL

    SQL_SELECT -->|"Paginated HistoryPage"| List
    List -->|"Select Item"| Restore["Load input & result into active workspace"]
```

---

## 7. Component & Module Reference

| Directory / File | Role | Key Responsibilities |
|---|---|---|
| `backend/src/server.ts` | Server Entry Point | Fastify server setup, CORS configuration, static file serving (`dist/`), route registrations (`/status`, `/analyze`, `/history`, `/index/rebuild`). |
| `backend/src/analyze.ts` | Analysis Engine | Pipeline coordinator: triggers detection, invokes RAG retrieval, formats prompts, handles JSON parsing and 1-shot retry, normalizes outputs, adjusts confidence. |
| `backend/src/detect.ts` | Heuristic Detector | Weighted regex scoring rules for 9 languages (Python, JS, TS, Java, Ruby, Go, C#, PHP, Rust) and major frameworks (React, Django, Express, Spring, etc.). |
| `backend/src/classify.ts` | Fallback Classifier | Fallback classifier invoking Ollama chat when heuristics are inconclusive. |
| `backend/src/ollama.ts` | Ollama HTTP Client | Minimal REST client for Ollama's `/api/chat` and `/api/tags` with timeout and health check helpers. |
| `backend/src/prompt.ts` | Prompt Construction | System prompts enforcing strict JSON response format and context grounding instructions. |
| `backend/src/history.ts` | History Persistence | CRUD operations on the SQLite `analyses` table, including keyword text search and pagination. |
| `backend/src/rag/db.ts` | Vector Database Core | `better-sqlite3` instance management with `sqlite-vec` extension loading and table schema setup (`doc_chunks`, `vec_chunks`). |
| `backend/src/rag/embed.ts` | Embeddings Client | Sends text to Ollama `/api/embeddings` using `nomic-embed-text` to generate 768-dim `Float32Array`. |
| `backend/src/rag/retrieve.ts` | Vector Retrieval | Performs vector KNN similarity queries against `vec_chunks`, applies strict language filtering and distance thresholds. |
| `backend/src/rag/rebuild.ts` | Index Builder | Reads `chunks.json`, computes embeddings, and re-populates the vector index. |
| `shared/schema.ts` | Contract & Validation | Zod schemas (`analyzeResponseSchema`, `codeExampleSchema`, `sourceSchema`) used for runtime validation on both client and server. |
| `shared/types.ts` | TypeScript Interfaces | Shared TypeScript types derived from schemas and API contracts. |
| `src/store/useErrorBotStore.ts` | Client State | Central Zustand store managing current inputs, active analysis results, UI status, selected model, and history cache. |
| `src/hooks/useAnalyze.ts` | Analysis Hook | TanStack Query mutation wrapper managing request status and triggering history refreshes. |
| `src/components/` | React UI Components | `InputPanel` (editor with line gutters), `ResultPanel` (root cause, fix steps, diffs), `HistorySidebar`, `SettingsPanel`, status banners. |
