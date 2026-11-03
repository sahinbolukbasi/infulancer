/**
 * Lambda handler'larını esbuild ile paketler → packages/core/dist/lambda/<ad>/index.mjs
 *   npm run build:lambda
 */
import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const entries = { scheduled: "src/lambda/scheduled.ts", sqs: "src/lambda/sqs.ts" };

for (const [name, entry] of Object.entries(entries)) {
  await build({
    entryPoints: [path.join(root, entry)],
    outfile: path.join(root, "dist/lambda", name, "index.mjs"),
    bundle: true,
    platform: "node",
    target: "node22",
    format: "esm",
    sourcemap: true,
    // Lambda çalışma zamanında AWS SDK v3 hazır gelir.
    external: ["@aws-sdk/*"],
    // ESM bundle içinde CommonJS bağımlılıkları için require/__dirname köprüsü.
    banner: {
      js: "import { createRequire as __cr } from 'module'; import { fileURLToPath as __fu } from 'url'; import { dirname as __dn } from 'path'; const require = __cr(import.meta.url); const __filename = __fu(import.meta.url); const __dirname = __dn(__filename);",
    },
    logLevel: "warning",
  });
  console.log(`paketlendi: dist/lambda/${name}/index.mjs`);
}
