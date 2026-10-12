#!/bin/zsh
# Sube a R2 (bucket rackers-reels) los vídeos de racqer-ios/design/content/reels:
# <idioma>/rackers-<frase>-<idioma>.mp4, con la misma ruta.
#   ./subir-videos.sh            # todos
#   ./subir-videos.sh es en      # solo esos idiomas
set -e
REELS=${REELS:-${0:A:h}/../racqer-ios/design/content/reels}
WRANGLER=${WRANGLER:-npx wrangler}
cd $REELS
for carpeta in ${@:-$(ls -d */ | tr -d /)}; do
  for video in $carpeta/rackers-*.mp4(N); do
    echo "↑ $video"
    ${=WRANGLER} r2 object put "rackers-reels/$video" --file "$video" --content-type video/mp4 --remote
  done
done
