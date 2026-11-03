import type { Platform } from "../generated/prisma/enums";

/**
 * Faz 5: platform OAuth / API entegrasyonu. Arayüz hazır, gerçek uygulama ertelendi
 * (App Review, OAuth uygulaması ve canlı kimlik bilgileri gerekiyor).
 */
export type ConnectorMetrics = {
  followers?: number;
  engagementRate?: number;
  posts?: { externalId: string; url: string; reach?: number; likes?: number; comments?: number }[];
};

export interface PlatformConnector {
  readonly platform: Platform;
  getAuthorizeUrl(state: string): string;
  exchangeCode(code: string): Promise<{ accessToken: string; expiresAt?: Date }>;
  fetchMetrics(accessToken: string): Promise<ConnectorMetrics>;
}

export class NotImplementedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotImplementedError";
  }
}

export function stubConnector(platform: Platform, label: string): PlatformConnector {
  const fail = (): never => {
    throw new NotImplementedError(`Faz 5: ${label} bağlantısı henüz uygulanmadı.`);
  };
  return { platform, getAuthorizeUrl: fail, exchangeCode: async () => fail(), fetchMetrics: async () => fail() };
}
