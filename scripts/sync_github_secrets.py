import os
import subprocess
import sys
from pathlib import Path
from dotenv import load_dotenv

TARGET_VARS = ["NEO4J_URI", "NEO4J_USERNAME", "NEO4J_PASSWORD"]
REPO = "Akifali-1/MedGraph"


def sync_secrets():
    # Load .env with python-dotenv
    script_dir = Path(__file__).resolve().parent
    env_candidates = [
        script_dir.parent / ".env",
        script_dir.parent / "medgraph" / ".env",
        Path.cwd() / ".env",
        Path.cwd() / "medgraph" / ".env",
    ]
    for env_path in env_candidates:
        if env_path.is_file():
            load_dotenv(dotenv_path=env_path)
            break
    else:
        load_dotenv()

    for var_name in TARGET_VARS:
        value = os.getenv(var_name)
        if not value:
            print(var_name)
            continue

        cmd = [
            "gh",
            "secret",
            "set",
            var_name,
            "--repo",
            REPO,
            "--body-file",
            "-",
        ]

        result = subprocess.run(
            cmd,
            input=value,
            text=True,
            capture_output=True,
            shell=False,
        )

        if result.returncode != 0 and "unknown flag: --body-file" in (result.stderr or ""):
            fallback_cmd = [
                "gh",
                "secret",
                "set",
                var_name,
                "--repo",
                REPO,
            ]
            result = subprocess.run(
                fallback_cmd,
                input=value,
                text=True,
                capture_output=True,
                shell=False,
            )

        if result.returncode == 0:
            print(f"{var_name} ok")
        else:
            print(f"{var_name} failed, exit code {result.returncode}")


if __name__ == "__main__":
    sync_secrets()

