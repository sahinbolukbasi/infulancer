-- Başlangıç bakiyesi 5000 TL → 250 TL (tek seferlik düzeltme).
-- Yalnız hiç kullanılmamış hesaplar: bakiye tam 5000, bloke yok, hiç tahsilat/bloke yok,
-- onaylanmış bakiye talebi yok ve defterde başlangıç dışında hareket yok.
-- Her düzeltilen hesap için deftere ADJUST satırı yazılır.
WITH eligible AS (
  SELECT a."tenantId"
  FROM credit_accounts a
  WHERE a."balanceCredits" = 5000
    AND a."heldCredits" = 0
    AND NOT EXISTS (SELECT 1 FROM credit_holds h WHERE h."tenantId" = a."tenantId")
    AND NOT EXISTS (SELECT 1 FROM credit_requests r WHERE r.tenant_id = a."tenantId" AND r.status = 'ONAYLANDI')
    AND NOT EXISTS (SELECT 1 FROM credit_ledger l WHERE l.tenant_id = a."tenantId" AND l.kind <> 'STARTER')
),
updated AS (
  UPDATE credit_accounts a
  SET "balanceCredits" = 250, "updatedAt" = now()
  FROM eligible e
  WHERE a."tenantId" = e."tenantId"
  RETURNING a."tenantId"
)
INSERT INTO credit_ledger (id, tenant_id, kind, amount, balance_after, note)
SELECT gen_random_uuid()::text, u."tenantId", 'ADJUST', -4750, 250, 'Başlangıç bakiyesi 5000 TL → 250 TL olarak güncellendi'
FROM updated u;
