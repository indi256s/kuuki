# Ground travel distance: decision memo

Date: 2026-10-13. Status: research recommendation, not an approved provider contract or implementation plan.

Scope: GT-06/GT-07 in [spec.md](spec.md): approximate distance through ordered cities; optional stations for trains; saving must work without a distance. No budget, traffic forecast, or provider credentials supplied. No live route/geocoding API calls, account creation, billing actions, or private data inspection were performed. Prices below are published list prices, not quotes.

## Accepted product decision

After reviewing this research on 2026-10-13, the owner selected straight-line
schematic distances for both road trips and trains, with no external routing API.
Use the existing local `greatCircleKm` calculation and explicit geographic-distance
labelling. The city/coordinate source remains a separate decision. Hosted-provider
comparisons below are retained as research context, not first-version dependencies.

## Research recommendations before the decision

**No-paid baseline:** use a local city catalogue with coordinates and an automatic sum of geodesic distances through the chosen points. Label this explicitly **“≈ … km between cities in a straight line”**, with a schematic map. It is an estimate of geographic separation, not kilometres driven or travelled by rail; `≈` alone does not convey this distinction. The owner accepted this limitation in GT-07 after the research. Do not use a road/rail multiplier.

**For a useful road distance without a paid subscription, openrouteservice Standard is the first candidate.** Its published free quotas comfortably cover 1,000–10,000 monthly recomputations when spread across days. Use local geodesic calculation as an explicitly labelled fallback when routing is unavailable. Before adoption, validate actual routes in the target regions and resolve the current licence/privacy conditions below. Free access is subject to terms and service availability; it is not a production SLA.

**For trains, keep the straight-line estimate separate from rail mileage.** None of the road providers below supplies a passenger railway route. A train-specific distance needs the selected train's route/shape or an admitted railway dataset; city endpoints alone do not identify it. Showing unknown rail distance is better than presenting driving distance as train distance. This still allows automatic geographic estimates and saving journeys.

These recommendations are engineering judgements, not provider claims. Hosted routing adds an external dependency; a local catalogue and calculation keep the journal usable without it.

Project-local reuse: [packages/shared/src/geo.ts](../../packages/shared/src/geo.ts) already exports `greatCircleKm(a, b)` and `greatCirclePoints`. Reuse this spherical calculation for the schematic fallback; a new ellipsoidal library is unnecessary for city-level approximation. Sum adjacent points; do not treat it as road or rail mileage.

## Five plausible choices

| Choice | Appropriate use | Published limits / tradeoffs | Rail support |
| --- | --- | --- | --- |
| Local geodesic + GeoNames catalogue | Always-available schematic distance; zero external routing fees | Sum adjacent points in user order, including repeats/return. Geography only; no roads, borders, ferries, stations or actual alignment. | Same geographic fallback, explicitly not rail mileage. |
| openrouteservice Standard | Preferred trial for approximate driving distance | Free; 2,000 directions/day, 40/min; 50 route points, 6,000 km route limit. Separate search/autocomplete budgets. No quality guarantee. | Published modes use street networks; no passenger rail profile. |
| GraphHopper hosted | Paid road fallback if service quality or contractual fit wins | Free is noncommercial only, 500 credits/day and 5 points; Basic €69/month excl. VAT, 5,000 credits/day, 30 points; Basic 1 request/s and 100 credits/min. | Car/bike/walking and other road vehicle profiles, not a passenger train itinerary. |
| Google Routes + separate city geocoding | Low-volume road API if Google map/storage terms fit | Essentials 10,000 free events/month, then $5/1,000. Up to 25 intermediate points; 11+ intermediates triggers a higher SKU. Billing-enabled project/key required. | TRANSIT can prefer rail, but is not a historical railway-distance service. |
| OSRM public demo / self-hosted road engine | Demo evaluation; self-host only after evidence of need | Public demo: reasonable noncommercial use, ≤1 request/s, no uptime/latency/update guarantees. Self-host adds graph imports, compute/storage, updates and operations. | Demo modes are car, bike and foot; no rail. |

Sources: [GeographicLib geodesic API](https://geographiclib.sourceforge.io/html/python/code.html), [GeoNames dump format/licence](https://download.geonames.org/export/dump/readme.txt), [ORS plans](https://account.heigit.org/info/plans), [ORS restrictions](https://openrouteservice.org/restrictions/), [ORS modes](https://openrouteservice.org/services/), [GraphHopper pricing](https://www.graphhopper.com/pricing/), [Google prices](https://developers.google.com/maps/billing-and-pricing/pricing), [Google waypoint rules](https://developers.google.com/maps/documentation/routes/intermed_waypoints), [OSRM operator policy](https://github.com/Project-OSRM/osrm-backend/wiki/Demo-server).

ORS evidence detail: plans and terms are client-rendered. The public application bundles served on this date confirm Standard is free, directions 2,000/day and 40/min; current GeocodeSearch and GeocodeAutoComplete are each 1,000/day and 100/min. The older Pelias policy entry also appears in the bundle, so use the current endpoint-specific policies, not an assumed shared 3,000/day allowance. Published bundles: [plans](https://account.heigit.org/chunk-7SF2PHKW.js), [terms](https://account.heigit.org/chunk-TC2R7MR4.js). Recheck these at implementation time; hashed asset URLs change.

## Indicative monthly cost

Assumptions: one ordered road-route request per recomputation; ≤10 GraphHopper locations / ≤10 Google intermediate points; ordinary directions, no optimisation, traffic premium or alternatives. Requests spread across 30 days. City geocoding is **not** repeated on every route reorder. Map tiles, autocomplete keystrokes, Workers/D1 usage and taxes are excluded.

These are **billable-call scenarios**, not a promise that 10,000 UI edits equal 10,000 calls. Debouncing/permitted caching can reduce calls; splitting a long route, retries or independent per-leg calculation increases them. Recalculate cost with the actual call count and waypoint distribution.

| Option | 1,000 road recomputations | 10,000 road recomputations | City lookup accounted separately |
| --- | --- | --- | --- |
| Local | $0 API fees | $0 API fees | Local GeoNames data: no per-search API fee; storage/search engineering remains. |
| ORS Standard | $0 within quotas | $0 within quotas (~334/day average) | Search and autocomplete each 1,000/day, 100/min; $0 within quotas. A concentrated day's workload may fail. |
| GraphHopper Basic | €69/month | €69/month | Default geocoding 0.3 credits/request; some providers 0.9. Shares daily credits with routing. Free tier only if Kuuki qualifies as noncommercial. |
| Google Essentials | $0 routing usage | $0 routing usage | Geocoding independently has 10,000 free/month then $5/1,000. With 2 uncached geocodes per recomputation: 2,000 costs $0; 20,000 costs $50/month. |
| Public OSRM / self-host | No production cost commitment | No production cost commitment | Public Nominatim is not an unrestricted autocomplete backend; self-host cost requires a workload/region benchmark. |

GraphHopper ordinary routes with 2–10 points cost 1 credit; larger routes cost points/10 and must also fit plan limits. Google Pro has 5,000 free events/month then $10/1,000: 10,000 Pro route calls would be $50, rather than Essentials' $0. Usage is aggregated within the billing account and SKU, so other consumers can use its allowance. These are arithmetic estimates from [GraphHopper credits](https://support.graphhopper.com/support/solutions/articles/44000718211-what-is-one-credit-) and [Google price list](https://developers.google.com/maps/billing-and-pricing/pricing). Google access requires [billing and credentials](https://developers.google.com/maps/documentation/routes/usage-and-billing); a zero invoice is not a no-billing-account option.

## City identity, licensing and privacy

- **City catalogue:** GeoNames supplies WGS84 coordinates, stable IDs, countries, administrative areas and alternative names under CC-BY 4.0. `cities5000` omits smaller places; `cities500` or country extracts give broader coverage. Choose size based on intended journeys, including RU/EN aliases and explicit country/region disambiguation. Preserve catalogue version and attribution. Completeness/accuracy are not guaranteed. [Official dump description](https://download.geonames.org/export/dump/readme.txt).
- **ORS:** current terms require ORS/HeiGIT and source attribution; route results are **CC-BY-SA 4.0**, while geocoding combines sources with their own licences. They also prohibit transmitting personal data. Send only selected public city/station coordinates, no owner IDs, names, dates, tickets or notes; assess whether the payload remains personal data in context before production use. Do not assume that a persisted route database has no share-alike obligations. The provider's recent answer about permanent commercial route geometry directs the requester to contact them; it does not grant blanket permission. [Terms](https://account.heigit.org/info/tos), [September 2026 geometry clarification](https://ask.openrouteservice.org/t/persistent-storage-and-commercial-reuse-of-directions-api-route-geometry/8057).
- **Google:** most route-content caching is restricted; place IDs are exempt. Routes displayed on maps require a Google map under the documented policy; standalone content requires Google Maps attribution. A journal storing distances indefinitely and drawing them over a non-Google map needs a contract-specific check before selection. Terms vary for EEA billing addresses. [Routes policies](https://developers.google.com/maps/documentation/routes/policies). Do not build cost savings around permanent Google-coordinate/route caching without confirming the permitted storage.
- **Nominatim public:** absolute 1 request/s app-wide, identifiable User-Agent/Referer, attribution, cache repeated queries, switchable provider; client-side autocomplete is prohibited. It runs on donated capacity and must not receive personal/confidential material. Suitable only for policy-compliant explicit searches at very small scale; use local catalogue search for Kuuki autocomplete. [OSMF policy](https://operations.osmfoundation.org/policies/nominatim/).
- **Self-hosting:** ORS uses a separate routing engine/server with imported OSM data; its [Docker guide](https://giscience.github.io/openrouteservice/run-instance/running-with-docker) describes heap memory and graph-build configuration. OSRM likewise needs prepared regional graphs. Inference: these native/Java engine workloads need a separate service, rather than treating Workers/D1 as the routing engine. No defensible fixed monthly hosting price exists without region size, profiles, RAM/storage benchmark and operator effort. “Open source” eliminates neither hosting nor maintenance cost.

## Railway feasibility and coverage

Google TRANSIT cannot accept intermediate waypoints. Rail modes are preferences: returned routes can use other modes, even exclusively. It includes walks/transfers and searches current schedules, with a window of only 7 days back / 100 days forward. Consequently it cannot identify an arbitrary old train or infer its mileage from cities without further route verification. [Google transit contract](https://developers.google.com/maps/documentation/routes/transit-route).

GTFS offers a more defensible future seam: where the exact train/stop sequence is known and the operator supplies a licensed feed, `shape_dist_traveled` is actual distance along the supplied shape; it is optional. Alternatively sum the selected section of a supplied shape with geodesic calculation. Units and stop/shape matching must be checked. [GTFS reference](https://gtfs.org/documentation/schedule/reference/#shapestxt). A connected OSM railway graph alone does not prove passenger service, selected train, operational border crossing, or historical alignment. No usable single rail API with established Georgia–Armenia–Turkey–Europe coverage was demonstrated in this bounded research.

ORS advertises global road/geocoding coverage, and OSM-based providers can contain these countries. That does not establish successful, currently legal international routes. Georgian/Armenian/Turkish city-name resolution, mountain roads, border closures, ferries and cross-border rail must be sampled. European transit data is also operator-dependent. No claim of validated coverage or accuracy is made here.

## Proposed implementation requirements, after selection

1. Separate distance provenance: method (`geodesic`, `road-routing`, future `rail-shape`), provider/version, ordered coordinate signature, metres, computed time, status and attribution. Unknown is nullable, never zero. Geographic and road/rail mileage must not silently mix in totals; label summaries or keep separate totals.
2. Resolve and persist city identity/coordinates once using a licensed source; preserve ordered repeats and explicit return. Train calculation sums each user-owned segment; road calculation uses full ordered route. Do not optimise waypoint order. Split routes only where provider limits require it, without dropping/duplicating legs; define partial failure rather than presenting a partial total as complete.
3. Make optional provider calls from an authenticated Worker endpoint with server-held key, finite timeout, bounded payload/waypoints, provider-wide rate/quota control and explicit no-route/429 handling. Debounce stable edits, reuse allowed results, and reject stale responses by route signature. Save/edit journeys independently of routing.
4. Cache only what the source contract permits, keyed by ordered coordinates, profile/options and method version. Keep user journeys owner-isolated even if public city data is shared. Log operational counts/errors without journey payloads. Do not send tickets, dates, owners or notes to routing services.
5. Verify ambiguous cities, ring routes/repeats, no route, unavailable provider, over-limit route and late response after reorder. For provider admission, test representative domestic/cross-border pairs in Georgia, Armenia, Turkey and Europe; check city centroids' road snapping and material detours. This research is not those tests.

Questions identified before the product decision (hosted-routing questions are deferred outside the first version): expected monthly/daily/burst traffic; whether Kuuki is commercial; accepted fallback wording/totals; chosen city catalogue and missing-city behavior; routing data persistence/licence admission; ORS personal-data interpretation; maximum route length/points; map provider; exact train-route sources and countries needed. No paid plan or additional server is justified by the supplied requirements yet.
