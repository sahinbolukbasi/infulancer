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
