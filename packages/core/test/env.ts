import { testEnv } from "./test-env";

// Modüller yüklenmeden önce ortam değişkenleri (loadEnv mevcut değerleri ezmez).
Object.assign(process.env, testEnv());
