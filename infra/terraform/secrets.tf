# Sırlar Secrets Manager'da tutulur; konteynere ortam değişkeni olarak enjekte edilir.
# Hiçbir sır repoda değildir.
resource "random_password" "auth_secret" {
  length  = 48
  special = false
}

resource "random_password" "fal_webhook" {
  length  = 40
  special = false
}

resource "random_password" "meta_verify" {
  length  = 32
  special = false
}

resource "random_password" "seed" {
  length  = 16
  special = false
}

locals {
  db_base = "postgresql://${aws_db_instance.main.username}:${random_password.db.result}@${aws_db_instance.main.address}:5432"
}

resource "aws_secretsmanager_secret" "app" {
  name                    = "${local.name}/app"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "app" {
  secret_id = aws_secretsmanager_secret.app.id
  secret_string = jsonencode({
    # RDS bağlantısı VPC içinde, TLS ile (sertifika doğrulaması olmadan).
    DATABASE_URL       = "${local.db_base}/infulancer?sslmode=no-verify"
    AUDIT_DATABASE_URL = "${local.db_base}/infulancer_audit?sslmode=no-verify"
    AUTH_SECRET        = random_password.auth_secret.result
    SEED_PASSWORD      = random_password.seed.result
    FAL_WEBHOOK_SECRET = random_password.fal_webhook.result
    META_VERIFY_TOKEN  = random_password.meta_verify.result
  })
}
