#!/usr/bin/env python3
"""
MedGraph AWS Cost & Deployment Controller
==========================================
Usage:
    python cloud_control.py status   # Check current AWS running state and hourly costs
    python cloud_control.py stop     # Completely stop ALB + ECS Fargate (drops compute to $0.00/hr)
    python cloud_control.py start    # Spin up ALB + ECS Fargate for demo/interview (~2 mins)
"""

import os
import sys
import time
import subprocess
import json
from pathlib import Path

# Fix Windows console encoding
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

REPO_ROOT = Path(__file__).resolve().parent
TERRAFORM_DIR = REPO_ROOT / "terraform"
ENV_FILE = REPO_ROOT / ".env"

CLOUDFRONT_URL = "https://dtqkyoln1vljw.cloudfront.net"

def load_env():
    """Load credentials from .env if not in environment."""
    env = os.environ.copy()
    if ENV_FILE.exists():
        with open(ENV_FILE, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    k = k.strip()
                    v = v.strip().strip('"').strip("'")
                    if k not in env:
                        env[k] = v
    env["AWS_DEFAULT_REGION"] = env.get("AWS_REGION", "us-east-1")
    return env

def get_status():
    """Check whether backend ECS/ALB is active and compute costs."""
    print("==================================================")
    print("  MedGraph Cloud Deployment Status")
    print("==================================================")
    env = load_env()
    
    # Check via AWS CLI or Terraform output
    cmd = ["terraform", "output", "-json"]
    try:
        res = subprocess.run(cmd, cwd=TERRAFORM_DIR, capture_output=True, text=True, env=env)
        if res.returncode == 0:
            outputs = json.loads(res.stdout)
            alb = outputs.get("backend_alb_dns_name", {}).get("value", "disabled")
            if alb and alb != "disabled":
                print(f"Backend (ECS + ALB):   [ACTIVE / RUNNING]")
                print(f"ALB DNS:               {alb}")
                print(f"CloudFront URL:        {CLOUDFRONT_URL}")
                print(f"Estimated Cost:        ~$0.04/hour (~$30/mo) while running")
                
                # Check live health
                try:
                    import urllib.request
                    req = urllib.request.Request(f"{CLOUDFRONT_URL}/health", headers={"User-Agent": "cloud-control"})
                    with urllib.request.urlopen(req, timeout=5) as r:
                        if r.status == 200:
                            print(f"Live Health Check:     [OK] - API responds 200 Healthy!")
                        else:
                            print(f"Live Health Check:     [STATUS {r.status}]")
                except Exception as e:
                    print(f"Live Health Check:     [CONNECTING / WARMING UP]")
            else:
                print(f"Backend (ECS + ALB):   [STOPPED / HIBERNATING]")
                print(f"Frontend (CloudFront): [ACTIVE] (Static CDN: $0.00/hr)")
                print(f"Estimated Cost:        $0.00/hour (All compute charges stopped!)")
        else:
            print("[!] Could not query Terraform state.")
    except Exception as e:
        print(f"[!] Error checking status: {e}")
    print("==================================================")

def stop_backend():
    """Destroy ALB & ECS service to bring AWS compute costs to $0.00/hour."""
    print("[*] Hibernating MedGraph Backend to save AWS credits ($0.00/hour)...")
    print("    - Tearing down Application Load Balancer and ECS Fargate instances.")
    print("    - Preserving S3 Frontend, CloudFront CDN, ECR Docker Image, and SSM Secrets.")
    env = load_env()
    cmd = ["terraform", "apply", "-var=enable_backend=false", "-auto-approve"]
    p = subprocess.run(cmd, cwd=TERRAFORM_DIR, env=env)
    if p.returncode == 0:
        print("\n[OK] MedGraph Backend is completely STOPPED!")
        print("     Ongoing compute costs are now $0.00/hour.")
        print(f"     Static frontend remains served at {CLOUDFRONT_URL}.")
    else:
        print("\n[!] Failed to stop backend. Check Terraform logs.")

def start_backend():
    """Spin up ALB & ECS service with the pushed image for demos/interviews."""
    print("[*] Starting MedGraph Backend for interview/demo...")
    print("    - Provisioning Application Load Balancer and ECS Fargate service...")
    print("    - Launching backend with latest pushed ECR Docker image...")
    env = load_env()
    cmd = ["terraform", "apply", "-var=enable_backend=true", "-auto-approve"]
    p = subprocess.run(cmd, cwd=TERRAFORM_DIR, env=env)
    if p.returncode == 0:
        print("\n[OK] MedGraph Backend provisioned!")
        print(f"[*] Verifying health at {CLOUDFRONT_URL}/health ...")
        
        # Poll health endpoint for up to 90 seconds
        import urllib.request
        for _ in range(18):
            time.sleep(5)
            try:
                req = urllib.request.Request(f"{CLOUDFRONT_URL}/health", headers={"User-Agent": "cloud-control"})
                with urllib.request.urlopen(req, timeout=5) as r:
                    if r.status == 200:
                        print(f"[OK] MedGraph is 100% LIVE and HEALTHY at {CLOUDFRONT_URL}!")
                        return
            except Exception:
                print("    Waiting for container registration and ALB target group health check...")
        print(f"[OK] Backend started. CloudFront URL: {CLOUDFRONT_URL}")
    else:
        print("\n[!] Failed to start backend. Check Terraform logs.")

if __name__ == "__main__":
    action = sys.argv[1].lower() if len(sys.argv) > 1 else "status"
    if action == "status":
        get_status()
    elif action == "stop":
        stop_backend()
    elif action == "start":
        start_backend()
    else:
        print("Usage: python cloud_control.py [status|stop|start]")
