# Documentation Structure Guide

**Created:** 2026-01-07
**Purpose:** Define how documentation should be organized in this project

---

## Philosophy

Documentation is organized by **type of knowledge**:

1. **Process Knowledge** - How to work on this project (setup, deployment, debugging)
2. **Factual Knowledge** - What the system is and how it works (architecture, schemas, APIs)
3. **Active Work** - Temporary planning docs for features in progress

This separation allows:
- AI assistants to quickly understand current state (slim CLAUDE.md)
- Developers to find detailed info when needed (progressive disclosure)
- Old planning docs to be archived without losing institutional knowledge

---

## Documentation Tree

All docs connect back to `CLAUDE.md` (the entry point):

```
CLAUDE.md (Entry Point)
│
├─► docs/DOCUMENTATION_STRUCTURE.md (this file - guidelines)
│
├─► mobile-app/ARCHITECTURE.md (mobile work)
│   └─► "Where Do I Find X?" quick reference
│
├─► backend/ARCHITECTURE.md (backend work)
│
├─► docs/deployment.md (deployment process)
│
├─► docs/debugging.md (debugging + known gotchas)
│
├─► privacy_architecture.md (technical privacy design)
│
├─► docs/GDPR_COMPLIANCE.md (legal compliance hub)
│   ├─► docs/DPIA.md
│   ├─► docs/ROPA.md
│   ├─► docs/data-retention-policy.md
│   └─► website/*/app-privacy-policy.astro, terms.astro
│
├─► blueprint.md (deep architecture)
│
└─► archive/ (historical planning docs)

README.md (User Entry Point)
└─► Setup and installation
```

**Navigation principle:** If lost, return to `CLAUDE.md`.

---

## Target Structure

### Process Knowledge (How to Work)

| Document | Purpose | Location | Audience |
|----------|---------|----------|----------|
| `CLAUDE.md` | AI assistant quick context - current state, pointers, do's/don'ts | Root | AI assistants |
| `README.md` | Project setup, installation, quick start | Root | New developers |
| `docs/deployment.md` | Docker, Hetzner, env vars, production deployment | docs/ | DevOps |
| `docs/debugging.md` | Mobile debugging, backend logs, common issues | docs/ | Developers |

**Characteristics:**
- Answers "how do I...?" questions
- Updated when processes change
- CLAUDE.md should be slim (~150-200 lines) to minimize token usage

### Factual Knowledge (What It Is)

| Document | Purpose | Location | Audience |
|----------|---------|----------|----------|
| `blueprint.md` | High-level system architecture, completed modules overview | Root | Architects |
| `mobile-app/ARCHITECTURE.md` | Mobile app details - modules, schemas, key components, **E2E testing** | Module | Mobile devs |
| `mobile-app/e2e/README.md` | Appium E2E test quick start | Module | QA/Mobile devs |
| `docs/E2E_TESTING_PLAN.md` | E2E testing reference - history, troubleshooting, framework comparison | docs/ | QA/Mobile devs |
| `backend/ARCHITECTURE.md` | Backend details - API, database, aggregation | Module | Backend devs |
| `privacy_architecture.md` | Privacy/GDPR technical design, data flows | Root | Technical |
| `website/README.md` | Website structure and content | Module | Content editors |

**Characteristics:**
- Answers "what is...?" and "how does X work?" questions
- Updated when features are FINISHED and tested
- Module-specific docs live in module folders (close to code)

### Legal & Compliance (GDPR)

| Document | Purpose | Location | Audience |
|----------|---------|----------|----------|
| `docs/GDPR_COMPLIANCE.md` | **Hub**: Status overview, checklist, links to all legal docs | docs/ | Controller, lawyers |
| `docs/DPIA.md` | Data Protection Impact Assessment (Art. 35) | docs/ | Lawyers, auditors |
| `docs/ROPA.md` | Records of Processing Activities (Art. 30) | docs/ | Lawyers, auditors |
| `docs/data-retention-policy.md` | Retention periods, deletion procedures | docs/ | Lawyers, ops |
| `docs/consent-flow-spec.md` | In-app consent UI specification | docs/ | Mobile devs |
| `website/*/app-privacy-policy.astro` | User-facing privacy policy (EN/DE) | website/ | Users, lawyers |
| `website/*/terms.astro` | User-facing terms of service (EN/DE) | website/ | Users, lawyers |

**Characteristics:**
- Required by law, not just helpful
- Must be auditable (regulators may request)
- Has formal structure requirements
- Different audience (lawyers, auditors) than technical docs
- Entry point: `docs/GDPR_COMPLIANCE.md` (hub document)

**Relationship to privacy_architecture.md:**
- `privacy_architecture.md` = Technical design (how we protect data)
- `docs/GDPR_COMPLIANCE.md` = Legal compliance status (are we compliant?)

### Active Work (Temporary)

| Document | Purpose | Lifecycle |
|----------|---------|-----------|
| `*_PLAN.md` | Planning doc for current feature/fix | Create at start → Archive when done |
| `docs/user-test-feedback-*.md` | User testing feedback and triage | Active during testing period |

**Characteristics:**
- Created when starting a new feature or addressing feedback
- Serves as source of truth during active development
- Archived (not deleted) when work is complete
- Key information extracted to permanent docs before archiving

**Note:** We do NOT use a separate `TODO.md`. Active work is tracked in `*_PLAN.md` files, which provide more context than a flat todo list.

---

## Document Lifecycle

```
1. Start feature/fix
   └─> Create docs/FEATURE_PLAN.md (or CLUSTER_X_PLAN.md)

2. During development
   └─> Update *_PLAN.md with progress, decisions, issues

3. Feature complete & tested
   ├─> Extract key info to permanent docs:
   │   - Architecture details → module/ARCHITECTURE.md
   │   - New processes → docs/deployment.md or docs/debugging.md
   │   - High-level changes → blueprint.md
   └─> Move *_PLAN.md to archive/

4. Update CLAUDE.md
   └─> Brief mention in "Recent Updates" (keep only last 7 days)
```

---

## CLAUDE.md Guidelines

CLAUDE.md should be **slim and focused** (~150-200 lines):

### Include:
- Project overview (1 paragraph)
- Current state summary (what's working, what's in progress)
- Documentation pointers (table linking to other docs)
- Do's and Don'ts (key constraints)
- Recent updates (last 7 days only)
- Production URLs

### Exclude (move to other docs):
- Detailed deployment instructions → `docs/deployment.md`
- Debugging tips → `docs/debugging.md`
- Tech stack details → `module/ARCHITECTURE.md`
- Historical updates (>7 days) → delete (in git history)
- Completed feature details → `blueprint.md` or `module/ARCHITECTURE.md`

---

## Module ARCHITECTURE.md Template

Each module should have an `ARCHITECTURE.md` with:

```markdown
# [Module Name] Architecture

## Overview
Brief description of what this module does.

## Tech Stack
- Framework: ...
- Key dependencies: ...

## Directory Structure
src/
├── components/
├── services/
└── ...

## Key Components
Description of main files and their responsibilities.

## Database Schema (if applicable)
Tables, columns, relationships.

## Key Decisions
Why certain approaches were chosen.

## Testing
How to run tests, what's covered.
```

---

## Migration Plan (2026-01-07)

**Status:** ✅ Complete

### What Was Done

**Phase 1: Created New Docs**
- [x] `docs/deployment.md` - Docker, Hetzner, production deployment
- [x] `docs/debugging.md` - Mobile debugging, backend logs
- [x] `mobile-app/ARCHITECTURE.md` - Mobile app details, schemas, patterns
- [x] `backend/ARCHITECTURE.md` - Backend API, database, aggregation

**Phase 2: Extracted & Populated**
Content extracted from old docs into new structure.

**Phase 3: Archived Old Docs**
Moved to `archive/`:
- [x] `BACKEND_REDESIGN_PLAN.md`
- [x] `PHASE_2_MOBILE_INTEGRATION_PLAN.md`
- [x] `PHASE_3_DEPLOYMENT_GUIDE.md`
- [x] `CLUSTER_A_PLAN.md`
- [x] `CLUSTER_C_PLAN.md`
- [x] `CLUSTER_E_PLAN.md`
- [x] `CLUSTER_F_PLAN.md`
- [x] `UX_IMPROVEMENTS_MODULE_1_PLAN.md`
- [x] `UX_IMPLEMENTATION_SUMMARY.md`

**Phase 4: Deleted Obsolete**
- [x] `TODO.md` (replaced by *_PLAN.md workflow)
- [x] `DOCUMENTATION_CLEANUP_PLAN.md`
- [x] `DOCUMENTATION_CLEANUP_SUMMARY.md`
- [x] `backend/SESSION_PROGRESS.md`

**Phase 5: Slimmed CLAUDE.md**
- [x] Reduced from ~1030 lines to ~155 lines
- [x] Kept: overview, current state, doc pointers, do's/don'ts, last 7 days
- [x] Removed: deployment details, debugging tips, old history, tech stack details

---

## Archive Policy

The `archive/` folder contains:
- Completed planning documents
- Historical decision logs
- Old implementation summaries

**When to archive:** After extracting key information to permanent docs.

**When to delete vs archive:**
- Archive if it contains decisions/rationale that might be useful later
- Delete if it's purely procedural (e.g., step-by-step instructions that are now in permanent docs)

---

## Updating This Guide

Update this document when:
- Adding a new category of documentation
- Changing the documentation philosophy
- After a major restructuring

This guide itself should be referenced in CLAUDE.md's documentation pointers section.

---

## Known Documentation Gaps

**Status:** Updated 2026-01-07

Most previously identified gaps have been addressed:

| Gap | Status | Notes |
|-----|--------|-------|
| State shapes (CalendarState, AuthState) | ✅ Documented | Added to `mobile-app/ARCHITECTURE.md` Key Types section |
| Key interfaces (ShiftTemplate, TrackingRecord, AbsenceInstance) | ✅ Documented | Added to `mobile-app/ARCHITECTURE.md` Key Types section |
| Component props | Low priority | Not needed - code is self-documenting |
| File → function mapping | Skipped | Over-documentation, not worth maintaining |
| Test coverage details | Low priority | Run `npm test` to see current state |

**Remaining low-priority items:**
- Component props documentation (if needed for external contributors)
- Detailed test coverage breakdown
