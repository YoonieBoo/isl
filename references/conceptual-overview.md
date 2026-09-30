# SmartDiscovery + ISL — Learner Intelligence Platform — Conceptual Overview v1

## 1. Concept Overview

SmartDiscovery + ISL transforms learner data, learning activities, and learning evidence into structured, reviewable, traceable, and usable learner intelligence that supports teaching, learning design, and learner development.

Two connected layers:
- **ISL** — workflow/platform layer: managing learner data, processing workflows, learner insight, human review, evidence traceability, persistent learner profiles.
- **SmartDiscovery** — AI research/intelligence layer: developing and validating learner signal extraction, pattern detection, learner insight generation, learning from human validation.

**Core idea**: SmartDiscovery + ISL turns learner data into structured, reviewable, traceable, and usable learner intelligence through a repeatable operational workflow.

Current development cycle objective is NOT the full ISL ecosystem blueprint. Current priorities:
1. Make the Learner Insight Platform operational.
2. Make SmartDiscovery capable of producing reviewable and evidence-backed learner intelligence.
3. Provide a minimal Learner Profile & Portfolio capability so learner insight and learning evidence can accumulate over time.
4. Validate the system through real learning environments.

## 2. The Learner Intelligence Problem

Learning environments generate significant learner data, but it's fragmented and rarely transformed into consistent learner intelligence. Common problems:
- learner responses/reflections/assignments/workshop outputs distributed across sources
- interpretation depends heavily on individual instructors
- patterns and progression across activities are difficult to track
- insights are difficult to trace back to supporting evidence
- AI can over-interpret limited evidence or create premature learner labels
- learner insight often ends as a report rather than becoming part of an ongoing learner record
- learners lack a persistent place where evidence, insight, and portfolio accumulate

**Real gap**: Learning environments lack an operational workflow that can consistently transform learner data into evidence-backed, reviewable, and reusable learner intelligence.

## 3. Core Solution

SmartDiscovery + ISL separates AI intelligence from the operational platform while allowing both layers to work together.

**SmartDiscovery** (AI Research/Intelligence Layer) — develops/validates methods for transforming learner data into signals, patterns, insight. Capabilities: learner signal extraction, evidence-backed tagging, learner context interpretation, strength/need/concern detection, learning preference detection, pattern detection, cohort-level pattern intelligence, insight structuring, interpretation boundaries, error-pattern identification, human-review logic, quality benchmarking. SmartDiscovery is NOT the platform — its role is to answer which AI methods work, how they should be used, with which data, where human review is required.

**ISL** (Learner Intelligence Platform) operationalises SmartDiscovery and the learner insight workflow.
- A. Learner Insight Platform (Primary Focus): receive/validate datasets, define context, run SmartDiscovery/supported AI, display structured insight, support human review, preserve evidence traceability, store approved insight, export/reuse.
- B. Learner Profile & Portfolio (Minimal Ecosystem Layer): persistent learner profile, approved insights, learning experiences/history, selected strengths/development areas, portfolio artifacts, project/workshop evidence, selected achievements, learner-facing profile.

## 4. Insight-First Platform Strategy

Prioritise Learner Insight Platform first. Core workflow: `Input → Confirm → Run → Output → Review → Export`
- **Input**: create/select learning environment, upload/select learner dataset, identify learner ID, identify relevant fields, validate structure/completeness.
- **Confirm**: define learning context, activity/course context, taxonomy/interpretation guidance, confirm dataset readiness.
- **Run**: execute SmartDiscovery processing, support external AI where needed, track processing status, preserve processing configuration.
- **Output**: display structured learner-level output, display signals/patterns/supporting evidence, preserve source linkage.
- **Review**: educator/reviewer can agree/revise/reject/request rerun; preserve original AI output + corrected output; capture review decision/comments.
- **Export**: export approved structured output, reuse insight in teaching/learner support/downstream analysis.

## 5. Learner Profile & Portfolio Layer

Minimum ecosystem capability required — not the full learner ecosystem. Purpose: ensure learner intelligence accumulates and becomes valuable to the learner over time.
Minimum profile: learner identity, learning environment/course participation, approved learner insight, strengths, development focus, learning preferences, selected evidence, portfolio artifacts, projects/workshops, selected achievements, update history.
Portfolio evidence: project outputs, workshop artifacts, assignments, reflection evidence, prototypes, presentations, selected achievements.

**Core principle**: Learner insight should not disappear after analysis. It should accumulate into a persistent learner profile backed by evidence.

## 6. Persistent Operational Platform

ISL must be an operational platform, not a browser prototype/mockup. Core system data must be stored through a persistent backend/database. Browser localStorage/sessionStorage may only be used for temporary UI state and must not be the system of record.
Must persist: learners, learner profiles, learner portfolio records, learning environments, datasets, dataset records, processing runs, SmartDiscovery outputs, human review decisions, corrected outputs, approved learner insights, supporting evidence, activity timestamps. Data must remain available after page refresh, browser close, later return, session change.

## 7. SmartDiscovery Research Framework (3 modules)

- **Module A — Learner Signal Processing & Extraction**: produce reliable record-level learner signals (learner response processing, evidence-backed signal extraction, normalized learner tags, strength/need/concern separation, learning preference, context-aware interpretation, noise reduction, evidence grounding). Output: Structured learner signals.
- **Module B — Pattern Detection & Learner Intelligence**: transform signals into higher-level intelligence (learner patterns, cohort patterns, emerging strengths, development focus, learner dynamics, comparative patterns, pattern stability, interpretation boundaries). Output: Learner patterns and structured learner insight.
- **Module C — Insight Validation & Learning Evaluation**: determine whether learner intelligence is reliable enough for real use (educator review, human review, output comparison, error categorisation, false positive/negative, interpretation safety, quality benchmarks, reviewer agreement, human-review boundaries, usage guidelines). Output: Validated methods, limitations, reusable learning.

## 8. Integrated Workflow

`Learning Environment → Dataset Intake → Processing Context → SmartDiscovery Processing → Structured Learner Insight → Human Review → Approved Insight → Learner Profile → Portfolio/Evidence → Learning Use`

| Step | ISL Role | SmartDiscovery Role |
|---|---|---|
| Learning Environment | Store course/workshop context | — |
| Dataset Intake | Upload, validate, persist learner data | — |
| Processing Context | Store learning context and guidance | Use context for interpretation |
| Processing | Manage run and status | Extract signals and patterns |
| Structured Output | Store and display output | Generate learner intelligence |
| Human Review | Capture agree/revise/reject | Provide candidate insight |
| Approved Insight | Store validated learner insight | Learn from corrections |
| Learner Profile | Accumulate approved insight | — |
| Portfolio | Link learner evidence and artifacts | — |
| Learning Use | Support teaching and learner development | Support interpretation |

## 9. AI Assistance Architecture

ISL should not depend on a single AI provider. May use: SmartDiscovery integrated capability, external AI systems, other supported AI tools, human analysis, test/mock processing. Provenance must always be clear — platform distinguishes SmartDiscovery output / External AI output / Human-corrected output / Human-approved learner insight. External AI may help validate the operational workflow, but doesn't prove the capability is integrated into SmartDiscovery.

## 10. Primary Validation Environment

Validation should prove three levels:
1. **Processing Works** — real learner data enters the workflow, produces structured learner output.
2. **Workflow Is Operational** — processing/review/persistence/evidence/delivery can be repeated.
3. **Learner Intelligence Creates Learning Value** (most important) — insight helps educators/learners understand strengths, development needs, learning patterns, support needs, progression, appropriate next actions, and supports real learning design/learner-development decisions.

Platform existence alone does not equal validation.

## 11. What Must Be Validated

Data Intake, Signal Processing, Insight Quality, Human Review, Pattern Intelligence, Traceability, Workflow, Profile Persistence, Portfolio Value, Educator Usability, Reusable Practice.
**Core validation rule: No evidence, no validation.**

## 12. Minimum Viable Operational Platform

Must Work: learner profile creation, learning environment/course creation, dataset upload, persistent backend/database storage, dataset validation, processing context, processing run, processing status, structured learner insight storage, learner insight display, human review, correction/approval, evidence traceability, processing history, learner profile persistence, basic portfolio artifacts, export.

Should Work: basic cohort pattern view, learner insight history, review history, portfolio evidence view, basic learner-facing profile, simple learning environment overview.

Can Remain Manual/External: advanced pattern detection, automatic intervention recommendation, advanced progression modelling, cross-course analytics, complex dashboards, trainer ecosystem, workshop marketplace, community features, social networking, complex roles/permissions, full learner ecosystem governance.

## 13. Value Created

**For Educators/Learning Designers**: understand learner signals faster, identify strengths/development needs more clearly, review evidence before using insight, use insight to support facilitation/learning design, track learner development over time.

**For Learners**: maintain persistent profile, understand strengths/development areas, accumulate portfolio/evidence, see learning history/development journey, gain a reason to remain engaged with the ecosystem.

**For Peanuts Academy**: establish repeatable Learner Intelligence workflow, reduce dependency on ad hoc learner analysis, understand AI capability/limitations more clearly, build reusable learner-insight practices, create a foundation for the future learner ecosystem.

## 14. Current Development Principle

**Build from real learning workflow demand, not imagined platform completeness.**
This means: build only what real validation requires, allow manual workflow where automation isn't yet necessary, use external AI where it accelerates validation, preserve evidence and human correction, treat learner insight as candidate output until reviewed, expand ISL only when real usage demonstrates the need, keep ecosystem scope limited to learner profile and portfolio.

Objective: build a working operational learner intelligence platform that supports real learner insight delivery and generates evidence for the next development cycle — not the full ISL Ecosystem Platform immediately.

## 15. Future Direction

| Period | Focus |
|---|---|
| Q3/2026 | Operationalise and validate SmartDiscovery + ISL through the primary validation environment; establish operational Learner Insight Platform and minimum Learner Profile/Portfolio |
| Q4/2026 | Standardise validated processing, review, learner insight, profile, and portfolio practices |
| Q1/2027 | Expand learner intelligence functions and selected ecosystem capabilities based on validated demand |

Long-term: ISL becomes a Learner Intelligence Platform that continuously accumulates learner evidence, insight, profiles, portfolios, eventually connecting learner development with learning opportunities across the ecosystem.

## 16. One-Line Summary

SmartDiscovery + ISL turns learner data and learning evidence into structured, reviewable, traceable, and usable learner intelligence through an operational platform that preserves learner profiles and portfolios over time.
