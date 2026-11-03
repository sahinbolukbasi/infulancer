# Infulancer — Influencer Ajans Yönetim Platformu

Influencer ajansları için kampanya, içerik takvimi, teslim (deliverable), metrik, agent denetimleri ve
influencer ödemelerini tek yerde yöneten platform. Admin, marka ve influencer olmak üzere üç rol vardır.

## Mimari

```
Tarayıcı ──HTTPS──> CloudFront ──> ALB ──> ECS Fargate (Next.js 16, tek imaj)
                                              │  ├─ RDS Postgres 16 (uygulama DB + ayrı audit DB)
                                              │  ├─ S3 (özel bucket, presigned URL)
                                              │  └─ Bedrock Converse (LLM, opsiyonel; yoksa mock)
EventBridge Scheduler ──> kısa ömürlü Fargate görevi (agent job'ları, aynı imaj)
SQS agent-events (+DLQ) — EVENT_MODE=sqs için hazır
Secrets Manager — DB bağlantıları, AUTH_SECRET, demo parolası
```

- `apps/web` — Next.js App Router, Auth.js (e-posta/şifre), rol bazlı erişim, Tailwind siyah-beyaz tasarım.
- `packages/core` — Prisma şeması, domain kuralları (skor, ledger, ödeme, marka çakışması), agent job'ları,
  LLM sağlayıcı, Lambda handler'ları, Faz 5 bağlantı iskeletleri.
- `infra/terraform` — tüm AWS yığını. `infra/deploy.sh` tek komutla kurar.

## Yerel geliştirme

Gereken: Node 24, Docker.

```bash
cp .env.example .env            # yerel değerler; .env gitignore'dadır
docker compose up -d            # Postgres + MinIO
npm install
npm run db:migrate
npm run audit:migrate
npm run storage:init
npm run db:seed
npm run dev -w @infulancer/web  # http://localhost:3000
```

Demo hesapları (yalnız yerel, parola `Demo1234!`): `admin@ajans.local`, `lumi@marka.local`,
`mira@marka.local`, `kahve@marka.local`, `zeynep@influencer.local`, `ece@influencer.local` …

Doğrulama: `npm run typecheck && npm run lint && npm run build`

## Agent job'ları

Agent'lar iş durumunu değiştirmez; `AgentRun` ve `Notification` yazar (yalnız `Influencer.riskScore` ve
`Deliverable.contractViolation` türetilmiş alanlarını günceller). Her çalıştırma idempotency anahtarıyla
kaydedilir; aynı job'ı tekrar çalıştırmak yinelenen kayıt üretmez. Her kayıt model ve prompt sürümünü saklar.

| Job | Tetik | Ne yapar |
|---|---|---|
| brief-compliance | dosya yükleme + saatlik | hashtag/etiket/zorunlu-yasaklı ifade/"Reklam" açıklaması + LLM ton kontrolü |
| publish-check | 15 dk | planlanan saat +30 dk geçti, yayın yok → gecikme |
| deletion-check | günlük | son 30 gün yayınlarında ölü link → KRITIK, sözleşme ihlali bayrağı |
| metric-consistency | metrik girişi + saatlik | ekran görüntüsü ile %5 tolerans, ER makul aralık |
| fake-engagement | influencer oluşturma + aylık | ER anomalisi, takipçi sıçraması → risk skoru |
| target-projection | günlük | aktif kampanyada tahmini skor < %100 → uyarı |
| campaign-summary | kampanya kapanışı | rapor özeti taslağı; admin "Rapora aktar" ile onaylar |
| influencer-recommendation | günlük + "Aday öner" | kategori, ER, müsaitlik, çakışma elemesi; ilk 5 aday |
| story-reminder | saatlik | Story yayınından 20 saat sonra ekran görüntüsü yoksa hatırlatma |

```bash
npm run agents:run -- --all
npm run agents:run -- --job publish-check
npm run agents:scheduler        # uzun süre çalışır, arka planda başlatın
npm run build:lambda            # SQS/Scheduler Lambda paketleri (opsiyonel dağıtım yolu)
```

LLM: `LLM_PROVIDER=mock` (varsayılan, deterministik) veya `bedrock`. Model ID'leri ortam değişkeni/Terraform
değişkenidir, kodda sabit değildir.

## AWS'e dağıtım

```bash
aws sso login --profile <profil>
AWS_PROFILE=<profil> ./infra/deploy.sh
```

Betik sırasıyla: altyapıyı kurar → kaynak kodu S3'e yükler → imajı CodeBuild'de (ARM64) derleyip ECR'ye
iter → web servisini başlatır → HTTPS adresini yazar. Yerel Docker gerekmez. İlk açılışta migrasyonlar ve
(`seed_on_start=true` ise) demo verisi otomatik uygulanır.

Demo parolası Secrets Manager'dadır (`SEED_PASSWORD` anahtarı):

```bash
aws secretsmanager get-secret-value --secret-id infulancer-prod/app --query SecretString --output text
```

Tahmini maliyet: ~65 $/ay (RDS t4g.micro, ALB, 1 Fargate görevi, public IPv4, CloudFront, kısa agent görevleri).
Kaldırmak için: `terraform -chdir=infra/terraform destroy -var aws_profile=<profil>` (RDS son snapshot alınır).

Bedrock'u açmak için: konsolda model erişimini etkinleştirin, ardından `-var llm_provider=bedrock` ile
yeniden uygulayın.

## Güvenlik notları

- Sırlar yalnız Secrets Manager'da; repoda gerçek anahtar yoktur. `.env`, `terraform.tfvars`, `*.tfstate` gitignore'dadır.
- Girişsiz erişilebilen yollar yalnız `/giris` ve `/api/auth/*`. Diğer tüm sayfa/API'ler oturum ve rol kontrolünden geçer.
- **Henüz yok:** giriş denemesi sınırı (rate limit), MFA, özel alan adı/WAF. Canlı müşteri verisinden önce eklenmeli.
- ALB yalnız CloudFront IP aralığından erişilebilir; RDS internete kapalıdır.
- Dosyalar özel S3 bucket'ında; erişim kısa ömürlü presigned URL ile (varsayılan 15 dk).
- Audit log ayrı veritabanında, append-only (UPDATE/DELETE tetikleyiciyle engellenir) ve SHA-256 hash zincirli.

## Ertelenenler

- **Faz 5 — platform API bağlantıları** (Instagram Graph, TikTok Display, YouTube Data): arayüz ve iskelet
  hazır (`packages/core/src/connectors`), "Hesabı bağla (yakında)" butonu pasif. Gerçek uygulama App Review,
  OAuth uygulaması ve canlı kimlik bilgisi gerektirir.
- **SQS tüketicisi dağıtımı:** olaylar şimdilik web sürecinde inline işlenir; kuyruk ve Lambda handler'ı hazır.
- **Vergi:** ödeme ekranındaki stopaj/serbest meslek uyarıları bilgilendirme amaçlıdır; fatura kesemeyen
  influencer ödemeleri için mali müşavir görüşü alınmalıdır.
