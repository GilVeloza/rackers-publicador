import descripciones from "./descripciones.json" with { type: "json" };
import coach from "./coach.json" with { type: "json" };

/** Las tres frases del vídeo; cada día toca una, por orden. */
export const FRASES = ["A", "B", "C"] as const;
export type Frase = (typeof FRASES)[number];

/** Las tres publicaciones del día, por orden de hora. */
export type Hueco = "otro" | "en" | "es";

/**
 * El tercer idioma de cada día, por turno. Son todos los de la app menos el
 * español y el inglés, que salen cada día, y sus variantes (es-MX, en-GB…,
 * fr-CA), que dirían casi lo mismo. Primero los países con más pádel.
 */
export const ROTACION = [
  "pt-PT", "it", "fr", "sv", "nl", "de", "pt-BR",
  "fi", "da", "nb", "pl", "ar", "ca", "cs", "ro", "hu", "el", "hr", "sk", "sl",
  "tr", "ru", "uk", "he", "ja", "ko", "zh-Hans", "zh-Hant", "id", "ms", "fil", "vi", "th",
  "hi", "bn", "ur", "mr", "gu", "pa", "ta", "te", "kn", "ml", "or",
] as const;

const DIA = 24 * 60 * 60 * 1000;

/** Cuántos días han pasado desde `inicio` (AAAA-MM-DD) hasta `ahora`, contando en UTC. */
export function diaDelCalendario(inicio: string, ahora: Date): number {
  const desde = Date.parse(`${inicio}T00:00:00Z`);
  if (Number.isNaN(desde)) throw new Error(`INICIO no es una fecha: ${inicio}`);
  return Math.floor((ahora.getTime() - desde) / DIA);
}

export interface Publicacion {
  dia: number;
  /** Los Reels de frases (A, B, C). */
  frase?: Frase;
  /** Los Reels del entrenador de bolsillo: el deporte del día. */
  deporte?: Deporte;
  idioma: string;
  /** Dónde está el vídeo en R2 (y en /videos/ del Worker). */
  clave: string;
  /** La descripción con sus hashtags. */
  texto: string;
}

/** Qué se publica un día en un hueco. Antes del primer día, nada. */
export function publicacion(dia: number, hueco: Hueco): Publicacion | null {
  if (dia < 0) return null;
  const frase = FRASES[dia % FRASES.length];
  const idioma = hueco === "otro" ? ROTACION[dia % ROTACION.length] : hueco;
  return {
    dia,
    frase,
    idioma,
    clave: `${idioma}/rackers-${frase}-${idioma}.mp4`,
    texto: descripcion(idioma),
  };
}

/** La web, que lleva al App Store. En TikTok y Reels no se puede tocar, pero se lee igual en todos los idiomas. */
export const WEB = "🔗 rackers.app";

export function descripcion(idioma: string): string {
  const d = (descripciones as Record<string, { texto: string; hashtags: string }>)[idioma];
  if (!d) throw new Error(`No hay descripción en ${idioma}`);
  return `${d.texto}\n${WEB}\n\n${d.hashtags}`;
}

/** Qué hueco es cada cron de wrangler.jsonc. */
export function huecoDelCron(cron: string): Hueco | null {
  const hora = Number(cron.split(" ")[1]);
  return hora === 8 ? "otro" : hora === 13 ? "en" : hora === 18 ? "es" : null;
}

// ---------------------------------------------------------------- el entrenador de bolsillo
// Desde COACH_DESDE (wrangler.jsonc) se publican los Reels del entrenador
// (racqer-ios/design/video/coach-bolsillo, con voz): cada día un deporte, por
// turno, y el español, el inglés y un tercer idioma de los que tienen vídeo.

export const DEPORTES = ["padel", "tenis", "pickleball", "squash"] as const;
export type Deporte = (typeof DEPORTES)[number];

/** El tercer idioma de cada día en los Reels del entrenador: los que tienen vídeo, primero los países con más pádel. */
export const ROTACION_COACH = ["pt-PT", "it", "fr", "sv", "nl", "de", "pt-BR", "zh-Hans", "hi", "vi", "ar", "ja"] as const;

/** Qué Reel del entrenador se publica el día `dia` (contado desde COACH_DESDE) en un hueco. */
export function publicacionCoach(dia: number, hueco: Hueco): Publicacion | null {
  if (dia < 0) return null;
  const deporte = DEPORTES[dia % DEPORTES.length];
  const idioma = hueco === "otro" ? ROTACION_COACH[dia % ROTACION_COACH.length] : hueco;
  return { dia, deporte, idioma, clave: `coach/${deporte}/rackers-coach-${deporte}-${idioma}.mp4`, texto: descripcionCoach(idioma, deporte) };
}

export function descripcionCoach(idioma: string, deporte: Deporte): string {
  const d = (coach as Record<string, { texto: string; hashtags: string; deportes: Record<Deporte, string> }>)[idioma];
  if (!d) throw new Error(`No hay descripción del entrenador en ${idioma}`);
  return `${d.texto}\n${WEB}\n\n${d.deportes[deporte]} ${d.hashtags}`;
}

/** Lo que toca publicar en un hueco: los Reels del entrenador desde COACH_DESDE, y antes los de frases. */
export function toca(inicio: string, coachDesde: string | undefined, cuando: Date, hueco: Hueco): Publicacion | null {
  if (coachDesde && cuando.toISOString().slice(0, 10) >= coachDesde) return publicacionCoach(diaDelCalendario(coachDesde, cuando), hueco);
  return publicacion(Math.max(0, diaDelCalendario(inicio, cuando)), hueco);
}
