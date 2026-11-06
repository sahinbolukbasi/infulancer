provider "aws" {
  region  = var.region
  profile = var.aws_profile != "" ? var.aws_profile : null

  default_tags {
    tags = {
      Project     = var.project
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

data "aws_caller_identity" "current" {}
data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  name       = "${var.project}-${var.environment}"
  account_id = data.aws_caller_identity.current.account_id
  azs        = slice(data.aws_availability_zones.available.names, 0, 2)
  # Alan adı doğrulanıp bağlandıysa kök domain; değilse CloudFront varsayılan adı.
  app_url    = var.domain_validated ? "https://${var.domain_name}" : "https://${aws_cloudfront_distribution.app.domain_name}"
}
