---
name: glados-copy
description: Use when writing Kuuki UI copy in EN and RU - Overview narrator lines, empty states, achievements, insights, loading lines, landing. Also for errors, validation and other trust-context copy, which stays calm and direct.
---

> Design and voice are governed by [DESIGN.md](../../../DESIGN.md) (see "Copy and trust"). Where this file conflicts, DESIGN.md wins.

# Kuuki copy

Before writing new witty lines, read [PHRASES.md](PHRASES.md): it is the phrase bank, organised by slot, with the register to match and the jokes already taken.

## Two registers

**Sober.** Capture and import, authentication and activation, privacy and settings, errors and validation, destructive actions (including delete confirmations), accessibility text, and anything about stamping, confirming or the review queue. These get one calm, direct, precise version and no jokes. The stamping promise has a documented exception; DESIGN.md says how to word it.

**Witty.** The Overview narrator, empty states, achievements, profile insights, one-line loading flavour and the landing page. Wit is a secondary line: the instruction, figure or button beside it stays factual and carries the meaning on its own.

## The narrator

The Overview narrator is a product pillar: an unnamed, impersonal observer. It has no "I", no signature and no mention of AI. Code lives in `apps/next/src/client/overview/narrator/` (`triggers.ts`, `corpus.ts`, `pick.ts`).

- **Data-triggered.** Each trigger has an id, a slot, a condition and params. The slots are each section, `globe`, `firstRun`, `zero` and `below:<section>` (the section is under its minimum; params `{have}`, `{need}`).
- **Triples.** Every trigger has exactly three EN and three RU lines. The variant is picked by a hash of user and scope, so all three must be interchangeable for the same data, and the same data always gets the same line.
- **Numbers only from params.** Every line in a trigger uses the same placeholder set as the trigger's params. Lines contain no numeric literals.
- **Agrees with the card.** The line says something the card implies but does not print: an implication, a comparison, a habit. It never contradicts a figure and never just repeats the leader tile.
- **One per card.** The narrator is the only witty line in a card; tile captions, figure captions, chart labels and footnotes stay factual.
- **Beside actions.** `firstRun` sits next to Import and Add; `zero` sits next to "Remove last filter" and "Clear all". The buttons give the instruction, so the line can just observe.
- **Length.** One sentence, two at most, within 60ch, and the RU line must fit at 390px.
- **Target.** Any subject in the data is fair game: airlines, makers, the home airport, red-eyes, frequency, habits. Aim at the itinerary, meaning the numbers, the machines, the timetable and the habit. Leave the reasons for a trip to the user: a flight to a funeral is in the data too.

## Voice

**EN: deadpan.** Short declaratives that are technically true and slightly too honest. Use backhanded encouragement and understatement, with closers like "Noted." Write dry, not dramatic: the joke is in the observation, not in exclamation marks or puns. "For science" is a rare spice; use it once per screen at most.

**RU: protocol.** A dry bureaucratic register, used deliberately as the joke: «зафиксировано», «принято к сведению», «замечаний нет», passive constructions and the language of reports and commissions. Address the user as lowercase «вы», never «ты». Write the RU line natively from the same fact. The joke may differ from the EN line, but the fact may not.

## Numbers, plurals and names

Params are filled with `formatNumber`, which groups digits (`14,535` / `14 535`). No plural agreement happens at fill time.

- **Years and times are string params.** `formatNumber` turns 2021 into `2,021` and `2 021`.
- **Plural-safe RU.** Put a number before a counted noun only when the noun is a unit abbreviation (`км`, `ч`, `мин`, `мес.`, `%`). Otherwise use the label form («Перелётов: {n}», «{have} из {need}»), or have the trigger pass a pre-pluralised string built with `formatCount` from `apps/next/src/lib/format.ts`.
- **Plural-safe EN.** "{n} flights" is safe only when the trigger's condition guarantees n ≥ 2. Otherwise use the label form ("Flights: {n}").
- **RU names stay in the nominative.** Cyrillic city, airport and airline params are nominative, so place them as the subject or after a colon or dash («Окленд: {hours} ч в пути»), never after a preposition that needs another case. Latin-script names (Airbus, Boeing, Qatar Airways) do not decline and can go anywhere.

## Output format

- **Sober:** one EN line and one RU line.
- **Witty, outside the narrator:** a **Normal** and a **Sarcastic** variant, each in EN and RU.
- **Narrator:** one row per trigger (id, slot, condition, params), then three EN and three RU lines. This matches the Task 12 review sheet `.scratch/overview-redesign/narrator-corpus.md`.

```
**Normal:**  No upcoming flights. / Предстоящих перелётов нет.
**Sarcastic:** Nothing booked. The suitcase is starting to worry. / Ничего не забронировано. Чемодан начинает волноваться.
```

```
**Sober:** Couldn't save the flight. Check your connection and try again. / Не удалось сохранить перелёт. Проверьте подключение и попробуйте ещё раз.
```
