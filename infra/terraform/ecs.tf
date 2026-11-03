resource "aws_ecr_repository" "app" {
  name                 = local.name
  image_tag_mutability = "MUTABLE"
  force_delete         = true
  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_lifecycle_policy" "app" {
  repository = aws_ecr_repository.app.name
  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Son 10 imaji tut"
      selection    = { tagStatus = "any", countType = "imageCountMoreThan", countNumber = 10 }
      action       = { type = "expire" }
    }]
  })
}

resource "aws_cloudwatch_log_group" "app" {
  name              = "/ecs/${local.name}"
  retention_in_days = 14
}

resource "aws_ecs_cluster" "main" {
  name = local.name
}

# --- IAM ---
data "aws_iam_policy_document" "ecs_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "execution" {
  name               = "${local.name}-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

resource "aws_iam_role_policy_attachment" "execution" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "execution_secrets" {
  name = "read-app-secret"
  role = aws_iam_role.execution.id
  policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{ Effect = "Allow", Action = ["secretsmanager:GetSecretValue"], Resource = [aws_secretsmanager_secret.app.arn] }]
  })
}

resource "aws_iam_role" "task" {
  name               = "${local.name}-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

# En az yetki: yalnız kendi bucket'ı, kuyruğu ve Bedrock model çağrısı.
resource "aws_iam_role_policy" "task" {
  name = "app"
  role = aws_iam_role.task.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:AbortMultipartUpload", "s3:ListMultipartUploadParts"]
        Resource = ["${aws_s3_bucket.assets.arn}/*"]
      },
      { Effect = "Allow", Action = ["s3:ListBucket"], Resource = [aws_s3_bucket.assets.arn] },
      { Effect = "Allow", Action = ["sqs:SendMessage"], Resource = [aws_sqs_queue.agent_events.arn] },
      {
        Effect   = "Allow"
        Action   = ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream", "bedrock:Converse"]
        Resource = ["arn:aws:bedrock:*::foundation-model/*", "arn:aws:bedrock:*:${local.account_id}:inference-profile/*"]
      },
    ]
  })
}

locals {
  container_env = [
    { name = "NODE_ENV", value = "production" },
    { name = "PORT", value = "3000" },
    { name = "APP_URL", value = local.app_url },
    { name = "AUTH_URL", value = local.app_url },
    { name = "AUTH_TRUST_HOST", value = "true" },
    { name = "S3_REGION", value = var.region },
    { name = "S3_BUCKET", value = aws_s3_bucket.assets.bucket },
    { name = "S3_FORCE_PATH_STYLE", value = "false" },
    { name = "PRESIGN_TTL_SECONDS", value = "900" },
    { name = "LLM_PROVIDER", value = var.llm_provider },
    { name = "BEDROCK_REGION", value = var.region },
    { name = "BEDROCK_TEXT_MODEL_ID", value = var.bedrock_text_model_id },
    { name = "BEDROCK_VISION_MODEL_ID", value = var.bedrock_vision_model_id },
    { name = "EVENT_MODE", value = "inline" },
    { name = "AGENT_QUEUE_URL", value = aws_sqs_queue.agent_events.url },
    { name = "LINK_CHECK_MODE", value = "http" },
    { name = "HOLD_DAYS", value = "14" },
    { name = "MIN_PAYOUT_KURUS", value = "50000" },
    { name = "AGENCY_NAME", value = "Infulancer Ajans" },
    { name = "AGENCY_IBAN", value = "TR000000000000000000000000" },
    { name = "AGENCY_BIC", value = "NOTPROVIDED" },
    { name = "SEED_ON_START", value = tostring(var.seed_on_start) },
  ]
  container_secrets = [
    for k in ["DATABASE_URL", "AUDIT_DATABASE_URL", "AUTH_SECRET", "SEED_PASSWORD"] :
    { name = k, valueFrom = "${aws_secretsmanager_secret.app.arn}:${k}::" }
  ]
  image = "${aws_ecr_repository.app.repository_url}:${var.image_tag}"
}

resource "aws_ecs_task_definition" "app" {
  family                   = local.name
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 512
  memory                   = 1024
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "ARM64"
  }

  container_definitions = jsonencode([{
    name         = "app"
    image        = local.image
    essential    = true
    portMappings = [{ containerPort = 3000, protocol = "tcp" }]
    environment  = local.container_env
    secrets      = local.container_secrets
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.app.name
        "awslogs-region"        = var.region
        "awslogs-stream-prefix" = "app"
      }
    }
  }])

  depends_on = [aws_secretsmanager_secret_version.app]
}

resource "aws_ecs_service" "app" {
  name                              = "${local.name}-web"
  cluster                           = aws_ecs_cluster.main.id
  task_definition                   = aws_ecs_task_definition.app.arn
  desired_count                     = var.app_desired_count
  launch_type                       = "FARGATE"
  health_check_grace_period_seconds = 180
  enable_execute_command            = false

  network_configuration {
    subnets          = aws_subnet.public[*].id
    security_groups  = [aws_security_group.app.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.app.arn
    container_name   = "app"
    container_port   = 3000
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  depends_on = [aws_lb_listener.http]
}
