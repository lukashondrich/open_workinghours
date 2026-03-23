# Open Working Hours — Workstreams

**Last updated:** 2026-03-21

## Current State

- 3-4 active users + developer
- New Android test phone arriving soon
- iOS: TestFlight build #31, E2E 48/48
- Android: development/internal testing, E2E 45/48 (3 known-flaky shift tests)
- Backend: production on Hetzner, daily immutable backups
- Security hardening: deployed (CORS, rate limiting, security headers, email enumeration fix)
- DP group stats v1+v2: deployed (full pipeline — adaptive ε, CIs, budget monitoring; activates at K_MIN=5)

---

## 1. Union Outreach

**Goal:** Get unions interested as distribution channel and legitimacy partner. Still the most important growth strategy.

| Lead | Channel | Status | Notes |
|------|---------|--------|-------|
| **Pierre Maite** (ver.di) | Signal → meeting | **Meeting next Friday (2026-03-28)** | via friend's intro. https://gesundheit-soziales-bildung-bb.verdi.de/tarifbereiche |
| Marburger Bund Kreise | Cold outreach | No response | Tried earlier, no reply |

**Next actions:**
- [ ] Prepare for Pierre Maite meeting (Friday 2026-03-28)
  - Pflege-focused pitch: "Weekly overtime data for nurses from month one"
  - DP privacy model explainer (we add noise, K_MIN suppression, error bars)
  - Discussion items: exact vs approximate n, acceptable noise level, K_MIN=5 justification
  - Show simulation results: Pflege n=25 → ±2.9h noise monthly
- [ ] Research ver.di Berlin election activity — ask Pierre about this

---

## 2. User Acquisition

| Channel | Size | Status | Blocker |
|---------|------|--------|---------|
| Doc-mums WhatsApp group (sister) | ~2k doctors | Not yet contacted | Android must be provably reliable |
| Tech-from-below meetup Berlin | ~30-50 people | Talk confirmed, end of April | Prep talk + demo |
| Organic / word of mouth | — | 1 user so far | — |

---

## 3. Institutional Support & Research

**Goal:** Legitimacy, resources, potential research collaboration. Long lead times — start research now.

### Funding (with deadlines)

| Organization | Type | Fit | Deadline | Status |
|-------------|------|-----|----------|--------|
| **NLnet NGI Zero Commons Fund** | Grant, 5-50k EUR | High — privacy, GDPR, open source | **April 1, 2026** | **Applying now** |
| **Hans-Böckler LABOR.A 2026** | Conference session proposal | High — flagship future-of-work event | **April 13, 2026** | To submit |
| **Prototype Fund** (BMBF/OKF) | Grant, up to 47.5k/6mo | High — open source, civic tech | Oct-Nov 2026 (Class 03) | Prepare later |
| **Hans-Böckler-Stiftung** | Fördererlinie Transformation | High — needs Praxispartner (hospital/union) | Year-round | To explore with HBS connection |

### Research Partnerships

| Organization | Type | Fit | Connection | Status |
|-------------|------|-----|------------|--------|
| **HIIG** | Visiting researcher / collaboration | High — digital governance, Berlin | Have connection | To explore |
| **ITS Rio** | Research collaboration (Conecta Trabalhadores parallel) | Medium-high — civic tech, privacy | Had email exchange | Follow up |
| **OpenMined** | Community — differential privacy practitioners | High — OWH uses differential privacy | None | Join Slack, introduce project |
| **ETUI** (European Trade Union Institute) | Research collaboration / visiting researcher / publication | High — EU-level, digitalization & working time research, Brussels | Co-author of ETUI publication, know editor Aida Ponce | To reach out |

### People / Contacts

| Person | Organization | Connection | Notes |
|--------|-------------|------------|-------|
| **Pierre Maite** | ver.di Gesundheit/Soziales BB | Friend's intro → Signal | **Meeting Friday 2026-03-28** |
| **Johanna Wenckebach** | IG Metall (Hauptjuristin im Vorstand) | Met via AlgorithmWatch / Hugo Sinzheimer meetings (3-4 years ago) | Moved from HBS to IG Metall 2024. Published "Arbeitszeiterfassung als Machtfrage." Draft ready. |
| **Ernesto Klengel** | Hugo Sinzheimer Institut (Direktor) | AlgorithmWatch / HSI meetings (likely met) | Succeeded Wenckebach at HSI. Draft ready (includes LABOR.A question). |
| **Aida Ponce Del Castillo** | ETUI (senior researcher) | Co-author of ETUI publication | Digitalization, AI, workers' rights. To reach out. |
| Hans-Böckler contact | HBS | Have connection | Explore Transformation funding, LABOR.A |
| HIIG contact | HIIG Berlin | Have connection | Visiting researcher |
| ITS Rio contact | ITS Rio | Email exchange | Follow up, reference Conecta Trabalhadores |
| Lawyer friend | — | Personal | Suggested BMJ, clarify if intro available |
| Friend (Tech-from-below) | ver.di contact | Personal | Intro to Pierre done, Tech-from-below talk end of April |

### Government / Policy

| Organization | Type | Fit | Connection | Status |
|-------------|------|-----|------------|--------|
| **Bundesministerium für Justiz (BMJ)** | Policy interest / endorsement | Possible — Arbeitszeitgesetz, Hinweisgeberschutzgesetz | Lawyer friend suggested | Clarify if intro available |

---

## 4. Engineering

### Codebase state (as of return, 2026-03-18)

**What's solid:**
- Geofencing with automatic clock-in/out
- Calendar with shifts, templates, overlap detection, absences
- InlinePicker (unified: Shifts/Absences/GPS tabs) — Group C complete
- 14-day dashboard, authentication, daily submission
- Full German translation
- UX Groups A + C complete (geofencing fixes, picker unification)
- Visual polish done (CalendarHeader, MonthView banner, Android tab bar)

**Active branch:** `main` (security hardening + dp_group_stats merged)
- Reports tab UI prototype shelved on `feature/reports-tab-v3-pipeline` (stash on `feature/reports-tab-visual-prototype`)
- Worktree `.claude/worktrees/accounting-model-implementation/` kept for dp_group_stats package extraction

**Pending UX issues:**
- Group B (Lock Screen with Face ID) — implemented but verify
- Group D (Calendar Day View) — not started, low priority

### DP Group Stats (2026-03-23)

**Status:** v1 + v2 complete, deployed to production. Aggregation activates when cells reach K_MIN=5.

**Deployed (v1 + v2):**
- Foundation: config, Laplace mechanism, publication state machine, accounting ledger
- DB schema: 5 tables + publication_status + CI columns + period_type
- SQL-level clipping (CASE WHEN, portable SQLite/PG)
- Adaptive ε schedule: `min(config_ε, (cap − spent_ytd) / remaining)`
- 90% confidence intervals with n_display rounding
- Per-user budget monitoring (GDPR Art. 15) + admin summary endpoint
- Temporal coarsening infrastructure (weekly/biweekly/monthly)
- 116 backend tests passing (64 DP-specific)

**Parameters (simulation-validated):**
| Parameter | Value | Rationale |
|-----------|-------|-----------|
| K_MIN | 5 | Labor data (Art. 6), not health data (Art. 9). With DP noise, K_MIN is secondary defense. |
| Bounds (planned/actual) | [0, 80h] / [0, 120h] | Covers 99.9% of real cases. |
| ε split (planned:actual) | 0.2/0.8 | 80% budget on actual hours (primary stakeholder metric). |
| Annual per-user ε cap | 150 | Defensible for non-health employment data with central DP. |
| Dominance threshold | 0.30 | Operationally redundant at K_MIN≥5, kept as safety net. |
| Aggregation cadence | Weekly (default) | Biweekly/monthly supported via period_type. |

**Pilot strategy (Berlin hospital):**
- Start with staff-group cells: Pflege / Assistenzarzt / Facharzt / Oberarzt (no specialty split)
- Pflege (n≈25, monthly, cap=150): noise ≈ 2.9h — detects 5h+ systematic overtime
- Specialty × career stage only viable cross-hospital at state level (~300+ users)

**Deferred (v2+):**
- [ ] Gaussian/zCDP mechanism (~10-15% noise improvement, not blocking)
- [ ] Multiple release families (F2: hospital × specialty, F3: national)
- [ ] Per-family cadence config knob
- [ ] Data model alignment — see `project-mgmt/dp-data-model-alignment.md`

**Discuss with ver.di (2026-03-28):**
- Exact vs approximate n in published stats
- Which cell granularity unions find most useful
- Acceptable noise level for policy use
- K_MIN=5 justification

**Specs:** `docs/dp-group-stats-requirements-v2.md`, `docs/dp-group-stats-accounting-model.md`, `docs/dp-group-stats-simulation-spec.md`

### Engineering priorities

| Task | Priority | Status | Notes |
|------|----------|--------|-------|
| Android robustness | **High** | Not started | Blocks doc-mums outreach (2k doctors). New test phone arriving. |
| Security hardening | ✅ Done | Deployed 2026-03-21 | CORS, rate limiting, headers, email enumeration fix, SMTP log cleanup |
| DP group stats v1+v2 | ✅ Done | Deployed 2026-03-21 | Full pipeline deployed (adaptive ε, CIs, budget monitoring). Activates at K_MIN=5. |
| E2E test updates | Medium | 48/48 iOS, 45/48 Android | Needs update for InlinePicker UI changes |
| Reports tab | Low | UI prototype done, backend not started | Revisit after user traction |
| Group D — Day View | Low | Not started | Not urgent |

---

## 5. Tech-from-below Talk (end of April)

**Event:** Tech-from-below meetup, Berlin
**Audience:** ~30-50 people, civic tech / critical tech community
**Invited by:** Friend (same person with ver.di contact)

**Next actions:**
- [ ] Outline talk structure
- [ ] Prepare demo
- [ ] Consider the "ask" (users? contributors? institutional connections?)

## 6. Business Model

**Current thinking (March 2026):**

| Tier | Price | Distribution |
|------|-------|-------------|
| **Individual** | 3 EUR/month | App Store / Play Store subscription |
| **Betriebsrat** | 40 EUR/month, unlimited licenses | Direct invoice, BR activation code in app |
| **Pilot** | Free | — |

- Everyone gets the same features (no freemium split)
- App store takes 15% of individual subs (Small Business Program) → ~2.55 EUR net
- BR license handled outside app stores (B2B, no commission)
- Pricing not finalized — keep simple for now, revisit after pilot

**Market size (Germany, rough):**
- ~1,900 hospitals, ~16,000 care homes, plus ambulatory services
- At 40 EUR/month: 100 BRs = 48k/yr, 500 BRs = 240k/yr, 1000 BRs = 480k/yr
- Current pricing is flat regardless of institution size — may need tiering later for large hospitals

---

## 7. Workstream Tooling

**Idea:** Lightweight tool to track workstreams and automate parts of project management.
**Status:** Not a priority right now — risk of over-optimization. Revisit when workstreams grow more complex.

---

## Priority Order (March 2026)

1. **Union outreach** — not blocked, start now (ver.di warm lead)
2. **Institutional support research** — long lead time, start now
3. **Android robustness** — critical engineering path, prerequisite for doc-mums
4. **Security / pen testing** — builds institutional credibility
5. **Tech-from-below talk prep** — fixed deadline end of April (~6 weeks)
6. **Doc-mums outreach** — high value, blocked on Android reliability
7. **Reports tab** — revisit after user traction
