# MedGraph evaluation summary

Run mode: **offline**
Diagnosis labels are provisional and the set is underpowered (20 cases versus a target of 40).

## Metrics
- Diagnosis: Not measured (offline deterministic reasoning was used; it is not a clinical accuracy measurement).
- Controls: 8/8 returned `no_evidence` (synthetic boundary controls).
- Interaction precision/recall: **BLOCKED** — DDInter source download and schema verification timed out; no labels were invented.
- Brand/synonym mapping: blocked.
- Citation resolution: 37/37 (deterministic ID-set resolution; does not verify the cited claim).
- Diagnosis latency p50/p95 (ms): 36.98 / 106.21.
- Gemini calls: 0.
- Errors: 0 — none.

Metrics are not clinical validation. The citation check verifies only that returned citation IDs resolve to returned source IDs; it does not verify a cited claim.
