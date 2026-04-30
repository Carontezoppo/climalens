# ClimaLens Narrative System

This document defines the narrative logic used across ClimaLens.
Its purpose is to prevent misinterpretation of climate data while avoiding information overload.

---

## Core Principle

Narrative exists to **prevent misinterpretation**, not to explain data exhaustively.

If a reasonable user could interpret the data correctly without text, **no narrative should appear**.

---

## Narrative Scope

### ClimaLens WILL:
- Compare current conditions to historical baselines
- Surface anomalies, persistence, and spatial contrasts
- Indicate counter-intuitive patterns when needed
- Remain descriptive and analytical

### ClimaLens WILL NOT:
- Argue, persuade, or moralise
- Predict future impacts
- Teach climate science fundamentals
- Attribute causality unless unavoidable

---

## Universal Narrative Triggers

All narrative elements are triggered by **data state**, not by page type.

### Trigger A — Deviation from Expected Range
**Question answered:** Is this normal?

**Fires when:**
- The current value lies outside the historical expected range for the selected date.

**Narrative role:**
- Anchor intuition through baseline comparison.

**Template:**
> “This value is above / below / within the expected historical range for this time of year.”

---

### Trigger B — Persistence
**Question answered:** Is this a blip or a pattern?

**Fires when:**
- A deviation persists beyond a defined temporal threshold.

**Narrative role:**
- Distinguish noise from signal.

**Template:**
> “Conditions like this have persisted for [duration].”

---

### Trigger C — Spatial Divergence
**Question answered:** Can this be generalised?

**Fires when:**
- Local deviation differs meaningfully from nearby or regional patterns.

**Narrative role:**
- Prevent false generalisation.

**Template:**
> “Nearby regions show different patterns relative to their historical ranges.”

---

### Trigger D — Counter-intuitive Pattern
**Question answered:** Why does this feel contradictory?

**Fires when:**
- Known patterns likely to be misread by non-experts are detected.

**Rules:**
- Never auto-displayed
- User-initiated only

**Template:**
> “Short-term or regional variations can occur even as long-term trends move in the opposite direction.”

---

## Narrative Priority Rules

Maximum visible at once:
- Two sentences
- One optional expansion

Priority order:
1. Deviation (A)
2. Persistence (B)
3. Spatial divergence (C)
4. Mechanism (D, gated)

Lower-priority triggers are hidden when space is constrained.

---

## Placement Rules

Narrative should:
- Sit adjacent to the data it interprets
- Appear inline with charts, maps, or headline metrics
- Never appear as a global banner or modal by default

Narrative should feel like **annotation**, not explanation.

---

## Tone and Language Guidelines

### Use:
- Above / below / within
- Relative to historical average
- Over the past [duration]
- Compared to nearby regions

### Avoid:
- Emotional language
- Predictive claims
- Moral framing
- “Caused by” statements

---

## Visual–Narrative Contract

Narrative assumes that visuals:
- Clearly encode historical ranges
- Visually distinguish anomalies
- Make time and variance legible

If visuals fail to do this, either improve them or compensate with narrative — never both.

---

## Sanity Check

Before adding any narrative element, ask:

“If this sentence were removed, would a user likely draw the wrong conclusion?”

If the answer is **no**, the narrative should not be present.
