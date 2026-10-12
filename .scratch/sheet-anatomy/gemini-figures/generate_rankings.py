import os

svg_content = '''<svg xmlns="http://www.w3.org/2000/svg" width="300" height="160" viewBox="0 0 300 160" fill="none" role="presentation">
<g stroke-linecap="round" stroke-linejoin="round">
  <!-- Back of Handles (behind cup bowl) -->
  <!-- Left Handle Rear Rim -->
  <path d="M 104 32 C 90 28, 76 36, 76 52 C 76 68, 92 78, 124 74" fill="none" stroke="var(--color-journal-dark-iso-line)" stroke-width="4.5"/>
  <path d="M 104 32 C 90 28, 76 36, 76 52 C 76 68, 92 78, 124 74" fill="none" stroke="var(--color-journal-dark-iso-side)" stroke-width="2.5"/>
  
  <!-- Right Handle Rear Rim -->
  <path d="M 196 32 C 210 28, 224 36, 224 52 C 224 68, 208 78, 176 74" fill="none" stroke="var(--color-journal-dark-iso-line)" stroke-width="4.5"/>
  <path d="M 196 32 C 210 28, 224 36, 224 52 C 224 68, 208 78, 176 74" fill="none" stroke="var(--color-journal-dark-iso-front)" stroke-width="2.5"/>

  <!-- Lower Base Tier (Plinth Foot) -->
  <!-- Left side -->
  <polygon points="104,136 150,154 150,146 104,128" fill="var(--color-journal-dark-iso-side)" stroke="var(--color-journal-dark-iso-line)" stroke-width="1"/>
  <!-- Right side -->
  <polygon points="150,154 196,136 196,128 150,146" fill="var(--color-journal-dark-iso-front)" stroke="var(--color-journal-dark-iso-line)" stroke-width="1"/>
  <!-- Top surface -->
  <polygon points="104,128 150,110 196,128 150,146" fill="var(--color-journal-dark-inset)" stroke="var(--color-journal-dark-iso-line)" stroke-width="1"/>

  <!-- Main Base Pedestal (Square Column) -->
  <!-- Left face -->
  <polygon points="114,122 150,136 150,108 114,94" fill="var(--color-journal-dark-iso-side)" stroke="var(--color-journal-dark-iso-line)" stroke-width="1"/>
  <!-- Right face (Plaque mount) -->
  <polygon points="150,136 186,122 186,94 150,108" fill="var(--color-journal-dark-iso-front)" stroke="var(--color-journal-dark-iso-line)" stroke-width="1"/>
  <!-- Top face -->
  <polygon points="114,94 150,80 186,94 150,108" fill="var(--color-journal-dark-inset)" stroke="var(--color-journal-dark-iso-line)" stroke-width="1"/>
  <!-- Base bevel step -->
  <path d="M 118 97 L 150 109 L 182 97" fill="none" stroke="var(--color-journal-dark-iso-detail)" stroke-width="0.8"/>

  <!-- Engraved Airline Plaque (Front-Right Face) -->
  <polygon points="154,111 182,100 182,118 154,129" fill="var(--color-journal-dark-iso-glass)" stroke="var(--color-journal-dark-shu)" stroke-width="1"/>
  <!-- Plaque accent mounting screws -->
  <circle cx="156.5" cy="113.5" r="0.8" fill="var(--color-journal-dark-shu)"/>
  <circle cx="179.5" cy="102.5" r="0.8" fill="var(--color-journal-dark-shu)"/>
  <circle cx="156.5" cy="126.5" r="0.8" fill="var(--color-journal-dark-shu)"/>
  <circle cx="179.5" cy="115.5" r="0.8" fill="var(--color-journal-dark-shu)"/>
  <!-- Selected Airline Callout Text -->
  <text x="168" y="117.5" transform="rotate(-21.5 168 117.5)" font-family="JetBrains Mono, monospace" font-size="8.5" font-weight="700" letter-spacing="0.05em" text-anchor="middle" fill="var(--color-journal-dark-shu)">PC</text>

  <!-- Turned Stem / Collar Rings -->
  <!-- Stem Lower Ring -->
  <ellipse cx="150" cy="88" rx="16" ry="6" fill="var(--color-journal-dark-iso-side)" stroke="var(--color-journal-dark-iso-line)" stroke-width="1"/>
  <ellipse cx="150" cy="85" rx="16" ry="6" fill="var(--color-journal-dark-inset)" stroke="var(--color-journal-dark-iso-line)" stroke-width="1"/>
  <!-- Stem Column -->
  <path d="M 142 85 C 142 76, 144 72, 143 68 L 157 68 C 156 72, 158 76, 158 85 Z" fill="var(--color-journal-dark-iso-front)" stroke="var(--color-journal-dark-iso-line)" stroke-width="1"/>
  <path d="M 142 85 C 142 76, 144 72, 143 68 L 150 68 L 150 86 Z" fill="var(--color-journal-dark-iso-side)" stroke="none"/>
  <!-- Stem Center Seam -->
  <line x1="150" y1="68" x2="150" y2="86" stroke="var(--color-journal-dark-iso-line)" stroke-width="0.8"/>
  <!-- Stem Upper Ring (Collar under bowl) -->
  <ellipse cx="150" cy="69" rx="14" ry="5.5" fill="var(--color-journal-dark-iso-side)" stroke="var(--color-journal-dark-iso-line)" stroke-width="1"/>
  <ellipse cx="150" cy="66" rx="14" ry="5.5" fill="var(--color-journal-dark-inset)" stroke="var(--color-journal-dark-iso-line)" stroke-width="1"/>

  <!-- Chalice Cup Body -->
  <!-- Outer Cup Silhouette and Faces -->
  <path d="M 104 30 C 104 52, 134 66, 150 66 C 166 66, 196 52, 196 30 Z" fill="var(--color-journal-dark-iso-front)" stroke="var(--color-journal-dark-iso-line)" stroke-width="1"/>
  <!-- Shaded left side of cup bowl -->
  <path d="M 104 30 C 104 52, 134 66, 150 66 L 150 34 C 132 34, 114 32, 104 30 Z" fill="var(--color-journal-dark-iso-side)" stroke="none"/>
  <!-- Bowl center seam -->
  <path d="M 150 34 L 150 66" stroke="var(--color-journal-dark-iso-line)" stroke-width="1"/>

  <!-- Decorative Laurel / Waist Band on Cup -->
  <ellipse cx="150" cy="46" rx="38" ry="12" fill="none" stroke="var(--color-journal-dark-iso-detail)" stroke-width="1" stroke-dasharray="2 3"/>

  <!-- Cup Top Rim & Deep Interior -->
  <!-- Rim outer ring -->
  <ellipse cx="150" cy="30" rx="46" ry="15" fill="var(--color-journal-dark-inset)" stroke="var(--color-journal-dark-iso-line)" stroke-width="1"/>
  <!-- Cup Interior Cavity -->
  <ellipse cx="150" cy="30" rx="40" ry="12" fill="var(--color-journal-dark-iso-glass)" stroke="var(--color-journal-dark-iso-detail)" stroke-width="1"/>

  <!-- Front Foreground Details on Handles -->
  <!-- Left Handle Inner Edge -->
  <path d="M 104 30 C 86 28, 70 38, 70 52 C 70 66, 88 74, 118 72 L 122 66 C 98 68, 80 62, 80 52 C 80 42, 94 34, 108 34 Z" fill="var(--color-journal-dark-iso-side)" stroke="var(--color-journal-dark-iso-line)" stroke-width="1"/>
  <!-- Right Handle Inner Edge -->
  <path d="M 196 30 C 214 28, 230 38, 230 52 C 230 66, 212 74, 182 72 L 178 66 C 202 68, 220 62, 220 52 C 220 42, 206 34, 192 34 Z" fill="var(--color-journal-dark-iso-front)" stroke="var(--color-journal-dark-iso-line)" stroke-width="1"/>
</g>
</svg>
'''

out_path = '/Users/indi256/Documents/kuuki/kuuki/.scratch/sheet-anatomy/gemini-figures/rankings-trophy-gemini.svg'
with open(out_path, 'w') as f:
    f.write(svg_content)
print('Wrote rankings SVG to', out_path)
