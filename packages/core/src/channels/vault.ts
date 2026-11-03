import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { envStr } from "../env";

/**
 * Token kasası. Token'lar RDS'te TUTULMAZ; channel_connections.token_ref yalnızca referans tutar.
 * - aws: Secrets Manager (tenant başına ayrı KMS anahtarı ile; VAULT_MODE=aws)
 * - local (varsayılan): AES-256-GCM şifreli dosya deposu (VAULT_DIR, varsayılan ~/.infulancer-vault; yalnız geliştirme)
 */
export interface TokenVault {
  put(tenantId: string, name: string, secret: string): Promise<string>;
  get(ref: string): Promise<string>;
  remove(ref: string): Promise<void>;
}

function dir(): string {
  const d = envStr("VAULT_DIR", path.join(homedir(), ".infulancer-vault"));
  if (!existsSync(d)) mkdirSync(d, { recursive: true, mode: 0o700 });
  return d;
}
function fileOf(ref: string): string {
  return path.join(dir(), createHash("sha256").update(ref).digest("hex"));
}
const store = {
  set: (ref: string, v: string) => writeFileSync(fileOf(ref), v, { mode: 0o600 }),
  get: (ref: string) => (existsSync(fileOf(ref)) ? readFileSync(fileOf(ref), "utf8") : undefined),
  delete: (ref: string) => rmSync(fileOf(ref), { force: true }),
};

function key(): Buffer {
  return createHash("sha256").update(envStr("AUTH_SECRET", "local-dev-vault-key")).digest();
}

export const localVault: TokenVault = {
  async put(tenantId, name, secret) {
    const iv = randomBytes(12);
    const c = createCipheriv("aes-256-gcm", key(), iv);
    const enc = Buffer.concat([c.update(secret, "utf8"), c.final()]);
    const ref = `local:${tenantId}/${name}/${randomBytes(6).toString("hex")}`;
    store.set(ref, Buffer.concat([iv, c.getAuthTag(), enc]).toString("base64"));
    return ref;
  },
  async get(ref) {
    const raw = store.get(ref);
    if (!raw) throw new Error("Kasada kayıt yok");
    const buf = Buffer.from(raw, "base64");
    const d = createDecipheriv("aes-256-gcm", key(), buf.subarray(0, 12));
    d.setAuthTag(buf.subarray(12, 28));
    return Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString("utf8");
  },
  async remove(ref) {
    store.delete(ref);
  },
};

/** Secrets Manager kasası: arn:aws:secretsmanager:...:secret:infulancer/tenants/<tenant>/<name>. */
export function awsVault(): TokenVault {
  const region = envStr("AWS_REGION", "eu-central-1");
  const prefix = envStr("VAULT_SECRET_PREFIX", "infulancer/tenants");
  // SDK dinamik yüklenir: yerel/test ortamında bağımlılık gerektirmesin.
  const sdk = async () => {
    const mod = "@aws-sdk/client-secrets-manager";
    return (await import(/* @vite-ignore */ mod)) as typeof import("@aws-sdk/client-secrets-manager");
  };
  return {
    async put(tenantId, name, secret) {
      const { SecretsManagerClient, CreateSecretCommand, PutSecretValueCommand, ResourceExistsException } = await sdk();
      const client = new SecretsManagerClient({ region });
      const Name = `${prefix}/${tenantId}/${name}`;
      try {
        const res = await client.send(
          new CreateSecretCommand({
            Name,
            SecretString: secret,
            KmsKeyId: envStr(`VAULT_KMS_KEY_${tenantId}`, "") || undefined,
            Tags: [{ Key: "tenant", Value: tenantId }],
          }),
        );
        return res.ARN!;
      } catch (e) {
        if (!(e instanceof ResourceExistsException)) throw e;
        const res = await client.send(new PutSecretValueCommand({ SecretId: Name, SecretString: secret }));
        return res.ARN!;
      }
    },
    async get(ref) {
      const { SecretsManagerClient, GetSecretValueCommand } = await sdk();
      const res = await new SecretsManagerClient({ region }).send(new GetSecretValueCommand({ SecretId: ref }));
      return res.SecretString ?? "";
    },
    async remove(ref) {
      const { SecretsManagerClient, DeleteSecretCommand } = await sdk();
      await new SecretsManagerClient({ region }).send(new DeleteSecretCommand({ SecretId: ref, ForceDeleteWithoutRecovery: true }));
    },
  };
}

export function vault(): TokenVault {
  return envStr("VAULT_MODE", "local") === "aws" ? awsVault() : localVault;
}
