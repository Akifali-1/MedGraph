# ==========================================
# 1. AWS CALLER IDENTITY DATA SOURCE
# ==========================================

data "aws_caller_identity" "current" {}


# ==========================================
# 2. IAM ROLES (LEAST PRIVILEGE)
# ==========================================

# SageMaker Execution Role (Data source for existing role)
data "aws_iam_role" "sagemaker_role" {
  name = "medgraph-sagemaker-execution-role"
}

# ECS Task Execution Role (to pull ECR images, send logs, and fetch Secrets)
resource "aws_iam_role" "ecs_execution_role" {
  count = var.enable_backend ? 1 : 0
  name  = "${var.project_name}-${var.environment}-ecs-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_execution_standard" {
  count      = var.enable_backend ? 1 : 0
  role       = aws_iam_role.ecs_execution_role[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Inline policy to read SSM Parameter Store parameters for ECS Task Execution
resource "aws_iam_policy" "ecs_execution_secrets" {
  count       = var.enable_backend ? 1 : 0
  name        = "${var.project_name}-${var.environment}-ecs-execution-ssm"
  description = "Allows ECS agent to read SSM Parameter Store parameters"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ssm:GetParameters",
          "ssm:GetParameter"
        ]
        Resource = ["arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/${var.project_name}/${var.environment}/*"]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_execution_secrets_attach" {
  count      = var.enable_backend ? 1 : 0
  role       = aws_iam_role.ecs_execution_role[0].name
  policy_arn = aws_iam_policy.ecs_execution_secrets[0].arn
}

# ECS Task Role (permits FastAPI inside container to invoke SageMaker & read Secrets)
resource "aws_iam_role" "ecs_task_role" {
  count = var.enable_backend ? 1 : 0
  name  = "${var.project_name}-${var.environment}-ecs-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })
}

# Custom policy for SageMaker Invocation + SSM Parameter Store read for ECS task
resource "aws_iam_policy" "ecs_task_policy" {
  count       = var.enable_backend ? 1 : 0
  name        = "${var.project_name}-${var.environment}-ecs-task-policy"
  description = "Allows ECS tasks to invoke SageMaker and read SSM parameters"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sagemaker:InvokeEndpoint",
          "sagemaker:DescribeEndpoint"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "ssm:GetParameters",
          "ssm:GetParameter"
        ]
        Resource = ["arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/${var.project_name}/${var.environment}/*"]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_task_policy_attach" {
  count      = var.enable_backend ? 1 : 0
  role       = aws_iam_role.ecs_task_role[0].name
  policy_arn = aws_iam_policy.ecs_task_policy[0].arn
}

# ==========================================
# 3. BACKEND CONTAINER REGISTRY (ECR)
# ==========================================

resource "aws_ecr_repository" "backend_ecr" {
  name                 = "${var.project_name}-backend"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }
}

# ==========================================
# 4. APP RUNNER SERVICE (SERVERLESS FASTAPI)
# ==========================================

# VPC for ECS + ALB
resource "aws_vpc" "main" {
  count                = var.enable_backend ? 1 : 0
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "${var.project_name}-${var.environment}-vpc"
  }
}

# Internet Gateway for public subnets
resource "aws_internet_gateway" "gw" {
  count  = var.enable_backend ? 1 : 0
  vpc_id = aws_vpc.main[0].id

  tags = {
    Name = "${var.project_name}-${var.environment}-igw"
  }
}

# 2 Public Subnets in different Availability Zones (required for ALB)
resource "aws_subnet" "public_1" {
  count                   = var.enable_backend ? 1 : 0
  vpc_id                  = aws_vpc.main[0].id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = "${var.aws_region}a"
  map_public_ip_on_launch = true

  tags = {
    Name = "${var.project_name}-${var.environment}-public-1"
  }
}

resource "aws_subnet" "public_2" {
  count                   = var.enable_backend ? 1 : 0
  vpc_id                  = aws_vpc.main[0].id
  cidr_block              = "10.0.2.0/24"
  availability_zone       = "${var.aws_region}b"
  map_public_ip_on_launch = true

  tags = {
    Name = "${var.project_name}-${var.environment}-public-2"
  }
}

# Route Table for Public Subnets
resource "aws_route_table" "public" {
  count  = var.enable_backend ? 1 : 0
  vpc_id = aws_vpc.main[0].id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.gw[0].id
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-public-rt"
  }
}

# Associate subnets to public route table
resource "aws_route_table_association" "public_1" {
  count          = var.enable_backend ? 1 : 0
  subnet_id      = aws_subnet.public_1[0].id
  route_table_id = aws_route_table.public[0].id
}

resource "aws_route_table_association" "public_2" {
  count          = var.enable_backend ? 1 : 0
  subnet_id      = aws_subnet.public_2[0].id
  route_table_id = aws_route_table.public[0].id
}

# ALB Security Group
resource "aws_security_group" "alb" {
  count       = var.enable_backend ? 1 : 0
  name        = "${var.project_name}-${var.environment}-alb-sg"
  description = "Allows inbound HTTP traffic to ALB"
  vpc_id      = aws_vpc.main[0].id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# ECS Tasks Security Group (Allows inbound traffic ONLY from the ALB)
resource "aws_security_group" "ecs_tasks" {
  count       = var.enable_backend ? 1 : 0
  name        = "${var.project_name}-${var.environment}-ecs-tasks-sg"
  description = "Allows inbound traffic only from the ALB"
  vpc_id      = aws_vpc.main[0].id

  ingress {
    from_port       = 8000
    to_port         = 8000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb[0].id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# Application Load Balancer
resource "aws_lb" "backend_alb" {
  count              = var.enable_backend ? 1 : 0
  name               = "${var.project_name}-${var.environment}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb[0].id]
  subnets            = [aws_subnet.public_1[0].id, aws_subnet.public_2[0].id]

  tags = {
    Name = "${var.project_name}-${var.environment}-alb"
  }
}

# ALB Target Group
resource "aws_lb_target_group" "backend_tg" {
  count       = var.enable_backend ? 1 : 0
  name        = "${var.project_name}-${var.environment}-tg"
  port        = 8000
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main[0].id
  target_type = "ip"

  health_check {
    path                = "/health"
    matcher             = "200"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 3
    unhealthy_threshold = 3
  }
}

# ALB Listener
resource "aws_lb_listener" "backend_listener" {
  count             = var.enable_backend ? 1 : 0
  load_balancer_arn = aws_lb.backend_alb[0].arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend_tg[0].arn
  }
}

# ECS Cluster
resource "aws_ecs_cluster" "backend_cluster" {
  count = var.enable_backend ? 1 : 0
  name  = "${var.project_name}-${var.environment}-cluster"
}

# CloudWatch Log Group for container logs
resource "aws_cloudwatch_log_group" "ecs_logs" {
  count             = var.enable_backend ? 1 : 0
  name              = "/ecs/${var.project_name}-${var.environment}-backend"
  retention_in_days = 7
}

# ECS Task Definition
resource "aws_ecs_task_definition" "backend_task" {
  count                    = var.enable_backend ? 1 : 0
  family                   = "${var.project_name}-${var.environment}-backend-task"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "1024"
  memory                   = "2048"
  execution_role_arn       = aws_iam_role.ecs_execution_role[0].arn
  task_role_arn            = aws_iam_role.ecs_task_role[0].arn

  container_definitions = jsonencode([
    {
      name      = "backend"
      image     = "${aws_ecr_repository.backend_ecr.repository_url}:latest"
      essential = true
      portMappings = [
        {
          containerPort = 8000
          hostPort      = 8000
        }
      ]
      secrets = [
        { name = "OPENAI_API_KEY", valueFrom = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/${var.project_name}/${var.environment}/OPENAI_API_KEY" },
        { name = "GOOGLE_API_KEY", valueFrom = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/${var.project_name}/${var.environment}/GOOGLE_API_KEY" },
        { name = "PINECONE_API_KEY", valueFrom = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/${var.project_name}/${var.environment}/PINECONE_API_KEY" },
        { name = "PINECONE_ENV", valueFrom = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/${var.project_name}/${var.environment}/PINECONE_ENV" },
        { name = "PINECONE_INDEX_NAME", valueFrom = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/${var.project_name}/${var.environment}/PINECONE_INDEX_NAME" },
        { name = "COHERE_API_KEY", valueFrom = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/${var.project_name}/${var.environment}/COHERE_API_KEY" },
        { name = "NEO4J_URI", valueFrom = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/${var.project_name}/${var.environment}/NEO4J_URI" },
        { name = "NEO4J_USERNAME", valueFrom = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/${var.project_name}/${var.environment}/NEO4J_USERNAME" },
        { name = "NEO4J_PASSWORD", valueFrom = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/${var.project_name}/${var.environment}/NEO4J_PASSWORD" },
        { name = "HF_MODEL_ID", valueFrom = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/${var.project_name}/${var.environment}/HF_MODEL_ID" },
        { name = "HF_API_TOKEN", valueFrom = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/${var.project_name}/${var.environment}/HF_API_TOKEN" },
        { name = "GOOGLE_CLIENT_ID", valueFrom = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/${var.project_name}/${var.environment}/GOOGLE_CLIENT_ID" },
        { name = "GOOGLE_CLIENT_SECRET", valueFrom = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/${var.project_name}/${var.environment}/GOOGLE_CLIENT_SECRET" },
        { name = "AUTH_SECRET", valueFrom = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/${var.project_name}/${var.environment}/AUTH_SECRET" }
      ]
      environment = [
        { name = "AWS_REGION", value = var.aws_region },
        { name = "SAGEMAKER_ENDPOINT_NAME", value = "gemma-2-2b-medgraph-ep-v1" }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.ecs_logs[0].name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "backend"
        }
      }
    }
  ])
}

# ECS Service
resource "aws_ecs_service" "backend_service" {
  count           = var.enable_backend ? 1 : 0
  name            = "${var.project_name}-${var.environment}-backend-service"
  cluster         = aws_ecs_cluster.backend_cluster[0].id
  task_definition = aws_ecs_task_definition.backend_task[0].arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = [aws_subnet.public_1[0].id, aws_subnet.public_2[0].id]
    security_groups  = [aws_security_group.ecs_tasks[0].id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.backend_tg[0].arn
    container_name   = "backend"
    container_port   = 8000
  }

  depends_on = [
    aws_lb_listener.backend_listener
  ]
}

# ==========================================
# 5. FRONTEND HOSTING (S3 + CLOUDFRONT CDN)
# ==========================================

# S3 Bucket (Private, static site host)
resource "aws_s3_bucket" "frontend_bucket" {
  bucket        = "${var.project_name}-${var.environment}-frontend-site"
  force_destroy = true
}

# Block all public S3 access (enforces security via CloudFront OAC)
resource "aws_s3_bucket_public_access_block" "frontend_block_public" {
  bucket = aws_s3_bucket.frontend_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# CloudFront Origin Access Control (OAC)
resource "aws_cloudfront_origin_access_control" "oac" {
  name                              = "${var.project_name}-oac"
  description                       = "OAC access for MedGraph Frontend"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# CloudFront CDN Distribution
resource "aws_cloudfront_distribution" "frontend_cdn" {
  origin {
    domain_name              = aws_s3_bucket.frontend_bucket.bucket_regional_domain_name
    origin_id                = "S3Origin"
    origin_access_control_id = aws_cloudfront_origin_access_control.oac.id
  }

  dynamic "origin" {
    for_each = var.enable_backend ? [1] : []
    content {
      domain_name = aws_lb.backend_alb[0].dns_name
      origin_id   = "ALBOrigin"

      custom_origin_config {
        http_port                = 80
        https_port               = 443
        origin_protocol_policy   = "http-only"
        origin_ssl_protocols     = ["TLSv1.2"]
      }
    }
  }

  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"

  dynamic "ordered_cache_behavior" {
    for_each = var.enable_backend ? ["/diagnose", "/auth/*", "/health", "/knowledge/*"] : []
    content {
      path_pattern     = ordered_cache_behavior.value
      allowed_methods  = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
      cached_methods   = ["GET", "HEAD"]
      target_origin_id = "ALBOrigin"

      forwarded_values {
        query_string = true
        headers      = ["*"]
        cookies {
          forward = "all"
        }
      }

      viewer_protocol_policy = "redirect-to-https"
      min_ttl                = 0
      default_ttl            = 0
      max_ttl                = 0
    }
  }

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3Origin"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
  }

  # SPA Routing Rule: redirect 403 & 404 errors back to index.html with code 200 (for React Router client handling)
  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 10
  }

  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 10
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}

# S3 Bucket Policy allowing CloudFront OAC read access
resource "aws_s3_bucket_policy" "frontend_allow_cloudfront" {
  bucket = aws_s3_bucket.frontend_bucket.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontServicePrincipalReadOnly"
        Effect = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.frontend_bucket.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.frontend_cdn.arn
          }
        }
      }
    ]
  })

  depends_on = [
    aws_s3_bucket_public_access_block.frontend_block_public
  ]
}
