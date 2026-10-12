# Contact sheet of rendered studies: python3 -I sheet.py <outdir> <prefix-regex> <out.png>
import base64, glob, os, re, subprocess, sys
d, pat, out = sys.argv[1], re.compile(sys.argv[2]), sys.argv[3]
names = sorted(os.path.basename(n)[:-7] for n in glob.glob(os.path.join(d, '*-bg.svg')) if pat.search(os.path.basename(n)))
W, H = 320, 190
rows = (len(names) + 1) // 2
o = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{2*W}" height="{rows*H}"><rect width="100%" height="100%" fill="#3c3a37"/>']
for i, n in enumerate(names):
    x, y = (i % 2) * W + 10, (i // 2) * H + 20
    b = base64.b64encode(open(os.path.join(d, n + '-bg.svg'), 'rb').read()).decode()
    o.append(f'<text x="{x}" y="{y-6}" fill="#c4beb7" font-size="11" font-family="Helvetica">{n}</text><image x="{x}" y="{y}" width="300" height="160" href="data:image/svg+xml;base64,{b}"/>')
open('/tmp/sheet.svg', 'w').write(''.join(o) + '</svg>')
subprocess.run(['rsvg-convert', '-z', '2', '/tmp/sheet.svg', '-o', out], check=True)
subprocess.run(['sips', '-Z', '1200', out], check=True, capture_output=True)
