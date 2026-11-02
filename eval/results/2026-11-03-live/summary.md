# MedGraph evaluation summary

Run mode: **live**
Diagnosis labels are provisional and the set is underpowered (20 cases versus a target of 40). The live run stopped after application errors exceeded 20 percent of the 20-case set; 9 cases were attempted.

## Metrics
- Diagnosis: Top-1: {'correct': 0, 'n': 4, 'wilson_95': [0.0, 0.4899]}; top-3: {'correct': 0, 'n': 4, 'wilson_95': [0.0, 0.4899]}. String-based matching against `gold_synonyms`.
- Controls: 0/0 returned `no_evidence` (controls were not included in this diagnosis-only live run; live retriever control boundary is recorded separately in the Phase 3 report).
- Interaction precision/recall: **BLOCKED** ? DDInter source download and schema verification timed out; no labels were invented.
- Brand/synonym mapping: blocked.
- Citation resolution: 12/12 (deterministic ID-set resolution; does not verify the cited claim).
- Diagnosis latency p50/p95 (ms): 1829.83 / 2611.97 for non-error responses.
- Gemini calls: not measured.
- Errors: 5 ? The clinical reasoning service is unavailable. Please try again..

Metrics are not clinical validation. The citation check verifies only that returned citation IDs resolve to returned source IDs; it does not verify a cited claim.
