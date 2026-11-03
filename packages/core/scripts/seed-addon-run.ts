/** Yalnız ek modül demo verisini yükler (mevcut çekirdek veriyi silmez). */
import { prisma } from "../src/db";
import { seedAddon } from "./seed-addon";

seedAddon()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
