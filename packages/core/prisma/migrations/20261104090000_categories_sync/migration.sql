-- AlterTable
ALTER TABLE "Influencer" ADD COLUMN     "bio" TEXT,
ADD COLUMN     "city" TEXT;

-- AlterTable
ALTER TABLE "SocialAccount" ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "avgComments" INTEGER,
ADD COLUMN     "avgLikes" INTEGER,
ADD COLUMN     "avgViews" INTEGER,
ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "lastSyncedAt" TIMESTAMP(3),
ADD COLUMN     "postsCount" INTEGER,
ADD COLUMN     "profileUrl" TEXT,
ADD COLUMN     "syncError" TEXT,
ADD COLUMN     "syncSource" TEXT NOT NULL DEFAULT 'manual',
ADD COLUMN     "tokenRef" TEXT,
ADD COLUMN     "verified" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InfluencerCategory" (
    "influencerId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "primary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "InfluencerCategory_pkey" PRIMARY KEY ("influencerId","categoryId")
);

-- CreateTable
CREATE TABLE "BrandCategory" (
    "brandId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "primary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "BrandCategory_pkey" PRIMARY KEY ("brandId","categoryId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE INDEX "Category_parentId_idx" ON "Category"("parentId");

-- CreateIndex
CREATE INDEX "InfluencerCategory_categoryId_idx" ON "InfluencerCategory"("categoryId");

-- CreateIndex
CREATE INDEX "BrandCategory_categoryId_idx" ON "BrandCategory"("categoryId");

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InfluencerCategory" ADD CONSTRAINT "InfluencerCategory_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "Influencer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InfluencerCategory" ADD CONSTRAINT "InfluencerCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandCategory" ADD CONSTRAINT "BrandCategory_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandCategory" ADD CONSTRAINT "BrandCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;



-- ───── Varsayılan kategori listesi (admin panelinden düzenlenebilir) ─────
INSERT INTO "Category" (id, slug, name, "parentId", sort) VALUES
('cat_guzellik', 'guzellik', 'Güzellik', NULL, 10),
('cat_makyaj', 'makyaj', 'Makyaj', 'cat_guzellik', 11),
('cat_cilt-bakimi', 'cilt-bakimi', 'Cilt bakımı', 'cat_guzellik', 12),
('cat_sac', 'sac', 'Saç', 'cat_guzellik', 13),
('cat_moda', 'moda', 'Moda', NULL, 20),
('cat_kadin-moda', 'kadin-moda', 'Kadın modası', 'cat_moda', 21),
('cat_erkek-moda', 'erkek-moda', 'Erkek modası', 'cat_moda', 22),
('cat_aksesuar', 'aksesuar', 'Aksesuar', 'cat_moda', 23),
('cat_spor-fitness', 'spor-fitness', 'Spor & fitness', NULL, 30),
('cat_fitness', 'fitness', 'Fitness', 'cat_spor-fitness', 31),
('cat_kosu', 'kosu', 'Koşu', 'cat_spor-fitness', 32),
('cat_outdoor', 'outdoor', 'Outdoor', 'cat_spor-fitness', 33),
('cat_yemek', 'yemek', 'Yemek', NULL, 40),
('cat_tarif', 'tarif', 'Tarif', 'cat_yemek', 41),
('cat_restoran', 'restoran', 'Restoran', 'cat_yemek', 42),
('cat_kahve', 'kahve', 'Kahve', 'cat_yemek', 43),
('cat_seyahat', 'seyahat', 'Seyahat', NULL, 50),
('cat_teknoloji', 'teknoloji', 'Teknoloji', NULL, 60),
('cat_mobil', 'mobil', 'Mobil', 'cat_teknoloji', 61),
('cat_yazilim', 'yazilim', 'Yazılım', 'cat_teknoloji', 62),
('cat_oyun', 'oyun', 'Oyun', NULL, 70),
('cat_anne-bebek', 'anne-bebek', 'Anne & bebek', NULL, 80),
('cat_finans', 'finans', 'Finans', NULL, 90),
('cat_eglence', 'eglence', 'Eğlence', NULL, 100),
('cat_mizah', 'mizah', 'Mizah', 'cat_eglence', 101),
('cat_muzik', 'muzik', 'Müzik', 'cat_eglence', 102),
('cat_yasam-tarzi', 'yasam-tarzi', 'Yaşam tarzı', NULL, 110),
('cat_ev-dekorasyon', 'ev-dekorasyon', 'Ev & dekorasyon', 'cat_yasam-tarzi', 111),
('cat_otomotiv', 'otomotiv', 'Otomotiv', NULL, 120),
('cat_egitim', 'egitim', 'Eğitim', NULL, 130),
('cat_saglikli-yasam', 'saglikli-yasam', 'Sağlıklı yaşam', NULL, 140)
ON CONFLICT (slug) DO NOTHING;

-- ───── Geriye uyumlu geçiş: serbest metin kategoriler taksonomiye bağlanır ─────
-- Eşanlamlılar
DROP TABLE IF EXISTS _cat_alias;
CREATE TEMP TABLE _cat_alias (alias text PRIMARY KEY, slug text);
INSERT INTO _cat_alias VALUES ('kozmetik','guzellik'),('güzellik','guzellik'),('makyaj','makyaj'),('cilt bakımı','cilt-bakimi'),
  ('moda','moda'),('giyim','moda'),('spor','spor-fitness'),('fitness','fitness'),('spor giyim','spor-fitness'),('yemek','yemek'),
  ('gıda','yemek'),('kahve','kahve'),('içecek','yemek'),('seyahat','seyahat'),('teknoloji','teknoloji'),('oyun','oyun'),
  ('anne-bebek','anne-bebek'),('finans','finans'),('eğlence','eglence'),('mizah','mizah'),('müzik','muzik'),('yaşam','yasam-tarzi'),
  ('yaşam tarzı','yasam-tarzi'),('lifestyle','yasam-tarzi'),('otomotiv','otomotiv'),('eğitim','egitim'),('sağlık','saglikli-yasam');

-- Eşleşmeyen değerler için yeni kategori
INSERT INTO "Category" (id, slug, name, sort)
SELECT 'cat_' || s.slug, s.slug, s.name, 900
FROM (
  SELECT DISTINCT lower(trim(v)) AS name,
         regexp_replace(translate(lower(trim(v)), 'çğıöşüâî ', 'cgiosuai-'), '[^a-z0-9-]', '', 'g') AS slug
  FROM (SELECT category AS v FROM "Influencer" UNION SELECT category FROM "Brand") x
  WHERE trim(v) <> '' AND lower(trim(v)) NOT IN (SELECT alias FROM _cat_alias)
) s
WHERE s.slug <> ''
ON CONFLICT (slug) DO NOTHING;

INSERT INTO "InfluencerCategory" ("influencerId", "categoryId", "primary")
SELECT i.id, c.id, true
FROM "Influencer" i
JOIN "Category" c ON c.slug = COALESCE(
  (SELECT slug FROM _cat_alias WHERE alias = lower(trim(i.category))),
  regexp_replace(translate(lower(trim(i.category)), 'çğıöşüâî ', 'cgiosuai-'), '[^a-z0-9-]', '', 'g'))
ON CONFLICT DO NOTHING;

INSERT INTO "BrandCategory" ("brandId", "categoryId", "primary")
SELECT b.id, c.id, true
FROM "Brand" b
JOIN "Category" c ON c.slug = COALESCE(
  (SELECT slug FROM _cat_alias WHERE alias = lower(trim(b.category))),
  regexp_replace(translate(lower(trim(b.category)), 'çğıöşüâî ', 'cgiosuai-'), '[^a-z0-9-]', '', 'g'))
ON CONFLICT DO NOTHING;

DROP TABLE IF EXISTS _cat_alias;
