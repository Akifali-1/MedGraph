"""Copy the newest evaluation summary into the frontend data bundle."""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
RESULTS_ROOT = ROOT / "eval" / "results"
DESTINATION = ROOT / "frontend" / "src" / "data" / "latest_eval_summary.json"


def main() -> int:
    summaries = sorted(path for path in RESULTS_ROOT.glob("*/summary.json") if path.is_file())
    if not summaries:
        raise SystemExit("No evaluation summary.json files were found.")
    latest = summaries[-1]
    DESTINATION.parent.mkdir(parents=True, exist_ok=True)
    payload = json.loads(latest.read_text(encoding="utf-8"))
    payload["summary_path"] = latest.relative_to(ROOT).as_posix()
    DESTINATION.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"Copied {latest.relative_to(ROOT)} to {DESTINATION.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
