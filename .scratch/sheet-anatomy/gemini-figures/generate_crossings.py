import os

svg_content = '''<svg xmlns="http://www.w3.org/2000/svg" width="300" height="160" viewBox="0 0 300 160" fill="none" role="presentation">
<g stroke-linecap="round" stroke-linejoin="round">
  <!-- Rear Elastic Headband with Adjustment Slider Buckle -->
  <!-- Strap looping on ground plane behind mask -->
  <path d="M 68 84 C 52 70, 56 46, 88 38 C 124 28, 172 32, 206 48 C 224 58, 222 72, 204 82" fill="none" stroke="var(--color-journal-dark-iso-line)" stroke-width="5"/>
  <path d="M 68 84 C 52 70, 56 46, 88 38 C 124 28, 172 32, 206 48 C 224 58, 222 72, 204 82" fill="none" stroke="var(--color-journal-dark-iso-side)" stroke-width="3"/>
  <path d="M 72 82 C 58 70, 60 48, 90 40 C 124 30, 170 34, 204 50 C 220 58, 218 70, 202 80" fill="none" stroke="var(--color-journal-dark-iso-detail)" stroke-width="0.8"/>
  
  <!-- Strap Adjustment Slider (Iso Buckle) -->
  <polygon points="174,38 184,42 184,47 174,43" fill="var(--color-journal-dark-iso-front)" stroke="var(--color-journal-dark-iso-line)" stroke-width="1"/>
  <line x1="179" y1="40" x2="179" y2="45" stroke="var(--color-journal-dark-iso-detail)" stroke-width="1"/>

  <!-- Travel Sleep Mask — Drop / Edge Thickness (Grounded Silhouette) -->
  <path d="M 62 82 C 58 104, 82 124, 114 124 C 132 124, 142 114, 150 106 C 158 114, 168 124, 186 124 C 218 124, 242 104, 238 82 C 234 62, 212 50, 184 48 C 160 46, 140 50, 116 48 C 88 50, 66 62, 62 82 Z" fill="var(--color-journal-dark-iso-side)" stroke="var(--color-journal-dark-iso-line)" stroke-width="1.2"/>

  <!-- Travel Sleep Mask — Top Face Cushion Body -->
  <path d="M 62 78 C 58 100, 82 120, 114 120 C 132 120, 142 110, 150 102 C 158 110, 168 120, 186 120 C 218 120, 242 100, 238 78 C 234 58, 212 46, 184 44 C 160 42, 140 46, 116 44 C 88 46, 66 58, 62 78 Z" fill="var(--color-journal-dark-inset)" stroke="var(--color-journal-dark-iso-line)" stroke-width="1.2"/>

  <!-- Left Contoured 3D Eye Dome & Cushion Seam -->
  <path d="M 78 78 C 76 94, 92 108, 112 108 C 126 108, 134 100, 138 88 C 136 74, 122 62, 106 62 C 90 62, 80 68, 78 78 Z" fill="var(--color-journal-dark-iso-front)" stroke="var(--color-journal-dark-iso-detail)" stroke-width="1"/>
  <ellipse cx="107" cy="84" rx="14" ry="10" fill="var(--color-journal-dark-iso-side)" stroke="var(--color-journal-dark-iso-detail)" stroke-width="0.8"/>

  <!-- Right Contoured 3D Eye Dome & Cushion Seam -->
  <path d="M 162 88 C 166 100, 174 108, 188 108 C 208 108, 224 94, 222 78 C 220 68, 210 62, 194 62 C 178 62, 164 74, 162 88 Z" fill="var(--color-journal-dark-iso-front)" stroke="var(--color-journal-dark-iso-detail)" stroke-width="1"/>
  <ellipse cx="193" cy="84" rx="14" ry="10" fill="var(--color-journal-dark-iso-side)" stroke="var(--color-journal-dark-iso-detail)" stroke-width="0.8"/>

  <!-- Ergonomic Nose Bridge Contour Notch -->
  <path d="M 140 96 C 146 88, 154 88, 160 96 C 158 104, 150 108, 142 102 Z" fill="var(--color-journal-dark-iso-side)" stroke="var(--color-journal-dark-iso-detail)" stroke-width="0.8"/>

  <!-- Perimeter Quilted Stitch Accent (Restrained Coral Shu Seam) -->
  <path d="M 122 46 C 140 44, 160 44, 180 46 C 206 48, 226 58, 232 74" fill="none" stroke="var(--color-journal-dark-shu)" stroke-width="1.6"/>
  <!-- Subdued complementary perimeter stitch -->
  <path d="M 68 74 C 74 58, 94 48, 120 46" fill="none" stroke="var(--color-journal-dark-iso-detail)" stroke-width="1"/>

  <!-- Foreground Grounded Aircraft Travel Earplugs with Connecting Lanyard -->
  <!-- Draped silicone connecting cord -->
  <path d="M 226 122 C 242 126, 252 136, 246 144 C 238 152, 218 148, 206 142 C 196 138, 188 136, 182 138" fill="none" stroke="var(--color-journal-dark-iso-line)" stroke-width="1.8"/>
  <path d="M 226 122 C 242 126, 252 136, 246 144 C 238 152, 218 148, 206 142 C 196 138, 188 136, 182 138" fill="none" stroke="var(--color-journal-dark-iso-detail)" stroke-width="1"/>

  <!-- Earplug 1: Tapered Bell Foam Plug (Angled Upright) -->
  <!-- Base shadow/edge -->
  <ellipse cx="182" cy="138" rx="5.5" ry="3.5" fill="var(--color-journal-dark-iso-side)" stroke="var(--color-journal-dark-iso-line)" stroke-width="1"/>
  <!-- Conical Body -->
  <path d="M 176.5 138 C 176 130, 178 122, 181 117 C 182 115, 185 115, 186 117 C 189 122, 191 130, 187.5 138 Z" fill="var(--color-journal-dark-iso-front)" stroke="var(--color-journal-dark-iso-line)" stroke-width="1"/>
  <!-- Left Shade Contour -->
  <path d="M 176.5 138 C 176 130, 178 122, 181 117 L 183.5 117 C 181.5 122, 180.5 130, 182 138 Z" fill="var(--color-journal-dark-iso-side)" stroke="none"/>
  <!-- Detail Flange Rings -->
  <path d="M 177.5 132 C 180 133.5, 184 133.5, 186.5 132" fill="none" stroke="var(--color-journal-dark-iso-detail)" stroke-width="0.8"/>
  <path d="M 179 125 C 181 126.2, 183.5 126.2, 185.5 125" fill="none" stroke="var(--color-journal-dark-iso-detail)" stroke-width="0.8"/>

  <!-- Earplug 2: Horizontal Foam Plug (Resting on Surface) -->
  <!-- Rear Flange Ellipse -->
  <ellipse cx="226" cy="122" rx="4" ry="6" fill="var(--color-journal-dark-iso-side)" stroke="var(--color-journal-dark-iso-line)" stroke-width="1"/>
  <!-- Cylindrical Flanged Body -->
  <path d="M 226 116 L 240 119 C 245 120, 247 124, 245 126 C 243 128, 239 129, 226 128 Z" fill="var(--color-journal-dark-iso-front)" stroke="var(--color-journal-dark-iso-line)" stroke-width="1"/>
  <!-- Lower shaded belly -->
  <path d="M 226 124 L 241 125 C 244 126, 245 127, 243 128 C 240 129, 236 129, 226 128 Z" fill="var(--color-journal-dark-iso-side)" stroke="none"/>
  <!-- Detail Flange Seams -->
  <path d="M 232 117.5 C 233 120, 233 124, 232 126.5" fill="none" stroke="var(--color-journal-dark-iso-detail)" stroke-width="0.8"/>
  <path d="M 237 118.5 C 238 120.5, 238 123.5, 237 125.5" fill="none" stroke="var(--color-journal-dark-iso-detail)" stroke-width="0.8"/>
</g>
</svg>
'''

out_path = '/Users/indi256/Documents/kuuki/kuuki/.scratch/sheet-anatomy/gemini-figures/crossings-sleepkit-gemini.svg'
with open(out_path, 'w') as f:
    f.write(svg_content)
print('Wrote crossings SVG to', out_path)
