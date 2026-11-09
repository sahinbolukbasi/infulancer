# HTTPS uç noktası (varsayılan *.cloudfront.net sertifikası). Dinamik uygulama: önbellek kapalı,
# Host başlığı dahil tüm başlıklar iletilir (Server Actions origin kontrolü için gerekli).
data "aws_cloudfront_cache_policy" "disabled" {
  name = "Managed-CachingDisabled"
}

data "aws_cloudfront_cache_policy" "optimized" {
  name = "Managed-CachingOptimized"
}

# Tüm viewer başlıkları + CloudFront'un ürettiği CloudFront-Viewer-Country origin'e iletilir.
# CloudFront bu coğrafi başlığı YALNIZCA origin request policy'nin başlık listesinde açıkça
# istenirse üretir; Managed-AllViewer onu içermediği için ülke algılaması origin'e ulaşmıyordu
# (proxy.ts cloudfront-viewer-country okur, gelmeyince TR'ye düşüyordu). Server Actions'ın origin
# kontrolü için Host dahil tüm viewer başlıkları da gerekir, bu yüzden allViewer + ülke başlığı.
resource "aws_cloudfront_origin_request_policy" "all_viewer_country" {
  name    = "${local.name}-all-viewer-country"
  comment = "Tüm viewer başlıkları + CloudFront-Viewer-Country (bölge/para birimi otomatik algılama)"

  headers_config {
    header_behavior = "allViewerAndWhitelistCloudFront"
    headers {
      items = ["CloudFront-Viewer-Country"]
    }
  }
  cookies_config {
    cookie_behavior = "all"
  }
  query_strings_config {
    query_string_behavior = "all"
  }
}

resource "aws_cloudfront_distribution" "app" {
  enabled         = true
  comment         = local.name
  price_class     = "PriceClass_100"
  http_version    = "http2and3"
  is_ipv6_enabled = true
  # Özel alan adları yalnız sertifika doğrulandıktan sonra bağlanır (aksi halde dağıtım hata verir).
  aliases         = var.domain_validated ? local.domain_aliases : []

  origin {
    origin_id   = "alb"
    domain_name = aws_lb.app.dns_name
    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
      origin_read_timeout    = 60
    }
  }

  default_cache_behavior {
    target_origin_id         = "alb"
    viewer_protocol_policy   = "redirect-to-https"
    allowed_methods          = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods           = ["GET", "HEAD"]
    compress                 = true
    cache_policy_id          = data.aws_cloudfront_cache_policy.disabled.id
    origin_request_policy_id = aws_cloudfront_origin_request_policy.all_viewer_country.id
  }

  # Next.js derleme çıktısı (içerik hash'li, değişmez).
  ordered_cache_behavior {
    path_pattern           = "/_next/static/*"
    target_origin_id       = "alb"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true
    cache_policy_id        = data.aws_cloudfront_cache_policy.optimized.id
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = var.domain_validated ? null : true
    acm_certificate_arn            = var.domain_validated ? aws_acm_certificate.app[0].arn : null
    ssl_support_method             = var.domain_validated ? "sni-only" : null
    minimum_protocol_version       = var.domain_validated ? "TLSv1.2_2021" : null
  }
  # Sertifika doğrulanmadan alias bağlanmasın diye doğrulama kaynağına bağımlılık.
  depends_on = [aws_acm_certificate_validation.app]
}
