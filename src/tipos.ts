export interface Env {
  VIDEOS: R2Bucket;
  ESTADO: KVNamespace;
  INICIO: string;
  /** AAAA-MM-DD: antes de este día no publica nada (los cron siguen, pero no hacen nada). */
  DESDE?: string;
  BASE_URL: string;
  IG_API_VERSION: string;
  TIKTOK_MODO: "borrador" | "privado" | "publico";
  /** Protege las rutas de conectar cuentas, ver el estado y probar. */
  CLAVE_ADMIN: string;
  IG_APP_ID: string;
  IG_APP_SECRET: string;
  TIKTOK_CLIENT_KEY: string;
  TIKTOK_CLIENT_SECRET: string;
}
