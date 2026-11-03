# Konteyner imajı AWS CodeBuild'de (ARM64) derlenir ve ECR'ye itilir; yerel Docker gerekmez.
# Kaynak: build bucket'ına yüklenen `git archive` zip'i (bkz. infra/deploy.sh).
resource "aws_s3_bucket" "build" {
  bucket        = "${local.name}-build-${local.account_id}"
  force_destroy = true
}

resource "aws_s3_bucket_public_access_block" "build" {
  bucket                  = aws_s3_bucket.build.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "build" {
  bucket = aws_s3_bucket.build.id
  rule {
    id     = "expire-sources"
    status = "Enabled"
    filter {}
    expiration {
      days = 14
    }
  }
}

data "aws_iam_policy_document" "codebuild_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["codebuild.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "codebuild" {
  name               = "${local.name}-codebuild"
  assume_role_policy = data.aws_iam_policy_document.codebuild_assume.json
}

resource "aws_iam_role_policy" "codebuild" {
  name = "build-and-push"
  role = aws_iam_role.codebuild.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Action = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"], Resource = ["*"] },
      { Effect = "Allow", Action = ["s3:GetObject", "s3:GetObjectVersion"], Resource = ["${aws_s3_bucket.build.arn}/*"] },
      { Effect = "Allow", Action = ["ecr:GetAuthorizationToken"], Resource = ["*"] },
      {
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability", "ecr:BatchGetImage", "ecr:GetDownloadUrlForLayer",
          "ecr:InitiateLayerUpload", "ecr:UploadLayerPart", "ecr:CompleteLayerUpload", "ecr:PutImage",
        ]
        Resource = [aws_ecr_repository.app.arn]
      },
    ]
  })
}

resource "aws_codebuild_project" "image" {
  name          = "${local.name}-image"
  service_role  = aws_iam_role.codebuild.arn
  build_timeout = 30

  artifacts {
    type = "NO_ARTIFACTS"
  }

  environment {
    type            = "ARM_CONTAINER"
    compute_type    = "BUILD_GENERAL1_LARGE"
    image           = "aws/codebuild/amazonlinux-aarch64-standard:3.0"
    privileged_mode = true

    environment_variable {
      name  = "REPO_URL"
      value = aws_ecr_repository.app.repository_url
    }
    environment_variable {
      name  = "IMAGE_TAG"
      value = var.image_tag
    }
  }

  source {
    type     = "S3"
    location = "${aws_s3_bucket.build.bucket}/source.zip"
    buildspec = yamlencode({
      version = "0.2"
      phases = {
        pre_build = {
          commands = [
            "aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $${REPO_URL%%/*}",
          ]
        }
        build = {
          commands = [
            "docker build -t $REPO_URL:$IMAGE_TAG .",
            "docker push $REPO_URL:$IMAGE_TAG",
          ]
        }
      }
    })
  }

  logs_config {
    cloudwatch_logs {
      group_name = "/codebuild/${local.name}-image"
    }
  }
}
