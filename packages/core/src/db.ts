import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "./generated/prisma/client";
import { requireEnv } from "./env";

export * from "./generated/prisma/client";

/** prisma.$transaction içindeki istemci tipi (PrismaClient de bu tipe uyar). */
export type Tx = Prisma.TransactionClient;

function createClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: requireEnv("DATABASE_URL") });
  return new PrismaClient({ adapter });
}

// Next.js dev'de hot reload sırasında bağlantı sızıntısını önlemek için globalThis önbelleği.
const globalForPrisma = globalThis as unknown as { __infulancerPrisma?: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.__infulancerPrisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__infulancerPrisma = prisma;
}
