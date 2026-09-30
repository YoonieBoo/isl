# SmartDiscovery + ISL — Presentation Deck Notes

The deck (10 slides) visually restates the Conceptual Overview. Content below captures what's distinct or adds visual/design direction not already in `conceptual-overview.md` and `requirement-specifications.md`.

## Visual identity (from deck + logo)
- Logo: lowercase "isl." wordmark in ISL blue (a strong, saturated blue), with a small dot accent — matches "ISL blue" called out in the requirement spec's visual direction.
- Slide backgrounds: white/very light, blue accent icons in circular/rounded-square outline badges, thin blue connecting arrows between stage icons, generous whitespace, rounded cards with subtle borders.
- Tagline used repeatedly: "Structured · Reviewable · Traceable · Usable"

## Slide 1 — Title
"Transform learner data and learning evidence into structured, reviewable, traceable, and usable learner intelligence."
Flow diagram: Learner Data + Learning Evidence → SmartDiscovery + ISL (AI-Powered Processing & Intelligence: Classification, Pattern Detection, Correlation, Summarization) → Learner Insight (actionable insights on performance, strengths, growth, needs) → Learner Profile & Portfolio (comprehensive, traceable record of learning and achievement).

## Slide 2 — The Learner Intelligence Gap
Same 5 problems as Conceptual Overview §2, visualized around a learner icon connected (with X marks, i.e. broken links) to: Reflection, Assignment, Workshop, Assessment, Project, Feedback.
Framing line: "The problem is not collecting more learner data. The problem is turning learner evidence into reliable intelligence."

## Slide 3 — AI Alone Is Not the Answer (not stated as explicitly elsewhere — useful framing for building)
Left column "AI Processing Only" (failure mode) vs right column "Operational Learner Intelligence" (target state):
- Over-interpretation → Learning context (understand learner, goals, history, environment)
- Premature learner labels → AI-assisted processing (analyze data to surface insights and patterns)
- Inconsistent outputs → Human review (expert judgment validates, interprets, decides)
- Weak evidence grounding → Evidence traceability (link every insight to source data and rationale)
- Limited learning context → Persistent workflow (structured steps from intake to action/follow-up)
- (implicit) → Learning from correction (capture feedback to improve future accuracy)

Bottom line: "Reliable learner intelligence requires AI + Context + Human Review + Evidence + Workflow." — good one-line design checklist to keep visible while building.

## Slide 7 — From Insight to Learner Profile & Portfolio (concrete UI example — useful as a design reference)
Shows a sample Learner Profile card:
- Photo, name ("Ava Chen"), Learner ID ("LRN-10245"), status badge ("Active")
- List: Strengths, Development Focus, Learning Preferences, Experiences, Approved Insights, Update History
- Linked "Portfolio & Evidence" card below: Projects, Assignments, Workshop Artifacts, Reflections, Presentations, Achievements
Pipeline shown: Learning Activity → Evidence → Learner Insight → Human Approval → (feeds into) Learner Profile
Caption: "Learners keep their insight and evidence. Their profile grows as they learn."
This is a reasonable visual reference for the Learner Profile screen (§12.12 of the requirement spec) — a profile header card + linked evidence/portfolio panel below it.

## Slides 4, 5, 6, 8, 9, 10
Restate content already captured in `conceptual-overview.md` (Core Solution, Insight-First Strategy, How ISL Works / Input-Confirm-Run-Output-Review-Export, SmartDiscovery Research Framework A/B/C, Proving the Model in Real Learning Environments, Future Direction Q3/2026–Q1/2027). No new build-relevant details beyond what's already recorded.

## Note on the ISL logo file
The logo was shared as an inline image in chat, not as a file — I can't extract it to a binary asset from the conversation. If you want the exact logo file used in the app (e.g. as `public/logo.svg` or `.png`), please drop the actual image file into `references/` or `public/` and point me to it; otherwise I'll recreate the wordmark in CSS/SVG using the blue palette described above.
