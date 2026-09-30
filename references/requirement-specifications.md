# SmartDiscovery + ISL — Requirement Specifications for Claude Code
Operational MVP — Working Draft v1
Prepared for Claude Code MVP Development — Peanuts Academy / Praram Nine Technology — 16 August 2026

> This is the authoritative build spec. Check every implementation decision against this document.

## CORE BUILD PRINCIPLE (NON-NEGOTIABLE)

**The MVP is operational only when the end-to-end learner intelligence workflow uses persistent backend / database storage.**

Browser `localStorage`, `sessionStorage`, temporary JSON files, or in-memory data structures are **not acceptable** as the system of record.

The platform must persist: learner data, processing runs, outputs, reviews, approved learner insights, learner profiles, portfolio records, and evidence.

## Document Control
- Primary focus: ISL Learner Insight Platform
- Supporting scope: Minimum Learner Profile & Portfolio ecosystem capability
- AI layer: SmartDiscovery — Learner Intelligence Engine
- Validation principle: Build from real learning workflow demand; no evidence, no validation

## 1. Product Objective

Build a lightweight but operational web app called **ISL — Learner Intelligence Platform**.

Transforms learner data and learning evidence into: structured learner signals, learner patterns, reviewable learner insight, approved learner intelligence, persistent learner profiles, evidence-backed learner portfolios.

Two connected layers:
- **ISL** (Workflow / Platform Layer): learner data intake, processing workflow, persistent storage, review and approval, evidence traceability, learner profiles, portfolios, insight delivery.
- **SmartDiscovery** (AI Research / Intelligence Layer): learner signal extraction, pattern detection, insight structuring, interpretation controls, quality learning, learning from human corrections.

## 2. Product Principles

1. **Insight First** — prioritise workflow to produce/review/approve/store/reuse learner insight, not broad ecosystem functionality.
2. **Operational Before Comprehensive** — MVP doesn't need every future feature, but must work end-to-end with persisted data.
3. **Human Review Is Required** — SmartDiscovery output is candidate learner intelligence until reviewed. Preserve distinction between AI-generated output, human-corrected output, human-approved learner insight.
4. **Evidence Must Be Traceable** — system must answer "why did the system produce this learner insight?"
5. **Avoid Premature Learner Labels** — prefer "observed signal," "emerging pattern," "current evidence suggests," "needs further evidence." Avoid unsupported claims about personality, intelligence, mental health, permanent ability, fixed learner type.
6. **Persistent Learner Value** — approved learner intelligence accumulates into learner profile and portfolio over time, doesn't disappear after analysis.
7. **Build From Real Workflow Demand** — no speculative platform functionality.

## 3. Core Workflow

`Input → Confirm → Run → Output → Review → Export`

Approved output may additionally flow into: `Approved Insight → Learner Profile → Portfolio / Evidence`

## 4. MVP Scope — Must Work

### 4.1 Learning Environment Management
CRUD + archive. Fields: environment ID, name, organisation/institution, course/workshop name, environment type, description, learning objectives, instructor/owner, status.
Examples: university course, professional upskilling program, developmental exploration workshop.

### 4.2 Learner Management
Create/import/edit/view/archive. Fields: learner ID, display name, external learner reference, email (where appropriate), learning environments, profile status, created/updated date. Sensitive fields should be minimised.

### 4.3 Dataset Management
Upload CSV/XLSX, persist original dataset, associate with learning environment, map to learner IDs, view uploaded datasets, validate structure, preserve source metadata.
Must detect: missing learner IDs, duplicate IDs, empty records, required fields, inconsistent column structures, unusable rows.

### 4.4 Processing Context
Before processing, define: learning objective, course/activity context, learner population, activity type, interpretation focus, signal categories, taxonomy guidance, processing notes, fields to use as evidence. Full context stored with the Processing Run.

### 4.5 Processing Runs
Create run, associate with environment + dataset, store processing context + configuration, start, monitor, store output, preserve history.
Statuses: Draft, Queued, Running, Completed, Completed with Warning, Failed, Cancelled.

## 5. SmartDiscovery — Minimum AI Engine

Modular processing capability. First version doesn't need to solve all learner intelligence problems.

### 5.1 Module A — Learner Signal Processing & Extraction
Process learner-generated text, extract learner signals, link to supporting evidence, normalise signal tags, distinguish: strength / need / concern / preference / activity-behaviour signal. Preserve processing context.
Input sources: reflections, assignments, workshop outputs, behavioural observations, performance indicators, instructor notes.
Output fields: signal type, signal label, evidence, source field, source record, interpretation note, confidence/review note.

### 5.2 Module B — Pattern Detection & Learner Intelligence
Group related signals, identify recurring patterns, produce candidate learner insight, optionally cohort-level patterns, identify insufficient evidence, allow **Unassigned / Needs More Evidence** outcomes. **Do not force every learner into a pattern.**
Pattern assignment fields: candidate pattern, supporting signals, contradictory evidence, reason for assignment, reason for uncertainty, review status.

### 5.3 Module C — Validation & Learning
Support learning from human review. Capture decisions: Agree, Revise, Reject, Unsure, Needs More Evidence.
Record where applicable: false positive, false negative, over-interpretation, missing signal, normalization error, taxonomy mismatch, pattern mismatch, insufficient evidence.

## 6. AI Assistance Architecture

Modular **processing adapter pattern**:
| Adapter | Purpose |
|---|---|
| SmartDiscovery Adapter | Integrated learner intelligence capability |
| External AI Adapter | Claude, ChatGPT, Gemini, or another AI used within the workflow |
| Manual Analysis Adapter | Human-generated structured result |
| Mock / Test Adapter | Demo and testing only |

Every Processing Result records: engine type, provider/tool, model where known, processing configuration, prompt/processing version reference, run ID, timestamp.
**External AI output must not be labelled as SmartDiscovery output.**

## 7. Structured Learner Insight

Fields: learner, environment, processing run, insight type, title, summary, observed strengths, development needs, learning preferences (where supported), concerns (where supported), evidence, interpretation boundary, review status, reviewer, approved output, creation/update date.

**Important**: Fact → Signal → Interpretation → Recommendation must remain distinguishable. Do not collapse into one unsupported narrative.

## 8. Human Review Workflow

Reviewer compares: `Source Evidence → SmartDiscovery Output → Interpretation → Review`
Reviewer may: Agree, Revise, Reject, Mark Unsure, Request More Evidence, Request Rerun.
System must preserve: original AI output, corrected output, review decision, review notes, reviewer, timestamp.
**Approved output must remain separate from original AI output.**

## 9. Learner Profile — Minimal Ecosystem Layer

Required in MVP (not the full Learner Ecosystem Platform). Displays: learner identity, learning environments participated in, approved learner insights, observed strengths, development focus, learning preferences (where validated), selected evidence, selected achievements, portfolio, update history.
Profile content drawn from approved or clearly-labelled provisional information.

## 10. Learner Portfolio

Artifact types: project, assignment, workshop output, reflection, prototype, presentation, achievement, other evidence.
Portfolio record fields: title, description, artifact type, linked learning environment, date, learner, file/URL reference, evidence note, visibility status, created date.
No advanced social portfolio functionality required.

## 11. Learner-Facing Value

Learner-facing profile shows: accumulated learning experiences, approved insights, strengths, development focus, selected evidence, portfolio artifacts, learning history. Must communicate development without presenting AI-generated interpretation as immutable learner identity.

## 12. Required Screens — Priority 1

| Screen | Minimum Requirement |
|---|---|
| Dashboard | Learning environments, datasets, processing runs, review status |
| Learning Environment List | Name, organisation, course/workshop, status, latest activity |
| Learning Environment Overview | Context, datasets, learners, runs, recent activity |
| Dataset Screen | Dataset metadata, record count, validation status, associated environment |
| Dataset Validation | ID field, evidence fields, missing values, duplicates, invalid rows |
| Processing Setup | Context, taxonomy, focus, AI configuration |
| Confirm Run | Full processing configuration before execution |
| Processing Run | Status, progress, records processed, warnings, errors |
| Learner Output List | Learner, insight status, pattern status, review status |
| Learner Insight Review | Evidence → AI output → human review |
| Pattern / Cohort View | Candidate patterns, evidence, review status |
| Learner Profile | Approved insight, learning history, portfolio |
| Portfolio | Learner artifacts and evidence |
| Export | Approved structured data export |

## 13. Priority 2 Screens (implement only after Priority 1 works)
processing run history, review history, learner insight history, cohort overview, basic activity log, profile update history, portfolio evidence viewer, basic configuration screen.

## 14. User Roles

- **Admin / Project Owner**: manage environments/learners/datasets, run processing, review outputs, manage profile/portfolio, export, view all records.
- **Analyst / Research User**: access assigned environments, upload datasets, configure processing, run SmartDiscovery, review outputs, inspect evidence, export results.
- **Educator / Reviewer**: view relevant learner output, inspect evidence, Agree/Revise/Reject, comment, approve learner insight.
- **Learner**: view own profile, view approved insights, view portfolio, add/manage portfolio artifacts where enabled.

Complex multi-tenant permission architecture not required for MVP.

## 15. Data Model

- **LearningEnvironment**: id, name, organisationName, environmentType, courseOrWorkshop, description, learningObjectives, status, createdBy, createdAt, updatedAt
- **Learner**: id, externalReference, displayName, email(optional), status, createdAt, updatedAt
- **LearnerEnvironment**: id, learnerId, environmentId, participationStatus, joinedAt
- **Dataset**: id, environmentId, name, originalFileName, storageReference, recordCount, validationStatus, uploadedBy, createdAt
- **DatasetRecord**: id, datasetId, learnerId, sourceRecordId, sourceData, validationStatus, createdAt
- **ProcessingRun**: id, environmentId, datasetId, status, processingContext, processingConfiguration, aiSource, modelOrTool, startedAt, completedAt, createdBy, createdAt
- **ProcessingResult**: id, processingRunId, datasetRecordId, learnerId, status, rawAiOutput, structuredOutput, warning, error, sourceType, modelOrTool, createdAt
- **LearnerSignal**: id, processingResultId, learnerId, signalType, label, normalizedLabel, evidenceText, sourceField, interpretationNote, createdAt
- **LearnerPattern**: id, processingRunId, learnerId(nullable), patternType, title, description, supportingSignalIds, contradictoryEvidence, assignmentStatus, createdAt
- **Review**: id, processingResultId, learnerId, reviewerId, decision, correctedOutput, reviewNotes, reviewedAt
- **LearnerInsight**: id, learnerId, environmentId, processingRunId, title, summary, insightType, status, approvedOutput, approvedBy, approvedAt, createdAt
- **InsightEvidence**: id, learnerInsightId, datasetRecordId, learnerSignalId(nullable), evidenceText, createdAt
- **LearnerProfile**: id, learnerId, profileStatus, summary, updatedAt
- **PortfolioArtifact**: id, learnerId, environmentId(nullable), artifactType, title, description, fileReference, externalUrl, evidenceNote, visibility, createdAt
- **ActivityLog**: id, actor, actionType, targetType, targetId, summary, createdAt

## 16. Relationship Principle

```
Learning Environment
→ Learner / Dataset
→ Dataset Record
→ Processing Run
→ Processing Result
→ Learner Signal
→ Pattern / Insight
→ Human Review
→ Approved Insight
→ Learner Profile / Portfolio
```
Traceability must remain intact.

## 17. Persistent Storage Requirements — NON-NEGOTIABLE

App must use persistent backend storage. If data disappears after refresh / browser close / login change / later return → **MVP is not operational**.

Backend storage must persist: users, learning environments, learners, learner-environment relationships, datasets, dataset records, processing runs, processing outputs, learner signals, patterns, reviews, approved learner insights, evidence, learner profiles, portfolio artifacts, activity logs.

File/object storage must preserve: source datasets, portfolio files, evidence files where applicable.

**Forbidden as system of record**: localStorage, sessionStorage, in-memory JS state, hardcoded JSON, temporary mock files (only OK for temporary UI state or explicitly-labelled demo fallback).

## 18. Data Integrity & Governance

Important records must preserve: unique ID, creation timestamp, update timestamp, origin, ownership where applicable, processing run, AI/tool provenance.
Deleting operational records must not silently destroy evidence traceability — prefer archive / soft delete over hard deletion.

## 19. Learner Data Protection

Minimise PII, don't display unnecessary email/student identifiers, restrict profile access, separate internal diagnostics from learner-facing views, avoid exposing raw evidence unnecessarily, record reviewer access where practical, allow de-identified datasets for research testing. No complicated enterprise governance at MVP stage, but basic responsible access must exist.

## 20. Processing Failure Handling

Failures must never disappear silently. Capture: provider error, malformed AI output, timeout, invalid JSON, incomplete output, missing evidence, unsupported input, skipped learner, ambiguous learner mapping, manual intervention required.
Run may finish as **Completed with Warning** when some learners require review.

## 21. MVP Acceptance Criteria

End-to-end flow (must all work with persistent backend storage):
1. Create learning environment → create/import learners → close browser → reopen → confirm data remains.
2. Upload real CSV/XLSX dataset → persist dataset+records → validate structure.
3. Define processing context → confirm configuration → create processing run → execute SmartDiscovery/supported AI processing → persist record-level results.
4. Close browser → reopen → confirm run and output remain.
5. Open learner insight → trace to source evidence.
6. Educator reviews output → revise or approve insight → confirm original AI output remains preserved.
7. Store approved learner insight → attach to learner profile → add ≥1 portfolio artifact.
8. Close browser → reopen → confirm profile, insight, evidence, portfolio remain.
9. Export approved structured learner insight → view previous processing run.

**OPERATIONAL DEFINITION OF DONE**: Create learner → upload learner data → process → review → approve insight → attach insight/evidence to learner profile → add portfolio artifact → close browser → reopen → confirm all data still exists → export approved insight. If this flow does not work with persistent backend storage, the MVP is not complete.

## 22. Suggested Build Order

| Phase | Build Focus | Acceptance Checkpoint |
|---|---|---|
| 1 | Application shell, ISL visual system, backend connection | App runs and backend connects |
| 2 | Learning Environment persistence | Create → refresh → remains |
| 3 | Learner persistence | Learner remains after restart |
| 4 | Dataset upload, parsing, storage, validation | Dataset survives restart |
| 5 | Processing context + run structure | Run exists before processing |
| 6 | SmartDiscovery adapter / processing | Persisted output is created |
| 7 | Learner signals + evidence traceability | Signal traces to source |
| 8 | Pattern / insight structuring | Candidate insight generated |
| 9 | Human review | Original + corrected output preserved |
| 10 | Approved learner insight | Approval persists |
| 11 | Learner Profile | Approved insight appears on profile |
| 12 | Portfolio | Artifact persists and displays |
| 13 | Export | Approved output can be exported |
| 14 | Run / Review History | Previous state is visible |
| 15 | Seed Data + QA | Full Definition of Done passes |

**BUILD SEQUENCE RULE**: Backend persistence must be implemented near the beginning, not added after the UI is finished.

## 23. Seed / Demo Data

Use same backend mechanisms as real data. Minimum: 1 learning environment, 10 learners, 1 dataset, 10–20 learner records, 1 completed processing run (successful records, ≥1 warning, ≥1 Needs More Evidence case, ≥1 rejected/revised insight, several approved insights), ≥3 learner profiles, ≥3 portfolio artifacts, evidence-linked insight.
**Do not use hardcoded JSON as the final demo system of record.**

## 24. Visual / UX Requirements

Use provided ISL logo and blue visual identity.
Primary direction: white/very light background, ISL blue, dark navy/charcoal text, subtle pale-blue surfaces, rounded cards, clear tables, simple navigation, professional learner intelligence interface.
Avoid: playful youth-app styling, excessive gradients, overly futuristic AI imagery, dashboard clutter, decorative features without operational purpose.

## 25. Suggested Navigation

Main: Dashboard, Learning Environments, Learners, Datasets, Processing Runs, Reviews, Insights, Profiles, Portfolios, Activity, Settings.
Inside Learning Environment: Overview, Learners, Datasets, Processing, Outputs, Patterns, Reviews, Insights.

## 26. Current Development Boundaries

Claude Code should **not** build: full ISL Learner Ecosystem Platform, trainer management, trainer marketplace, workshop marketplace, community/social networking, payment, subscriptions, complex multi-tenancy, advanced recommendation engine, advanced progression prediction, broad cross-course analytics, complex dashboards.
Should **not**: create permanent learner labels from weak evidence, make AI output final without review, hide AI/tool provenance, use browser storage as system of record, create fake dashboard data, create buttons that appear operational but do nothing.
If something is mocked / external / manual / incomplete — **label it clearly**.

## 27. Validation Principle

- Level 1 — Processing Works: real learner data enters system, structured output produced.
- Level 2 — Workflow Is Operational: processing, persistence, evidence, review, approval, reuse can be repeated.
- Level 3 (**most important**) — Learner Intelligence Creates Learning Value: educators/learners can use insight for facilitation, learner support, learning design, reflection, development decisions.

**No evidence, no validation.**

## 28. Definition of Done

Platform must be able to answer: Who is the learner? In which learning environment? What dataset was processed? Which records belong to the learner? Which processing context was used? Which run generated the output? Which AI/tool generated the output? What learner signals were extracted? What evidence supports each signal? What pattern or insight was generated? Was the insight reviewed? Who reviewed it? Was it corrected? What is the approved insight? What evidence supports the approved insight? Is it visible on the learner profile? Which portfolio evidence belongs to the learner? Can the approved output be exported? Does all data remain available when the user returns later?

If these questions cannot be answered reliably, the operational MVP is not complete.

## 29. Copy-Ready Build Prompt (source intent, for reference)

Build the first operational MVP of SmartDiscovery + ISL — Learner Intelligence Platform. ISL is the workflow/platform layer; SmartDiscovery is the AI research/learner intelligence layer. Primary focus: Learner Insight Platform, supported by minimum Learner Profile & Portfolio capability. Core workflow: Input → Confirm → Run → Output → Review → Export, flowing into Approved Insight → Learner Profile → Portfolio/Evidence. Must use persistent backend/database storage — no localStorage/sessionStorage/in-memory/hardcoded JSON/mock data as system of record. Build incrementally; don't prioritise visual completeness over operational functionality. SmartDiscovery output must remain evidence-backed and reviewable; don't force pattern assignment when evidence is insufficient (allow Needs More Evidence/Unassigned); don't treat AI-generated interpretation as permanent learner identity. Preserve distinction between source evidence, learner signal, AI interpretation, human correction, human-approved learner insight. AI integration uses modular adapter pattern. Exclude trainer/workshop marketplace, community features, payment, complex ecosystem governance, advanced analytics unless necessary for the defined MVP workflow. Label anything manual/mocked/incomplete/external clearly. Build from real learning workflow demand. No evidence, no validation.
