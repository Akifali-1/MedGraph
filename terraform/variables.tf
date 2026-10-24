variable "aws_region" {
  type        = string
  description = "The AWS region to deploy resources in"
  default     = "us-east-1"
}

variable "project_name" {
  type        = string
  description = "Name of the project to be prefixed to resources"
  default     = "medgraph"
}

variable "environment" {
  type        = string
  description = "Deployment environment (e.g. dev, staging, prod)"
  default     = "prod"
}

variable "enable_backend" {
  type        = bool
  description = "Toggle to spin up/down ECS and ALB backend resources to save costs"
  default     = true
}

variable "enable_sagemaker" {
  type        = bool
  description = "Enable the optional SageMaker reasoning endpoint. Gemini remains the default when disabled."
  default     = false
}

variable "sagemaker_endpoint_name" {
  type        = string
  description = "SageMaker endpoint name used only when enable_sagemaker is true"
  default     = "medgraph-gemma-endpoint"
}
