#!/bin/zsh
# Sube a R2 (bucket rackers-reels) los Reels del entrenador de bolsillo, con
# voz, de racqer-ios/design/video/coach-bolsillo, como
# coach/<deporte>/rackers-coach-<deporte>-<idioma>.mp4 (los idiomas del publicador).
#   ./subir-coach.sh            # todos
#   ./subir-coach.sh es en      # solo esos idiomas
set -e
VIDEOS=${VIDEOS:-${0:A:h}/../racqer-ios/design/video/coach-bolsillo}
WRANGLER=${WRANGLER:-npx wrangler}
# El código del publicador y el del nombre del vídeo.
typeset -A CODIGO=(es es-ES en en-US fr fr-FR pt-PT pt-PT pt-BR pt-BR it it-IT de de-DE nl nl-NL sv sv-SE vi vi-VN zh-Hans zh-Hans ja ja-JP hi hi-IN ar ar)
for idioma in ${@:-${(k)CODIGO}}; do
  for deporte in padel tenis pickleball squash; do
    video=$VIDEOS/coach-bolsillo-$deporte-vertical-$CODIGO[$idioma]-voz-elevenlabs-liam.mp4
    [[ -f $video ]] || { echo "falta $video"; exit 1; }
    echo "↑ coach/$deporte/rackers-coach-$deporte-$idioma.mp4"
    ${=WRANGLER} r2 object put "rackers-reels/coach/$deporte/rackers-coach-$deporte-$idioma.mp4" --file "$video" --content-type video/mp4 --remote
  done
done
