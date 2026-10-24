# MedGraph AI AWS Teardown Script
# Scales down ECS/ALB resources to save costs, while preserving S3 and ECR assets.

param(
    [switch]$StopSageMaker
)

$ErrorActionPreference = "Stop"

Write-Host "=======================================================" -ForegroundColor Yellow
Write-Host "             MEDGRAPH AI TEARDOWN AGENT                " -ForegroundColor Yellow
Write-Host "=======================================================" -ForegroundColor Yellow

# 1. Stop SageMaker only when explicitly requested.
if ($StopSageMaker) {
    Write-Host "`n[1/2] Stopping SageMaker GPU Endpoint..." -ForegroundColor Cyan
    if (Test-Path ".venv\Scripts\python.exe") {
        & .venv\Scripts\python.exe fine_tuning/manage_sagemaker.py stop
    } else {
        python fine_tuning/manage_sagemaker.py stop
    }
} else {
    Write-Host "`n[1/2] SageMaker stop skipped; no endpoint is configured by default." -ForegroundColor Yellow
}

# 2. Scale down ECS and ALB backend resources via Terraform
Write-Host "`n[2/2] Scaling down ECS Fargate and ALB resources via Terraform..." -ForegroundColor Cyan
cd terraform
terraform apply -var="enable_backend=false" -auto-approve
cd ..

Write-Host "`n=======================================================" -ForegroundColor Green
Write-Host "             AWS RESOURCES SHUT DOWN!                  " -ForegroundColor Green
Write-Host "=======================================================" -ForegroundColor Green
Write-Host "  SageMaker Endpoint : Inactive" -ForegroundColor Green
Write-Host "  ECS/ALB Backend    : Destroyed (enable_backend=false)" -ForegroundColor Green
Write-Host "=======================================================" -ForegroundColor Green
