import os

svg_content = '''<svg xmlns="http://www.w3.org/2000/svg" width="300" height="160" viewBox="0 0 300 160" fill="none" role="presentation">
<g stroke-linecap="round" stroke-linejoin="round">
  <!-- Heavy Grounded Tooling / Builder's Pedestal Base -->
  <!-- Base Lower Bevel / Footprint -->
  <!-- Left Side Face -->
  <polygon points="96,124 150,152 150,140 96,112" fill="var(--color-journal-dark-iso-side)" stroke="var(--color-journal-dark-iso-line)" stroke-width="1"/>
  <!-- Right Side Face (Manufacturer Nameplate Face) -->
  <polygon points="150,152 204,124 204,112 150,140" fill="var(--color-journal-dark-iso-front)" stroke="var(--color-journal-dark-iso-line)" stroke-width="1"/>
  <!-- Top Surface of Base -->
  <polygon points="96,112 150,84 204,112 150,140" fill="var(--color-journal-dark-inset)" stroke="var(--color-journal-dark-iso-line)" stroke-width="1"/>
  <!-- Inset Bevel Perimeter Line -->
  <path d="M 104 112 L 150 88 L 196 112 L 150 136 Z" fill="none" stroke="var(--color-journal-dark-iso-detail)" stroke-width="0.8"/>

  <!-- Engraved Manufacturer Nameplate on Front-Right Face -->
  <polygon points="154,136 198,114 198,124 154,146" fill="var(--color-journal-dark-iso-glass)" stroke="var(--color-journal-dark-iso-line)" stroke-width="1"/>
  <!-- Mounting rivets -->
  <circle cx="156.5" cy="137.5" r="0.8" fill="var(--color-journal-dark-iso-detail)"/>
  <circle cx="195.5" cy="116.5" r="0.8" fill="var(--color-journal-dark-iso-detail)"/>
  <circle cx="156.5" cy="144.5" r="0.8" fill="var(--color-journal-dark-iso-detail)"/>
  <circle cx="195.5" cy="123.5" r="0.8" fill="var(--color-journal-dark-iso-detail)"/>
  <!-- Stamped Builder Typography -->
  <text x="176" y="133" transform="rotate(-26.5 176 133)" font-family="Commissioner, sans-serif" font-size="9" font-weight="700" letter-spacing="0.08em" text-anchor="middle" fill="var(--color-journal-dark-muted)">AIRBUS</text>

  <!-- Heavy Aero-Sting Strut (Mounting Pylon) -->
  <!-- Strut Lower Socket Mount -->
  <polygon points="144,110 156,116 156,112 144,106" fill="var(--color-journal-dark-iso-side)" stroke="var(--color-journal-dark-iso-line)" stroke-width="1"/>
  <!-- Pylon Body -->
  <!-- Pylon Left Shade -->
  <polygon points="146,106 148,74 152,72 150,108" fill="var(--color-journal-dark-iso-side)" stroke="var(--color-journal-dark-iso-line)" stroke-width="1"/>
  <!-- Pylon Front Face -->
  <polygon points="150,108 152,72 156,74 154,110" fill="var(--color-journal-dark-iso-front)" stroke="var(--color-journal-dark-iso-line)" stroke-width="1"/>

  <!-- Precision Twinjet Airframe (In Dynamic 30° Climbing Attitude) -->
  <!-- Background Parts: Starboard (Far) Wing & Tailplane -->
  <!-- Starboard Horizontal Stabilizer -->
  <polygon points="194,56 216,45 220,48 198,59" fill="var(--color-journal-dark-iso-side)" stroke="var(--color-journal-dark-iso-line)" stroke-width="1"/>
  
  <!-- Starboard Swept Wing (Far Wing) -->
  <polygon points="160,54 218,25 224,28 174,62" fill="var(--color-journal-dark-iso-front)" stroke="var(--color-journal-dark-iso-line)" stroke-width="1"/>
  <!-- Starboard Blended Winglet -->
  <polygon points="218,25 220,17 223,19 224,28" fill="var(--color-journal-dark-iso-front)" stroke="var(--color-journal-dark-iso-line)" stroke-width="1"/>
  <!-- Starboard Nacelle (Far Engine) -->
  <ellipse cx="188" cy="45" rx="5" ry="8" fill="var(--color-journal-dark-iso-side)" stroke="var(--color-journal-dark-iso-line)" stroke-width="1"/>
  <ellipse cx="187" cy="45" rx="3.5" ry="6" fill="var(--color-journal-dark-iso-glass)" stroke="var(--color-journal-dark-iso-detail)" stroke-width="0.8"/>

  <!-- Vertical Stabilizer (Fin & Rudder) -->
  <!-- Fin Left Face -->
  <polygon points="186,52 196,16 204,12 202,44" fill="var(--color-journal-dark-iso-side)" stroke="var(--color-journal-dark-iso-line)" stroke-width="1"/>
  <!-- Fin Trailing Bevel / Rudder Edge -->
  <polygon points="204,12 206,14 204,46 202,44" fill="var(--color-journal-dark-iso-front)" stroke="var(--color-journal-dark-iso-line)" stroke-width="1"/>
  <!-- Rudder hinge seam -->
  <line x1="200" y1="20" x2="198" y2="44" stroke="var(--color-journal-dark-iso-detail)" stroke-width="0.8"/>

  <!-- Port Horizontal Stabilizer (Near Tailplane) -->
  <polygon points="178,65 152,78 148,75 174,62" fill="var(--color-journal-dark-iso-front)" stroke="var(--color-journal-dark-iso-line)" stroke-width="1"/>

  <!-- Fuselage Body (Sculpted Cylinder & Radome) -->
  <!-- Lower Belly Shading (Side Face) -->
  <path d="M 88 88 C 84 86, 92 82, 106 75 L 188 34 C 196 30, 202 34, 196 46 L 126 82 C 108 92, 94 92, 88 88 Z" fill="var(--color-journal-dark-iso-side)" stroke="var(--color-journal-dark-iso-line)" stroke-width="1"/>
  <!-- Upper Fuselage Crown (Front / Top Lit Face) -->
  <path d="M 88 88 C 84 86, 90 80, 104 73 L 186 32 C 196 27, 202 32, 196 42 L 126 80 C 106 88, 94 90, 88 88 Z" fill="var(--color-journal-dark-inset)" stroke="var(--color-journal-dark-iso-line)" stroke-width="1"/>
  <!-- Fuselage longitudinal contour line -->
  <path d="M 88 88 L 196 44" stroke="var(--color-journal-dark-iso-line)" stroke-width="0.8"/>

  <!-- Cockpit Windscreen Facets -->
  <polygon points="93,85 97,81 101,83 97,87" fill="var(--color-journal-dark-iso-glass)" stroke="var(--color-journal-dark-iso-line)" stroke-width="0.8"/>
  <polygon points="98,80 102,77 106,79 102,82" fill="var(--color-journal-dark-iso-glass)" stroke="var(--color-journal-dark-iso-line)" stroke-width="0.8"/>

  <!-- Passenger Window Belt Line (Subtle Airframe Detail) -->
  <path d="M 106 83 L 176 48" stroke="var(--color-journal-dark-iso-detail)" stroke-width="1" stroke-dasharray="2 3"/>

  <!-- Port Swept Wing (Foreground Wing) -->
  <!-- Wing Top Lit Surface -->
  <polygon points="124,78 68,106 62,103 140,64" fill="var(--color-journal-dark-iso-front)" stroke="var(--color-journal-dark-iso-line)" stroke-width="1"/>
  <!-- Wing Leading Edge Bevel -->
  <polygon points="124,78 68,106 67,109 123,81" fill="var(--color-journal-dark-inset)" stroke="var(--color-journal-dark-iso-line)" stroke-width="0.8"/>
  <!-- Port Blended Winglet (Vertical Wingtip) -->
  <polygon points="68,106 64,96 61,98 62,103" fill="var(--color-journal-dark-iso-front)" stroke="var(--color-journal-dark-iso-line)" stroke-width="1"/>
  <!-- Wing Aileron / Flap Seam -->
  <line x1="82" y1="99" x2="134" y2="73" stroke="var(--color-journal-dark-iso-detail)" stroke-width="0.8"/>

  <!-- Port Turbofan Engine Nacelle (Foreground Engine) -->
  <!-- Nacelle Pylon Mount -->
  <polygon points="108,86 112,88 112,94 108,92" fill="var(--color-journal-dark-iso-side)" stroke="var(--color-journal-dark-iso-line)" stroke-width="0.8"/>
  <!-- Nacelle Cowling Outer Cylinder -->
  <path d="M 104 90 L 118 83 C 122 81, 124 85, 122 89 L 108 96 C 104 98, 102 94, 104 90 Z" fill="var(--color-journal-dark-iso-front)" stroke="var(--color-journal-dark-iso-line)" stroke-width="1"/>
  <!-- Lower Cowl Shade -->
  <path d="M 104 94 L 118 87 C 121 86, 122 88, 120 90 L 108 96 C 105 97, 103 96, 104 94 Z" fill="var(--color-journal-dark-iso-side)" stroke="none"/>
  <!-- Intake Lip & Fan Face Cavity -->
  <ellipse cx="104" cy="92" rx="4.5" ry="7" fill="var(--color-journal-dark-iso-side)" stroke="var(--color-journal-dark-iso-line)" stroke-width="1"/>
  <ellipse cx="103" cy="92" rx="3" ry="5.5" fill="var(--color-journal-dark-iso-glass)" stroke="var(--color-journal-dark-iso-detail)" stroke-width="0.8"/>
</g>
</svg>
'''

out_path = '/Users/indi256/Documents/kuuki/kuuki/.scratch/sheet-anatomy/gemini-figures/makers-aerosting-gemini.svg'
with open(out_path, 'w') as f:
    f.write(svg_content)
print('Wrote makers SVG to', out_path)
