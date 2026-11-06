# Özel alan adı (Cloudflare DNS + CloudFront + ACM).
#
# DNS Cloudflare'de olduğundan doğrulama ve yönlendirme kayıtları Terraform tarafından
# OLUŞTURULMAZ; output olarak verilir ve Cloudflare'e elle (veya API ile) girilir.
#
# İki aşamalı kurulum:
#   1) domain_name set + domain_validated=false:
#        ACM sertifikası (us-east-1) oluşur. `acm_validation_records` output'undaki
#        CNAME'leri Cloudflare'e ekleyin. CloudFront hâlâ varsayılan sertifikada kalır.
#   2) Sertifika "Issued" olunca domain_validated=true ile tekrar apply:
#        CloudFront alias + ACM sertifikasına geçer, app_url domaine döner.
#        `cloudflare_dns_records` output'undaki CNAME'leri Cloudflare'e ekleyin.

# CloudFront için ACM sertifikası us-east-1'de olmak ZORUNDA.
provider "aws" {
  alias   = "us_east_1"
  region  = "us-east-1"
  profile = var.aws_profile != "" ? var.aws_profile : null
  default_tags {
    tags = {
      Project     = var.project
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

locals {
  domain_enabled = var.domain_name != ""
  # Alan adı set ise alternatif adlar (kök + www), değilse boş.
  domain_aliases = local.domain_enabled ? [var.domain_name, "www.${var.domain_name}"] : []
}

resource "aws_acm_certificate" "app" {
  count             = local.domain_enabled ? 1 : 0
  provider          = aws.us_east_1
  domain_name       = var.domain_name
  subject_alternative_names = ["www.${var.domain_name}"]
  validation_method = "DNS"
  lifecycle {
    create_before_destroy = true
  }
}

# Sertifikanın ISSUED durumuna geçmesini bekler (yalnız doğrulama tamamlandıktan sonra).
# Cloudflare'de DNS olduğu için validation_record_fqdns VERMİYORUZ; kayıtlar elle girilir.
resource "aws_acm_certificate_validation" "app" {
  count           = local.domain_enabled && var.domain_validated ? 1 : 0
  provider        = aws.us_east_1
  certificate_arn = aws_acm_certificate.app[0].arn
}
