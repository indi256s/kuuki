# Manual air visits

User authority: 10 November 2026, “давай сделаем еще прилет самолетом с вызовом наших элементов по добавлению полета опционально”. Local implementation and checks only; no production migration or deploy.

Use the existing Interface Design contract, sober EN/RU copy, and existing flight capture. A manual visit by plane does not invent an airport, date, route or canonical flight and stays a Manual source until a real flight contributes evidence.

| Interaction | Observable result |
| --- | --- |
| Pick By plane / Самолётом on a lifted country | Existing tear records `entryMethod='air'`, `mode=null`; stamp, year and Undo work as before. |
| Save or edit a country-sheet visit | The same air choice persists and reads as by plane / самолётом. |
| Recorded air-visit toast or saved unlinked air row | Add flight / Добавить перелёт is optional and opens `/add?passportVisit=<id>` using the existing form. No automatic redirect. |
| Close or cancel flight capture | Return to the originating Passport view; manual evidence remains. |
| Reload or retry contextual capture | Draft and receipt stay scoped to the visit; the stored payload pins `passport_visit_id`. Other unfinished flights stay intact. |
| Save a flight for this air visit | Owner, method and destination country are validated; linking is in the canonical create transaction and idempotency digest. |
| Linked flight contributes a logged arrival in this country | Count the arrival once; retain the manual row's year and note. |
| Linked flight is removed, rerouted, upcoming or marked transit | Original manual evidence remains active. Other owners' rows are never linked. |

Storage: additive `0019_manual_air_visits.sql` preserves every existing visit and adds nullable `linked_flight_id` with `ON DELETE SET NULL`. Flights-only publication and aviation statistics continue to require canonical flight evidence.

Checks: migration preservation/constraints; manual API create/edit/read and rejected air+rail; atomic flight linking, receipt replay and owner guards; active/superseded evidence; atlas and country-sheet air interaction; capture draft/receipt context; affected unit suites, lint/typechecks, build and required navigation suite. Existing welcome “I'll do this later” flake is recorded in `.scratch/flaky-welcome-later/issue.md`.
