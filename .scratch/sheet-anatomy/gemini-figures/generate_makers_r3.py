import os

svg_makers = '''<svg xmlns="http://www.w3.org/2000/svg" width="300" height="160" viewBox="0 0 300 160" fill="none" role="presentation">
  <defs>
    <!-- Soft shadow filter -->
    <filter id="plate-shadow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="5"/>
    </filter>
  </defs>

  <!-- 1. Ground Contact Shadow -->
  <polygon points="56,86 150,140 248,86 154,34" 
           fill="rgb(0 0 0 / 38%)" filter="url(#plate-shadow)"/>

  <!-- 2. Machined Metal Builder's Plate — Beveled Drop Faces (Physical Depth 10px) -->
  <!-- Left Shaded Edge Face -->
  <polygon points="52,78 150,132 150,142 52,88" 
           fill="var(--color-journal-dark-iso-side)" stroke="var(--color-journal-dark-iso-line)" stroke-width="1.2" stroke-linejoin="round"/>
  <!-- Front Right Shaded Edge Face -->
  <polygon points="150,132 248,78 248,88 150,142" 
           fill="var(--color-journal-dark-iso-front)" stroke="var(--color-journal-dark-iso-line)" stroke-width="1.2" stroke-linejoin="round"/>

  <!-- 3. Top Main Surface of Heavy Alloy Builder's Plate -->
  <polygon points="52,78 150,24 248,78 150,132" 
           fill="var(--color-journal-dark-inset)" stroke="var(--color-journal-dark-iso-line)" stroke-width="1.2" stroke-linejoin="round"/>

  <!-- Inset Machined Bevel Channel (Engraved Perimeter Line) -->
  <polygon points="60,78 150,30 240,78 150,126" 
           fill="none" stroke="var(--color-journal-dark-iso-detail)" stroke-width="0.8" stroke-linejoin="round"/>

  <!-- 4. Four Precision Counter-Bored Aircraft Mounting Fasteners (Corner Rivets) -->
  <!-- Left Corner Rivet -->
  <ellipse cx="66" cy="78" rx="4" ry="2.2" fill="var(--color-journal-dark-iso-side)" stroke="var(--color-journal-dark-iso-line)" stroke-width="0.8"/>
  <circle cx="66" cy="78" r="1.2" fill="var(--color-journal-dark-iso-detail)"/>
  <!-- Top Corner Rivet -->
  <ellipse cx="150" cy="34" rx="4" ry="2.2" fill="var(--color-journal-dark-iso-side)" stroke="var(--color-journal-dark-iso-line)" stroke-width="0.8"/>
  <circle cx="150" cy="34" r="1.2" fill="var(--color-journal-dark-iso-detail)"/>
  <!-- Bottom Corner Rivet -->
  <ellipse cx="150" cy="122" rx="4" ry="2.2" fill="var(--color-journal-dark-iso-side)" stroke="var(--color-journal-dark-iso-line)" stroke-width="0.8"/>
  <circle cx="150" cy="122" r="1.2" fill="var(--color-journal-dark-iso-detail)"/>
  <!-- Right Corner Rivet -->
  <ellipse cx="234" cy="78" rx="4" ry="2.2" fill="var(--color-journal-dark-iso-side)" stroke="var(--color-journal-dark-iso-line)" stroke-width="0.8"/>
  <circle cx="234" cy="78" r="1.2" fill="var(--color-journal-dark-iso-detail)"/>

  <!-- 5. Recessed Stamped Header Badge (Dark Inset Window) -->
  <!-- Header polygon spanning upper plate -->
  <polygon points="90,66 150,34 210,66 150,98" 
           fill="var(--color-journal-dark-iso-glass)" stroke="var(--color-journal-dark-iso-line)" stroke-width="1" stroke-linejoin="round"/>

  <!-- Manufacturer Brand Identity: BOLD, CLEAN, READABLE "AIRBUS" -->
  <g transform="matrix(0.866 0.5 -0.866 0.5 150 56)">
    <text x="0" y="-3" font-family="Commissioner, sans-serif" font-size="16" font-weight="800" letter-spacing="0.18em" text-anchor="middle" fill="var(--color-journal-dark-ink)">AIRBUS</text>
    <text x="0" y="8" font-family="JetBrains Mono, monospace" font-size="6.5" font-weight="700" letter-spacing="0.12em" text-anchor="middle" fill="var(--color-journal-dark-muted)">AIRCRAFT DATA PLATE</text>
  </g>

  <!-- 6. Left Half: Technical Manufacturing Specifications & Data Rows -->
  <!-- Specification Grid Lines -->
  <line x1="78" y1="74" x2="132" y2="103" stroke="var(--color-journal-dark-iso-detail)" stroke-width="0.8"/>
  <line x1="88" y1="84" x2="138" y2="111" stroke="var(--color-journal-dark-iso-detail)" stroke-width="0.8"/>
  
  <!-- Left Side Technical Data Stamps -->
  <g transform="matrix(0.866 0.5 0 1 76 74)">
    <text x="0" y="0" font-family="JetBrains Mono, monospace" font-size="6" font-weight="700" letter-spacing="0.08em" fill="var(--color-journal-dark-muted)">AIRFRAME ID: F-WW</text>
    <text x="0" y="10" font-family="JetBrains Mono, monospace" font-size="5.5" font-weight="600" letter-spacing="0.06em" fill="var(--color-journal-dark-iso-line)">FACILITY: TOULOUSE</text>
    <text x="0" y="19" font-family="JetBrains Mono, monospace" font-size="5.5" font-weight="600" letter-spacing="0.06em" fill="var(--color-journal-dark-iso-line)">SERIES: A320/A350</text>
  </g>

  <!-- 7. Right Half: CONFIDENT, BOLD CORAL ACCEPTANCE BADGE (Connected to Chart) -->
  <!-- Coral Plaque Bevel Drop Face (Depth 4px) -->
  <polygon points="146,114 218,74 218,78 146,118" 
           fill="#bb6a59" stroke="var(--color-journal-dark-iso-line)" stroke-width="1" stroke-linejoin="round"/>
  <!-- Coral Plaque Main Surface (Solid Accent Block matching Routes stub) -->
  <polygon points="146,92 218,52 218,74 146,114" 
           fill="var(--color-journal-dark-shu)" stroke="var(--color-journal-dark-shu)" stroke-width="1.2" stroke-linejoin="round"/>

  <!-- Coral Plaque Corner Fasteners (Dark Ink #292827) -->
  <circle cx="152" cy="94" r="1" fill="#292827"/>
  <circle cx="212" cy="60" r="1" fill="#292827"/>
  <circle cx="152" cy="110" r="1" fill="#292827"/>
  <circle cx="212" cy="70" r="1" fill="#292827"/>

  <!-- Coral Plaque Stamped Inspection Seal & Typography (Dark Ink #292827) -->
  <g transform="matrix(0.866 -0.48 0 1 182 82)">
    <!-- Top Label -->
    <text x="0" y="-14" font-family="Commissioner, sans-serif" font-size="5.5" font-weight="800" letter-spacing="0.1em" text-anchor="middle" fill="#292827">ACCEPTANCE STAMP</text>
    
    <!-- Circular Stamped Inspection Mark -->
    <circle cx="0" cy="-2" r="9" fill="none" stroke="#292827" stroke-width="1.2"/>
    <circle cx="0" cy="-2" r="7.5" fill="none" stroke="#292827" stroke-width="0.6" stroke-dasharray="2 1.5"/>
    <text x="0" y="0.5" font-family="JetBrains Mono, monospace" font-size="5" font-weight="900" letter-spacing="0.08em" text-anchor="middle" fill="#292827">AIRBUS</text>
    
    <!-- Certification / Selected Code -->
    <text x="0" y="11" font-family="JetBrains Mono, monospace" font-size="6" font-weight="800" letter-spacing="0.08em" text-anchor="middle" fill="#292827">DELIVERED · 59%</text>
  </g>
</svg>'''

with open('/Users/indi256/Documents/kuuki/kuuki/.scratch/sheet-anatomy/gemini-figures/makers-aerosting-gemini.svg', 'w') as f:
    f.write(svg_makers)
print("Generated Makers data plate SVG.")
