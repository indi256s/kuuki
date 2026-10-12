# Figure redesign review

Full review of the Crossings and Makers figure drawings in Paper. This is SVG artwork in the existing Kuuki illustration system; no application implementation is in scope. Fresh designers are working sequentially.

| Category | Evidence inspected | Result |
| --- | --- | --- |
| Typography | User's Crossings study and Makers sheet screenshots | Crossings bottle label breaks into unreadable projected fragments. |
| Surfaces | Same drawings at their intended mobile stage size | Shapes need clearer silhouettes, material and physical support. |
| Animations | Static Paper drawings only | Not verified; do not use movement to disguise geometry defects. |
| Icons | Makers cargo dolly, Crossings mask silhouette | Makers object has a weak semantic connection to manufacturer share. |
| Performance | No application implementation requested | Not reviewed; drawings only. |

| Severity | Location | Before | After | Why |
| --- | --- | --- | --- | --- |
| MEDIUM | Crossings figure study | Diagonal mask floating above a bottle; intersecting strap contours | Recompose a recognizable, grounded sleep object with deliberate occlusion and fewer contours | Optical alignment and design at render size: the silhouette must survive at 300×160. |
| MEDIUM | Crossings bottle label | MELATONIN split across tiny projected lines | Remove or simplify the label; preserve recognizability through object shape | Typography should clarify the object without requiring close inspection. |
| MEDIUM | Aircraft / Makers figure | Five colored cargo containers imply freight, not aircraft makers | Use a physical aircraft-related object with a clear maker or manufacturing association | Details need semantic purpose, rather than repeating chart categories on arbitrary boxes. |

| Location | Candidate | Rejected because |
| --- | --- | --- |
| Crossings | Add a UTC tag or miniature numeric display | Turns the sleep metaphor into another contrived instrument. |
| Crossings | Encode 82 hours as sleep lost or pills used | Those measures are not supported by the flight data. |
| Makers | Repair only cargo colors | The object's meaning remains unrelated to manufacturer share. |
| Both figures | Add glow or idle motion | Does not resolve silhouette, geometry or meaning. |

Verification: reviewed user-provided screenshots and current Paper studies. The shared template's figure guide and source note fit after their corrections; desktop Clock layout also fits. Physical gesture behavior and animated states are not verified.

Verdict: Needs changes for Crossings and Makers. Fresh studies require review in the full sheet and at actual render size before integration.
