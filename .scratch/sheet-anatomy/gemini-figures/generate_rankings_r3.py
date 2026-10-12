import os

# 300x160 SVG for Rankings Dual-Champion Trophy
# Palette:
# --color-journal-dark-paper: #292827
# --color-journal-dark-surface: #353331
# --color-journal-dark-inset: #403d3a
# --color-journal-dark-ink: #f1efeb
# --color-journal-dark-muted: #c4beb7
# --color-journal-dark-shu: #ea846f
# --color-journal-dark-iso-front: #363432
# --color-journal-dark-iso-side: #2e2c2a
# --color-journal-dark-iso-line: #a8a098
# --color-journal-dark-iso-detail: #5f5954
# --color-journal-dark-iso-glass: #262423

svg_rankings = '''<svg xmlns="http://www.w3.org/2000/svg" width="300" height="160" viewBox="0 0 300 160" fill="none" role="presentation">
  <defs>
    <!-- Ground shadow -->
    <filter id="trophy-shadow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="4"/>
    </filter>
  </defs>

  <!-- 1. Ground Shadow -->
  <ellipse cx="150" cy="146" rx="66" ry="12" fill="rgb(0 0 0 / 35%)" filter="url(#trophy-shadow)"/>

  <!-- 2. Handles - Rear Lower Curves (Behind Cup Body) -->
  <!-- Left Handle Rear Curve -->
  <path d="M 112 40 C 82 40, 72 66, 88 88 C 96 99, 114 104, 128 98" 
        fill="none" stroke="var(--color-journal-dark-iso-line)" stroke-width="6" stroke-linecap="round"/>
  <path d="M 112 40 C 82 40, 72 66, 88 88 C 96 99, 114 104, 128 98" 
        fill="none" stroke="var(--color-journal-dark-iso-side)" stroke-width="4" stroke-linecap="round"/>

  <!-- Right Handle Rear Curve -->
  <path d="M 188 40 C 218 40, 228 66, 212 88 C 204 99, 186 104, 172 98" 
        fill="none" stroke="var(--color-journal-dark-iso-line)" stroke-width="6" stroke-linecap="round"/>
  <path d="M 188 40 C 218 40, 228 66, 212 88 C 204 99, 186 104, 172 98" 
        fill="none" stroke="var(--color-journal-dark-iso-front)" stroke-width="4" stroke-linecap="round"/>

  <!-- 3. Plinth / Stepped Base -->
  <!-- Base Tier 1 (Bottom Foot Slab) -->
  <!-- Left Side Face -->
  <polygon points="106,134 150,150 150,144 106,128" 
           fill="var(--color-journal-dark-iso-side)" stroke="var(--color-journal-dark-iso-line)" stroke-width="1" stroke-linejoin="round"/>
  <!-- Front Right Face -->
  <polygon points="150,150 194,134 194,128 150,144" 
           fill="var(--color-journal-dark-iso-front)" stroke="var(--color-journal-dark-iso-line)" stroke-width="1" stroke-linejoin="round"/>
  <!-- Top Face of Tier 1 -->
  <polygon points="106,128 150,112 194,128 150,144" 
           fill="var(--color-journal-dark-inset)" stroke="var(--color-journal-dark-iso-line)" stroke-width="1" stroke-linejoin="round"/>

  <!-- Base Tier 2 (Upper Plinth Block) -->
  <!-- Left Face (Subordinate QR tie plaque) -->
  <polygon points="112,122 150,136 150,98 112,84" 
           fill="var(--color-journal-dark-iso-side)" stroke="var(--color-journal-dark-iso-line)" stroke-width="1" stroke-linejoin="round"/>
  <!-- Top Face of Tier 2 -->
  <polygon points="112,84 150,70 188,84 150,98" 
           fill="var(--color-journal-dark-inset)" stroke="var(--color-journal-dark-iso-line)" stroke-width="1" stroke-linejoin="round"/>
  <!-- Front Right Face (Selected PC Plaque Face) -->
  <polygon points="150,136 188,122 188,84 150,98" 
           fill="var(--color-journal-dark-iso-front)" stroke="var(--color-journal-dark-iso-line)" stroke-width="1" stroke-linejoin="round"/>

  <!-- Engraved Co-Champion QR plaque on Left Face (showing explicit tie) -->
  <polygon points="116,116 146,127 146,104 116,93" 
           fill="var(--color-journal-dark-iso-glass)" stroke="var(--color-journal-dark-iso-detail)" stroke-width="0.8" stroke-linejoin="round"/>
  <text x="131" y="112" transform="rotate(20 131 112)" 
        font-family="JetBrains Mono, monospace" font-size="8.5" font-weight="700" letter-spacing="0.06em" text-anchor="middle" 
        fill="var(--color-journal-dark-muted)">QR · 4</text>

  <!-- Large, Bold, Confident CORAL Plaque on Front-Right Face (Pegasus PC Selected) -->
  <!-- Plaque drop thickness -->
  <polygon points="152,133 186,120.5 186,123.5 152,136" 
           fill="#bb6a59" stroke="var(--color-journal-dark-iso-line)" stroke-width="1" stroke-linejoin="round"/>
  <!-- Plaque main solid coral surface -->
  <polygon points="152,99 186,86.5 186,120.5 152,133" 
           fill="var(--color-journal-dark-shu)" stroke="var(--color-journal-dark-shu)" stroke-width="1" stroke-linejoin="round"/>
  
  <!-- Corner Rivets on Coral Plaque (Dark Ink) -->
  <circle cx="155" cy="102" r="1" fill="#292827"/>
  <circle cx="183" cy="91.5" r="1" fill="#292827"/>
  <circle cx="155" cy="129.5" r="1" fill="#292827"/>
  <circle cx="183" cy="117.5" r="1" fill="#292827"/>

  <!-- Plaque Typography & Insignia (Readable in Dark Ink #292827, exactly like Routes pass) -->
  <text x="169" y="103" transform="rotate(-20 169 103)" 
        font-family="Commissioner, sans-serif" font-size="6.5" font-weight="700" letter-spacing="0.08em" text-anchor="middle" 
        fill="#292827">CHAMPION</text>
  <text x="169" y="115" transform="rotate(-20 169 115)" 
        font-family="JetBrains Mono, monospace" font-size="13" font-weight="800" letter-spacing="0.04em" text-anchor="middle" 
        fill="#292827">PC</text>
  <text x="169" y="124" transform="rotate(-20 169 124)" 
        font-family="JetBrains Mono, monospace" font-size="6" font-weight="700" letter-spacing="0.08em" text-anchor="middle" 
        fill="#292827">PEGASUS · 4</text>

  <!-- 4. Sculptural Turned Metal Stem -->
  <!-- Stem Lower Flared Foot Ring -->
  <ellipse cx="150" cy="84" rx="20" ry="7.5" 
           fill="var(--color-journal-dark-iso-side)" stroke="var(--color-journal-dark-iso-line)" stroke-width="1"/>
  <ellipse cx="150" cy="81" rx="20" ry="7.5" 
           fill="var(--color-journal-dark-inset)" stroke="var(--color-journal-dark-iso-line)" stroke-width="1"/>

  <!-- Stem Center Fluted Column -->
  <path d="M 140 81 C 140 68, 143 62, 142 56 L 158 56 C 157 62, 160 68, 160 81 Z" 
        fill="var(--color-journal-dark-iso-front)" stroke="var(--color-journal-dark-iso-line)" stroke-width="1" stroke-linejoin="round"/>
  <!-- Stem Left Shade -->
  <path d="M 140 81 C 140 68, 143 62, 142 56 L 150 56 L 150 82 Z" 
        fill="var(--color-journal-dark-iso-side)" stroke="none"/>
  <!-- Stem Centerline -->
  <line x1="150" y1="56" x2="150" y2="82" stroke="var(--color-journal-dark-iso-line)" stroke-width="0.8"/>

  <!-- Stem Upper Ring (Collar under Chalice Bowl) -->
  <ellipse cx="150" cy="58" rx="17" ry="6.5" 
           fill="var(--color-journal-dark-iso-side)" stroke="var(--color-journal-dark-iso-line)" stroke-width="1"/>
  <ellipse cx="150" cy="55" rx="17" ry="6.5" 
           fill="var(--color-journal-dark-inset)" stroke="var(--color-journal-dark-iso-line)" stroke-width="1"/>

  <!-- 5. Sculptural Chalice Bowl (Thick, Solid Metal Volume) -->
  <!-- Main Outer Bowl Silhouette -->
  <path d="M 102 24 C 102 46, 128 62, 150 62 C 172 62, 198 46, 198 24 Z" 
        fill="var(--color-journal-dark-iso-front)" stroke="var(--color-journal-dark-iso-line)" stroke-width="1.2" stroke-linejoin="round"/>
  <!-- Left Side Shading of Bowl -->
  <path d="M 102 24 C 102 46, 128 62, 150 62 L 150 28 C 130 28, 112 26, 102 24 Z" 
        fill="var(--color-journal-dark-iso-side)" stroke="none"/>
  <!-- Bowl Center Seam Contour -->
  <path d="M 150 28 L 150 62" stroke="var(--color-journal-dark-iso-line)" stroke-width="1"/>

  <!-- Decorative Engraved Fluting / Laurel Rings on Bowl Body -->
  <ellipse cx="150" cy="38" rx="42" ry="12.5" 
           fill="none" stroke="var(--color-journal-dark-iso-detail)" stroke-width="0.8" stroke-dasharray="3 3"/>
  <ellipse cx="150" cy="46" rx="34" ry="10" 
           fill="none" stroke="var(--color-journal-dark-iso-detail)" stroke-width="0.8"/>

  <!-- Thick Sculpted Lip & Rim (Substantial wall thickness) -->
  <!-- Outer Rim Ellipse -->
  <ellipse cx="150" cy="24" rx="48" ry="15" 
           fill="var(--color-journal-dark-inset)" stroke="var(--color-journal-dark-iso-line)" stroke-width="1.2"/>
  <!-- Deep Interior Cavity -->
  <ellipse cx="150" cy="24" rx="40" ry="11.5" 
           fill="var(--color-journal-dark-iso-glass)" stroke="var(--color-journal-dark-iso-detail)" stroke-width="1"/>
  <!-- Deep Cavity Depth Shadow -->
  <path d="M 110 24 C 110 32, 130 35.5, 150 35.5 C 170 35.5, 190 32, 190 24 C 190 20, 170 17, 150 17 C 130 17, 110 20, 110 24 Z" 
        fill="#1e1d1c" stroke="none"/>

  <!-- 6. Foreground Sculptural Handles (Solid 3D Form) -->
  <!-- Left Handle (Solid 3D Bracket) -->
  <path d="M 104 24 C 74 24, 66 50, 82 72 C 90 83, 108 88, 122 84 L 126 78 C 114 82, 100 78, 92 70 C 78 54, 86 34, 108 34 Z" 
        fill="var(--color-journal-dark-iso-side)" stroke="var(--color-journal-dark-iso-line)" stroke-width="1" stroke-linejoin="round"/>
  <!-- Left Handle Top Highlight Edge -->
  <path d="M 104 24 C 84 24, 76 38, 80 52" 
        fill="none" stroke="var(--color-journal-dark-iso-front)" stroke-width="1.2" stroke-linecap="round"/>

  <!-- Right Handle (Solid 3D Bracket) -->
  <path d="M 196 24 C 226 24, 234 50, 218 72 C 210 83, 192 88, 178 84 L 174 78 C 186 82, 200 78, 208 70 C 222 54, 214 34, 192 34 Z" 
        fill="var(--color-journal-dark-iso-front)" stroke="var(--color-journal-dark-iso-line)" stroke-width="1" stroke-linejoin="round"/>
  <!-- Right Handle Shaded Inner Rim -->
  <path d="M 196 24 C 216 24, 224 38, 220 52" 
        fill="none" stroke="var(--color-journal-dark-iso-side)" stroke-width="1.2" stroke-linecap="round"/>
</svg>'''

with open('/Users/indi256/Documents/kuuki/kuuki/.scratch/sheet-anatomy/gemini-figures/rankings-trophy-gemini.svg', 'w') as f:
    f.write(svg_rankings)
print("Generated Rankings trophy SVG.")
