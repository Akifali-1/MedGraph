# MedGraph evaluation summary

Run mode: **live**
Diagnosis labels are provisional and the set is underpowered (20 cases versus a target of 40).

## Metrics
- Diagnosis: Top-1: {'n': 18, 'correct': 1, 'wilson_95': [0.0099, 0.2576]}; top-3: {'n': 18, 'correct': 1, 'wilson_95': [0.0099, 0.2576]}.
- Controls: 0/0 returned `no_evidence` (synthetic boundary controls).
- Interaction precision/recall: **BLOCKED** — DDInter source download and schema verification timed out; no labels were invented.
- Brand/synonym mapping: blocked.
- Citation resolution: 32/32 (deterministic ID-set resolution; does not verify the cited claim).
- Diagnosis latency p50/p95 (ms): 5425.1 / 23881.87.
- Gemini calls: not measured.
- Errors: 2 — The clinical reasoning service is unavailable. Please try again..

Metrics are not clinical validation. The citation check verifies only that returned citation IDs resolve to returned source IDs; it does not verify a cited claim.
