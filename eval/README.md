# MedGraph evaluation set

Audit date: 2026-11-02. Diagnosis labels are **provisional** and remain subject to user review. Vignettes are paraphrases of open-access reports and are each under 120 words; article text was not copied into the repository.

## Files

- `cases/diagnosis.jsonl`: 20 source-linked case vignettes. Each has an age, sex, symptoms, medications, provisional gold diagnosis, synonyms, and a PMCID source URL. This meets the minimum case count but is below the target of 40, so the diagnosis evaluation is underpowered.
- `cases/interactions.jsonl`: empty because the selected DDInter source could not be downloaded and verified after three timed-out attempts. No interaction labels were invented. Interaction evaluation is BLOCKED.
- `cases/controls.jsonl`: eight **synthetic negative controls** used only to exercise no-evidence boundaries: five unrelated presentations and three empty/near-empty inputs. They are not clinical validation cases.
- `review/review_sample.csv`: ten random-looking, source-linked diagnosis cases for user review. Labels remain provisional.

## Label production and limits

Diagnosis gold labels come from the diagnosis stated or clearly established in the cited open-access case report. They are not adjudicated clinical gold labels. `gold_synonyms` are normalization variants of the same report diagnosis.

Interaction positives and absence-based negatives were not produced because the primary interaction source was unavailable. When enabled, `negative_by_absence` will mean absent from the selected source only; it will not mean that a pair is clinically safe.

The no-evidence control expectation is `no_evidence`. This is a retrieval boundary check, not a statement about the absence of disease. Diagnosis top-1/top-3 matches, when measured, compare normalized returned names with `gold_synonyms`; Wilson intervals describe only this provisional sample. Interaction precision/recall requires a verified source and is currently not measured. Citation resolution checks whether each cited `citation_id` occurs in the returned retrieved-source set; it does not verify the claim made by a citation.

The Gemini-dependent evaluation is blocked by provider/API failures recorded in `scratch/PHASE2_REPORT.md`. An offline run may validate response shape and controls, but its deterministic demo reasoning is not reported as clinical accuracy.

## Case source URLs accessed

- https://pmc.ncbi.nlm.nih.gov/articles/PMC6392842/
- https://pmc.ncbi.nlm.nih.gov/articles/PMC8351385/
- https://pmc.ncbi.nlm.nih.gov/articles/PMC5414320/
- https://pmc.ncbi.nlm.nih.gov/articles/PMC9162837/
- https://pmc.ncbi.nlm.nih.gov/articles/PMC9356553/
- https://pmc.ncbi.nlm.nih.gov/articles/PMC7124881/
- https://pmc.ncbi.nlm.nih.gov/articles/PMC11398793/
- https://pmc.ncbi.nlm.nih.gov/articles/PMC7653246/
- https://pmc.ncbi.nlm.nih.gov/articles/PMC8577953/
- https://pmc.ncbi.nlm.nih.gov/articles/PMC11661901/
- https://pmc.ncbi.nlm.nih.gov/articles/PMC9817481/
- https://pmc.ncbi.nlm.nih.gov/articles/PMC8488713/
- https://pmc.ncbi.nlm.nih.gov/articles/PMC2913650/
- https://pmc.ncbi.nlm.nih.gov/articles/PMC8311323/
- https://pmc.ncbi.nlm.nih.gov/articles/PMC8830159/
- https://pmc.ncbi.nlm.nih.gov/articles/PMC8762610/
- https://pmc.ncbi.nlm.nih.gov/articles/PMC8288974/
- https://pmc.ncbi.nlm.nih.gov/articles/PMC7458705/
- https://pmc.ncbi.nlm.nih.gov/articles/PMC7871576/
- https://pmc.ncbi.nlm.nih.gov/articles/PMC2780638/
