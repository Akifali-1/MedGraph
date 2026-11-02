"""Run the bounded MedGraph evaluation against the local DAG endpoint."""

from __future__ import annotations

import argparse
import json
import math
import os
import statistics
import subprocess
import sys
import time
from datetime import date
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
CASES_DIR = ROOT / "eval" / "cases"


def load_jsonl(path: Path) -> list[dict[str, Any]]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def wilson_interval(correct: int, n: int, z: float = 1.959963984540054) -> list[float] | None:
    if n == 0:
        return None
    proportion = correct / n
    denominator = 1 + z * z / n
    centre = (proportion + z * z / (2 * n)) / denominator
    margin = z * math.sqrt((proportion * (1 - proportion) + z * z / (4 * n)) / n) / denominator
    return [round(max(0.0, centre - margin), 4), round(min(1.0, centre + margin), 4)]


def normalize(value: str) -> str:
    return "".join(char for char in value.lower() if char.isalnum())


def percentile(values: list[float], quantile: float) -> float | None:
    if not values:
        return None
    values = sorted(values)
    position = (len(values) - 1) * quantile
    lower = math.floor(position)
    upper = math.ceil(position)
    if lower == upper:
        return round(values[lower], 2)
    return round(values[lower] + (values[upper] - values[lower]) * (position - lower), 2)


def request_json(url: str, payload: dict[str, Any], retries: int = 3) -> tuple[int, dict[str, Any], float, str | None]:
    started = time.perf_counter()
    last_error = None
    for attempt in range(retries + 1):
        request = Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urlopen(request, timeout=150) as response:
                body = response.read().decode("utf-8")
                return response.status, json.loads(body), (time.perf_counter() - started) * 1000, None
        except HTTPError as exc:
            try:
                body = json.loads(exc.read().decode("utf-8"))
            except Exception:
                body = {}
            last_error = f"HTTP {exc.code}: {body.get('detail', exc.reason)}"
            if exc.code != 429 or attempt >= retries:
                return exc.code, body, (time.perf_counter() - started) * 1000, last_error
            time.sleep(2 ** attempt)
        except (URLError, TimeoutError, OSError) as exc:
            last_error = f"{type(exc).__name__}: {exc}"
            if attempt >= retries:
                return 0, {}, (time.perf_counter() - started) * 1000, last_error
            time.sleep(2 ** attempt)
    return 0, {}, (time.perf_counter() - started) * 1000, last_error


def sanitize_result(case: dict[str, Any], status_code: int, result: dict[str, Any], latency_ms: float, error: str | None) -> dict[str, Any]:
    return {
        "id": case["id"],
        "kind": "diagnosis" if case["id"].startswith("dx-") else "control",
        "status_code": status_code,
        "status": result.get("status"),
        "message": result.get("message"),
        "diagnoses": result.get("diagnoses", []),
        "interaction_check": result.get("interaction_check"),
        "citations": result.get("citations", []),
        "retrieved_sources": result.get("retrieved_sources", []),
        "step_timings": result.get("step_timings"),
        "total_latency_ms": round(latency_ms, 2),
        "error": error,
    }


def run_case_set(base_url: str, cases: list[dict[str, Any]], offline: bool) -> list[dict[str, Any]]:
    results = []
    # Keep the endpoint and provider budget below eight requests per minute in
    # both modes. Offline mode still exercises the real HTTP route.
    minimum_interval = 7.6
    last_request = 0.0
    total_cases = len(cases)
    for case in cases:
        elapsed = time.monotonic() - last_request
        if last_request and elapsed < minimum_interval:
            time.sleep(minimum_interval - elapsed)
        payload = {
            "age": case["age"],
            "sex": case["sex"],
            "symptoms": case["symptoms"],
            "medications": case.get("medications", []),
            "comorbidities": case.get("comorbidities", []),
        }
        status_code, result, latency_ms, error = request_json(f"{base_url}/diagnose", payload)
        last_request = time.monotonic()
        results.append(sanitize_result(case, status_code, result, latency_ms, error))
        errors = sum(1 for item in results if item["error"] or item["status_code"] >= 400)
        if errors / max(total_cases, 1) > 0.20:
            break
    return results


def build_summary(results: list[dict[str, Any]], diagnosis_cases: list[dict[str, Any]], controls: list[dict[str, Any]], offline: bool) -> dict[str, Any]:
    by_id = {item["id"]: item for item in results}
    diagnosis_results = [by_id[case["id"]] for case in diagnosis_cases if case["id"] in by_id]
    control_results = [by_id[case["id"]] for case in controls if case["id"] in by_id]
    valid_diagnosis = [item for item in diagnosis_results if not item["error"] and item["status_code"] < 400]
    no_evidence_controls = [item for item in control_results if item.get("status") == "no_evidence"]
    citation_total = 0
    citation_resolved = 0
    for item in results:
        source_ids = {source.get("citation_id") for source in item.get("retrieved_sources", [])}
        for citation in item.get("citations", []):
            citation_total += 1
            if citation.get("citation_id") in source_ids:
                citation_resolved += 1

    if offline:
        diagnosis_metric: dict[str, Any] = {
            "status": "not_measured",
            "reason": "offline deterministic reasoning was used; it is not a clinical accuracy measurement",
        }
    else:
        top1 = 0
        top3 = 0
        for case in diagnosis_cases:
            item = by_id.get(case["id"])
            if not item or item["error"]:
                continue
            names = [normalize(d.get("name", "")) for d in item.get("diagnoses", [])]
            gold = {normalize(case["gold_diagnosis"]), *(normalize(value) for value in case.get("gold_synonyms", []))}
            if names and names[0] in gold:
                top1 += 1
            if any(name in gold for name in names[:3]):
                top3 += 1
        diagnosis_metric = {
            "top1": {"n": len(valid_diagnosis), "correct": top1, "wilson_95": wilson_interval(top1, len(valid_diagnosis))},
            "top3": {"n": len(valid_diagnosis), "correct": top3, "wilson_95": wilson_interval(top3, len(valid_diagnosis))},
        }

    latency_values = [item["total_latency_ms"] for item in valid_diagnosis]
    return {
        "run_mode": "offline" if offline else "live",
        "diagnosis_cases": len(diagnosis_cases),
        "diagnosis_cases_evaluated": len(valid_diagnosis),
        "diagnosis_metric": diagnosis_metric,
        "controls": {
            "n": len(control_results),
            "no_evidence": len(no_evidence_controls),
            "rate": (len(no_evidence_controls) / len(control_results)) if control_results else None,
        },
        "interactions": {"status": "blocked", "reason": "DDInter source download and schema verification timed out; no labels were invented"},
        "brand_synonym_mapping": {"status": "blocked", "correct": 0, "total": 0},
        "citation_resolution": {
            "resolved": citation_resolved,
            "total": citation_total,
            "rate": (citation_resolved / citation_total) if citation_total else None,
            "note": "deterministic ID-set resolution; does not verify the cited claim",
        },
        "diagnosis_latency_ms": {"p50": percentile(latency_values, 0.50), "p95": percentile(latency_values, 0.95)},
        "gemini_calls_used": 0 if offline else "not measured",
        "errors": {
            "count": sum(1 for item in results if item["error"] or item["status_code"] >= 400),
            "reasons": sorted({item["error"] for item in results if item["error"]}),
        },
        "provenance": {
            "label_status": "provisional",
            "diagnosis_set_underpowered": len(diagnosis_cases) < 40,
            "synthetic_controls": True,
            "live_gemini_metrics": "not measured" if offline else "measured only if provider responses completed",
        },
    }


def summary_markdown(summary: dict[str, Any]) -> str:
    diagnosis = summary["diagnosis_metric"]
    if diagnosis.get("status") == "not_measured":
        diagnosis_text = f"Not measured ({diagnosis['reason']})."
    else:
        diagnosis_text = f"Top-1: {diagnosis['top1']}; top-3: {diagnosis['top3']}."
    controls = summary["controls"]
    return "\n".join([
        "# MedGraph evaluation summary",
        "",
        f"Run mode: **{summary['run_mode']}**",
        "Diagnosis labels are provisional and the set is underpowered (20 cases versus a target of 40).",
        "",
        "## Metrics",
        f"- Diagnosis: {diagnosis_text}",
        f"- Controls: {controls['no_evidence']}/{controls['n']} returned `no_evidence` (synthetic boundary controls).",
        f"- Interaction precision/recall: **BLOCKED** — {summary['interactions']['reason']}.",
        f"- Brand/synonym mapping: {summary['brand_synonym_mapping']['status']}.",
        f"- Citation resolution: {summary['citation_resolution']['resolved']}/{summary['citation_resolution']['total']} ({summary['citation_resolution']['note']}).",
        f"- Diagnosis latency p50/p95 (ms): {summary['diagnosis_latency_ms']['p50']} / {summary['diagnosis_latency_ms']['p95']}.",
        f"- Gemini calls: {summary['gemini_calls_used']}.",
        f"- Errors: {summary['errors']['count']} — {', '.join(summary['errors']['reasons']) or 'none'}.",
        "",
        "Metrics are not clinical validation. The citation check verifies only that returned citation IDs resolve to returned source IDs; it does not verify a cited claim.",
    ]) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--date", default=date.today().isoformat())
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--offline", action="store_true", help="Use explicit deterministic test mode; do not report clinical accuracy.")
    args = parser.parse_args()
    output_dir = ROOT / "eval" / "results" / args.date
    output_dir.mkdir(parents=True, exist_ok=True)

    diagnosis_cases = load_jsonl(CASES_DIR / "diagnosis.jsonl")
    controls = load_jsonl(CASES_DIR / "controls.jsonl")
    cases = diagnosis_cases + controls
    env = os.environ.copy()
    env["ALLOW_TEST_AUTH"] = "true"
    if args.offline:
        env["TESTING"] = "true"
        env["MOCK_NEO4J"] = "true"
        env["MOCK_REDIS"] = "true"
    server = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "backend.main:app", "--host", "127.0.0.1", "--port", str(args.port)],
        cwd=ROOT,
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    base_url = f"http://127.0.0.1:{args.port}"
    results: list[dict[str, Any]] = []
    try:
        for _ in range(60):
            try:
                with urlopen(f"{base_url}/health", timeout=2):
                    break
            except Exception:
                if server.poll() is not None:
                    raise RuntimeError(f"uvicorn exited with code {server.returncode}")
                time.sleep(0.25)
        results = run_case_set(base_url, cases, args.offline)
    finally:
        server.terminate()
        try:
            server.wait(timeout=10)
        except subprocess.TimeoutExpired:
            server.kill()
            server.wait(timeout=10)

    with (output_dir / "results.jsonl").open("w", encoding="utf-8") as handle:
        for result in results:
            handle.write(json.dumps(result, sort_keys=True) + "\n")
    summary = build_summary(results, diagnosis_cases, controls, args.offline)
    (output_dir / "summary.json").write_text(json.dumps(summary, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    (output_dir / "summary.md").write_text(summary_markdown(summary), encoding="utf-8")
    print(json.dumps({"output_dir": str(output_dir), "cases_written": len(results), "errors": summary["errors"]["count"]}, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
