# MedGraph Phase 2 Evidence Report

Branch: `phase2-evidence` (created from `audit-fixes`)  
Baseline: `scratch/STATUS_AUDIT.md` and `scratch/PHASE1_REPORT.md` were present and read.

## Carried Phase 1 blockers

- Gemini short call and embedding calls were blocked by HTTP 400 `API key not valid`; live Gemini-dependent retrieval/evaluation was not verified.
- Phase 1 item 5 (Gemini embedding dimension plus three semantic Pinecone queries) remained blocked by the Gemini error.
- Phase 1 item 6 (live alert from a real returned interaction) was not completed as a committed work item; the live graph now contains seeded interactions, but the alert path still needs Phase 2 contract verification.
- Phase 1 item 7 (structured citation metadata) was not completed.
- No SageMaker or AWS resource operations were performed.

## Phase 0 baseline and preflight

- Working directory: `C:\PROJECTS\Medgraph\medgraph`; branch `phase2-evidence`; git status was clean before creating this report — **PASS**.
- Environment names, set/unset only: `GOOGLE_API_KEY=SET`, `PINECONE_API_KEY=SET`, `NEO4J_URI=SET`, `NEO4J_USERNAME=SET`, `NEO4J_PASSWORD=SET`, `COHERE_API_KEY=SET`, `SAGEMAKER_ENDPOINT_NAME=UNSET`.
- Read-only Neo4j `RETURN 1 AS ok` — **PASS**, `{'ok': 1}`.
- Read-only Neo4j label counts before Phase 2: `Disease=133`, `Drug=6`, `Symptom=397`.
- Read-only Neo4j relationship counts before Phase 2: `INDICATES=1854`, `INTERACTS_WITH=24`.
- Neo4j rollback dump: `scratch/neo4j_before.json`, 536 nodes and 1,878 relationships, including properties — **PASS**.
- Gemini short call (`Reply with exactly OK.`), with retries disabled and a 10-second request timeout — **BLOCKED**: `ServerError`, HTTP 503 `UNAVAILABLE`, `This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.` A prior Phase 1 call also returned HTTP 400 invalid API key; no secret value was printed.
- Pinecone read-only: index `medgraph`, dimension `3072`, metric `cosine`, ready `true`, total vectors `357`, namespaces `""=357`, `user_uploads=0` — **PASS**.
- Port check: `8000=FREE`, `5173=FREE` — **PASS**.

The graph dump succeeded, so the Phase 1 rollback record exists. Gemini is blocked by repeated provider errors; Gemini-dependent evaluation and live semantic retrieval will be marked BLOCKED rather than substituted with invented metrics.

### Phase 1 / 1a — source review

- **DDInter 2.0** was selected as the primary interaction source. Its terms state CC BY-NC-SA 4.0; risk levels include minor, moderate, and major. Non-commercial redistribution with attribution/ShareAlike is allowed under those terms.
- **RxNav interaction API** is discontinued as of January 2, 2024, per the NLM FAQ; it is not usable as a current DDI source.
- **DrugBank academic data** has minor/moderate/major severity, but access is license-gated and the release page reported academic downloads temporarily paused. No DrugBank data was downloaded or committed.
- Full URLs, versions/dates, license notes, and intended uses are in `docs/DATA_SOURCES.md`.
- The DDInter B CSV download URL was attempted three times from the approved public source and timed out each time; exact CSV schema was therefore not verified.

### Phase 1 / 1c — Columbia counts

- The Columbia page says the count column measures discharge summaries containing a positive/current disease mention. It does not expose a numeric symptom-edge co-occurrence count; symptom rows are ranked by association strength.
- `seed_columbia.py` now labels its existing rank score as an explicit heuristic and does not call it a measured co-occurrence weight. Formula is documented in code and `docs/DATA_SOURCES.md`.

### Phase 1 / 1d — real graph reseed

- **BLOCKED.** DDInter 2.0 was selected, but the public B-category CSV could not be downloaded after three attempts: two Python urllib attempts timed out while reading, and `curl.exe` timed out after 120 seconds. The exact source CSV schema could not be verified.
- The current Neo4j graph was left unchanged. `backend/graph/data/drugbank_mini.csv` and `backend/graph/data/disease_symptoms.csv` were not moved; no files were moved in this phase.
- No Neo4j delete or reseed was run in this step. The Phase 0 dump remains the rollback record.

### Phase 1 / 1e — TREATED_BY

- Removed the two hard-coded `TREATED_BY` seed statements from `backend/graph/seed.py` because no verified Phase 2 source supports those treatment edges.
- No live graph mutation was needed for this change; the Phase 0 graph already had `TREATED_BY=0`.

## Phase 2 — evaluation set

### 2a–2e diagnosis, interaction, controls, and review sample

- Added `eval/cases/diagnosis.jsonl` with 20 open-access, source-linked, paraphrased case reports. Every label is `provisional`; the set meets the minimum of 20 but is below the target of 40, so diagnosis evaluation is **underpowered**.
- Added `eval/cases/interactions.jsonl` as an empty blocked set. The selected DDInter download could not be retrieved or schema-verified after three timeouts, so no interaction positives, absence-based negatives, or synonym mappings were invented. Interaction evaluation is **BLOCKED**.
- Added eight explicitly synthetic negative controls in `eval/cases/controls.jsonl` (five unrelated presentations and three empty/near-empty inputs). They are boundary tests only, not clinical cases.
- Added ten provisional cases to `eval/review/review_sample.csv`.
- Added dataset definitions, label provenance, metric definitions, limits, and all case-report URLs to `eval/README.md`.

## Phase 4 / backend contract

- Retrieval now preserves title, source type, source ID, chunk ID, excerpt, and URL metadata from local guideline chunks.
- DAG responses now expose `status` (`ok`, `no_evidence`, `graph_unavailable`, or `error`), a plain-sentence `message`, structured `citations`, `retrieved_sources`, and `interaction_check: {status, interactions}`.
- The exact no-evidence message is `No supporting information was found in the indexed guidelines for this presentation.` Diagnoses are empty when no retrieved chunk passes the retrieval boundary; graph interaction lookups remain present.
- Graph-unavailable responses use `interaction_check.status=unavailable` and the message `The interaction check could not run.`
- Critical alert text is built from the returned interaction pair/effect/severity rather than a fixed drug pair.
- Added regression tests in `backend/tests/test_phase2_contract.py`; focused suite: **13 passed**, 1 dependency deprecation warning.

## Phase 3 — evaluation run

- Added `eval/run_eval.py`. It starts uvicorn on localhost, uses the default `/diagnose` DAG route, sends sequential requests, retries HTTP 429 responses up to three times, paces requests below eight per minute, writes raw JSONL, and terminates the server it started.
- The live Gemini-dependent run was not used for accuracy claims because Gemini was blocked by provider/API failures. An explicit offline HTTP run was completed to validate response shape and the control boundary; it used `TESTING=true`, explicit mock flags, and **0 Gemini calls**.
- Raw output: `eval/results/2026-11-02/results.jsonl`; summary: `eval/results/2026-11-02/summary.json` and `summary.md`.
- Eval sizes: 20 diagnosis cases (all provisional; underpowered versus target 40), 8 synthetic controls, 0 interaction cases because the interaction phase is blocked.
- Measured offline boundary results: controls `8/8` returned `no_evidence`; citation ID resolution `37/37`. These are not clinical accuracy metrics.
- Diagnosis top-1/top-3 accuracy: **not measured** because deterministic offline reasoning is not a clinical accuracy measurement. Interaction precision/recall and brand/synonym mapping: **BLOCKED**.
- Offline diagnosis latency: p50 `36.98 ms`, p95 `106.21 ms`; Gemini calls `0`; errors `0`. No secret values or secret variable names appeared in raw results.

## Phase 4 / frontend

- Removed the fabricated `updateRagEvidence` path, hard-coded passages, and similarity/correlation percentages from `frontend/src/App.jsx`.
- Source cards now render only response citations: title, source type, source/chunk IDs, expandable excerpt, and optional URL. Diagnosis cards use returned citation IDs.
- Empty evidence, graph-unavailable, and interaction states use the backend status contract. Critical alert text is built from returned interactions in both practitioner and patient views.
- Frontend checks after this change: `npm run build` — **PASS**; `npm run lint` — **PASS**.

## Phase 5 — honest About page

- Updated the existing `#about` route with implemented pipeline behavior, Gemini/SageMaker selection rules, no-evidence behavior, graph interaction status, source licenses/access notes, evaluation status, limitations, and a not-medical-advice statement.
- Added `scripts/sync_eval_to_about.py` and ran it. It copied `eval/results/2026-11-02/summary.json` to `frontend/src/data/latest_eval_summary.json`.
- About-page data is generated from the latest committed evaluation summary; blocked and not-measured values remain labeled on the page.

## Phase 6 — local pipeline verification

- Fixed startup handling so explicit mock Redis does not open a socket, unavailable Neo4j does not abort uvicorn startup, and startup Pinecone inspection uses `allow_create=False`.
- Critical interaction (`POST /diagnose`, DAG): HTTP `200`; `status="ok"`; `interaction_check.status="ok"`; returned `Warfarin + Aspirin` and reverse pair, both `severity="HIGH"`; alert was exactly `Critical drug interaction detected: Warfarin + Aspirin: increased bleeding risk (severity: HIGH); Aspirin + Warfarin: increased bleeding risk (severity: HIGH)`.
- Cardiac evidence (`POST /diagnose`, DAG): HTTP `200`; `status="ok"`; diagnoses included `STEMI (ST-Elevation Myocardial Infarction)`, `Unstable Angina`, and `Aortic Dissection`; citations were structured objects with `citation_id`, title, source type, source ID, chunk ID, excerpt, and URL; diagnoses contained returned citation IDs.
- Nonsense input: HTTP `200`; `status="no_evidence"`; exact message `No supporting information was found in the indexed guidelines for this presentation.`; diagnoses `[]`; structured interaction check remained present.
- Neo4j closed-port backend: HTTP `200`; `status="graph_unavailable"`; message `The interaction check could not run.`; `interaction_check={"status":"unavailable","interactions":[]}`; diagnosis evidence remained available.
- Unreachable dependency health: HTTP `503`; `status="unhealthy"`; Neo4j and Redis were reported `unhealthy`; Pinecone was inspected without index creation; SageMaker was `not_configured`.
- Sanitized full response bodies were written to ignored `scratch/phase6_responses.json`. All processes started for this verification were stopped; ports 8000, 5173, 8010, 8011, and 8012 were free after the run.

## Phase 7 / README

- Updated `README.md` to describe the implemented Gemini-default/SageMaker-optional path, explicit mock behavior, evaluation links, data-source documentation, and measured/blocked evaluation status.

### Final checks

- `.\.venv\Scripts\python.exe -m pytest backend/tests -q` — **PASS**, 19 passed, 2 warnings.
- `.\.venv\Scripts\python.exe backend/tests/test_flow.py` — **PASS**, all offline integration tests completed successfully.
- `frontend/npm run build` — **PASS**.
- `frontend/npm run lint` — **PASS**.
- `docker build --progress=plain -t medgraph-phase2 .` — **PASS**; only the existing two `FromAsCasing` warnings.
- Final `git status --short --branch` — clean on `phase2-evidence`.
- Final port checks: `8000=FREE`, `5173=FREE`; all temporary verification ports were also free. No MedGraph uvicorn or Vite process remained.
- Phase 2 commits are listed in the branch log; no push or merge was performed.

## Decisions

- If a source cannot be redistributed under a clear license, the repository will contain a downloader/loader and provenance documentation, not the dataset.
- Existing Pinecone vectors are treated as read-only evidence; no re-indexing or deletion will be attempted.
- Diagnosis cases will be marked `provisional` and only paraphrased, source-linked cases with clear labels will be included.
- If fewer than 20 diagnosis cases can be sourced without copying article text or violating license rules, the diagnosis evaluation will be explicitly underpowered.
