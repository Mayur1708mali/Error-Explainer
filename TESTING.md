# Error Bot — Testing Guide

## Automated Test Suite

Run all tests:

```bash
npm test            # vitest run (all tests, single pass)
npm run test:watch  # vitest in watch mode during development
```

Run specific test files:

```bash
npx vitest run shared/schema.test.ts          # Zod schema tests
npx vitest run backend/src/detect.test.ts     # Detector (existing)
npx vitest run backend/src/detect-advanced.test.ts  # Detector (advanced)
npx vitest run backend/src/retrieve.test.ts   # Retrieval scoring
npx vitest run backend/src/failure-paths.test.ts    # Failure paths
npx vitest run backend/src/integration.test.ts      # Integration (needs Ollama)
```

Skip integration tests (CI without Ollama):

```bash
SKIP_INTEGRATION=1 npm test
```

---

## Manual Test Plan

**Target environment:** Clean machine or user account with no development tools installed, except Ollama pre-installed and running.

### Prerequisites

| Requirement | Check |
|---|---|
| macOS, Linux, or Windows with WSL | `uname -a` |
| Ollama installed and running | `curl http://localhost:11434/api/tags` returns JSON |
| Node.js >= 20 | `node --version` |
| npm >= 10 | `npm --version` |

### Step 1 — Clone and Install

```bash
git clone <repo-url> error-bot
cd error-bot
npm install
```

**Expected:** No errors. `node_modules` created. Native `better-sqlite3` compiles successfully.

**If it fails:** Ensure Xcode Command Line Tools (macOS) or `build-essential` (Linux) is installed for native compilation:
```bash
# macOS
xcode-select --install
# Ubuntu/Debian
sudo apt install build-essential python3
```

### Step 2 — Pull Required Ollama Models

```bash
ollama pull qwen2.5-coder:3b
ollama pull qwen2.5-coder:7b
ollama pull nomic-embed-text
```

**Expected:** Each model downloads successfully. Verify with:
```bash
ollama list
```

All three models should appear in the output.

### Step 3 — Run Unit Tests

```bash
SKIP_INTEGRATION=1 npm test
```

**Expected:** All unit tests pass (schema, detect, retrieve, failure paths). These do not require Ollama.

### Step 4 — Run Integration Tests

```bash
npm test
```

**Expected:** Integration tests run against the live Ollama instance. Typical run time: 15–30 seconds depending on hardware. All tests pass.

### Step 5 — Start the Backend Server

```bash
npm run dev:backend
```

**Expected:** Server starts on `http://127.0.0.1:3001`. Log output shows:
```
{"level":30,...,"msg":"Server listening at http://127.0.0.1:3001"}
```

### Step 6 — Verify Health Check

```bash
curl http://localhost:3001/status | python3 -m json.tool
```

**Expected:**
```json
{
  "ok": true,
  "ollamaReachable": true,
  "models": [
    { "name": "qwen2.5-coder:3b", "present": true },
    { "name": "qwen2.5-coder:7b", "present": true },
    { "name": "nomic-embed-text", "present": true }
  ]
}
```

### Step 7 — Test Analysis (Python Error)

```bash
curl -X POST http://localhost:3001/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "input": "Traceback (most recent call last):\n  File \"app.py\", line 3, in <module>\n    print(user_naem)\nNameError: name '\''user_naem'\'' is not defined"
  }' | python3 -m json.tool
```

**Expected:** 200 OK with JSON containing:
- `language`: "Python"
- `rootCause`: mentions typo or undefined variable
- `fixSteps`: at least one step
- `confidence`: number between 0 and 1
- `sources`: array (may be empty if RAG index has no Python docs)

### Step 8 — Test Analysis (JavaScript Error)

```bash
curl -X POST http://localhost:3001/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "input": "TypeError: Cannot read properties of undefined (reading '\''map'\'')\n    at UserList (http://localhost:5173/src/UserList.jsx:12:20)\n    at renderWithHooks (react-dom.js:12345:18)"
  }' | python3 -m json.tool
```

**Expected:** 200 OK, `language` is "JavaScript", `framework` is "React".

### Step 9 — Test Input Validation

```bash
# Too short
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3001/analyze \
  -H "Content-Type: application/json" -d '{"input": "hi"}'
# Expected: 400

# Empty
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3001/analyze \
  -H "Content-Type: application/json" -d '{"input": ""}'
# Expected: 400

# Missing field
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3001/analyze \
  -H "Content-Type: application/json" -d '{}'
# Expected: 400
```

### Step 10 — Test with Ollama Stopped (Failure Path)

```bash
# Stop Ollama
ollama stop        # or: launchctl stop com.ollama.ollama (macOS)
# On Linux: systemctl stop ollama

# Verify it's down
curl http://localhost:11434/api/tags
# Expected: Connection refused

# Try an analysis
curl -X POST http://localhost:3001/analyze \
  -H "Content-Type: application/json" \
  -d '{"input": "Traceback (most recent call last):\n  File \"x.py\", line 1\nNameError: name '\''x'\'' is not defined"}' \
  -w "\nHTTP Status: %{http_code}\n"
# Expected: HTTP 502, body has {"error": "..."}

# Check /status
curl http://localhost:3001/status | python3 -m json.tool
# Expected: {"ok": false, "ollamaReachable": false, "models": [...all present: false]}

# Restart Ollama
ollama serve &     # or restart the service
```

### Step 11 — Start the Frontend

In a new terminal:

```bash
npm run dev
```

**Expected:** Vite dev server starts on `http://localhost:5173`.

### Step 12 — Browser Smoke Test

1. Open `http://localhost:5173` in a browser.
2. Verify the UI loads without console errors.
3. Check the Ollama status badge shows "connected" (green).
4. Paste a Python stack trace into the input area.
5. Click Analyze (or press the keyboard shortcut).
6. Verify a result card appears with language, root cause, fix steps.
7. Check the History sidebar updates with the new entry.

### Step 13 — Rebuild RAG Index

```bash
curl -X POST http://localhost:3001/index/rebuild | python3 -m json.tool
```

**Expected:**
```json
{
  "ok": true,
  "chunksIndexed": <number > 0>
}
```

After rebuild, re-run Step 7. The response should now include `sources` with real documentation links.

---

## Monitoring Memory & CPU Usage

### macOS — Activity Monitor (GUI)

1. Open **Activity Monitor** (Spotlight → "Activity Monitor").
2. Filter by process name: `ollama`, `node`.
3. Monitor the **Memory** and **CPU** columns during analysis requests.

### macOS / Linux — Command Line

**Real-time monitoring during a session:**

```bash
# Watch node (backend) and ollama processes every 2 seconds
while true; do
  echo "=== $(date) ==="
  ps aux | grep -E '(ollama|node.*server)' | grep -v grep | awk '{printf "%-8s CPU: %5s%%  MEM: %5s%%  RSS: %sMB\n", $11, $3, $4, $6/1024}'
  echo ""
  sleep 2
done
```

**Snapshot before and after an analysis:**

```bash
# Before
echo "--- BEFORE ---"
ps -o pid,rss,%cpu,%mem,command -p $(pgrep -f 'ollama|server.ts') 2>/dev/null

# Run an analysis
curl -s -X POST http://localhost:3001/analyze \
  -H "Content-Type: application/json" \
  -d '{"input": "Traceback (most recent call last):\n  File \"a.py\", line 1\nNameError: x"}' > /dev/null

# After
echo "--- AFTER ---"
ps -o pid,rss,%cpu,%mem,command -p $(pgrep -f 'ollama|server.ts') 2>/dev/null
```

**Using `top` (interactive):**

```bash
# macOS
top -pid $(pgrep ollama) -pid $(pgrep -f server.ts)

# Linux
top -p $(pgrep ollama),$(pgrep -f server.ts)
```

### Typical Baseline (Apple Silicon Mac, 8GB RAM)

| Process | Idle RSS | During Inference | Notes |
|---|---|---|---|
| `ollama` (server) | ~50 MB | ~100 MB | Model runner process |
| `ollama` (model) | ~2.2 GB (3B) | ~2.5 GB (3B) | Model loaded in memory |
| `node` (backend) | ~80 MB | ~90 MB | Stays stable |
| `node` (frontend) | ~60 MB | ~60 MB | Vite dev server, no change |

### What to Watch For

- **Memory leak:** RSS of the `node` backend process growing steadily across multiple requests without releasing. After 50+ requests, it should stabilize within ~120 MB.
- **Ollama model unload:** After ~5 minutes of inactivity, Ollama unloads models from VRAM/RAM. Next request will have a cold-start delay (~2–5s extra).
- **CPU spike:** Ollama will peg available CPU cores during inference. This is normal. The Node backend should remain < 5% CPU except briefly when parsing responses.
- **Disk I/O:** The SQLite database and WAL files (`backend/data/errorbot.db*`) should not grow unboundedly. Each analysis record is ~2–5 KB.

### Automated Resource Tracking (Optional)

For long-running soak tests, log resource usage to a file:

```bash
# Log every 5 seconds for 10 minutes
for i in $(seq 1 120); do
  echo "$(date +%H:%M:%S) $(ps -o rss= -p $(pgrep -f server.ts) 2>/dev/null || echo 0)" >> /tmp/errorbot-mem.log
  sleep 5
done

# Then plot or inspect:
cat /tmp/errorbot-mem.log
# Format: HH:MM:SS RSS_KB
```

---

## Summary of Test Coverage

| Area | Test File | Count | Type |
|---|---|---|---|
| Zod schemas | `shared/schema.test.ts` | 26 | Unit |
| Language detector | `backend/src/detect.test.ts` | 21 | Unit |
| Detector (advanced) | `backend/src/detect-advanced.test.ts` | 26 | Unit |
| Retrieval scoring | `backend/src/retrieve.test.ts` | 29 | Unit |
| Failure paths | `backend/src/failure-paths.test.ts` | 12 | Unit (mocked) |
| Integration | `backend/src/integration.test.ts` | 8 | Integration |
| **Total** | | **122** | |
