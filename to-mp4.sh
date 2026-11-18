#!/usr/bin/env bash
# Turn a Playwright recording (webm) into a public-ready MP4 with a faststart index.
set -euo pipefail
in="$1"; out="$2"
ffmpeg="$(node -e "console.log(require('ffmpeg-static'))")"
"$ffmpeg" -y -loglevel error -i "$in" \
  -vf "fps=15,scale=trunc(iw/2)*2:trunc(ih/2)*2" \
  -c:v libx264 -preset veryfast -crf 28 -pix_fmt yuv420p -movflags +faststart \
  -an "$out"
ls -l "$out"
