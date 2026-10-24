import re
from typing import Any, Dict, List, Tuple


def verify_diagnosis_citations(
    diagnoses: List[Dict[str, Any]], chunks: List[str]
) -> Tuple[List[Dict[str, Any]], bool]:
    """Verify specific reference identifiers, rather than generic word overlap."""
    text = "\n".join(chunks).lower()
    verified = []
    warnings = False
    for diagnosis in diagnoses:
        citations = []
        for citation in diagnosis.get("citations", []):
            cleaned = " ".join(str(citation).lower().split())
            guideline = re.search(r"\bguideline\s+(\d+)\b", cleaned)
            chunk = re.fullmatch(r"chunk\s+(\d+)", cleaned)
            if guideline:
                matched = bool(re.search(
                    rf"\bguideline\s+{re.escape(guideline.group(1))}\b", text
                ))
            elif chunk:
                matched = 1 <= int(chunk.group(1)) <= len(chunks)
            else:
                matched = bool(cleaned) and cleaned in text
            if matched:
                citations.append(citation)
            else:
                warnings = True
        verified.append({**diagnosis, "citations": citations})
    return verified, warnings
