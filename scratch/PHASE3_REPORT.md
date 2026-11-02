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

### A1 — reasoning engine contract

- Result: **PASS**. `/diagnose` now returns `reasoning_engine` with values `gemini`, `mock`, or `none`. The DAG records the selected engine; the ReAct response paths also expose it.

### A2 — no implicit mock diagnoses

- Command: `.\.venv\Scripts\python.exe -m pytest backend/tests/test_phase3_reasoning.py::test_mock_reasoning_is_not_used_without_explicit_demo_mode -q`
- Result: **PASS**. With `MEDGRAPH_DEMO_MODE` unset and provider keys unavailable, reasoning returns `reasoning_engine="none"`, `status="error"`, and `diagnoses=[]`. The test is independent of live services.
- Existing offline flow tests now set explicit `MEDGRAPH_DEMO_MODE=true`; mock diagnoses are labeled by the engine contract rather than inferred from `TESTING=true`.

### A3 — Gemini failure behavior

- Command: `.\.venv\Scripts\python.exe -m pytest backend/tests/test_phase3_reasoning.py::test_gemini_failure_returns_error_without_mock_diagnoses -q`
- Result: **PASS**. A test-process-only invalid key and simulated Gemini failure return HTTP `200` with `status="error"`, the plain message `The clinical reasoning service is unavailable. Please try again.`, `reasoning_engine="none"`, and `diagnoses=[]`. No key value was committed or printed.

### A4 — live cardiac vignette

- First live attempt: **FAIL**. The provider returned a successful response, but the installed Gemini adapter exposed `response.content` as text blocks and the old parser called `.strip()` on the list; the request then fell through to an invalid placeholder OpenAI key. No result was reported as a diagnosis.
- Fix: normalize Gemini text blocks, ignore placeholder OpenAI credentials, and set the Gemini client to `retries=0` so provider calls remain bounded.
- Final command: live uvicorn on `127.0.0.1:8000` with mock flags off, authenticated demo practitioner request for cardiac symptoms.
- Final result: **PASS**. HTTP `200`; `reasoning_engine="gemini"`; `status="ok"`; citation IDs `citation-1` and `citation-2`; two diagnoses returned. Sanitized response: `scratch/phase3_live_cardiac.json`.

## Phase B

The dense retrieval initialization was changed to open the existing Pinecone index with `allow_create=False`; no `from_documents` or upsert path is used for live diagnosis/evaluation.

### B1 — embedding dimension

- Command: approved Python call to `get_embeddings().embed_query(...)` with no test/demo flags.
- Result: **PASS**. Gemini embedding length was `3072`, matching Pinecone dimension `3072`.

### B2 — live controls

- Command: live `get_retrieval_diagnostics` run over all eight records in `eval/cases/controls.jsonl`, paced 7.6 seconds between embedding requests.
- Result: **PASS**. Threshold was `0.35`. Controls `control-001`, `002`, `003`, `007`, and `008` had accepted dense retrieval with top scores `0.791214`, `0.824493408`, `0.811771393`, `0.809387207`, and `0.8088416755`; they therefore did not satisfy the expected no-evidence boundary. Empty/near-empty controls `004`, `005`, and `006` produced empty retrieval after the provider rejected empty embedding parts with HTTP 400 `INVALID_ARGUMENT`.
- Live control no-evidence boundary rate: `3/8` (`37.5%`) by empty retrieval; threshold rejections: `0/8`; accepted dense retrieval: `5/8`. This is a retrieval-boundary measurement, not clinical accuracy.
- Full raw diagnostics, including every score and source metadata, are in ignored `scratch/phase3_retrieval_live.json`.

### B3 — semantic queries

- Command: the same paced live diagnostics run for three required semantic queries.
- Result: **PASS**. All were accepted above threshold `0.35`:
  - Warfarin plus aspirin bleeding: top score `0.8771668075`; source ID `AHA_ACC_Guideline`; source type `guideline`.
  - Acute chest pain with ECG: top score `0.860542327`; source ID `AHA_ACC_Guideline`; source type `guideline`.
  - Headache with confusion and hemorrhage: top score `0.852973968`; source ID `AHA_ACC_Guideline`; source type `guideline`.
- The existing Pinecone metadata did not contain chunk IDs for these rows; diagnostics recorded `chunk_id=unknown` rather than inventing one.

## Phase C

### C1 — live diagnosis evaluation

- First command: live `eval/run_eval.py --date 2026-11-03-live --diagnosis-only` with the default 120-second Gemini timeout.
- First result: **FAIL** — the harness command exceeded 600 seconds before the script wrote output. Ports were free and no process remained; no partial result files were produced.
- Fix before retry: make the Gemini request timeout configurable and use a bounded 30-second timeout for the live evaluation process. The evaluator keeps 15.5 seconds between requests and stops when errors exceed 20 percent.
