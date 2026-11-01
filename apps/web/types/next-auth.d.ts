import type { DefaultSession } from "next-auth";
import type { Role } from "@infulancer/core/enums";

declare module "next-auth" {
  interface User {
    role?: Role;
    brandId?: string | null;
    influencerId?: string | null;
  }
  interface Session {
    user: {
      id: string;
      role: Role;
      brandId: string | null;
      influencerId: string | null;
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id?: string;
    role?: Role;
    brandId?: string | null;
    influencerId?: string | null;
  }
}
