// TikTok con la Content Posting API. Mientras TikTok no audite la app, solo
// deja publicar en privado o dejar el vídeo en la bandeja de la cuenta como
// borrador (llega un aviso y se termina de publicar desde la app). Lo decide
// TIKTOK_MODO: "borrador", "privado" o, ya auditada, "publico".
// https://developers.tiktok.com/doc/content-posting-api-get-started

import type { Env } from "./tipos.ts";

const API = "https://open.tiktokapis.com";
const MINUTO = 60 * 1000;

export interface CuentaTikTok {
  accessToken: string;
  refreshToken: string;
  openId: string;
  /** Milisegundos desde 1970. El de acceso dura 24 horas; el de renovar, un año. */
  caducaAcceso: number;
  caducaRenovar: number;
}

/**
 * Los permisos que se piden al conectar. En borrador basta con subir a la
 * bandeja (video.upload): es lo único que se pide en la revisión de TikTok,
 * porque publicar sin que la persona lo confirme en la app es lo que menos
 * aprueban. video.publish solo hace falta para "privado" o "publico".
 */
export function scopes(env: Env): string {
  return env.TIKTOK_MODO === "borrador" ? "user.info.basic,video.upload" : "user.info.basic,video.upload,video.publish";
}

export function urlConectar(env: Env, estado: string): string {
  const url = new URL("https://www.tiktok.com/v2/auth/authorize/");
  url.searchParams.set("client_key", env.TIKTOK_CLIENT_KEY);
  url.searchParams.set("scope", scopes(env));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", `${env.BASE_URL}/tiktok/vuelta`);
  url.searchParams.set("state", estado);
  // Que TikTok enseñe siempre la pantalla de permisos, aunque ya se hubiera
  // autorizado: se ve qué pide la app (y es lo que pide su revisión).
  url.searchParams.set("disable_auto_auth", "1");
  return url.toString();
}

interface RespuestaToken {
  access_token: string;
  refresh_token: string;
  open_id: string;
  expires_in: number;
  refresh_expires_in: number;
}

function cuenta(t: RespuestaToken): CuentaTikTok {
  return {
    accessToken: t.access_token,
    refreshToken: t.refresh_token,
    openId: t.open_id,
    caducaAcceso: Date.now() + t.expires_in * 1000,
    caducaRenovar: Date.now() + t.refresh_expires_in * 1000,
  };
}

export async function conectar(env: Env, code: string): Promise<CuentaTikTok> {
  return cuenta(await token(env, { grant_type: "authorization_code", code, redirect_uri: `${env.BASE_URL}/tiktok/vuelta` }));
}

/** Renueva el token de acceso si le quedan menos de 30 minutos. */
export async function renovar(env: Env, c: CuentaTikTok): Promise<CuentaTikTok> {
  if (c.caducaAcceso - Date.now() > 30 * MINUTO) return c;
  return cuenta(await token(env, { grant_type: "refresh_token", refresh_token: c.refreshToken }));
}

async function token(env: Env, campos: Record<string, string>): Promise<RespuestaToken> {
  const respuesta = await fetch(`${API}/v2/oauth/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_key: env.TIKTOK_CLIENT_KEY, client_secret: env.TIKTOK_CLIENT_SECRET, ...campos }),
  });
  const cuerpo = (await respuesta.json()) as RespuestaToken & { error?: string; error_description?: string };
  if (!respuesta.ok || cuerpo.error) throw new Error(`TikTok token: ${cuerpo.error_description ?? cuerpo.error ?? respuesta.status}`);
  return cuerpo;
}

/**
 * Sube el vídeo de un trozo (los nuestros pesan unos 11 MB; TikTok acepta un
 * solo trozo hasta 64 MB). Devuelve el publish_id.
 */
export async function publicarVideo(env: Env, c: CuentaTikTok, video: R2ObjectBody, texto: string): Promise<string> {
  const tamano = video.size;
  const fuente = { source: "FILE_UPLOAD", video_size: tamano, chunk_size: tamano, total_chunk_count: 1 };
  const borrador = env.TIKTOK_MODO === "borrador";
  const ruta = borrador ? "/v2/post/publish/inbox/video/init/" : "/v2/post/publish/video/init/";
  const cuerpo = borrador
    ? { source_info: fuente }
    : {
        post_info: {
          // En TikTok la descripción va en el título (hasta 2.200 caracteres).
          title: texto.slice(0, 2200),
          privacy_level: env.TIKTOK_MODO === "publico" ? "PUBLIC_TO_EVERYONE" : "SELF_ONLY",
          disable_duet: false,
          disable_comment: false,
          disable_stitch: false,
        },
        source_info: fuente,
      };

  const inicio = await fetch(`${API}${ruta}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${c.accessToken}`, "Content-Type": "application/json; charset=UTF-8" },
    body: JSON.stringify(cuerpo),
  });
  const datos = (await inicio.json()) as { data?: { publish_id: string; upload_url: string }; error?: { code: string; message: string } };
  if (!inicio.ok || !datos.data || (datos.error && datos.error.code !== "ok")) {
    throw new Error(`TikTok init: ${datos.error?.message ?? inicio.status}`);
  }

  const subida = await fetch(datos.data.upload_url, {
    method: "PUT",
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(tamano),
      "Content-Range": `bytes 0-${tamano - 1}/${tamano}`,
    },
    body: video.body,
  });
  if (!subida.ok) throw new Error(`TikTok subida: ${subida.status} ${(await subida.text()).slice(0, 200)}`);
  return datos.data.publish_id;
}
