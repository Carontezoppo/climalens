# Appendix — Weather Page Narrative Examples

This appendix applies the ClimaLens Narrative System to the **Weather** page.
The Weather page is both a **hook** and a **standalone experience**, so narrative must be especially restrained.

Its role is to help users interpret *today’s conditions* without encouraging climate conclusions based on short-term weather alone.

---

## Narrative Role of the Weather Page

The Weather page should:
- Feel immediately familiar and useful
- Ground current conditions in historical context
- Encourage exploration without forcing it

It should **not**:
- Explain climate change
- Compete with dedicated forecast apps
- Draw long-term conclusions by default

---

## Data Elements Referenced

Narrative logic on the Weather page may reference:

- Current temperature
- Short-term forecast (e.g. 7 days)
- Historical seasonal average
- Expected historical range
- Duration of deviation (days, not weeks)
- Broader regional comparison (optional)

Narrative attaches primarily to **current temperature**.

---

## Scenario 1 — Typical Conditions

### Data state
- Current temperature lies within expected historical range
- No meaningful deviation detected

### Active triggers
- None

### Narrative output
_No narrative displayed_

### Rationale
The Weather page must feel calm and trustworthy.
Normal weather should not be annotated.

---

## Scenario 2 — Temperature Outside Expected Range (Today)

### Data state
- Current temperature above or below expected historical range
- Deviation detected only for the current day

### Active triggers
- Trigger A — Deviation from expected range

### Narrative output
> “Today’s temperature is above / below the expected historical range for this time of year.”

### Rationale
Anchors intuition without implying trend or cause.
This is the most common Weather-page narrative state.

---

## Scenario 3 — Short-term Persistence

### Data state
- Temperature remains outside expected range for several consecutive days
- Duration remains short (days, not weeks)

### Active triggers
- Trigger A — Deviation
- Trigger B — Persistence (short threshold)

### Narrative output
> “Today’s temperature is above / below the expected historical range for this time of year.”  
> “Conditions like this have persisted for several days.”

### Rationale
Acknowledges pattern without overstating significance.

---

## Scenario 4 — Local Weather vs Broader Context

### Data state
- Local temperature deviates from expected range
- Broader regional or global indicators differ

### Active triggers
- Trigger A — Deviation
- Trigger C — Spatial divergence

### Narrative output
> “Today’s temperature here differs from historical norms.”  
> “Broader regional patterns show smaller deviations.”

### Rationale
Prevents users from extrapolating climate conclusions from local weather.

---

## Scenario 5 — Counter-intuitive Cold or Heat Event (Gated)

### Data state
- Local conditions contradict common expectations
  - e.g. cold snap during a generally warm period

### Active triggers
- Trigger A — Deviation
- Trigger D — Counter-intuitive pattern (user-initiated)

### Visible narrative
> “Today’s temperature is below / above the expected historical range for this time of year.”

### Expandable affordance
> “Why does this not contradict long-term warming?”

Expanded text:
> “Short-term weather events can vary significantly from long-term climate trends, which are measured over decades.”

### Rationale
Directly addresses a common misconception, but only on demand.

---

## Narrative Suppression Rules (Weather Page)

Narrative is intentionally suppressed when:
- Conditions are within expected range
- Deviations are minor and short-lived
- Visual cues alone are sufficient

The Weather page should feel **useful first, educational second**.

---

## Visual–Narrative Alignment

To keep narrative minimal:
- Expected ranges should be visually encoded
- Current temperature should be clearly highlighted
- Forecast charts should distinguish variability from anomaly

Narrative should never compensate for unclear visuals.

---

## Appendix Sanity Check

The Weather page narrative works when:
- Most visits show no text
- One-sentence annotations feel helpful, not preachy
- Users are gently encouraged to explore other sections
- The page stands on its own without miseducating

This appendix balances immediacy with restraint, reflecting the Weather page’s dual role as entry point and reference.
