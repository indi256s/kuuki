const lin=c=>{c/=255;return c<=0.04045?c/12.92:((c+0.055)/1.055)**2.4}
export function oklch(hex){const n=parseInt(hex.slice(1),16);const r=lin(n>>16&255),g=lin(n>>8&255),b=lin(n&255)
const l=Math.cbrt(0.4122214708*r+0.5363325363*g+0.0514459929*b),m=Math.cbrt(0.2119034982*r+0.6806995451*g+0.1073969566*b),s=Math.cbrt(0.0883024619*r+0.2817188376*g+0.6299787005*b)
const L=0.2104542553*l+0.7936177850*m-0.0040720468*s,A=1.9779984951*l-2.4285922050*m+0.4505937099*s,B=0.0259040371*l+0.7827717662*m-0.8086757660*s
return [L,Math.hypot(A,B),(Math.atan2(B,A)*180/Math.PI+360)%360]}
