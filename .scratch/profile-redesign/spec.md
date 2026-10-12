# Profile redesign (`/fly/[username]`) — spec

Status: ready for design (2026-10-12). Guidance: emil-design-eng.

## Settled
- **Audience:** public identity card for visitors. Owner sees the same page plus owner controls; signed-out join CTA at the end. Deep self-analysis stays in Overview.
- **Boundary:** curated summary that links out, and must host the Traveler comparison entry ("Compare with me") from `.scratch/record-sharing-comparison/` (not built yet: no `/compare` route).
- **Metaphor:** passport holder page (reuses the welcome-flow holder page: photo, name, handle, Issued = joined, Founding stub, MRZ line).
- **Diagnosis (owner):** no focal point; just lists numbers; layout per device (desktop 720px column wastes width, mobile long). Badges and owner controls were not flagged; the duplicate `/settings` links still get fixed.

- **Compare with me:** both places. Primary on the holder page (visitors only; guests → sign-in → return), plus per-record "Compare this" on each record card.
- **Records:** cabinet of the five public Record cards when Records consent is on; each opens its Shared record page. Consent off: hidden for visitors, one-line opt-in for owner.
- **Desktop layout:** open passport spread, max ~1120px. Holder page (~400px) left, sticky; right page scrolls. Spine is a soft inset-shadow crease, never a hairline. Concentric radii.
- **Mobile layout:** plain scroll. Holder card full-width on top (Compare/Share inside, 44px targets). Records = horizontal scroll-snap rail; badges = 3-col grid opening the Arc Sheet; ranks = compact gate-sign rows. Tablet 701–1023: holder card on top + 2-col grid.
- **Block order:** headline numbers → record cabinet → stamp strip → badge cabinet → ranks (gate signs) → join CTA (guests).
- **Motion:** quiet entrance (holder 240ms opacity + 8px rise, `--ease-out`; blocks stagger 60ms; no count-ups; no scroll reveals; press scale 0.96; reduced motion = fade) **plus one delight moment: owner badge unboxing.** The cabinet keeps its own per-owner "seen in cabinet" baseline (separate from the `kuuki:badge-events` toast key). The first profile visit after earning a badge presses it into its slot (scale 1.08→1 + ink settle, ~320ms, 80ms stagger). First-ever visit sets the baseline without replay. Reduced motion: appears with a "New" tag. The global toast stays.
- **Scope:** public, owner-public, owner-private, visitor-blocked, not-found; light+dark; 390 + 1440. Out: OG image, field editing, leaderboard page.
- **Process:** Paper boards → this spec → build.

- **Headline numbers:** flights, distance (caption: around the Earth ×N), countries, air-time hours. Airports, airlines and aircraft types leave the profile (Overview owns them).
- **Owner controls:** on your own holder page, the Compare slot becomes Share (native share sheet on mobile, copy link on desktop) plus one visibility chip (Public / Private → Settings → Privacy). This replaces the two duplicate `/settings` links.
- **States:** visitor on a private profile → closed passport cover, "This passport is private", no name. Not-found → same cover, "No such passport" + home link. Owner-private → full page with a diagonal PRIVATE ink stamp on the holder page + a one-line note linking to Settings.
- **Stamp strip:** pressed country stamps, most recent first, ~8 on desktop / rail on mobile, then a "+N" chip. Derived from the airport set the public overview already exposes (no new disclosure). Owner taps through to `/passport`; read-only for visitors.
- **Badges:** earned only, for everyone.
- **Narrator:** owner-only "Remarks" line on the holder page, addressing the owner (RU «вы»), from a new profile bank, data-backed and sarcastic per `glados-copy`. Visitors never see it.
- **Ranks:** one gate-sign row per ranked category (name + large mono #rank, static), linking to the leaderboard. Visitors: block hidden when there are no ranks. Owner: one eligibility line.
- **Record card action:** on someone else's profile "Compare this" → `/compare/:username` with that record focused (guests: sign-in → return). On your own profile the slot is "Share" → share preview from the record-sharing spec.
- **Avatar:** keep the round avatar (Facehash fallback); no passport-photo frame.
- **Paper:** new "Profile" page in the existing Kuuki Paper file, boards 21.x: desktop 1440 + mobile 390, light + dark, all five states. Opus draws the desktop spread; per-artboard Sonnet workers adapt mobile and the states.

## Dependencies
- Traveler comparison and record sharing (`.scratch/record-sharing-comparison/`) are specified but not built: there's no `/compare` route, sign-in return target, record share preview or consent PATCH yet.

- **Sequencing:** Paper shows the full design, Compare and Share included. The profile build ships first with those actions gated on the comparison feature being ready, and they turn on when `/compare` lands. No dead buttons in prod.

Status: shared understanding confirmed 2026-10-12. Next: Paper boards 21.x.

## Audit decisions (dxe pass on boards 21.1–21.7, 2026-10-12)
- **Labels:** uppercase field and card labels (Issued, Bio, Remarks, record names, Distance flown) use the `.eyebrow` contract: 12/16, 600, uppercase, +0.06em, `--text-muted`. Never `--control-border` for text (4.16:1 light, 3.77:1 dark fail).
- **Stamps:** no opacity on stamp text. The date is 11px minimum, format `MM·YY`. Each stamp's accessible name is "Country, Month Year" (e.g. "Norway, September 2026"); the country code and ring are `aria-hidden`. Visitors see "+N" as plain muted text (not a chip). The owner gets an "Open passport →" link in the Stamps header (to `/passport`).
- **Hero numbers:** the headline values use Commissioner with tabular figures, not Paper Mono (the mono comma splits "412,580"). Record values stay Paper Mono. Use locale-aware grouping (RU narrow no-break space).
- **"Around the Earth ×N":** shown only when N ≥ 0.5; below that, show no caption.
- **Holder page:** "Authority · KUUKI" is cut. The holder page shadow is a documented exception only for the desktop spread (spine crease). The mobile holder card is an in-flow card: one subtle `--hairline` outline (dark: top highlight), no shadow.
- **Owner-private:** no disabled Share. The holder page action row is the Private chip plus the note "Your profile is private. Others see a closed passport." and "Change in Settings".
- **Unboxing "New" pill:** pinned to the badge tile's top-right corner (absolute), never in flow, so the grid never moves when it clears.
- **Remarks copy:** must fit two lines on the 400px holder page; no orphaned word.
- **Shipped-first variant (board 21.1b):** before `/compare` lands, visitors see no Compare button and record cards have no action row; the holder page closes up after the Bio (no empty slot). Owner Share for the profile link (copy link / native share) ships now, since it doesn't depend on `/compare`. Record-card Share waits for the record share preview.
- **Closed covers by viewer:** a signed-out visitor sees the guest shell (BrandShell: wordmark, Sign in, Sign up, language, theme) and "Start your own journal". A signed-in visitor sees the member shell and "Back to your journal". Not-found cover fill is `#66605B` (white text 6.2:1). Covers use radius `6px 20px 20px 6px` (spine on the left).
- **Mobile guest shell:** the guest header is BrandShell, not a sign-in-only header; no tab bar for guests.
- **Mobile gate rows:** light uses `--surface-inset` rows with `--text` labels and `--accent-text` ranks (not three black blocks). Desktop light keeps the dark gate signs.
- **Accessibility contract for the build:** the MRZ, badge glyphs and the PRIVATE stamp are `aria-hidden`; gate signs read "Rank 4 in Distance"; every touch-reachable action has a 44px hit area (desktop "Compare this" rows may be visually 28px but get a 44px hit area).
- **Stress board 21.8:** RU locale, sparse profile (3 flights, 1 country, no records consent, 0 badges, no ranks), long Cyrillic name, photo avatar. Visitor view hides empty blocks; the MRZ transliterates Cyrillic (ICAO 9303).
- **Navbar:** three primary links (Overview, Journal, Passport) are correct per the navbar redesign; Leaderboard lives in the account menu. No nav item is active on the profile.
