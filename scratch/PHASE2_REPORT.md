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

## Decisions

- If a source cannot be redistributed under a clear license, the repository will contain a downloader/loader and provenance documentation, not the dataset.
- Existing Pinecone vectors are treated as read-only evidence; no re-indexing or deletion will be attempted.
- Diagnosis cases will be marked `provisional` and only paraphrased, source-linked cases with clear labels will be included.
- If fewer than 20 diagnosis cases can be sourced without copying article text or violating license rules, the diagnosis evaluation will be explicitly underpowered.
