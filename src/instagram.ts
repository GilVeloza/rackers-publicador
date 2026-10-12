// Instagram con la API de Instagram (inicio de sesión con Instagram, sin
// página de Facebook): la cuenta tiene que ser profesional (creador o empresa).
// Reels: se crea el contenedor con la URL pública del vídeo, se espera a que
// Instagram lo procese y se publica.
// https://developers.facebook.com/docs/instagram-platform/content-publishing

import type { Env } from "./tipos.ts";

const GRAPH = "https://graph.instagram.com";
const DIA = 24 * 60 * 60 * 1000;

export interface CuentaInstagram {
  token: string;
  userId: string;
  /** Milisegundos desde 1970. El token largo dura 60 días y se renueva antes. */
  caduca: number;
}

export const SCOPES = "instagram_business_basic,instagram_business_content_publish";

export function urlConectar(env: Env, estado: string): string {
  const url = new URL("https://www.instagram.com/oauth/authorize");
  url.searchParams.set("client_id", env.IG_APP_ID);
  url.searchParams.set("redirect_uri", `${env.BASE_URL}/instagram/vuelta`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPES);
  url.searchParams.set("state", estado);
  return url.toString();
}

/** El código de la vuelta → token corto → token largo (60 días). */
export async function conectar(env: Env, code: string): Promise<CuentaInstagram> {
  const corto = await json<{ access_token: string; user_id: number | string }>(
    await fetch("https://api.instagram.com/oauth/access_token", {
      method: "POST",
      body: new URLSearchParams({
        client_id: env.IG_APP_ID,
        client_secret: env.IG_APP_SECRET,
        grant_type: "authorization_code",
        redirect_uri: `${env.BASE_URL}/instagram/vuelta`,
        code,
      }),
    }),
  );
  const url = new URL(`${GRAPH}/access_token`);
  url.searchParams.set("grant_type", "ig_exchange_token");
  url.searchParams.set("client_secret", env.IG_APP_SECRET);
  url.searchParams.set("access_token", corto.access_token);
  const largo = await json<{ access_token: string; expires_in: number }>(await fetch(url));
  return { token: largo.access_token, userId: String(corto.user_id), caduca: Date.now() + largo.expires_in * 1000 };
}

/** Renueva el token si le quedan menos de 10 días. Devuelve la cuenta, renovada o no. */
export async function renovar(cuenta: CuentaInstagram): Promise<CuentaInstagram> {
  if (cuenta.caduca - Date.now() > 10 * DIA) return cuenta;
  const url = new URL(`${GRAPH}/refresh_access_token`);
  url.searchParams.set("grant_type", "ig_refresh_token");
  url.searchParams.set("access_token", cuenta.token);
  const nuevo = await json<{ access_token: string; expires_in: number }>(await fetch(url));
  return { ...cuenta, token: nuevo.access_token, caduca: Date.now() + nuevo.expires_in * 1000 };
}

/** Publica un Reel. Devuelve el id de la publicación. */
export async function publicarReel(env: Env, cuenta: CuentaInstagram, videoUrl: string, texto: string): Promise<string> {
  const base = `${GRAPH}/${env.IG_API_VERSION}/${cuenta.userId}`;
  const contenedor = await json<{ id: string }>(
    await fetch(`${base}/media`, {
      method: "POST",
      body: new URLSearchParams({
        media_type: "REELS",
        video_url: videoUrl,
        caption: texto,
        share_to_feed: "true",
        access_token: cuenta.token,
      }),
    }),
  );

  // Instagram descarga y procesa el vídeo: se pregunta cada 10 s, hasta 5 minutos.
  for (let intento = 0; intento < 30; intento++) {
    await espera(10_000);
    const url = new URL(`${GRAPH}/${env.IG_API_VERSION}/${contenedor.id}`);
    url.searchParams.set("fields", "status_code,status");
    url.searchParams.set("access_token", cuenta.token);
    const estado = await json<{ status_code: string; status?: string }>(await fetch(url));
    if (estado.status_code === "FINISHED") break;
    if (estado.status_code === "ERROR" || estado.status_code === "EXPIRED") {
      throw new Error(`Instagram no pudo procesar el vídeo: ${estado.status ?? estado.status_code}`);
    }
    if (intento === 29) throw new Error("Instagram tardó más de 5 minutos en procesar el vídeo");
  }

  const publicado = await json<{ id: string }>(
    await fetch(`${base}/media_publish`, {
      method: "POST",
      body: new URLSearchParams({ creation_id: contenedor.id, access_token: cuenta.token }),
    }),
  );
  return publicado.id;
}

async function json<T>(respuesta: Response): Promise<T> {
  const cuerpo = await respuesta.text();
  if (!respuesta.ok) throw new Error(`Instagram ${respuesta.status}: ${cuerpo.slice(0, 300)}`);
  return JSON.parse(cuerpo) as T;
}

const espera = (ms: number) => new Promise((listo) => setTimeout(listo, ms));
