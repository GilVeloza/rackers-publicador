import descripciones from "./descripciones.json" with { type: "json" };

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
  frase: Frase;
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
