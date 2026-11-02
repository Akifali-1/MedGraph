# MedGraph Phase 1 Stabilization Report

Branch: `audit-fixes`  
Baseline: `scratch/STATUS_AUDIT.md` was present and read before work began.  
Scope: Phase 1 only; no SageMaker/AWS resource changes and no Pinecone writes/deletes.

## Preflight and Neo4j appendix

### Preflight

- Working directory: `C:\PROJECTS\Medgraph\medgraph` (project root) — **PASS**.
- Initial git status: clean on `main` — **PASS**.
- Required variable names — names only; no values printed:
  - `GOOGLE_API_KEY=SET`
  - `PINECONE_API_KEY=SET`
  - `NEO4J_URI=SET`
  - `NEO4J_USERNAME=SET`
  - `NEO4J_PASSWORD=SET`
  - `COHERE_API_KEY=SET`
- Read-only Neo4j `RETURN 1 AS ok` — **PASS**, returned `{'ok': 1}`.
- Gemini short call (`Reply with exactly OK.`) — **BLOCKED**: `ChatGoogleGenerativeAIError`, HTTP 400 `INVALID_ARGUMENT`, `API key not valid. Please pass a valid API key.` No secret value was printed.
- `docker info --format ...` — **PASS**: Docker Desktop server `27.4.0`, 4 containers, 12 images.

The Gemini failure blocks live Gemini-dependent verification, but not the code changes that can be tested with deterministic mocks. Pinecone writes/deletes and SageMaker remain prohibited and were not attempted.

### Neo4j A1–A8

- `NEO4J_URI`, `NEO4J_USERNAME`, and `NEO4J_PASSWORD` were all **SET**; values were not printed.
- A2 before seeding, using the requested read-only queries:
  - `MATCH (n) RETURN labels(n) AS labels, count(*) AS count` → `[]`
  - `MATCH ()-[r]->() RETURN type(r) AS type, count(*) AS count` → `[]`
- The first `python -m backend.graph.seed_csv` used the system interpreter, which lacked the Neo4j package and fell back to mock mode without writing. It was not treated as a seed result. The venv command was then used successfully.
- Before each script, source was read. `seed_csv.py` uses `Neo4jClient`/`.env` and contains `MATCH (n) DETACH DELETE n` (full graph clear), despite the appendix’s summary that only Columbia deletes. `seed_rxnav.py` uses `Neo4jClient`/`.env` and does not delete nodes. `seed_columbia.py` uses `Neo4jClient`/`.env` and deletes only `Disease` and `Symptom` nodes.
- A4 seed commands, all with the venv interpreter:
  - `python -m backend.graph.seed_csv` — **PASS**: 6 drugs, 12 interaction rows, 4 diseases, 5 symptoms, 9 indication rows.
  - `python -m backend.graph.seed_rxnav` — **PASS**: 6 hand-written clinical drugs, 6 interaction pairs; existing schema notices only.
  - `python -m backend.graph.seed_columbia` — **PASS**: parsed 1,867 rows, processed 1,865 associations, seeded 133 diseases, 397 symptoms, 1,865 indicator records.
- A6 after seeding, using read-only counts:
  - Labels: `Drug=6`, `Disease=133`, `Symptom=397`.
  - Relationships: `INTERACTS_WITH=24`, `INDICATES=1854`.
  - All 24 `INTERACTS_WITH` relationships had a `severity` property.
  - `TREATED_BY=0`; it is not created by the A4 seed sequence.
  - Directed DDI count was 24; the undirected pattern counted 48 because each bidirectional relationship is encountered from both endpoints.
- A7 expected labels `Drug`, `Disease`, `Symptom` are present. Expected relationship types `INDICATES` and `INTERACTS_WITH` are present. No unexpected relationship type was returned. `TREATED_BY` is absent.

## Work items

Entries will be added after each item with the change, command, result, and remaining breakage.

### Work item 1 — Docker build

- Changed `.dockerignore` to exclude the `.claude` reparse-point tree that caused Docker Desktop to fail while archiving the context.
- First retry: `docker build --progress=plain -t medgraph-audit .` reached pip installation but timed out after 180 seconds while resolving/installing dependencies.
- Second retry, same command with a 360-second timeout: **PASS**. Image built successfully. Docker emitted only `FromAsCasing` warnings for the existing `as`/`FROM` capitalization.
- Remaining: the Dockerfile casing warnings are cosmetic and were not changed in this item.

### Work item 2 — DAG default

- Changed `/diagnose` default `mode` from `react` to `dag`; the docstring now identifies DAG as primary and ReAct as opt-in.
- Added explicit `MOCK_NEO4J`/`MOCK_REDIS` flags to offline tests and added `data_mode` to DAG output (`demo` when the explicit graph mock is active).
- Frontend `fetch('/diagnose')` already omitted a mode query, so it now reaches the DAG default without a frontend change.
- `python -m pytest ...` with the system interpreter — **BLOCKED/command error**: system Python lacked `slowapi`; no code was changed for this error.
- `.venv/Scripts/python.exe -m pytest backend/tests/test_phase1_stabilization.py -q` — **PASS**, 1 passed.
- Remaining: ReAct live execution and Gemini remain unverified; it stays available only by `?mode=react`.

### Work item 3 — truthful health and explicit mocks

- Neo4j now defaults to live connection mode; only `MOCK_NEO4J=true` enables the local graph. Failed live initialization remains unavailable instead of silently becoming healthy mock mode.
- Redis mock fallback now requires `MOCK_REDIS=true`; `/health` reports Redis down when the socket is unreachable unless that flag is explicit.
- `/health` calls Neo4j connectivity verification for a live client and calls `get_pinecone_index(allow_create=False)`, so health cannot create a missing Pinecone index.
- `.venv/Scripts/python.exe -m pytest backend/tests/test_phase1_stabilization.py -q` — **PASS**, 2 passed.
- Remaining: the live environment has a reachable seeded Neo4j, but local Redis availability and Gemini/Pinecone credential behavior remain environment-dependent.

## Decisions

- The DAG is the sole default `/diagnose` path; ReAct remains available only by explicit `mode=react`.
- Mock dependency behavior is allowed only when an explicit test/demo flag is active; production health reports dependency failure instead of silently reporting a healthy mock.
- No live Gemini/Pinecone retrieval claim will be made while the configured Gemini key returns HTTP 400.
- Metadata is carried as structured citation objects while retaining the existing citation strings for compatibility.
- The existing A4 seeding instruction was followed because the database was empty, but the report records the actual full-graph delete in `seed_csv.py`.
