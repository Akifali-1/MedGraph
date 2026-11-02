# MedGraph data sources

Audit date: 2026-11-02. This document records the sources considered for the Phase 2 evidence work. It does not grant a license beyond the source terms.

## Drug-drug interactions

### Primary candidate: DDInter 2.0

- Name: DDInter 2.0.
- URLs used: [download page](https://ddinter2.scbdd.com/download/), [terms](https://ddinter2.scbdd.com/terms/), [publication](https://pmc.ncbi.nlm.nih.gov/articles/PMC11701621/).
- Version/date: DDInter 2.0; publication dated 2024-08-24. The download page was accessed on 2026-11-02.
- License: Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0), according to the DDInter terms page.
- Redistribution: allowed for non-commercial use with attribution and ShareAlike obligations; not a commercial redistribution license. Any committed subset would need attribution and the same license terms.
- Fields: the DDInter site describes risk levels, mechanism descriptions, management strategies, and alternatives. Risk levels include minor, moderate, and major. The downloaded CSV could not be retrieved in this environment after three timed-out attempts, so its exact column names were not independently recorded.
- Intended use: a source-attributed local interaction loader would map DDInter drug pairs to `INTERACTS_WITH`, preserve the DDInter risk level as `severity`, and retain source/version metadata on nodes and edges.
- Phase 2 decision: chosen as the primary source because it has a published release, a stated non-commercial redistribution license, and an explicit risk-level field. The actual graph replacement is blocked until the source file can be downloaded and its schema verified.

### RxNav / NLM interaction API

- Name: NLM RxNav Drug-Drug Interaction API.
- URLs used: [NLM FAQ](https://lhncbc.nlm.nih.gov/RxNav/information/FAQs.html), [NLM APIs](https://lhncbc.nlm.nih.gov/RxNav/APIs/index.html).
- Version/date: interaction features discontinued January 2, 2024; the general RxNorm APIs remain available.
- License/redistribution: the interaction endpoint is discontinued, so it is not a usable current interaction source for this project. RxNorm terminology licensing is separate and does not restore the discontinued interaction dataset.
- Fields: the discontinued service is not a current source for severity or interaction records.
- Intended use: none. `seed_rxnav.py` must not be described as an RxNav data integration.

### DrugBank academic data

- Name: DrugBank academic drug-interaction data.
- URLs used: [academic research](https://go.drugbank.com/academic_research), [terms](https://trust.drugbank.com/drugbank-trust-center/terms-of-use), [interaction parameters](https://dev.drugbank.com/guides/drug_interactions/parameters), [release page](https://portal.drugbank.com/releases/latest).
- Version/date: the release page identified version 5.1.22; academic downloads were reported temporarily paused when accessed on 2026-11-02.
- License: academic access is non-commercial and requires eligibility/verification. The release page also describes CC BY-NC 4.0 for academic downloads; the terms restrict distribution and use outside the granted license.
- Redistribution: not assumed for this repository without a verified academic license and the applicable download terms. No DrugBank data was downloaded or committed.
- Fields: DrugBank documents `minor`, `moderate`, and `major` severity levels plus action, evidence level, extended description, and management fields.
- Intended use: only after verified licensed access; no current Phase 2 seed uses it.

## Disease-symptom associations

### Columbia Disease-Symptom Knowledge Database

- URL used: [Columbia source page](http://people.dbmi.columbia.edu/~friedma/Projects/DiseaseSymptomKB/index.html).
- Source description: generated from textual discharge summaries for New York Presbyterian Hospital admissions during 2004 using MedLEE UMLS extraction and statistical frequency/co-occurrence methods. The page cites Wang et al., AMIA 2008, PMCID `PMC2656103`.
- Count meaning: the second column is the number of discharge summaries containing a positive and current mention of the disease. It is not the number of co-occurrences for a particular symptom edge.
- Association ordering: symptoms are ranked by strength of association, but the page does not expose a numeric per-edge association value in the table.
- Phase 2 formula decision: because the count is disease occurrence and not edge-level co-occurrence, `seed_columbia.py` retains a rank-based score as a **heuristic**. The code must not call it a co-occurrence weight or a measured probability. A future change would require an interpretable edge-level statistic from the source authors.
- Redistribution: this audit did not identify a clear dataset redistribution license on the source page. The project uses the public page as a source reference and does not add a copied Columbia dataset to the repository.

## Source URLs accessed in Phase 2

- https://ddinter2.scbdd.com/download/
- https://ddinter2.scbdd.com/terms/
- https://pmc.ncbi.nlm.nih.gov/articles/PMC11701621/
- https://lhncbc.nlm.nih.gov/RxNav/information/FAQs.html
- https://lhncbc.nlm.nih.gov/RxNav/APIs/index.html
- https://go.drugbank.com/academic_research
- https://trust.drugbank.com/drugbank-trust-center/terms-of-use
- https://dev.drugbank.com/guides/drug_interactions/parameters
- https://portal.drugbank.com/releases/latest
- http://people.dbmi.columbia.edu/~friedma/Projects/DiseaseSymptomKB/index.html
