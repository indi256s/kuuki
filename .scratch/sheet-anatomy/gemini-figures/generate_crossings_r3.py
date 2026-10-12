import os

svg_crossings = '''<svg xmlns="http://www.w3.org/2000/svg" width="300" height="160" viewBox="0 0 300 160" fill="none" role="presentation">
  <defs>
    <!-- Soft shadow filter -->
    <filter id="mask-shadow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="4.5"/>
    </filter>
  </defs>

  <!-- 1. Ground Contact Shadow -->
  <ellipse cx="150" cy="116" rx="94" ry="16" fill="rgb(0 0 0 / 38%)" filter="url(#mask-shadow)"/>

  <!-- 2. Wide Elastic Headband (Looping cleanly behind on the ground plane) -->
  <!-- Strap rear loop outline & fill -->
  <path d="M 64 80 C 44 60, 52 38, 92 30 C 134 22, 178 26, 216 40 C 242 50, 246 68, 226 84" 
        fill="none" stroke="var(--color-journal-dark-iso-line)" stroke-width="9" stroke-linecap="round"/>
  <path d="M 64 80 C 44 60, 52 38, 92 30 C 134 22, 178 26, 216 40 C 242 50, 246 68, 226 84" 
        fill="none" stroke="var(--color-journal-dark-iso-side)" stroke-width="7" stroke-linecap="round"/>
  <!-- Strap ribbed elastic texture lines -->
  <path d="M 66 78 C 48 60, 54 40, 92 32 C 132 24, 176 28, 214 42 C 238 52, 242 66, 224 82" 
        fill="none" stroke="var(--color-journal-dark-iso-detail)" stroke-width="1.2" stroke-dasharray="4 3"/>

  <!-- 3. Padded Sleep Mask — Lower 3D Cushion Thickness (Drop Facet) -->
  <!-- Solid drop showing 8px thick padded ergonomic memory foam -->
  <path d="M 52 82 C 48 108, 76 128, 110 128 C 128 128, 140 118, 150 110 C 160 118, 172 128, 190 128 C 224 128, 252 108, 248 82 C 244 58, 218 44, 186 42 C 160 40, 140 44, 114 42 C 82 44, 56 58, 52 82 Z" 
        fill="var(--color-journal-dark-iso-side)" stroke="var(--color-journal-dark-iso-line)" stroke-width="1.2" stroke-linejoin="round"/>

  <!-- 4. Padded Sleep Mask — Main Top Cushion Surface -->
  <path d="M 52 76 C 48 102, 76 122, 110 122 C 128 122, 140 112, 150 104 C 160 112, 172 122, 190 122 C 224 122, 252 102, 248 76 C 244 52, 218 38, 186 36 C 160 34, 140 38, 114 36 C 82 38, 56 52, 52 76 Z" 
        fill="var(--color-journal-dark-inset)" stroke="var(--color-journal-dark-iso-line)" stroke-width="1.2" stroke-linejoin="round"/>

  <!-- 5. Sculpted Ergonomic Nose Bridge Recess & Center Seam -->
  <path d="M 136 94 C 144 86, 156 86, 164 94 C 158 104, 142 104, 136 94 Z" 
        fill="var(--color-journal-dark-iso-front)" stroke="var(--color-journal-dark-iso-detail)" stroke-width="1"/>
  <line x1="150" y1="37" x2="150" y2="86" stroke="var(--color-journal-dark-iso-detail)" stroke-width="1" stroke-dasharray="2 3"/>

  <!-- 6. Broad Soft Material Faceting / Subtle Ergonomic Contours (NO eye holes!) -->
  <!-- Left Cheek Soft Contour Wave -->
  <path d="M 72 74 C 70 96, 90 110, 116 110 C 132 110, 140 98, 140 82 C 136 64, 116 52, 94 54 C 80 56, 74 64, 72 74 Z" 
        fill="none" stroke="var(--color-journal-dark-iso-detail)" stroke-width="0.8"/>
  <path d="M 84 76 C 82 90, 96 102, 114 102 C 126 102, 132 92, 132 80" 
        fill="none" stroke="var(--color-journal-dark-iso-detail)" stroke-width="0.8" stroke-dasharray="2 2"/>

  <!-- 7. Confident, Meaningful CORAL Textile Accent Wing (Right Temple Panel) -->
  <!-- Shaded edge of the coral panel -->
  <path d="M 186 122 C 218 122, 245 106, 248 78 L 248 84 C 245 112, 218 128, 186 128 Z" 
        fill="#bb6a59" stroke="var(--color-journal-dark-iso-line)" stroke-width="1" stroke-linejoin="round"/>
  <!-- Solid Coral Surface of the Right Temple Wing -->
  <path d="M 184 62 C 176 80, 180 106, 192 122 C 220 120, 246 102, 248 76 C 245 54, 222 42, 198 38 C 190 46, 186 54, 184 62 Z" 
        fill="var(--color-journal-dark-shu)" stroke="var(--color-journal-dark-shu)" stroke-width="1.2" stroke-linejoin="round"/>

  <!-- Coral Panel Inset Stitch Line -->
  <path d="M 189 64 C 182 80, 186 102, 196 116" 
        fill="none" stroke="#292827" stroke-width="1.2" stroke-dasharray="3 2" stroke-linecap="round"/>

  <!-- Stamped / Embroidered Travel Brand Label on Coral Wing (Dark Ink #292827) -->
  <g transform="matrix(0.92 0.38 -0.38 0.92 216 72)">
    <!-- Small flight crossing arc -->
    <path d="M -16 -4 C -8 -12, 6 -12, 14 -4" fill="none" stroke="#292827" stroke-width="1.5" stroke-linecap="round"/>
    <polygon points="14,-4 8,-6 10,-2" fill="#292827"/>
    <text x="0" y="8" font-family="JetBrains Mono, monospace" font-size="7" font-weight="800" letter-spacing="0.1em" text-anchor="middle" fill="#292827">KUUKI</text>
    <text x="0" y="16" font-family="JetBrains Mono, monospace" font-size="5.5" font-weight="700" letter-spacing="0.08em" text-anchor="middle" fill="#292827">TRANSIT</text>
  </g>

  <!-- 8. Tailored Perimeter Edge Piping / Seam Accent -->
  <path d="M 58 74 C 62 52, 84 40, 114 38 C 138 36, 160 38, 184 38" 
        fill="none" stroke="var(--color-journal-dark-shu)" stroke-width="1.6" stroke-linecap="round"/>
</svg>'''

with open('/Users/indi256/Documents/kuuki/kuuki/.scratch/sheet-anatomy/gemini-figures/crossings-sleepkit-gemini.svg', 'w') as f:
    f.write(svg_crossings)
print("Generated Crossings sleep mask SVG.")
