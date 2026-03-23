# NLnet NGI Zero Commons Fund — Proposal Draft

**Fund:** NGI Zero Commons Fund
**Deadline:** April 1, 2026, 12:00 CEST
**Status:** DRAFT — review, rewrite in your own words, then submit

---

## Proposal Name

dp-group-stats: Privacy-Preserving Aggregation for Small-Group Statistics

---

## Abstract

How do you publish useful statistics about small professional groups — say, cardiologists in one German state — without revealing any individual's data? This is a common problem across labor rights, public health, and civic tech, and existing tools don't solve it well: general-purpose differential privacy libraries require deep expertise to apply correctly, while domain-specific platforms keep their privacy logic locked inside.

**dp-group-stats** is an open-source Python library that packages k-anonymity filtering, calibrated differential privacy (Laplace mechanism), composition budget tracking, temporal stability controls, and l-diversity checks into a reusable toolkit with safe defaults. It is designed so that civic tech developers can publish aggregate statistics from sensitive group data with formal privacy guarantees — without needing to be differential privacy experts.

The library is being developed and battle-tested within **Open Working Hours** (https://openworkinghours.org), a platform where healthcare workers in Germany track and collectively report their actual working hours. The core privacy layer — k-anonymity (k=5), Laplace noise with per-user annual ε budget, and a two-layer architecture separating pseudonymous operational data from anonymous aggregates — is already deployed in production. This proposal funds hardening that layer and extracting it as a standalone, reusable library.

Specifically, we will:

1. **Implement composition budget tracking** — publishing the same group weekly accumulates privacy loss (effective ε ≈ 52/year with naive composition). We will implement a privacy budget ledger that tracks cumulative exposure per group and automatically suppresses publication when the budget is exhausted.

2. **Add temporal stability controls** — prevent inference attacks when groups cross the k-anonymity threshold (e.g., a group going from 10 to 11 members reveals information about the new member). We will require N consecutive weeks above threshold before first publication, with smoothed transitions.

3. **Implement l-diversity checks** — k-anonymity alone fails when group members have similar values (all work ~60 hours). We will add a minimum variance requirement before publishing group averages.

4. **Extract and package as a standalone Python library** (`dp-group-stats`) with clean API, type annotations, comprehensive documentation, and PyPI publication.

5. **Commission a security audit** of the privacy layer (we understand NLnet can facilitate this).

**Expected outcomes:** A well-documented, tested Python library on PyPI that any project collecting sensitive group statistics can use — from labor rights platforms to public health monitoring tools. Validated in production through Open Working Hours' deployment for healthcare workers in Germany.

**License:** Apache 2.0 (library), AGPL-3.0 (Open Working Hours platform)

---

## Relevant Experience

[TODO: Rewrite in your own words. Draft below for structure/content — adapt freely.]

I designed and implemented the privacy layer that this library will be extracted from. It runs in production as part of Open Working Hours — a platform I built and deployed solo (React Native mobile app, FastAPI backend on Hetzner/Germany, Astro website). The current implementation includes k-anonymity with threshold 11, Laplace-mechanism differential privacy, a two-layer data model separating pseudonymous from anonymous data, and GDPR compliance with cascading right-to-erasure. I documented 7 attack vectors with severity assessments and mitigations.

My background combines AI/ML engineering, data protection research, and labor rights work:

- **AI safety in regulated settings:** At Cornelsen (Germany's largest educational publisher), I led development of an LLM tutoring app for 25k students, including building a PII-removal service (fine-tuned Llama 3.1 with LoRA, integrated with Presidio). I hold an EU AI Act Officer certification (Art. 4).

- **Algorithmic fairness and worker interests:** At AlgorithmWatch, I consulted on fairness in embedding-based search systems and advised Bosch on AI fairness in production. This led to peer-reviewed publications on automation bias and worker agency in ML pipelines, including a chapter in the ETUI volume "Artificial intelligence, labour and society" (2024, co-edited by Aida Ponce Del Castillo) and a Hans-Böckler working paper on employee action along the ML pipeline.

- **Statistical and formal methods:** My M.Sc. in Cognitive-Affective Neuroscience (TU Dresden) focused on Bayesian model comparison and reinforcement learning, with thesis work at the Bernstein Center for Computational Neuroscience and Princeton University. This gives me the formal background for differential privacy parameter selection and composition analysis.

- **Healthcare domain:** I worked as ML Engineer at the Institute of Medical and Human Genetics at Charité Berlin, developing computer vision tools for 3D histological analysis.

- **Institutional connections relevant to this project:** ver.di Gesundheit/Soziales (meeting scheduled), Hugo Sinzheimer Institut (Ernesto Klengel), Johanna Wenckebach (IG Metall, previously HSI), Hans-Böckler-Stiftung, HIIG Berlin, ETUI (Aida Ponce Del Castillo — co-author), ITS Rio (Conecta Trabalhadores parallel project).

Selected relevant publications:
- "Implementing employee interest along the machine learning pipeline" — ETUI, 2024
- "Automation Bias in public administration" — Government Information Quarterly, 2024
- "Addressing Automation Bias through Verifiability" — European Conference on Algorithmic Fairness, 2023
- "From risk mitigation to employee action along the ML pipeline" — Böckler Impuls, 2023

Google Scholar: https://scholar.google.com/citations?user=15kprDEAAAAJ

---

## Budget

**Requested amount:** 35,000 EUR

| Task | Effort | Rate | Amount |
|------|--------|------|--------|
| **1. Composition budget tracking** | 60h | 80 EUR/h | 4,800 EUR |
| Design privacy budget ledger schema; implement per-group cumulative ε tracking; automatic suppression when budget exceeded; configurable budget limits; unit + integration tests | | | |
| **2. Temporal stability controls** | 50h | 80 EUR/h | 4,000 EUR |
| Implement N-week consecutive threshold requirement; smoothed group entry/exit; transition period handling; documentation of attack model; tests | | | |
| **3. L-diversity implementation** | 40h | 80 EUR/h | 3,200 EUR |
| Minimum variance check before publication; configurable diversity threshold; integration with existing aggregation pipeline; tests | | | |
| **4. Library extraction & packaging (dp-group-stats)** | 90h | 80 EUR/h | 7,200 EUR |
| Extract privacy components into standalone Python package; clean API design; type annotations; comprehensive documentation; example usage; PyPI publication; CI/CD | | | |
| **5. Documentation & threat model** | 50h | 80 EUR/h | 4,000 EUR |
| Formal threat model document; privacy parameter selection guide; deployment guide for adopters; API reference; tutorial for civic tech developers | | | |
| **6. Integration & validation** | 50h | 80 EUR/h | 4,000 EUR |
| Integrate dp-group-stats back into Open Working Hours as production validation; migration of existing aggregation to use the library; regression testing; performance benchmarks | | | |
| **7. Security audit preparation & follow-up** | 40h | 80 EUR/h | 3,200 EUR |
| Prepare codebase for external audit; address audit findings; document remediations | | | |
| **8. Community engagement & ecosystem** | 32h | 80 EUR/h | 2,600 EUR |
| Blog posts on implementation decisions; conference presentation (LABOR.A 2026, Tech-from-below); outreach to potential adopters; OpenMined community engagement | | | |
| **Contingency (infrastructure, tools)** | — | — | 2,000 EUR |
| Hetzner hosting, CI/CD, testing infrastructure, domain costs | | | |
| **Total** | **412h** | | **35,000 EUR** |

---

## Comparison with Existing Efforts

**Tumult Analytics** (Tumult Labs; used by U.S. Census Bureau, Wikimedia): The closest existing tool. Provides session-level privacy budgets, contribution bounding, and post-processing suppression of small groups. However, each session is independent — there is no cross-publication budget tracking (publishing the same group weekly for a year), no temporal stability controls (protecting against inference when groups cross thresholds), no formal k-anonymity guarantee, and no l-diversity. Tumult is designed for large one-off analyses, not for repeated publication of slowly-changing small-group statistics over time.

**General-purpose DP primitives** (OpenDP, Google dp-accounting, IBM diffprivlib, OpenMined's PyDP): These provide excellent building blocks — OpenDP has sophisticated composition odometers, Google's dp-accounting has best-in-class Privacy Loss Distribution accounting. dp-group-stats will build on these primitives (specifically Google dp-accounting or OpenDP for composition math) rather than reimplementing noise mechanisms. The gap these libraries leave: no k-anonymity, no temporal stability, no l-diversity, and no orchestration layer for repeated small-group publication.

**DP-enabled SQL layers** (SmartNoise SQL, Qrlew/Sarus): These rewrite SQL queries into differentially private equivalents and support tau-thresholding to suppress small groups. Budget tracking is within-session only — no cross-publication accounting, no temporal stability controls.

**Anonymization frameworks** (ARX, sdcMicro): ARX is the only tool that combines k-anonymity, l-diversity, t-closeness, and differential privacy. However, it is designed for microdata release (anonymizing individual records for publication), not for repeatedly publishing aggregate statistics. The composition and temporal stability problems are outside its scope.

**Domain-specific platforms** (public health dashboards, Census Bureau deployments): These use custom configurations of the above tools, tightly coupled to their applications. There is no reusable library a civic tech developer can import.

**The gap:** No existing open-source library combines k-anonymity group suppression, differential privacy with cross-publication composition tracking, temporal stability controls, and l-diversity checks — packaged as a reusable toolkit for repeated small-group statistics. The theoretical foundations exist (Dwork et al. 2010 on continual observation; Bo et al. 2024 on budget recycling) but have not been packaged into a usable library. This is what dp-group-stats provides.

---

## Technical Challenges

**1. Composition budget under repeated publication.** Publishing the same group's statistics weekly causes privacy loss to accumulate. With naive composition, ε effectively becomes 52 after one year. We will implement cross-publication budget tracking using established composition accounting (building on Google's dp-accounting PLD framework or OpenDP's odometers), with a configurable annual budget and automatic suppression. The challenge is balancing utility (unions need regular data) against formal privacy guarantees. Recent work on budget recycling (Bo et al., IEEE S&P 2024) suggests tighter bounds are achievable for repeated queries on slowly-changing data.

**2. Temporal boundary inference.** When a group crosses the k-anonymity threshold (e.g., from 10 to 11 members), the timing of first publication can reveal information about the newest member. Requiring N consecutive weeks above threshold mitigates this but introduces delay. We need to find the right N that balances privacy against data freshness, and handle edge cases (members leaving and re-joining, seasonal workforce changes in hospitals).

**3. Small-group dynamics in healthcare.** Medical specialties create naturally small groups. A state may have very few pediatric cardiologists. Even with k=5, concentration becomes critical — if all members of a group work similar overtime, the average reveals individual values. We need variance-aware suppression that doesn't over-suppress (making the system useless for the specialties that need it most).

**4. Library API design for non-experts.** The hardest challenge may be packaging these privacy guarantees into an API that civic tech developers can use correctly without being differential privacy experts. Wrong parameter choices can silently destroy privacy. The library must make safe choices easy and dangerous choices explicit, with clear documentation of trade-offs.

---

## Ecosystem

**Library adopters (technical community):**
- **OpenMined** — their PyDP library wraps Google's differential privacy implementation. dp-group-stats solves a layer above (application-level aggregation with composition tracking). We will engage their community to share our approach and explore integration. A real-world deployment of DP for healthcare data is a case study they value.
- **OpenDP (Harvard/Microsoft)** — their composition accounting tools may inform our implementation. We will contribute back domain-specific extensions.
- **Civic tech projects collecting sensitive group data** — labor rights platforms, public health dashboards, community surveys. The library's value proposition is: import one package, get formal privacy guarantees without becoming a DP expert.

**Validation stakeholders (via Open Working Hours):**
- **Healthcare worker unions** (ver.di Fachbereich 3, Marburger Bund) — we have connections to ver.di Berlin-Brandenburg and the Hugo Sinzheimer Institut. Unions consume the aggregated data for collective bargaining — they validate that the library's privacy/utility trade-offs work in practice.
- **Hans-Böckler-Stiftung** — DGB's research foundation. We have a direct connection and plan to submit a session proposal for their LABOR.A 2026 conference (deadline April 13, 2026).
- **Hospital works councils (Betriebsräte)** — potential pilot partners. The privacy guarantees the library provides are essential for their participation.

**Research & policy:**
- **AlgorithmWatch** — algorithmic accountability organization (prior collaboration). The library demonstrates accountable data aggregation practices.
- **ITS Rio (Conecta Trabalhadores)** — parallel project using mobile technology for worker empowerment in Brazil/Colombia. We are in contact — dp-group-stats could serve their privacy needs directly.
- **HIIG Berlin** — Alexander von Humboldt Institut für Internet und Gesellschaft. We have a connection and will explore collaboration on the governance aspects of data commons.
- **ETUI** (European Trade Union Institute) — co-author relationship. Digitalization and worker data rights are a core research area.

**Promotion & adoption:**
- Present the library at Tech-from-below Berlin (confirmed, April 2026) and LABOR.A 2026 (session proposal to be submitted)
- Publish implementation blog posts targeting civic tech developers
- Documented Python library on PyPI with tutorials and example usage
- Engage with European civic tech networks (Code for Germany, mySociety) as potential adopters

---

## Notes for Submission

- [ ] Rewrite all sections in your own words
- [ ] Rewrite "Relevant Experience" in your voice (draft structure is there)
- [ ] AI disclosure: used AI for brainstorming/structuring; all submitted text is your own
- [ ] Decide: website/wiki field — link to OWH or create a dp-group-stats repo/page?
- [ ] Submit at https://nlnet.nl/propose/ before April 1, 12:00 CEST
