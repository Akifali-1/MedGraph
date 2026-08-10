# MedGraph AI Unified AWS Deployment Script
# Compiles frontend, logs into ECR, builds & pushes backend container, syncs static assets to S3, and applies ECS Fargate routing.

# Run from root directory of MedGraph repo
$ErrorActionPreference = "Stop"

Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "             MEDGRAPH AI DEPLOYMENT AGENT              " -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan

# 1. Start Docker Desktop if not running
Write-Host "`n[1/7] Checking Docker Engine state..." -ForegroundColor Cyan
$oldPreference = $ErrorActionPreference
$ErrorActionPreference = "SilentlyContinue"
docker info >$null 2>&1
$dockerExit = $LASTEXITCODE
$ErrorActionPreference = $oldPreference

if ($dockerExit -ne 0) {
    Write-Host "Docker is not running. Attempting to launch Docker Desktop..." -ForegroundColor Yellow
    Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    Write-Host "Please wait for the Docker Desktop Engine to boot and become green..." -ForegroundColor Yellow
    Write-Host "Once Docker is ready, press any key to resume this deployment script..." -ForegroundColor Yellow
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    
    # Check again
    $ErrorActionPreference = "SilentlyContinue"
    docker info >$null 2>&1
    $dockerExit = $LASTEXITCODE
    $ErrorActionPreference = $oldPreference
    if ($dockerExit -ne 0) {
        Write-Error "Docker daemon connection failed. Please ensure Docker Desktop is fully running and try again."
        exit 1
    }
}
Write-Host "Docker Engine is responsive." -ForegroundColor Green

# 2. Initialize Baseline Terraform State (ECR, S3, Secrets Manager, CloudFront)
Write-Host "`n[2/7] Ensuring baseline AWS infrastructure (ECR, S3, Secrets) is present..." -ForegroundColor Cyan
cd terraform
terraform init
Write-Host "Running terraform apply for baseline static resources..." -ForegroundColor Gray
terraform apply -var="enable_backend=false" -auto-approve
if ($LASTEXITCODE -ne 0) {
    Write-Error "Baseline Terraform apply failed. Check AWS CLI credentials/permissions."
    cd ..
    exit 1
}

# 3. Retrieve target endpoints from Terraform
$ecr_repo = (terraform output -raw ecr_repository_url).Trim()
$cf_dist_id = (terraform output -raw cloudfront_distribution_id).Trim()
$cloudfront_url = (terraform output -raw frontend_cloudfront_url).Trim()
$s3_bucket = (terraform output -raw frontend_bucket_name).Trim()
cd ..

if ([string]::IsNullOrEmpty($ecr_repo)) {
    Write-Error "Could not retrieve ECR repository url from terraform."
    exit 1
}
Write-Host "ECR Repository target: $ecr_repo" -ForegroundColor Green
$ecr_registry = $ecr_repo.Split('/')[0]

# 4. Authenticate Docker with AWS ECR
Write-Host "`n[3/7] Logging Docker into AWS ECR Registry..." -ForegroundColor Cyan
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin $ecr_registry
if ($LASTEXITCODE -ne 0) {
    Write-Error "ECR Authentication failed."
    exit 1
}
Write-Host "Docker login succeeded." -ForegroundColor Green

# 5. Build, Tag, and Push Backend Image
Write-Host "`n[4/7] Compiling backend container and pushing to ECR..." -ForegroundColor Cyan
Write-Host "Building Docker image..." -ForegroundColor Gray
docker build -t medgraph-backend .
if ($LASTEXITCODE -ne 0) {
    Write-Error "Docker build failed."
    exit 1
}

Write-Host "Tagging image as latest..." -ForegroundColor Gray
docker tag medgraph-backend:latest "${ecr_repo}:latest"

Write-Host "Pushing image to AWS ECR registry..." -ForegroundColor Gray
docker push "${ecr_repo}:latest"
if ($LASTEXITCODE -ne 0) {
    Write-Error "ECR Push failed."
    exit 1
}
Write-Host "Backend image pushed successfully to ECR." -ForegroundColor Green

# 6. Build Frontend React SPA
Write-Host "`n[5/7] Building production React frontend..." -ForegroundColor Cyan
cd frontend
Write-Host "Installing npm dependencies..." -ForegroundColor Gray
npm install
Write-Host "Compiling static build files..." -ForegroundColor Gray
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Error "Vite compilation failed."
    cd ..
    exit 1
}
cd ..
Write-Host "Frontend compiled successfully." -ForegroundColor Green

# 7. Apply Full ECS Fargate Infrastructure
Write-Host "`n[6/7] Deploying Fargate Cluster, Load Balancer, and Active Task..." -ForegroundColor Cyan
cd terraform
terraform apply -var="enable_backend=true" -auto-approve
if ($LASTEXITCODE -ne 0) {
    Write-Error "ECS Fargate deployment failed."
    cd ..
    exit 1
}
$alb_dns = (terraform output -raw backend_alb_dns_name).Trim()
cd ..
Write-Host "Fargate Cluster active. Target ALB DNS: http://$alb_dns" -ForegroundColor Green

# 8. Sync Assets and Invalidate CDN Cache
Write-Host "`n[7/7] Uploading frontend build to S3 and invalidating CDN cache..." -ForegroundColor Cyan
aws s3 sync frontend/dist/ "s3://$s3_bucket" --delete
if ($LASTEXITCODE -ne 0) {
    Write-Error "S3 sync failed."
    exit 1
}

Write-Host "Invalidating CloudFront CDN cache for path /* (Distribution: $cf_dist_id)..." -ForegroundColor Gray
aws cloudfront create-invalidation --distribution-id $cf_dist_id --paths "/*"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Warning: Cache invalidation failed. The client changes might take up to 24 hours to propagate." -ForegroundColor Yellow
} else {
    Write-Host "Cache invalidation requested successfully." -ForegroundColor Green
}

Write-Host "`n=======================================================" -ForegroundColor Green
Write-Host "           MEDGRAPH AI DEPLOYMENT COMPLETED!           " -ForegroundColor Green
Write-Host "=======================================================" -ForegroundColor Green
Write-Host "  Frontend URL : $cloudfront_url" -ForegroundColor Green
Write-Host "  Backend ALB  : http://$alb_dns" -ForegroundColor Green
Write-Host "=======================================================" -ForegroundColor Green
