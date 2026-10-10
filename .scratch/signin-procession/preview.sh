#!/bin/sh
# Quick look at the stills: panel fill + kana + wordmark behind the generated planes, rasterised with rsvg-convert.
cd "$(dirname "$0")/out" || exit 1
for L in desktop mobile; do for T in dark light; do
  if [ $L = desktop ]; then W=420 H=620; else W=390 H=302; fi
  if [ $T = dark ]; then BG='#2f2d2b' ACC='#EA846F' OP=0.13 TX='#F1EFEB'; else BG='#f2f0ed' ACC='#C23417' OP=0.1 TX='#302D2A'; fi
  [ $L = mobile ] && [ $T = dark ] && BG='#292827'
  if [ $L = desktop ]; then
    KANA="<g font-family='Hiragino Sans' font-weight='700' font-size='164' fill='$ACC' opacity='$OP' text-anchor='middle'><text x='210' y='230'>く</text><text x='210' y='394'>う</text><text x='210' y='558'>き</text></g>"
    WM="<text x='40' y='70' font-family='Commissioner' font-weight='700' font-size='36' letter-spacing='-1.4'><tspan fill='$ACC'>Ku</tspan><tspan fill='$TX'>uki</tspan></text>"
  else
    KANA="<text x='195' y='215' font-family='Hiragino Sans' font-weight='700' font-size='104' fill='$ACC' opacity='$OP' text-anchor='middle' letter-spacing='4'>くうき</text>"
    WM="<text x='20' y='35' font-family='Commissioner' font-weight='700' font-size='28' letter-spacing='-1.1'><tspan fill='$ACC'>Ku</tspan><tspan fill='$TX'>uki</tspan></text>"
  fi
  INNER=$(sed -e 's/^<svg[^>]*>//' -e 's/<\/svg>$//' still-$L-$T.svg)
  printf '%s' "<svg xmlns='http://www.w3.org/2000/svg' width='$W' height='$H'><rect width='$W' height='$H' fill='$BG'/>$KANA$INNER$WM</svg>" > /tmp/kuuki-prev-$L-$T.svg
  rsvg-convert -z 2 /tmp/kuuki-prev-$L-$T.svg -o prev-$L-$T.png
done; done
echo ok
