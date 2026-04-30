# Appendix — Sea Page Narrative Examples

This appendix shows how the ClimaLens Narrative System applies specifically to the **Sea** page.
It provides concrete, testable examples without introducing page-specific narrative rules.

The Sea page focuses on **contextualising ocean conditions relative to historical norms**, with minimal explanatory text.

---

## Data Elements Referenced

Narrative logic on the Sea page may reference:

- Sea Surface Temperature (SST)
- Historical seasonal average
- Expected historical range (variance band)
- Duration of deviation
- Spatial comparison (nearby regions / broader area)

Narrative attaches only to **SST and its relationship to historical context**.

---

## Scenario 1 — SST within Expected Range

### Data state
- Current SST falls within the historical expected range
- No meaningful deviation detected

### Active triggers
- None

### Narrative output
_No narrative displayed_

### Rationale
Normal conditions require no annotation.
Neutrality is a valid and important state.

---

## Scenario 2 — SST Outside Expected Range (Short-lived)

### Data state
- Current SST is above the expected historical range
- Deviation duration below persistence threshold

### Active triggers
- Trigger A — Deviation from expected range

### Narrative output
> “Sea surface temperature here is above the expected historical range for this time of year.”

### Rationale
Anchors intuition without implying trend or cause.

---

## Scenario 3 — SST Outside Expected Range (Persistent)

### Data state
- SST is above expected range
- Deviation persists for several weeks

### Active triggers
- Trigger A — Deviation
- Trigger B — Persistence

### Narrative output
> “Sea surface temperature here is above the expected historical range for this time of year.”  
> “Conditions like this have persisted for several weeks.”

### Optional expansion
> “Why might this happen?”

Expanded text:
> “Ocean circulation and seasonal patterns can produce sustained regional differences over short periods.”

### Rationale
Distinguishes signal from noise while keeping mechanisms optional.

---

## Scenario 4 — SST Anomalous but Spatially Uneven

### Data state
- Local SST significantly above expected range
- Nearby regions closer to historical norms

### Active triggers
- Trigger A — Deviation
- Trigger C — Spatial divergence

### Narrative output
> “Sea surface temperature here is above the expected historical range for this time of year.”  
> “Nearby regions show smaller deviations from their historical ranges.”

### Rationale
Prevents overgeneralisation from local data.

---

## Scenario 5 — Counter‑intuitive Pattern (User‑Initiated)

### Data state
- Local SST below expected range during a period of broader warming
- Pattern likely to feel contradictory to non‑experts

### Active triggers
- Trigger A — Deviation
- Trigger D — Counter‑intuitive pattern (gated)

### Visible narrative
> “Sea surface temperature here is below the expected historical range for this time of year.”

### Expandable affordance
> “Why might this happen?”

Expanded text:
> “Short-term regional cooling can occur due to ocean circulation and seasonal effects, even as long-term ocean temperatures rise.”

### Rationale
Addresses confusion without foregrounding explanation.

---

## Narrative Suppression Rules (Sea Page)

Narrative is intentionally suppressed when:
- SST lies within historical norms
- Deviations are minimal and short-lived
- Visual context alone is sufficient to prevent misreading

The Sea page should remain **quiet by default**.

---

## Visual–Narrative Alignment

For these examples to work as intended:

- Historical expected ranges must be visually encoded
- Current SST must be clearly distinguishable
- Colour scales should represent deviation, not absolute temperature

Narrative assumes visuals do most of the explanatory work.

---

## Appendix Sanity Check

The Sea page narrative succeeds when:
- Most users see zero or one sentence
- Curious users can expand for context
- Experts feel unimpeded
- No section reads like a lesson

This appendix is illustrative, not prescriptive, and should evolve alongside the data model.
