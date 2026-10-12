// El publicador de Rackers: cada día, a las horas de wrangler.jsonc, publica
// en Instagram y TikTok el vídeo que toca (ver calendario.ts). También sirve
// los vídeos (Instagram los descarga de una URL pública) y las páginas para
// conectar las dos cuentas.

import { diaDelCalendario, huecoDelCron, publicacion, type Hueco, type Publicacion } from "./calendario.ts";
import * as instagram from "./instagram.ts";
import * as tiktok from "./tiktok.ts";
import type { Env } from "./tipos.ts";

const VIDEO = /^\/videos\/([A-Za-z-]{2,7})\/(rackers-[ABC]-[A-Za-z-]{2,7}\.mp4)$/;
/** Lo que se guarda de cada publicación, 90 días. */
const REGISTRO_TTL = 90 * 24 * 60 * 60;

type Resultado = { ok: true; id: string; cuando: string } | { ok: false; error: string; cuando: string };
interface Registro {
  publicacion: Publicacion;
  instagram?: Resultado;
  tiktok?: Resultado;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const ruta = url.pathname;

    const video = VIDEO.exec(ruta);
    if (video && request.method === "GET") return servirVideo(request, env, `${video[1]}/${video[2]}`);

    // Todo lo demás es para el dueño: lleva la clave (menos la vuelta de cada
    // red, que viene con el estado que se guardó al salir).
    if (ruta === "/instagram/vuelta" || ruta === "/tiktok/vuelta") return vuelta(url, env);
    if (!(await esAdmin(url, env))) return new Response("No encontrado", { status: 404 });

    if (ruta === "/instagram/conectar") return Response.redirect(instagram.urlConectar(env, await nuevoEstado(env, "instagram")), 302);
    if (ruta === "/tiktok/conectar") return Response.redirect(tiktok.urlConectar(env, await nuevoEstado(env, "tiktok")), 302);
    if (ruta === "/estado") return Response.json(await estado(env));
    if (ruta === "/probar" && request.method === "POST") {
      // Una prueba a mano: no espera a DESDE y puede ir a una sola red
      // (&red=tiktok o &red=instagram). Se apunta como prueba, aparte del calendario.
      const hueco = url.searchParams.get("hueco") as Hueco | null;
      if (hueco !== "otro" && hueco !== "en" && hueco !== "es") return new Response("hueco: otro, en o es", { status: 400 });
      const red = url.searchParams.get("red");
      if (red !== null && red !== "instagram" && red !== "tiktok") return new Response("red: instagram o tiktok", { status: 400 });
      return Response.json(await publicarHueco(env, hueco, new Date(), { prueba: true, red: red ?? undefined }));
    }
    return new Response("No encontrado", { status: 404 });
  },

  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    const hueco = huecoDelCron(controller.cron);
    if (!hueco) return;
    ctx.waitUntil(publicarHueco(env, hueco, new Date(controller.scheduledTime)).then((r) => console.log(JSON.stringify(r))));
  },
} satisfies ExportedHandler<Env>;

/** Publica en las dos redes lo que toca. Si una ya salió bien, no la repite. */
export async function publicarHueco(
  env: Env,
  hueco: Hueco,
  cuando: Date,
  opciones: { prueba?: boolean; red?: "instagram" | "tiktok" } = {},
): Promise<Registro | { nada: string }> {
  if (!opciones.prueba && env.DESDE && cuando.toISOString().slice(0, 10) < env.DESDE) return { nada: `publica solo desde el ${env.DESDE}` };
  const p = publicacion(Math.max(0, diaDelCalendario(env.INICIO, cuando)), hueco);
  if (!p) return { nada: `el calendario empieza el ${env.INICIO}` };
  const clave = `${opciones.prueba ? "prueba" : "registro"}:${cuando.toISOString().slice(0, opciones.prueba ? 19 : 10)}:${hueco}`;
  const registro: Registro = (await env.ESTADO.get<Registro>(clave, "json")) ?? { publicacion: p };

  if (opciones.red !== "tiktok" && !registro.instagram?.ok) registro.instagram = await intento(() => publicarInstagram(env, p));
  if (opciones.red !== "instagram" && !registro.tiktok?.ok) registro.tiktok = await intento(() => publicarTikTok(env, p));

  await env.ESTADO.put(clave, JSON.stringify(registro), { expirationTtl: REGISTRO_TTL });
  return registro;
}

async function publicarInstagram(env: Env, p: Publicacion): Promise<string> {
  const guardada = await env.ESTADO.get<instagram.CuentaInstagram>("cuenta:instagram", "json");
  if (!guardada) throw new Error("Instagram sin conectar: abre /instagram/conectar");
  const cuenta = await instagram.renovar(guardada);
  if (cuenta !== guardada) await env.ESTADO.put("cuenta:instagram", JSON.stringify(cuenta));
  return instagram.publicarReel(env, cuenta, `${env.BASE_URL}/videos/${p.clave}`, p.texto);
}

async function publicarTikTok(env: Env, p: Publicacion): Promise<string> {
  const guardada = await env.ESTADO.get<tiktok.CuentaTikTok>("cuenta:tiktok", "json");
  if (!guardada) throw new Error("TikTok sin conectar: abre /tiktok/conectar");
  const cuenta = await tiktok.renovar(env, guardada);
  if (cuenta !== guardada) await env.ESTADO.put("cuenta:tiktok", JSON.stringify(cuenta));
  const video = await env.VIDEOS.get(p.clave);
  if (!video) throw new Error(`Falta el vídeo ${p.clave} en R2`);
  return tiktok.publicarVideo(env, cuenta, video, p.texto);
}

async function intento(publicar: () => Promise<string>): Promise<Resultado> {
  const cuando = new Date().toISOString();
  try {
    return { ok: true, id: await publicar(), cuando };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error), cuando };
  }
}

/** El vídeo desde R2, también por trozos (Range), que es como lo piden algunos lectores. */
async function servirVideo(request: Request, env: Env, clave: string): Promise<Response> {
  const objeto = await env.VIDEOS.get(clave, { range: request.headers, onlyIf: request.headers });
  if (!objeto) return new Response("No encontrado", { status: 404 });
  const cabeceras = new Headers({
    "Content-Type": "video/mp4",
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=86400",
    ETag: objeto.httpEtag,
  });
  if (!("body" in objeto)) return new Response(null, { status: 304, headers: cabeceras });
  const rango = objeto.range as { offset?: number; length?: number } | undefined;
  if (request.headers.has("Range") && rango?.offset !== undefined && rango.length !== undefined) {
    cabeceras.set("Content-Range", `bytes ${rango.offset}-${rango.offset + rango.length - 1}/${objeto.size}`);
    cabeceras.set("Content-Length", String(rango.length));
    return new Response(objeto.body, { status: 206, headers: cabeceras });
  }
  cabeceras.set("Content-Length", String(objeto.size));
  return new Response(objeto.body, { headers: cabeceras });
}

/** Lo que pasa hoy y lo último publicado, sin enseñar ningún token. */
async function estado(env: Env) {
  const hoy = new Date();
  const dia = diaDelCalendario(env.INICIO, hoy);
  const fecha = hoy.toISOString().slice(0, 10);
  const huecos: Hueco[] = ["otro", "en", "es"];
  const lista = await env.ESTADO.list({ prefix: "registro:" });
  const ultimos = await Promise.all(lista.keys.slice(-9).map(async (k) => [k.name, await env.ESTADO.get(k.name, "json")]));
  return {
    hoy: Object.fromEntries(huecos.map((h) => [h, publicacion(dia, h)])),
    mañana: Object.fromEntries(huecos.map((h) => [h, publicacion(dia + 1, h)])),
    conectadas: {
      instagram: (await env.ESTADO.get("cuenta:instagram")) !== null,
      tiktok: (await env.ESTADO.get("cuenta:tiktok")) !== null,
    },
    tiktokModo: env.TIKTOK_MODO,
    fecha,
    ultimos: Object.fromEntries(ultimos),
  };
}

async function nuevoEstado(env: Env, red: string): Promise<string> {
  const estado = crypto.randomUUID();
  await env.ESTADO.put(`oauth:${estado}`, red, { expirationTtl: 600 });
  return estado;
}

async function vuelta(url: URL, env: Env): Promise<Response> {
  const red = url.pathname.startsWith("/instagram") ? "instagram" : "tiktok";
  const estado = url.searchParams.get("state") ?? "";
  const code = url.searchParams.get("code");
  if (!code || (await env.ESTADO.get(`oauth:${estado}`)) !== red) return new Response("Enlace caducado o no válido", { status: 400 });
  await env.ESTADO.delete(`oauth:${estado}`);
  const cuenta = red === "instagram" ? await instagram.conectar(env, code) : await tiktok.conectar(env, code);
  await env.ESTADO.put(`cuenta:${red}`, JSON.stringify(cuenta));
  return new Response(`${red === "instagram" ? "Instagram" : "TikTok"} conectado. Ya puedes cerrar esta página.`, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

async function esAdmin(url: URL, env: Env): Promise<boolean> {
  const dada = new TextEncoder().encode(url.searchParams.get("clave") ?? "");
  const buena = new TextEncoder().encode(env.CLAVE_ADMIN ?? "");
  if (buena.length === 0 || dada.length !== buena.length) return false;
  return crypto.subtle.timingSafeEqual(dada, buena);
}
