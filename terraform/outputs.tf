output "frontend_cloudfront_url" {
  value       = "https://${aws_cloudfront_distribution.frontend_cdn.domain_name}"
  description = "The secure global HTTPS endpoint for the MedGraph Frontend"
}

output "cloudfront_distribution_id" {
  value       = aws_cloudfront_distribution.frontend_cdn.id
  description = "The ID of the CloudFront CDN distribution"
}

output "backend_alb_dns_name" {
  value       = var.enable_backend ? aws_lb.backend_alb[0].dns_name : "disabled"
  description = "The DNS name of the Application Load Balancer hosting the FastAPI backend"
}

output "ecr_repository_url" {
  value       = aws_ecr_repository.backend_ecr.repository_url
  description = "The ECR repository URL to push Docker backend images to"
}

output "sagemaker_role_arn" {
  value       = data.aws_iam_role.sagemaker_role.arn
  description = "The custom IAM role ARN to use for launching AWS SageMaker Gemma endpoints"
}

output "frontend_bucket_name" {
  value       = aws_s3_bucket.frontend_bucket.id
  description = "The S3 bucket hosting static web files"
}
