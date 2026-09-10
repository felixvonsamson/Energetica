# Workshop Mode UI prototype

Throwaway UI mockup for issue [#992](https://github.com/felixvonsamson/Energetica/issues/992)
(Workshop Mode — implementation spec), built on the `prototype/workshop-mode-ui-992`
branch. Not wired to any backend — every number is invented sample data. See
`frontend/src/lib/workshop-prototype/sample-data.ts`.

Question this answers: what should Workshop Mode's player-facing screens and
persistent chrome (§12 of the spec) actually look like, in the app's existing
visual language? The spec is prescriptive enough about layout and behavior
that this isn't a "pick between three directions" exploration — it's a single
build of the described design, so it can be looked at instead of imagined.

## Pages

- `/app/prototype/workshop` — index, links to everything below.
- `/app/prototype/workshop/investment` — facility catalog, current fleet,
  fuel purchase, active vote (user stories #26–47).
- `/app/prototype/workshop/trading-period` — power-generation chart, a
  scrubber through the day's settlement points, the merit-order chart for
  whichever point the scrubber is on, and a separate "My prices" tab
  (#48–53). Open the price-setting panel from the top bar to see it push
  the layout rather than overlay it (spec §12).
- `/app/prototype/workshop/recap` — round-transition recap: event
  headlines, tech unlocks, demand shifts (#54–59).
- `/app/prototype/workshop/round` — bonus, not one of the requested
  screenshots: round overview (season revenue strip + facility performance
  table), built so the timeline's "Round N" label has somewhere to link to.

Global chrome (`components/workshop-prototype/chrome.tsx`) — the top bar,
the Round → 4 seasons → recap timeline, the phase countdown, and the
collapsible price-setting panel — is shared across all of them, per spec §12.

## Run it

```
cd frontend && bun run dev:app
```

Then open `http://localhost:5173/app/prototype/workshop`. No login needed —
these routes are public (`requiredRole: null`) since they don't touch real
game state.

## Verdict

Not yet decided — this branch exists for Felix to look at. Capture the
outcome here (or on the issue) once he has: which screens are worth folding
into a real build, and what — if anything — needs to change in the spec
because seeing it revealed something planning-on-paper didn't.
