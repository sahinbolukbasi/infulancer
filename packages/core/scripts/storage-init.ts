import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketCorsCommand,
} from "@aws-sdk/client-s3";
import { envStr } from "../src/env";
import { bucket, s3 } from "../src/storage/s3";

// Yerel MinIO bucket'ını (yoksa) oluşturur ve tarayıcıdan presigned PUT/GET için CORS ayarlar.
async function main() {
  const client = s3();
  const name = bucket();
  try {
    await client.send(new HeadBucketCommand({ Bucket: name }));
    console.log(`storage: bucket mevcut (${name})`);
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: name }));
    console.log(`storage: bucket oluşturuldu (${name})`);
  }

  const appUrl = envStr("APP_URL", "http://localhost:3000");
  try {
    await putCors(name, appUrl);
    console.log(`storage: CORS ayarlandı (${appUrl})`);
  } catch (err) {
    // MinIO bucket CORS API'sini desteklemez (501 NotImplemented); CORS sunucu düzeyinde
    // MINIO_API_CORS_ALLOW_ORIGIN ile verilir (docker-compose.yml). AWS S3'te bu çağrı çalışır.
    if ((err as { name?: string }).name === "NotImplemented") {
      console.log(
        `storage: sunucu bucket CORS API'sini desteklemiyor (MinIO); CORS docker-compose'daki MINIO_API_CORS_ALLOW_ORIGIN ile sağlanıyor (${appUrl}).`,
      );
    } else {
      throw err;
    }
  }
}

async function putCors(name: string, appUrl: string) {
  await s3().send(
    new PutBucketCorsCommand({
      Bucket: name,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: [appUrl],
            AllowedMethods: ["PUT", "GET", "HEAD"],
            AllowedHeaders: ["*"],
            ExposeHeaders: ["ETag"],
            MaxAgeSeconds: 3000,
          },
        ],
      },
    }),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
