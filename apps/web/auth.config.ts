import type { NextAuthConfig } from "next-auth";

/**
 * Veritabanı içermeyen Auth.js yapılandırması — proxy.ts bunu kullanır.
 * Sağlayıcılar (Credentials + Prisma) yalnız auth.ts'de eklenir.
 */
export const authConfig = {
  pages: { signIn: "/giris" },
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.brandId = user.brandId ?? null;
        token.influencerId = user.influencerId ?? null;
      }
      return token;
    },
    session({ session, token }) {
      if (token.id && token.role) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.brandId = token.brandId ?? null;
        session.user.influencerId = token.influencerId ?? null;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
