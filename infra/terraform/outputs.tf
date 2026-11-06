output "app_url" {
  description = "Uygulamanın HTTPS adresi"
  value       = local.app_url
}

output "ecr_repository_url" {
  value = aws_ecr_repository.app.repository_url
}

output "assets_bucket" {
  value = aws_s3_bucket.assets.bucket
}

output "ecs_cluster" {
  value = aws_ecs_cluster.main.name
}

output "ecs_service" {
  value = aws_ecs_service.app.name
}

output "app_secret_arn" {
  description = "DATABASE_URL, AUTH_SECRET ve demo parolası (SEED_PASSWORD) burada"
  value       = aws_secretsmanager_secret.app.arn
}

output "resource_group" {
  value = aws_resourcegroups_group.project.name
}

# --- Alan adı kurulumu (Cloudflare'e elle girilecek kayıtlar) ---

# 1. Adım: ACM doğrulama kayıtları. Cloudflare'de bu CNAME'leri oluşturun (Proxy KAPALI / "DNS only").
output "acm_validation_records" {
  description = "Cloudflare'e eklenecek ACM DNS doğrulama CNAME'leri (name -> value). Proxy kapalı olmalı."
  value = local.domain_enabled ? {
    for o in aws_acm_certificate.app[0].domain_validation_options :
    o.domain_name => { name = o.resource_record_name, type = o.resource_record_type, value = o.resource_record_value }
  } : {}
}

# 2. Adım: Doğrulandıktan sonra alan adını CloudFront'a yönlendiren kayıtlar.
output "cloudflare_dns_records" {
  description = "Alan adını CloudFront'a yönlendirmek için Cloudflare CNAME kayıtları (hedef = CloudFront domaini)."
  value = local.domain_enabled ? {
    root = { name = var.domain_name, type = "CNAME", value = aws_cloudfront_distribution.app.domain_name, note = "Kök alan: CNAME flattening gerektirir; Cloudflare bunu destekler. Proxy açık/kapalı tercihe bağlı." }
    www  = { name = "www.${var.domain_name}", type = "CNAME", value = aws_cloudfront_distribution.app.domain_name }
  } : {}
}

output "cloudfront_domain" {
  description = "CloudFront dağıtım alan adı (DNS hedefi)."
  value       = aws_cloudfront_distribution.app.domain_name
}
