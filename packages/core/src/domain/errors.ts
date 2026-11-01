export type DomainErrorCode =
  | "YETKISIZ"
  | "BULUNAMADI"
  | "GECERSIZ_GECIS"
  | "DOGRULAMA"
  | "CAKISMA"
  | "YETERSIZ_BAKIYE"
  | "KURAL_IHLALI";

/** Kullanıcıya gösterilebilir, Türkçe mesajlı alan hatası. */
export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: DomainErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.details = details;
  }
}

export function isDomainError(err: unknown): err is DomainError {
  return err instanceof DomainError;
}
