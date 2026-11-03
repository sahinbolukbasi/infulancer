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
- Girişsiz erişilebilen yollar: `/giris`, `/api/auth/*`, `/gizlilik`, `/kullanim-kosullari`, `/fiyatlandirma` ve webhook uçları
  `/api/webhooks/meta` (X-Hub-Signature-256 imzası, `META_APP_SECRET` tanımlı değilse tüm istekler reddedilir) ve `/api/webhooks/fal`
  (paylaşılan gizli başlık). Diğer tüm sayfa/API'ler oturum ve rol kontrolünden geçer. Prod'da webhook için API Gateway mTLS önerilir.
- **Henüz yok:** giriş denemesi sınırı (rate limit), MFA, özel alan adı/WAF. Canlı müşteri verisinden önce eklenmeli.
- ALB yalnız CloudFront IP aralığından erişilebilir; RDS internete kapalıdır.
- Dosyalar özel S3 bucket'ında; erişim kısa ömürlü presigned URL ile (varsayılan 15 dk).
- Audit log ayrı veritabanında, append-only (UPDATE/DELETE tetikleyiciyle engellenir) ve SHA-256 hash zincirli.

## Ek modül: Kanallar, Agent'lar, Reklam ve Creative

Mevcut platformun üzerine eklenir; tenant = marka (Brand). Ayrıntılı gereksinimler: `.agents/tasks/addon-channels/spec.md` (yerel).

| Alan | Kod | Durum |
|---|---|---|
| WhatsApp Embedded Signup v4, Instagram/Messenger bağlantısı, token kasası (Secrets Manager), saatlik sağlık kontrolü | `packages/core/src/channels` | Çalışan kod, Meta çağrıları mock (`META_API_MODE=http` ile gerçek) |
| Webhook alımı (imza, S3 ham kayıt, her koşulda 200, 7 günlük dedupe, last-write-wins) | `channels/webhook.ts`, `processor.ts`, `/api/webhooks/meta` | Çalışan kod |
| Pencereler (24 sa / FEP 7 gün / HUMAN_AGENT), template yaşam döngüsü + kalite koruması, kademe planlayıcı, adaptif throttling, maliyet defteri | `src/messaging` | Çalışan kod |
| Shared inbox, insana aktarma, unsend hard-delete (`DELETE /api/internal/messages/{id}/purge`) | `messaging/inbox.ts`, `purge.ts`, `/marka/gelen-kutusu` | Çalışan kod |
| Hazır agent kataloğu, pgvector RAG (RLS + WHERE), Guardrails, creator ön eleme | `src/assistant` | Çalışan kod, LLM/embedding mock (Bedrock hazır) |
| İYS kapısı (RET terminal, 3 iş günü SLA, 422 bölme), KVKK standart sözleşme + makbuz kapısı, md. 23/A kontrolü + kampanya yayın kapısı, politika bayrakları | `src/compliance` | Çalışan kod, İYS entegratörü mock |
| Vergi profili + 20/B IBAN kilidi (DB trigger) | `domain/tax-profile.ts` | Çalışan kod |
| Reklam: saatlik bütçe motoru (30 sn / saatte 4 / 100 QPS), kota/skor modeli, Partnership Ads durum modeli | `src/ads` | Kurallar çalışan kod; Marketing API çağrıları iskelet |
| Creative: model kaydı + lisans kapısı + deprecation yönlendirme, kredi hold/charge, fal kuyruğu, C2PA izi, md. 27/12 engeli | `src/creative` | Kurallar çalışan kod; fal/c2patool mock |
| TikTok: pre-flight, audit öncesi kısıtlar, DM yok notu | `src/tiktok` | İskelet |

Testler (yerel Postgres + pgvector gerekir, `…_test` veritabanlarını kullanır):

```bash
npm run test          # 17 kabul kriterinin her biri için en az bir test
```

Docker yerine Homebrew ile: `brew install postgresql@17 pgvector`, sonra `.env`'deki kullanıcıyla `infulancer`, `infulancer_audit`,
`infulancer_test`, `infulancer_test_audit` veritabanlarını oluşturun.

Canlıya almadan önce sizin tarafınızda kalanlar (kod değil): Meta Business Verification ve App Review, Meta app (WhatsApp use case),
fal'dan FLUX lisansı için yazılı teyit, İYS entegratör hesabı, Ticaret Bakanlığı'ndan İYS/WhatsApp kapsamı görüşü, mali müşavir görüşü
(fatura kesemeyen creator), Meta'nın kendi Türkiye tarife kartı, X-Hub-Signature-256 ve fal webhook imza şemasının teyidi.

Ertelenenler: TikTok outbound DM (API yok), TikTok One / Creator Marketplace API (davet kapılı), audit öncesi TikTok public branded content,
Messenger 24 saat dışı re-engagement (tag'ler kaldırıldı), AgentCore Memory, kendi İYS entegratörlüğü, BSP olup mesaj satmak,
TikTok izlenme süresi/demografi (public API'de yok), YouTube/X etiket mekanikleri (doğrulanmadı). Embedded Signup penceresinin (Meta JS SDK)
kendisi, App Review için Meta app kimliği gerektirdiğinden henüz bağlanmadı; panelde manuel giriş formu var.

Not: tenant kanal token'ları Terraform dışında, `infulancer-prod/tenants/*` adıyla Secrets Manager'da oluşturulur; `terraform destroy`
bunları silmez.

## Ertelenenler (çekirdek platform)

- **Faz 5 — platform API bağlantıları** (Instagram Graph, TikTok Display, YouTube Data): arayüz ve iskelet
  hazır (`packages/core/src/connectors`), "Hesabı bağla (yakında)" butonu pasif. Gerçek uygulama App Review,
  OAuth uygulaması ve canlı kimlik bilgisi gerektirir.
- **SQS tüketicisi dağıtımı:** olaylar şimdilik web sürecinde inline işlenir; kuyruk ve Lambda handler'ı hazır.
- **Vergi:** ödeme ekranındaki stopaj/serbest meslek uyarıları bilgilendirme amaçlıdır; fatura kesemeyen
  influencer ödemeleri için mali müşavir görüşü alınmalıdır.
