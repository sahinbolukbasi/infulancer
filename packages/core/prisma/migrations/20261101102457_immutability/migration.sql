-- LedgerEntry ve MetricSnapshot append-only: UPDATE/DELETE trigger ile engellenir.
-- (TRUNCATE satır seviyesi trigger'ları tetiklemez; seed betiği yalnız geliştirmede TRUNCATE kullanır.)

CREATE OR REPLACE FUNCTION infulancer_forbid_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% tablosu değiştirilemez (append-only): % engellendi', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "LedgerEntry_immutable"
  BEFORE UPDATE OR DELETE ON "LedgerEntry"
  FOR EACH ROW EXECUTE FUNCTION infulancer_forbid_mutation();

CREATE TRIGGER "MetricSnapshot_immutable"
  BEFORE UPDATE OR DELETE ON "MetricSnapshot"
  FOR EACH ROW EXECUTE FUNCTION infulancer_forbid_mutation();
