import { test } from "node:test";
import assert from "node:assert/strict";
import { FRASES, ROTACION, descripcion, diaDelCalendario, huecoDelCron, publicacion } from "../src/calendario.ts";
import frases from "../../racqer-ios/design/content/reels/frases.json" with { type: "json" };

test("el día cuenta desde INICIO en UTC", () => {
  assert.equal(diaDelCalendario("2026-10-12", new Date("2026-10-12T08:00:00Z")), 0);
  assert.equal(diaDelCalendario("2026-10-12", new Date("2026-10-13T18:00:00Z")), 1);
  assert.equal(diaDelCalendario("2026-10-12", new Date("2026-10-11T23:59:00Z")), -1);
});

test("antes del primer día no se publica nada", () => {
  assert.equal(publicacion(-1, "es"), null);
});

test("cada día una frase, por orden, y español e inglés siempre", () => {
  assert.deepEqual([0, 1, 2, 3].map((d) => publicacion(d, "es")!.frase), ["A", "B", "C", "A"]);
  assert.equal(publicacion(5, "es")!.idioma, "es");
  assert.equal(publicacion(5, "en")!.idioma, "en");
  assert.equal(publicacion(0, "otro")!.clave, "pt-PT/rackers-A-pt-PT.mp4");
});

test("la rotación pasa por todos los idiomas sin repetir ni variantes", () => {
  assert.equal(new Set(ROTACION).size, ROTACION.length);
  for (const fuera of ["es", "en", "es-MX", "en-GB", "en-AU", "en-CA", "fr-CA"]) assert.ok(!ROTACION.includes(fuera as never));
  const vistos = new Set(Array.from({ length: ROTACION.length }, (_, d) => publicacion(d, "otro")!.idioma));
  assert.equal(vistos.size, ROTACION.length);
});

test("cada idioma de la rotación tiene vídeo (frase) y descripción", () => {
  for (const idioma of [...ROTACION, "es", "en"]) {
    for (const f of FRASES) assert.ok((frases as Record<string, Record<string, string>>)[f][idioma], `${f} ${idioma}`);
    assert.ok(descripcion(idioma).includes("#padel"), idioma);
    assert.ok(descripcion(idioma).includes("rackers.app"), idioma);
  }
});

test("cada cron es un hueco", () => {
  assert.equal(huecoDelCron("0 8 * * *"), "otro");
  assert.equal(huecoDelCron("0 13 * * *"), "en");
  assert.equal(huecoDelCron("0 18 * * *"), "es");
  assert.equal(huecoDelCron("0 3 * * *"), null);
});

// ---------------------------------------------------------------- el entrenador de bolsillo
import { existsSync } from "node:fs";
import { DEPORTES, ROTACION_COACH, descripcionCoach, publicacionCoach, toca } from "../src/calendario.ts";

const VIDEO_LOCAL: Record<string, string> = {
  es: "es-ES", en: "en-US", fr: "fr-FR", "pt-PT": "pt-PT", "pt-BR": "pt-BR", it: "it-IT", de: "de-DE",
  nl: "nl-NL", sv: "sv-SE", vi: "vi-VN", "zh-Hans": "zh-Hans", ja: "ja-JP", hi: "hi-IN", ar: "ar",
};

test("entrenador: cada día un deporte por turno, y español e inglés siempre", () => {
  assert.deepEqual([0, 1, 2, 3, 4].map((d) => publicacionCoach(d, "es")!.deporte), ["padel", "tenis", "pickleball", "squash", "padel"]);
  assert.equal(publicacionCoach(3, "en")!.idioma, "en");
  assert.equal(publicacionCoach(0, "otro")!.clave, "coach/padel/rackers-coach-padel-pt-PT.mp4");
  assert.equal(publicacionCoach(-1, "es"), null);
});

test("entrenador: el tercer idioma pasa por todos los que tienen vídeo", () => {
  const vistos = new Set(Array.from({ length: ROTACION_COACH.length }, (_, d) => publicacionCoach(d, "otro")!.idioma));
  assert.equal(vistos.size, ROTACION_COACH.length);
  assert.ok(!ROTACION_COACH.includes("es" as never) && !ROTACION_COACH.includes("en" as never));
});

test("entrenador: cada idioma y deporte tiene descripción y vídeo con voz", () => {
  for (const idioma of [...ROTACION_COACH, "es", "en"]) {
    for (const deporte of DEPORTES) {
      const texto = descripcionCoach(idioma, deporte);
      assert.ok(texto.includes("rackers.app") && texto.includes(`#${deporte === "tenis" ? "tennis" : deporte}`), `${idioma} ${deporte}`);
      const video = `../racqer-ios/design/video/coach-bolsillo/coach-bolsillo-${deporte}-vertical-${VIDEO_LOCAL[idioma]}-voz-elevenlabs-liam.mp4`;
      assert.ok(existsSync(new URL(video, `file://${process.cwd()}/`)), video);
    }
  }
});

test("entrenador: antes de COACH_DESDE siguen las frases; desde ese día, el entrenador", () => {
  const antes = toca("2026-10-11", "2026-11-09", new Date("2026-11-08T18:00:00Z"), "es")!;
  const desde = toca("2026-10-11", "2026-11-09", new Date("2026-11-09T08:00:00Z"), "otro")!;
  assert.ok(antes.frase && !antes.deporte);
  assert.equal(desde.clave, "coach/padel/rackers-coach-padel-pt-PT.mp4");
  assert.ok(toca("2026-10-11", "", new Date("2027-01-01T08:00:00Z"), "es")!.frase, "sin fecha, siguen las frases");
});
