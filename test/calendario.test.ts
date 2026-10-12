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
