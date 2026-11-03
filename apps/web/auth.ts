import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@infulancer/core/db";
import { authConfig } from "./auth.config";

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(1).max(200),
});

// Hiçbir şifreyle eşleşmeyen geçerli bcrypt özeti (zamanlama eşitleme için).
const DUMMY_HASH = "$2b$10$A7yDQShngpQVA81qK8a.rOCh813tyD4HnAJggOpK14MnFk0AkXVGu";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "E-posta", type: "email" },
        password: { label: "Şifre", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
        // Kullanıcı yoksa da karşılaştırma yapılır; yanıt süresi e-posta varlığını sızdırmasın.
        const hash = user?.passwordHash ?? DUMMY_HASH;
        const ok = await bcrypt.compare(parsed.data.password, hash);
        if (!user || !ok) return null;
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          brandId: user.brandId,
          influencerId: user.influencerId,
          status: user.status,
        };
      },
    }),
  ],
});
