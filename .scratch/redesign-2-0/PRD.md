# PRD: Kuuki Redesign 2.0

Status: ready-for-agent

Design source of truth: `docs/plans/2026-10-04-redesign-2.0-ux-ui.md` (the "design brief"; section numbers below, e.g. §6.12, refer to it). Evidence: the user-journey atlas and interface audit under `docs/user-journeys/` (audit 11/20, 113 findings, 34 P1).

This PRD turns the design brief into an implementable spec. The implementation planner should read the brief in full; this document fixes scope, user-visible behaviour, implementation decisions and test seams, and does not repeat every visual value.

## Problem Statement

Kuuki is a personal flight log and travel passport. People use it to capture their flights, remember where they have been, and share a profile they are proud of. Today it feels like a draft:

- It looks like several products stitched together. The public profile is calm and editorial, the dashboard is a wall of 13 equal cards with English rank titles and a joke on each, activation is an unbranded teal page, and the accent colour, fonts and radii disagree from screen to screen. Three written style guides contradict each other and the code follows none of them.
- Screens have no clear point. The dashboard shows a radar chart with two non-zero axes, a screen-high waffle for one flight, and a map coloured in flag hues that answers no question and disagrees with the filters next to it.
- The most important feature, AI import, hides whether it is sure. Confidence lives inside an expander, three different failures show one generic message, an error and "no flights found" can appear together, and the review breaks on a phone.
- Russian speakers get a second-class product: the brand font has no Cyrillic, plural forms are wrong («5 перелёт»), English strings leak into Russian screens, and layouts are sized for English.
- Text and controls fail contrast, focus is half-transparent, touch targets are small, there is no route to the leaderboard or one's own profile on mobile, and the mobile dashboard scrolls sideways.
- Jokes appear where people need trust: under the sign-in button and in the irreversible account-deletion dialog.
- The passport is not trustworthy. A booked flight silently becomes "flown" when its date passes, even if it was cancelled or rebooked, and every connection airport stamps its country, so a layover in Istanbul stamps Turkey. Leaving an import review loses the work.

## Solution

Kuuki 2.0 is one coherent product with one design language, the editorial style of the current public profile, built on a rewritten design system and organised around three jobs: **Capture**, **Remember**, **Share**.

- A single design system (DESIGN.md v2) defines colour (separate text, fill and control-border tokens, terracotta in both themes, curated accent pairs, country colours used only as stamp ink, a single-hue map ramp with a legend), a Cyrillic-capable typeface, a type scale with a 12px floor, a 12-column grid, a concentric radius scale, four elevation levels with no glass or glow, Lucide icons at weights matched to text, and a motion system where frequency decides what animates.
- Clear navigation: guests land on a landing page that shows the real product; members get Overview, Journal, Passport and Leaderboard on desktop with a split «＋ Добавить» button and an avatar menu, and Обзор · Журнал · ＋ · Паспорт · Я on mobile. Every route and mode has its own URL and page title.
- Every screen answers one question first. Overview leads with the next or just-landed flight and four unboxed figures. Passport is the signature screen, with stamps and a map behind a switch. Journal is where filtering lives. Import shows its confidence on every row and names each failure.
- Every data surface designs all five states (loading, first-run empty, filtered empty, error, success or partial), and errors never look like empty data.
- Russian and English are equal: correct plurals, localized dates and numbers, layouts checked at Russian length.
- Voice is calm and precise in trust contexts and witty only in a few safe places, using «вы» consistently.
- **Passport control:** nothing is stamped without the owner. Flights have a visible lifecycle (draft → upcoming → awaiting confirmation → logged). After a flight's date passes Kuuki asks «Вы долетели?», and confirming presses the stamp. Connections don't stamp countries unless the user left the airport. Import drafts survive leaving the page.
- Accessibility (contrast, keyboard paths, focus, announcements, heading structure) is part of every screen's design.

Success is measured by recapturing the atlas in light and dark themes and rerunning the interface audit: ≥16/20 with zero P1 findings.

## User Stories

### Visitor and entry

1. As a first-time visitor, I want the home page to show what Kuuki actually looks like (a ticket being recognised, a grid of stamps, a profile strip), so that I understand the product before signing up.
2. As a first-time visitor, I want «Создать аккаунт» to be the primary action and «Войти» secondary, so that the page speaks to me rather than to returning members.
3. As a visitor on a phone, I want the first screen to show part of a product example, so that I don't have to scroll to see what this is.
4. As a visitor, I want a short FAQ and plain privacy facts on the landing page, so that I can decide whether to trust Kuuki with my travel history.
5. As a visitor who opened someone's shared profile, I want a quiet «Заведите свой паспорт перелётов» call to action at the end, so that I can start my own.
6. As a returning member, I want signing in to live at its own address, so that back, refresh and bookmarks behave predictably.
7. As a signed-in member who opens the home page, sign-in or sign-up page (including from the installed app), I want to be taken straight to my Overview, so that I never see a login form I don't need.
8. As someone signing up, I want to see the password rule before I type, and to show or hide my password, so that I don't fail validation blindly.
9. As someone signing in, I want validation errors inline, localized and without the layout jumping, so that I can correct mistakes calmly.
10. As someone signing in while the server is slow, I want the form to stay usable and to explain what happened if it fails, so that I'm never stuck on a disabled form.
11. As a member of the old version, I want a quiet «Переносите аккаунт из старой версии?» link that starts activation in the same branded shell, so that migrating feels like the same product.
12. As a migrated member with an expired activation link, I want a «Отправить новую ссылку» button, so that I can recover without contacting anyone.
13. As a migrated member setting my password, I want rules shown up front, inline match checking and a clear success step that leads me into the app, so that activation is one smooth flow.
14. As a Russian-speaking visitor on mobile, I want language and theme controls on the auth screens, so that I can read the product in my language before I sign in.
15. As any user, I want the auth screens free of jokes and glass effects, so that the place where I hand over credentials feels trustworthy.

### Onboarding

16. As a new member, I want to choose my username with live availability and see the exact public address it will create, so that I know what I'm sharing.
17. As a new member, I want the reactive avatar to respond while I type my name, so that setup feels personal.
18. As a new member, I want to choose how to add my first flights (upload, paste text, or type) from three clear options, so that I start with the method that suits me.
19. As a new member who isn't ready, I want «Сделаю позже» to look like a normal choice, so that skipping doesn't feel like failing.
20. As a new member who added flights, I want my first stamps to press onto an empty passport page, so that I immediately see what Kuuki is for.
21. As a new member who skipped, I want to land on an Overview empty state that tells me exactly what to do next, so that I'm not lost.
22. As a new member, I want the progress indicator to name each step, so that I know how long setup will take.

### Navigation and shell

23. As a desktop member, I want Обзор · Журнал · Паспорт · Рейтинг in the header and one «＋ Добавить» split button, so that capture is always one click away.
24. As a desktop member, I want my profile, settings, theme, language and sign-out in an avatar menu that works by keyboard, so that the header stays calm.
25. As a mobile member, I want a tab bar with Обзор · Журнал · ＋ · Паспорт · Я, so that every main area, including my profile and the leaderboard, is reachable with my thumb.
26. As a mobile member, I want the ＋ tab to offer upload, paste and manual entry in a sheet, so that adding a flight starts from one place.
27. As a mobile member, I want content, toasts and popups never to hide under the tab bar or the home indicator, so that nothing is unreachable.
28. As a member using a screen reader, I want the active tab to be announced and visually marked by more than colour, so that I know where I am.
29. As any user, I want each page and mode to set a descriptive browser title and move focus to its heading on navigation, so that tabs, history and assistive tech make sense.
30. As a member who bookmarked old addresses, I want the old dashboard, flights and landing addresses to redirect to their new equivalents, so that my links keep working.
31. As any user, I want a single stable logo mark that is never mistaken for a back button, so that the brand reads consistently.

### Overview

32. As a member, I want the Overview to open with my next flight as a ticket with a countdown, so that the most relevant thing is first.
33. As a member who has just flown, I want the Overview to ask whether I landed, in place of the countdown, so that my log stays true without extra effort.
34. As a member, I want four big figures (flights, distance with a human comparison, countries, time in the air), so that I see the shape of my flying at a glance.
35. As a member, I want to switch the period between all time and individual years, with year-over-year change shown only when a year is selected, so that I can compare honestly.
36. As a member, I want a mini map in the passport colours with a legend line that follows the selected period and opens the passport map, so that geography is shown once and correctly.
37. As a member, I want a few notable facts (longest flight, most frequent route, new countries, favourite airline) written as sentences, so that the numbers mean something.
38. As a member, I want ranked lists for airlines, airports and aircraft with «Все» opening the Journal already filtered, so that I can dig in when I want to.
39. As a member with very few flights, I want ranked lists to become a sentence («Все 12 перелётов — American Airlines»), so that I don't see a chart with one bar.
40. As a member whose flights lack aircraft types, I want a line saying how many and offering to find them automatically, so that missing data becomes an action instead of a zero.
41. As a new member with no flights, I want a clear empty panel with import and manual actions above a clearly labelled preview of what my Overview will look like, so that I know both what to do and why.
42. As a mobile member, I want the Overview in one column with figures in a 2×2 grid and nothing wider than the screen, so that it never scrolls sideways.

### Journal

43. As a member, I want to search my flights by route, city, airport code or flight number from one field, so that I find a flight quickly.
44. As a member, I want filter chips (period, status, airline, aircraft) that show their active value and can be cleared individually, so that I always know what I'm looking at.
45. As a mobile member, I want filters in a bottom sheet with an apply button and an active-filter count, so that filtering fits a small screen.
46. As a member, I want flights awaiting my confirmation pinned at the top of the Journal, then upcoming flights, then past years with sticky headers, so that the list is ordered by what needs me.
47. As a member, I want every row aligned on one baseline with tabular dates and right-aligned distances, so that the table is easy to scan.
48. As a member, I want clicking a flight to open a detail sheet with a ticket header, inline edit and a separate delete section, so that I can review or fix a flight without leaving the list.
49. As a mobile member, I want each flight as a two-line card with route and date first and a small «＋ самолёт» chip when the type is missing, so that cards stay readable.
50. As a member, I want to select several flights and delete them from a floating bar that names the count and confirms with the affected routes, so that bulk actions are safe.
51. As a member, I want select mode to reserve the checkbox column in advance, so that the table doesn't shift.
52. As a member, I want an empty Journal to offer import and manual entry, and a filtered empty Journal to offer resetting filters, so that I always have a next step.
53. As a member, I want a fetch failure to say it failed and offer retry, so that I never think my flights were deleted.

### Add and edit a flight

54. As a member, I want to add a flight with just route and date and reveal optional details only if I want, so that manual entry is fast.
55. As a member, I want airport search that matches codes, English, native and Russian names, shows recent airports first and works with arrow keys, so that I find airports however I think of them.
56. As a mobile member, I want airport search to open as a full-height sheet with the search field pinned and the save button above the keyboard, so that typing on a phone works.
57. As a member, I want a fully localized date picker that I can also type into, so that entering dates is quick in my language.
58. As a member, I want a readable duplicate warning with «Открыть существующий» and «Всё равно сохранить», never triggered by the flight I'm editing, so that I avoid duplicates without false alarms.
59. As a member, I want optional fields marked «необязательно» rather than drawn as disabled-looking ghost fields, so that I know they're available.
60. As a desktop member, I want ⌘/Ctrl+Enter to save, so that frequent entry is fast.

### Import

61. As a member, I want a large drop area that also works as a button and by keyboard, so that uploading a boarding pass, PDF or screenshot is the obvious first action.
62. As a member, I want to paste text from an email as a second option, and find the "export from email with an AI prompt" helper collapsed below, so that the advanced path doesn't crowd the simple one.
63. As a member, I want a plain statement of what happens to my document, so that I can trust the upload.
64. As a member, I want to see real recognition stages and found flights appearing as rows while it works, with no artificial delay, so that I trust what is happening.
65. As a member, I want to be able to close the page during recognition or review and find the results waiting in my Journal, so that I don't lose work.
66. As a member, I want each found flight to show at a glance whether any field is uncertain, with the reason available («год не указан в документе — подставлен 2026»), so that I know what to check.
67. As a member, I want to expand a row to edit it, and see the source snippet when available, so that I can correct mistakes against the document.
68. As a member, I want flights already in my Journal grouped at the end and unselected, so that I don't import duplicates by accident.
69. As a member, I want a simple header (select all, «Выбрано 3 из 4») and a sticky bar with «Импортировать 3», so that confirming is one decision.
70. As a member, I want to add a missing flight as an inline row in the review, so that I don't leave the flow.
71. As a mobile member, I want found flights as ticket cards that open an edit sheet, so that review works at 390px.
72. As a member, I want distinct messages for quota reached (with when it resets), service unavailable, timeout, unreadable file and nothing found, each with the right recovery action, so that I know what to do next.
73. As a member, I want the result summary («Добавлено 12 перелётов · 3 новые страны · 18 400 км») shown at its final values, with new stamps pressing in once, so that finishing feels rewarding and honest.
74. As a member whose save partly failed, I want «Сохранено 10 из 12» with the failed rows listed and a retry for just those, so that I can finish without duplicates.

### Passport control (flight lifecycle)

75. As a member whose flight date has passed, I want Kuuki to ask «Вы долетели до …?» instead of silently logging the flight, so that my passport only contains trips I actually made.
76. As a member, I want «Отметить» to confirm the flight and press the new country's stamp onto the ticket in one gesture, so that confirming feels like passport control.
77. As a member whose flight was rebooked or retimed, I want «Изменилось» to open the edit sheet focused on date or route, so that I can fix it in seconds.
78. As a member whose flight was cancelled, I want «Не летал» to remove it with an undo toast, so that a cancelled trip never becomes a stamp.
79. As a member who connected through another country, I want the connection marked «Пересадка» with no stamp by default, and an option «Выходил в город», so that my country count reflects where I actually went.
80. As a member returning from a long trip, I want many legs grouped into one card with «Отметить все», so that confirming a 12-leg trip takes one tap.
81. As a member who ignores the queue, I want awaiting flights to count in my stats right away and be confirmed automatically after 7 days, so that nothing breaks if I don't act.
82. As a member, I want a country awaiting confirmation to appear in my passport as an unpressed slot with «Ждёт отметки», and the country count to say «· 1 ждёт отметки», so that numbers and stamps never contradict each other.
83. As a member, I want a number badge on Журнал and a top row in the ＋ sheet only when something awaits me, and no badge otherwise, so that the app never nags with a permanent dot.
84. As an existing member, I want a one-time review of connections that are currently stamped as countries, with nothing changed until I choose, so that my existing passport can be cleaned up on my terms.
85. As a member, I want a failed confirmation to leave the card in place with the cause and «Повторить», and the stamp never to press before the server confirms, so that the passport never shows something that wasn't saved.
86. As a member using a screen reader, I want each confirmation's result announced («Штамп: Соединённые Штаты») and focus moved to the next card, so that I can work through the queue without sight.
87. As a member offline, I want confirmation actions disabled with the reason shown, so that I don't think they worked.

### Passport

88. As a member, I want the passport header to show countries out of a stated total with a progress bar, continents as six chips, new countries this year and my latest stamp, so that my collection's shape is clear.
89. As a member, I want to switch between Stamps and Map with a labelled control, so that the map lives in one place.
90. As a member, I want stamps in native script with the localized name, first-visit year, and a readable «×12 · 2 мес. назад» line, so that each stamp is both beautiful and informative.
91. As a member, I want air and land/sea stamps to differ in shape with a small key explaining it, so that the difference isn't a mystery.
92. As a member, I want visit count shown as ring density (one, double, triple ring), so that frequent countries stand out without breaking the grid.
93. As a member, I want stamps grouped by continent and sortable by recent, visit count or name, so that a large collection stays browsable.
94. As a member, I want a country detail sheet with first and last visit, every visit, airports used, «＋ Добавить визит» and a danger section for removal, so that I can manage a country completely.
95. As a member, I want to add a country I visited by land or sea from a searchable sheet with neighbour suggestions, and see its stamp press into place, so that claimed countries feel as real as flown ones.
96. As a member, I want claim-only countries marked with a dashed ring and «без перелётов», so that the distinction is never colour-only.
97. As a member, I want the map in one colour ramp with a titled legend, layers named Страны / Маршруты / Частота, and no scroll hijacking, so that it reads correctly and lets me scroll the page.
98. As a keyboard user, I want the map to offer a country list and the detail sheet instead of 177 unnamed tab stops, so that I can explore by keyboard.
99. As a new member, I want an empty passport page with ghost stamps, «246 стран ждут вас» and actions to add a country or import, so that the empty state invites me in.

### Profile

100. As a member, I want my public profile to keep its calm editorial style, with my avatar outlined rather than glowing and my join date localized, so that I'm proud to share it.
101. As a profile owner, I want «Скопировать ссылку» to confirm with «Ссылка скопирована» and handle clipboard failure, so that sharing never silently fails.
102. As a profile owner with a private profile, I want a banner saying only I can see it, with a way to make it public, so that I understand why my stats look hidden.
103. As a profile owner, I want stats that are zero because of missing data explained to me and hidden from visitors, so that my profile never looks broken.
104. As a visitor, I want profile wording addressed to me («Место в рейтинге») and no owner instructions, so that the page reads naturally.
105. As a visitor, I want achievement badges with visible names, tier shown by text and shape, and details on tap or focus, so that badges are understandable on any device.
106. As a visitor to a private or missing profile, I want one calm message and a way home, so that I'm not confused by duplicate notices.

### Leaderboard

107. As a member, I want the leaderboard in a centred column with labelled category tabs, so that rank and value are easy to read together.
108. As a member, I want my own place shown as one clear state (rank with change, flights still needed, or how to opt in), so that I know where I stand.
109. As a member, I want the «+N мест» celebration only once per change, so that it stays meaningful.
110. As a member, I want rank numbers always present beside medals, my row highlighted and pinned when scrolled away, so that ranking never depends on icons or colour.
111. As a guest or after an error, I want exactly one appropriate message («Войдите, чтобы участвовать» or a retryable error), so that a failure is never shown as an empty leaderboard.

### Settings and account

112. As a member, I want settings in one column with clear sections (Профиль · Приватность · Внешний вид · Данные · Аккаунт), so that I find things quickly.
113. As a member editing my profile, I want a sticky unsaved-changes bar and a warning if I leave, so that I don't lose edits.
114. As a member, I want privacy switches that state their consequence and explain inline why one is unavailable, so that I understand what I'm turning on or off.
115. As a member turning off my public profile, I want to be told beforehand that leaderboard participation will also turn off, so that nothing surprises me.
116. As a member, I want theme and language as labelled segmented controls that fit at Russian length on a narrow phone, and an accent picker of six named colours if offered, so that personalisation is clear.
117. As a member exporting data, I want counts, the daily limit in plain words and the reason when export is unavailable, so that I'm never shown a misleading empty state.
118. As a member deleting my account, I want a sober, step-numbered flow (what will be deleted, offer to download, confirm with password) with distinct errors and no jokes, so that an irreversible action feels safe.
119. As a former member, I want a clear «Аккаунт удалён» confirmation before returning to the landing page, so that I know it worked.

### Language, theme and accessibility

120. As a Russian speaker, I want correct plural forms, localized dates and number grouping everywhere, so that the product reads as native.
121. As a Russian speaker, I want the brand typeface to render Cyrillic, so that Russian screens look as designed.
122. As any user, I want light and dark themes of equal quality with system as the default, so that my choice is respected.
123. As a user with low vision, I want text at 4.5:1, control borders and focus rings at 3:1 in both themes and every accent, and no text smaller than 12px, so that I can read and operate everything.
124. As a touch user, I want targets at least 44px and no sticky hover states, so that I don't mis-tap.
125. As a user who prefers reduced motion, I want gentle fades instead of movement, static loading indicators with text, and no ambient loops, so that the app is comfortable without losing feedback.
126. As a screen-reader user, I want async results (import progress and count, saves, copied links, deletes, confirmations) announced, so that I know what happened.
127. As any user, I want frequent actions (navigation, filters, keyboard actions) to be instant and only rare moments to animate, so that the app feels fast.
128. As any user, I want every chart to have a text equivalent and tooltips that work by touch and keyboard, so that data isn't locked behind hover.

## Implementation Decisions

### Process and sources

- The design brief is the visual and behavioural specification. Where this PRD and the brief disagree, the brief wins on visual values and this PRD wins on scope and contracts.
- Decisions D1–D12 in the brief (§14) adopt the brief's recommendation unless the owner overrides them before Phase 0 completes. Of these, D1 (landing at `/`), D5 (typeface, chosen by specimen test), D11 (7-day auto-confirm) and D12 (no stamp for transit) most affect implementation.
- Delivery follows the brief's phase order (§12): decisions and DESIGN.md v2 → foundations → shell and IA → Capture (including the flight lifecycle) → Remember → Share and entry → polish and verification. Screens are built once, on the new foundations.
- DESIGN.md is rewritten as the single design source of truth. The conflicting guidance in the brand-guidelines skill and the frontend guidelines doc is retired or marked superseded.

### Foundations (web)

- The token layer keeps the OKLCH architecture and adds separate text, fill and control-border tokens, an accent-text token, and per-theme accent pairs with their own foregrounds. The runtime accent hook may only switch between curated pairs; it must never override semantic tokens or write raw colours.
- Country ink is computed by normalising flag-derived colours per theme (clamped lightness and chroma, neutral fallback). The map uses a 4-bucket ramp derived from the accent, never flag colours.
- The typeface is self-hosted (this also resolves the inline font-loading handler that breaks under the content security policy). Mono is limited to codes, flight numbers, times and dates in tables and tickets, and handles.
- Primitives are rebuilt or restyled once: button (including split and loading variants), field system, combobox, segmented control, swatch picker, switch row, dialog, sheet (bottom and side, drag with velocity dismiss), popover and menu, disclosure (grid-rows height technique), table, floating action bar, toast, destructive confirm. Two signature components are added: Ticket (states: upcoming, today, landed-awaiting, logged) and Stamp (air and land/sea variants, ring density, pending variant). Each primitive specifies all states in both themes and both languages.
- Motion is a set of CSS tokens (curves and durations from the brief §8.1). No motion library is required by the design. Whether the sheet's drag physics uses a small dedicated library is left to the implementation planner, provided the behaviour matches §8.2.
- Hit areas, press feedback, hover gating and focus rings are built into the primitives, not patched globally.

### Shell, routing and IA

- New routes: guest landing at `/`, `/signin`, `/signup`, `/overview`, `/journal`, `/passport` (with the Stamps/Map view in the URL), `/onboarding`, `/settings`, `/leaderboard`, `/fly/:username`, and activation inside the app shell.
- Redirects: `/dashboard` → `/overview`, `/flights` → `/journal`, `/landing` → `/`, and the old auth mode query to the matching auth route. Signed-in visitors to `/`, `/signin` and `/signup` go to `/overview`.
- `/journey` and its nav entries are removed; its ticket and single-accent map styles seed the Ticket component and map styles.
- Every route and mode sets a page title and moves focus to its H1. The document language follows the UI language.
- Mobile tab bar: Обзор · Журнал · ＋ · Паспорт · Я. The ＋ action opens a sheet. "Я" is the user's own profile route.

### Internationalisation

- Locales gain full Russian plural categories (one, few, many, other) for every counted string, and Russian and English key sets are kept identical.
- All hard-coded English strings move into locale files. Dates and numbers format through locale-aware formatters tied to the UI language.
- «вы» is the single form of address in Russian.

### Flight lifecycle (API and data)

This is the only part of the redesign that changes the data model. The contracts below are behavioural; the planner chooses the exact schema.

- **Lifecycle state on flights.** A flight is upcoming, awaiting confirmation, or logged. This replaces the current boolean upcoming flag as the source of truth (it may still be derived for compatibility). Each logged flight records how it was confirmed: at save, by the user, or automatically.
- **Saving past-dated flights** (manual add, import, bulk create) produces logged flights directly. Saving a future-dated flight produces an upcoming flight.
- **The upcoming sync** moves past-dated upcoming flights to awaiting confirmation, not to logged. Awaiting flights count in stats and derived visits exactly as completed flights do today, so nothing regresses for members who never act.
- **Passport country payloads** expose a pending marker for a country whose only contributing flights are awaiting confirmation. This is derived, not stored.
- **A confirmation operation** accepts one or many awaiting flights, each with an optional transit choice for its connection. It moves them to logged, republishes derived state, and returns the countries that became newly stamped, so the client can play the stamp press and announce it. It must be idempotent and must reject flights that aren't awaiting.
- **"Did not fly"** is a delete of the awaiting flight. Undo is client-side: the client defers the delete until the undo window closes. If the page closes first, the flight simply stays awaiting.
- **Auto-confirm.** The existing maintenance cron moves awaiting flights older than 7 days (D11) to logged with automatic provenance, then republishes derived state.
- **Transit.** A flight can mark its arrival as a connection. Visit derivation still counts the connection airport for airport statistics, but it does not contribute to country visits, stamps or country counts. The server identifies connection candidates: consecutive legs where one arrives where the next departs within 24 hours (same or next calendar day when times are missing), in a country that is neither the trip's start nor its end. Candidates are returned with awaiting flights and through a one-time cleanup query for existing data. Existing data is unchanged until the user acts.
- **Import drafts.** Parsed but unconfirmed import results persist server-side as drafts, grouped by import batch (source label, per-field values, per-field or per-flight confidence, and a source snippet if the parser provides one). Drafts never store the uploaded document, never affect stats or derived state, and expire after 30 days. Confirming drafts goes through the existing bulk create with per-item idempotency keys. Drafts are separate from flights so that the flights table keeps its reference-validation invariants.
- **Awaiting-queue read.** One read returns the member's awaiting flights, their connection candidates and draft batches, and supplies the counts for the badge and ＋ sheet row.
- **The Overview hero slot** prefers the most recent awaiting flight, from the morning after its departure date in the member's local date, over the next upcoming flight.

### Screens

- Each screen is implemented per the brief's §6 spec, including its five states. Notable structural changes:
  - Overview drops the 13 stat cards, the radar, waffle and ridge charts and the filter toolbar, keeping only the period control.
  - Journal gains the full filters.
  - Passport moves the map behind a view switch.
  - Import becomes three labelled stages on one page with drafts.
  - Settings becomes a single column.
  - The delete flow uses a stepped dialog.
- The aircraft-lookup and per-row confidence patterns from the current aircraft dialog are kept.
- Existing safe behaviours are preserved: duplicates unselected by default in import, idempotent retry, the delete-account safety model, and the mobile country picker sheet (brief §13).

### Out-of-scope engineering findings

- The audit's engineering-only findings (listed in the brief §11) are not part of this PRD. They may be scheduled alongside it, but they are not acceptance criteria here.

## Testing Decisions

A good test exercises behaviour a user or API client can observe: an HTTP response and the state readable afterwards, or what a rendered screen shows and announces after a user interaction. Tests must not assert on internal function calls, component structure, CSS class names or query shapes. The fewer seams the better; these are the seams, from highest to lowest.

### Seam 1: API handlers against the in-process D1 harness (existing, primary for the lifecycle)

- Prior art: the API test harness that runs handlers against an in-process D1 with all migrations applied, as used by the flights tests (create, bulk, sync-upcoming publishing two completed flights, derived repair), the derived-state tests and the passport tests.
- Cover:
  - Sync moves past upcoming flights to awaiting, and they count in stats.
  - The passport payload marks a pending country.
  - Confirmation (single and bulk) logs flights, returns newly stamped countries, and is idempotent.
  - Confirming a non-awaiting flight is rejected.
  - Transit choice removes the country but keeps the airport.
  - Connection candidates are detected, including the date-only case.
  - The cleanup query changes nothing by itself.
  - Auto-confirm through the maintenance repair path logs flights older than 7 days with automatic provenance.
  - Drafts never affect stats or derived state, expire, and convert through bulk create with replay safety.
  - Past-dated saves log directly.

### Seam 2: Rendered screens with Testing Library in jsdom, API mocked at the client boundary (existing)

- Prior art: the sign-in form component test, plus the pure-logic tests for passport and flight-creation operations.
- Cover at page or route level where possible, rendering through the router:
  - Signed-in redirects from `/`, `/signin` and `/signup`.
  - Legacy route redirects.
  - Page titles and focus on navigation.
  - The arrival card: action order, focus moves to the next card, the polite announcement, the undo window, and the error that keeps the card.
  - Each data surface renders error distinctly from empty.
  - The import error causes map to distinct messages and actions.
  - Import drafts reappear after remount.
  - Disabled controls show their reason.

### Seam 3: Proposed new low-level checks (pure, cheap, high leverage)

- **Locale parity.** Russian and English have identical key sets, and every pluralised key has all Russian plural categories.
- **Token contrast.** Every text, control-border and focus pair meets its threshold in both themes and for every accent pair.
- Both run in the existing web unit-test runner, read the source of truth directly, and need no new tooling.

### Acceptance (existing tooling, not CI)

- Phase 6 recaptures the user-journey atlas in light and dark with the existing atlas build script, then reruns the interface audit. Exit criteria: ≥16/20, zero P1, every screen passing the brief's §10 checklist.

### Not introduced

- No end-to-end browser suite, no visual-regression service and no automated accessibility engine are added by this PRD. The atlas and audit pass covers those concerns. The planner may propose an automated accessibility check as an addition.

## Out of Scope

- The `/journey` trip planner (removed in 2.0; a possible 2.x feature).
- Push notifications, email forwarding addresses and system share targets for capture (natural follow-ons that feed the draft queue).
- Grouping flights into trips beyond the connection detection described here; a retained "cancelled" flight status.
- Year-in-review or other shareable recaps.
- Changes to the AI parser beyond surfacing confidence and snippets it already returns (to be verified).
- A self-serve password reset flow (out of scope per the domain glossary).
- The audit's engineering-only findings listed in the brief §11.
- Code-level design of components and schema beyond the contracts above; that belongs to the implementation plan.

## Further Notes

- **Seams are an assumption.** The three seams above were chosen without a review round with the owner. Seam 1 and Seam 2 already exist; Seam 3 is the only new one and is optional. Flag disagreement before the implementation plan is split into issues.
- **Validate the lifecycle before building it.** Run a read-only production query first: (a) the share of stamped countries that are transit-only, and (b) how often flights are edited or deleted after their date passed. If both are negligible, keep only the one-time transit cleanup and drop the queue.
- **Glossary gap.** The domain glossary covers only auth and migration terms. Flight, visit, claim, ground visit, stamp, derived state, enrichment, and the new lifecycle terms (upcoming, awaiting confirmation, logged, draft, connection) should be added through domain modelling, so issues use one vocabulary. There are no ADRs; the lifecycle change is a good candidate for the first one.
- **Tracker discrepancy.** Agent docs configure local Markdown issues, while the GitHub repository has issues enabled with default labels only. This PRD follows the local convention.
- **Evidence gaps carried from the brief (§15):**
  - Dark theme was never captured.
  - Several transient states were not captured.
  - The parser's per-field confidence and source snippets are unverified.
  - Privacy claims about uploaded documents need backend confirmation before the copy ships.
