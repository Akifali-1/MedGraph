# MedGraph AI AWS Startup Script
# Spins up the existing ECS/ALB backend infrastructure. SageMaker is opt-in.

param(
    [switch]$StartSageMaker
)

$ErrorActionPreference = "Stop"

Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "             MEDGRAPH AI STARTUP AGENT                 " -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan

# 1. Scale up ECS and ALB backend resources via Terraform
Write-Host "`n[1/2] Spinning up ECS Fargate and ALB resources via Terraform..." -ForegroundColor Cyan
cd terraform
$sagemaker_enabled = $StartSageMaker.IsPresent.ToString().ToLower()
terraform apply -var="enable_backend=true" -var="enable_sagemaker=$sagemaker_enabled" -auto-approve
$alb_dns = (terraform output -raw backend_alb_dns_name).Trim()
$cloudfront_url = (terraform output -raw frontend_cloudfront_url).Trim()
cd ..

# 2. SageMaker is opt-in because the Gemini path is the default and does not
# require a continuously running GPU endpoint.
if ($StartSageMaker) {
    Write-Host "`n[2/2] Launching SageMaker GPU Endpoint..." -ForegroundColor Cyan
    if (Test-Path ".venv\Scripts\python.exe") {
        & .venv\Scripts\python.exe fine_tuning/manage_sagemaker.py start
    } else {
        python fine_tuning/manage_sagemaker.py start
    }
} else {
    Write-Host "`n[2/2] SageMaker disabled; Gemini fallback remains active." -ForegroundColor Yellow
}

Write-Host "`n=======================================================" -ForegroundColor Green
Write-Host "             AWS RESOURCES STARTING UP!                " -ForegroundColor Green
Write-Host "=======================================================" -ForegroundColor Green
Write-Host "  Frontend URL       : $cloudfront_url" -ForegroundColor Green
Write-Host "  Backend ALB URL    : http://$alb_dns" -ForegroundColor Green
Write-Host "  SageMaker Endpoint : $(if ($StartSageMaker) { 'Spin up requested' } else { 'Disabled' })" -ForegroundColor Green
Write-Host "=======================================================" -ForegroundColor Green
