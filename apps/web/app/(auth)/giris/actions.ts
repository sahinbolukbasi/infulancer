"use server";

import { AuthError } from "next-auth";
import { z } from "zod";
import { signIn } from "@/auth";
import { safeNextPath } from "@/lib/roles";

export type LoginState = { error: string | null; email: string };

const GENERIC_ERROR = "E-posta veya şifre hatalı";

const schema = z.object({
  email: z.string().trim().min(3).max(200),
  password: z.string().min(1).max(200),
});

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const parsed = schema.safeParse({ email, password: formData.get("password") });
  if (!parsed.success) return { error: GENERIC_ERROR, email };
  try {
    // Başarılıysa NEXT_REDIRECT fırlatır; "/" rolün ana sayfasına yönlendirir.
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: safeNextPath(formData.get("next")) ?? "/",
    });
  } catch (err) {
    if (err instanceof AuthError) return { error: GENERIC_ERROR, email };
    throw err;
  }
  return { error: null, email };
}
