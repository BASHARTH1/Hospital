# AI Staff Roster Manager (Angular)

An Angular 22 port of the React/Vite `ai-staff-roster-manager` app — intelligent duty
scheduling for 3-shift hospital operations.

## Running

```bash
npm install
npm start          # http://localhost:4200
npm run build      # production bundle in dist/hospital-roster
```

## Generating a roster

The **Generate** tab offers two engines:

### Local rule engine (default, no API key)

`src/app/services/roster-scheduler.ts` builds the month entirely in the browser. It walks
day by day, filling each shift to its weekday / weekend / holiday minimum with the
least-loaded eligible person, and enforces:

- every pre-existing assignment as an immovable anchor (leave, requested shifts, on-call),
  including a look-ahead so a generated night never drags a fixed duty into a recovery window
- minimum seniors and maximum males per regular shift (HA staff are exempt, as designed)
- per-person monthly `maxMorning` / `maxEvening` / `maxNight` caps
- recovery days after a night series, and never night → morning
- maximum consecutive evening, night, and total duty days
- load spread in proportion to each person's own capacity

Regular and HA staff are scheduled as separate pools against their own `ha*` limits, and
the previous month's tail is replayed so recovery periods carry across the boundary.

Where a rule cannot be satisfied the engine **leaves the slot empty and reports it**
rather than quietly breaking the constraint; the Generate tab then shows which shifts fell
short and by how much, and stays put so the report is read.

### Gemini AI (optional)

Sends the staff list and rules to `gemini-3-pro-preview`. Supply a key either way:

- **Build time** — set `geminiApiKey` in `src/environments/environment.ts`.
- **Runtime** — in the browser console:
  `localStorage.setItem('GEMINI_API_KEY', '<your key>')`, then reload. This wins over
  the build-time value and keeps the key out of source control.

Without a key, only this engine is unavailable — the local engine and every other tab
work offline.

## Architecture

| Concern | Location |
| --- | --- |
| Domain types, `ShiftType` enum, HA/date helpers | `src/app/models/types.ts` |
| Months, years, per-theme shift palettes | `src/app/constants.ts` |
| App state (staff, config, assignments, theme, tab) | `src/app/services/roster-store.ts` |
| Local rule-based scheduler | `src/app/services/roster-scheduler.ts` |
| Gemini roster generation (optional) | `src/app/services/gemini.service.ts` |
| Feature components | `src/app/components/` |
| Icons, editable-ID field, dynamic `<style>` helper | `src/app/ui/` |

State lives in a single `RosterStore` (`providedIn: 'root'`) built on signals — the
Angular equivalent of the `useState` cluster in the original `App.tsx`. Components are
standalone, `OnPush`, and use signal `input()`/`output()`. The app runs **zoneless**.

`resolvedAssignments` is a computed signal that layers counterpart (mirrored) duties on
top of the real assignments — exactly what the React `useMemo` did.

## Notable porting decisions

- **Tailwind is compiled at build time** (v3.4, matching what the original loaded from the
  Play CDN) rather than pulled from `cdn.tailwindcss.com`. `tailwind.config.js` scans
  `src/**/*.{html,ts}` — the theme maps (`THEME_SHIFT_STYLES`, the per-view `THEME_CONFIGS`,
  the class helpers on each component) are plain string literals, so the extractor finds
  them without a safelist. It does apply one `transform`, to unwrap Angular's
  `[class.bg-rose-950/30]="expr"` bindings, which the default extractor would otherwise
  read as a single unusable token.
- **`lucide-react` was dropped.** `src/app/ui/icon.ts` renders the same 17 glyphs as
  inline SVG, so there is no icon dependency.
- **`motion` was dropped** — the original imported it in `StaffCardsView` but never used it.
- **Per-view print CSS** (`<style dangerouslySetInnerHTML>` in React) is injected into
  `document.head` by `src/app/ui/dynamic-style.ts` and removed on component destroy.
- **Bug fixed during the port:** in the React `DailyAssignmentsPrintView`, the computed
  `pagingRule` was never interpolated into the returned CSS, so the "Days per Page"
  selector did nothing. It is now applied.
- **`<select>` bindings** use `[selected]` on each `<option>` rather than `[value]` on the
  `<select>`, which is unreliable when options come from `@for`.

## Data notes

- Weekends are **Friday and Saturday** throughout (matching the original).
- Staff whose name starts with `HA` or `(HA)` are auxiliary staff: exempt from seniority
  and gender rules, governed by the separate `ha*` config values, and sorted to the bottom
  of printed daily sheets.
- Counterpart staff mirror a primary member's duties, optionally within a day range, and
  their cells are read-only in the grid.
- The Daily Sheet's free-text agenda notes and the print font colours persist in
  `localStorage`; all other state is in-memory for the session.
