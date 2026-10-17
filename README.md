# Publicador de Rackers

Un Worker de Cloudflare que publica cada día, solo, los vídeos de Rackers en
Instagram (Reels) y TikTok. Funciona con el Mac apagado.

## Qué publica y cuándo

Tres veces al día (horas en `wrangler.jsonc`, en UTC):

| Hora UTC | Madrid (invierno / verano) | Idioma |
| --- | --- | --- |
| 08:00 | 09:00 / 10:00 | El del día (rota entre 44 idiomas, ver `src/calendario.ts`) |
| 13:00 | 14:00 / 15:00 | Inglés |
| 18:00 | 19:00 / 20:00 | Español |

Cada día toca una frase (A, B, C, A…). El primer día es `INICIO`. La
descripción de cada idioma está en `src/descripciones.json` (copia de
`racqer-ios/design/content/reels/descripciones.json`).

Si una red falla, la otra sigue; lo que salió bien no se repite al reintentar
(`POST /probar`). Todo queda en `GET /estado`.

## Los Reels del entrenador de bolsillo

Desde el día `COACH_DESDE` (`wrangler.jsonc`) publica, en los mismos tres
huecos, los Reels del entrenador (`racqer-ios/design/video/coach-bolsillo`,
con la voz de Liam): cada día un deporte por turno (pádel, tenis, pickleball,
squash), el español y el inglés siempre, y el tercer idioma rota entre los 12
que tienen vídeo (`ROTACION_COACH` en `src/calendario.ts`). Las descripciones
están en `src/coach.json`. Vacío, siguen los Reels de frases.

Para activarlos:

1. `./subir-coach.sh` (sube los 56 vídeos a R2 como `coach/<deporte>/rackers-coach-<deporte>-<idioma>.mp4`).
2. Poner la fecha en `COACH_DESDE` y `npm run deploy`.
3. Mirar `/estado`: «hoy» y «mañana» enseñan el deporte y el vídeo de cada hueco.

Ojo: esos Reels enseñan la detección de jugadores, la trayectoria de la bola y
el mapa de calor. La fecha tiene que ser la de la versión de la app que los trae.

## Ponerlo en marcha (una vez)

Lo que solo puedes hacer tú está en **negrita**: crear las apps y dar permiso
con tus cuentas.

1. `npm install`
2. Crear lo de Cloudflare:
   ```sh
   npx wrangler r2 bucket create rackers-reels
   npx wrangler kv namespace create rackers-publicador   # pega el id en wrangler.jsonc
   ./subir-videos.sh
   ```
3. **Instagram:** la cuenta tiene que ser profesional (creador o empresa).
   En developers.facebook.com, crea una app de tipo *Empresa*, añade el
   producto *Instagram* → *API con inicio de sesión de Instagram*, y en
   *Redirect URI* pon `https://publicar.rackers.app/instagram/vuelta`.
   Apunta el *Instagram App ID* y el *App Secret*. Para tu propia cuenta no
   hace falta revisión de Meta: añádela como *Instagram tester* de la app.
4. **TikTok:** en developers.tiktok.com crea una app, añade *Login Kit* y
   *Content Posting API* (con *Direct Post*), pon la redirect URI
   `https://publicar.rackers.app/tiktok/vuelta` y apunta el *Client key* y el
   *Client secret*. Para publicar en público hay que pedir la auditoría de
   TikTok; mientras tanto `TIKTOK_MODO` es `borrador` (llega a tu bandeja y la
   publicas tú desde la app) o `privado`.
5. Las claves, cada una con su comando (te pide el valor):
   ```sh
   npx wrangler secret put CLAVE_ADMIN          # una contraseña larga inventada
   npx wrangler secret put IG_APP_ID
   npx wrangler secret put IG_APP_SECRET
   npx wrangler secret put TIKTOK_CLIENT_KEY
   npx wrangler secret put TIKTOK_CLIENT_SECRET
   ```
6. `npm run deploy`
7. **Conectar las cuentas**, abriendo en el navegador:
   - `https://publicar.rackers.app/instagram/conectar?clave=TU_CLAVE_ADMIN`
   - `https://publicar.rackers.app/tiktok/conectar?clave=TU_CLAVE_ADMIN`
8. Probar un hueco ahora mismo:
   ```sh
   curl -X POST "https://publicar.rackers.app/probar?clave=TU_CLAVE_ADMIN&hueco=es"
   ```

## Día a día

- Qué toca hoy y mañana, y lo último publicado:
  `https://publicar.rackers.app/estado?clave=TU_CLAVE_ADMIN`
- Vídeos nuevos: se rehacen en `racqer-ios/design/content/reels` (`todos.sh`)
  y se vuelven a subir con `./subir-videos.sh`.
- Los tokens se renuevan solos: el de Instagram antes de los 60 días y el de
  TikTok cada día. El de renovar de TikTok dura un año: entonces, volver a
  conectar.

## Comprobar

```sh
npm test            # el calendario (node:test, sin dependencias)
npm run typecheck
```
