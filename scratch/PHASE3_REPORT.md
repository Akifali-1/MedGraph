# MedGraph Phase 3 Live Verification Report

Date: 2026-11-03  
Branch: `phase2-evidence`  
Working directory: `C:\PROJECTS\Medgraph\medgraph`

## Decisions

- The Gemini preflight succeeded, so live retrieval and diagnosis steps will run with the configured provider and under the eight-calls-per-minute limit.
- No Pinecone writes/deletes, SageMaker calls, or AWS resource operations will be performed.
- DDInter rows, derived interaction files, and Neo4j snapshots remain under ignored `scratch/`; only loader code, tests, metrics, and documentation are committed.
- Existing offline evaluation output remains under `eval/results/2026-11-02/` and will not be relabeled as live.

## Preflight

### P1 — repository and branch

- Command: `Get-Location; git status --short --branch; git log --oneline -8`
- Result: **PASS**. Working directory is `C:\PROJECTS\Medgraph\medgraph`; branch is `phase2-evidence`; no tracked changes were present.

### P2 — environment names

- Command: approved Python `.env` inspection printing names and SET/UNSET only.
- Result: **PASS**. `GOOGLE_API_KEY=SET`, `PINECONE_API_KEY=SET`, `NEO4J_URI=SET`, `NEO4J_USERNAME=SET`, `NEO4J_PASSWORD=SET`, `COHERE_API_KEY=SET`, `SAGEMAKER_ENDPOINT_NAME=UNSET`.

### P3 — disk space

- Command: `Get-PSDrive -Name C` free-space query.
- Result: **PASS**. `16.49 GB` free; Docker build is not blocked by disk space.

### P4 — Gemini short call

- Command: `ChatGoogleGenerativeAI(..., request_timeout=10, retries=0).invoke('Reply with exactly OK.')`
- Result: **PASS**. Model `gemini-3.1-flash-lite` returned `OK.`. No key value was printed.

### P5 — Neo4j read-only

- Command: `RETURN 1 AS ok`, label counts, and relationship counts through the Neo4j Python driver.
- Result: **PASS**. Return value `{'ok': 1}`. Labels: `Disease=133`, `Drug=6`, `Symptom=397`. Relationships: `INDICATES=1854`, `INTERACTS_WITH=24`.

### P6 — Pinecone read-only

- Command: `describe_index` and `describe_index_stats` for `medgraph`.
- Result: **PASS**. Dimension `3072`, metric `cosine`, ready `true`, total vectors `357`; namespaces: empty namespace `357`, `user_uploads=0`.

### P7 — ports

- Command: socket bind checks for ports `8000` and `5173`.
- Result: **PASS**. `8000=FREE`, `5173=FREE`.

## Phase A

Entries will be added as each step completes.
