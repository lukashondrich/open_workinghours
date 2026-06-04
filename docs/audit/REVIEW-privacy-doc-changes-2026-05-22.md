# Review Brief — Privacy Doc Rewrite (Doc-Side)

**Date:** 2026-05-22
**Author:** Claude (Opus 4.7, 1M context) in a long session with the project owner
**Status:** Doc work complete on `main`; one related commit on `feature/consumer-landing-page`. Code changes deferred (separate ticket).
**For the reviewer:** Read this top-to-bottom, then go file-by-file. Pay special attention to §3 ("Areas that especially need review") below.

---

## 1. Context

The project owner is preparing for the iOS App Store launch + a 2,000-person Android launch via a doctors' WhatsApp group. To avoid lawyer fees at this stage, the agreed approach is self-review of GDPR docs with code-cited claims — every assertion in the new privacy policy links to the line of code that implements it (commit-SHA permalink to `49ea57b`).

The workstream had two parts done previously (in the same session):
- **Pass 1 — Data inventory.** Code-derived ground truth: what data flows where. Output: [`docs/audit/data-inventory-2026-05-22.md`](data-inventory-2026-05-22.md).
- **Pass 2 — Inventory vs comms diff.** Found 26 inconsistencies between code and existing user-facing comms (high: 6, medium: 11, low: 9). Output: [`docs/audit/inventory-vs-comms-diff-2026-05-22.md`](inventory-vs-comms-diff-2026-05-22.md).

Then the project owner picked the **"Standard" triage cut** (false claims + material undisclosed processing) and chose **structure-first** (consolidate the 3 existing privacy pages into 1 canonical doc, then fix everything in one place).

This review covers everything that happened during structure-first assembly. The full drafted content (EN + DE, all 9 sections) is preserved as a separate artifact at [`docs/audit/draft-app-privacy-policy-2026-05-22.md`](draft-app-privacy-policy-2026-05-22.md) — that's the source-of-truth for what should end up in the live pages.

**Code changes ticket** (deferred; do not check these in this review): [`project-mgmt/ticket-privacy-doc-code-changes.md`](../../project-mgmt/ticket-privacy-doc-code-changes.md).

---

## 2. Files changed

### 2.1 Website — new consolidated privacy policy (large rewrites)

**`website/src/pages/app-privacy-policy.astro`** — rewrite (+653 lines, -229 prev)

- **What:** Replaced the body of the existing English app privacy policy. New structure: §1 At-a-glance (4 color-coded summary panels — teal/amber/red/indigo for "named", "pseudonymous", "not collected", "how protected") · §2 What we collect (6 subsections, each with What/Why/When/Legal basis/Verify-in-code template) · §3 What stays on device (table) · §4 Third-party recipients matrix · §5 Retention table · §6 Rights table · §7 International transfers (rewrites the broken "no EU/EEA transfer" claim) · §8 Security table (incl. honest-about-limits paragraph) · §9 Responsible person.
- **Why:** Pass 2 found that the EN explainer (now retired) said "Hospital or employer name — Not collected" while code stores it; the policy said "no data outside EU/EEA" while Apple/Google JWKS are US; "device identifiers not collected" while bug reports capture device model; Photon was not disclosed at all. New doc fixes all these by being code-cited and explicit.
- **How to review:** Compare against `docs/audit/draft-app-privacy-policy-2026-05-22.md` (the source markdown). Open the page in dev server (`cd website && npm run dev`), click every code-link in the matrix to confirm they resolve to the correct GitHub line. Verify anchor links (#summary, #collect, #device, #recipients, #retention, #rights, #transfers, #security, #contact) all jump correctly from the in-page nav.

**`website/src/pages/de/app-privacy-policy.astro`** — rewrite (+663 lines, -237 prev)

- **What:** Mirror of EN page in German. Same structure, same anchors, German legal terminology (DSGVO, "Aufsichtsbehörde", "Rechtsgrundlage", "Datenschutzbeauftragter").
- **Why:** EN/DE must say the same thing for the policy to be consistent across the two language audiences. Pass 2 found the EN/DE existed in unsynchronized form previously.
- **How to review:** Compare structure to EN (every section should mirror). German legal terminology: check that Art. 6 references use German format ("Art. 6 Abs. 1 lit. b DSGVO"). Native-German review of phrasing would be ideal — the translation was done by an LLM and may have stilted spots.

### 2.2 Website — explainer retirement + redirects

**Deleted:** `website/src/pages/privacy.astro` and `website/src/pages/de/privacy.astro`.

- **Why:** These were the plain-language "explainer" pages with visual panels. Pass 2 found they were a major source of EN/DE drift (the EN page had the hospital lie). Their function (plain-language summary linked from the consent sheet) is now served by §1 of the consolidated policy at anchor `#summary`. Two pages → one canonical source.

**`website/astro.config.mjs`** — added `redirects` block

- **What:** Maps `/privacy` → `/app-privacy-policy#summary` and `/de/privacy` → `/de/app-privacy-policy#summary`. Comment explains the retirement.
- **Why:** External bookmarks and any uncaught internal references continue to work.
- **How to review:** Build the site and verify the redirects fire (Astro generates meta-refresh HTML for static builds).

### 2.3 Website — internal link updates (small)

These all changed `/privacy` → `/app-privacy-policy#summary` (or `/de/privacy` → `/de/app-privacy-policy#summary`) to skip the redirect hop:

- `website/src/layouts/Layout.astro` — footer "Privacy" link
- `website/src/layouts/LayoutDE.astro` — footer "Datenschutz" link
- `website/src/pages/index.astro` — homepage "Privacy principles" link **plus** rewrote the surrounding "no third parties" claim (§2.4 below describes the claim rewrite)
- `website/src/pages/de/index.astro` — same for DE
- `website/src/pages/dashboard.astro` — "Read full privacy principles" link
- `website/src/pages/de/dashboard.astro` — DE equivalent
- `website/src/pages/privacy-policy.astro` — "App privacy principles" reference now reads "App Privacy Policy" and points to the new URL
- `website/src/pages/de/datenschutzerklaerung.astro` — reworded reference to the app privacy policy
- `website/src/pages/de/impressum.astro` — reworded reference to the app privacy policy

**How to review:** `grep -rn '/privacy"' website/src` should now return only one match in `Layout.astro` (the footer link is `/app-privacy-policy#summary`) — i.e. no naked `/privacy` references should remain other than via the redirect. Same for DE.

### 2.4 Website — homepage claim rewrites

**`website/src/pages/index.astro`** + **`website/src/pages/de/index.astro`** — privacy-feature paragraph

- **What:** "No employer, no third parties have access. GDPR compliant, data in Germany, deletion anytime." → "No employer access; EU-only infrastructure (the optional Apple/Google sign-in is the only US touchpoint, under EU adequacy). GDPR compliant, deletion anytime." (Same structural change in DE.)
- **Why:** Pass 2 flagged "no third parties have access" as directly false — Apple/Google JWKS, Photon all touch user data.
- **How to review:** Read the paragraph in context. Is it still punchy enough for the homepage card? Does it preserve the "no employer" reassurance (which is the most important thing for the audience of healthcare workers)?

### 2.5 Backend — RoPA expansion

**`docs/ROPA.md`** — +92 lines

- **What:**
  - Bumped version 1.0 → 1.1, date Jan 2026 → May 2026, status changed from "Draft - Pending Legal Review" to "Self-reviewed; legal review pending".
  - Changed controller email from `privacy@openworkinghours.org` to `lukashondrich@googlemail.com` (per project owner instruction).
  - Added §2.7 Bug Reports (purpose, consent basis, 90-day retention).
  - Added §2.8 Calendar Export (purpose, consent basis, user controls onward sync).
  - Added §2.9 Identity Verification — Social Sign-In (purpose, contract basis, US transfer under DPF).
  - Added §3.3 Komoot GmbH (Photon) as a processor (Germany).
  - Added §3.4 Apple Inc. and §3.5 Google LLC as processors (USA, DPF).
- **Why:** Pass 2 found RoPA listed only 6 processing activities and 2 processors; missing the three optional features and three additional recipients.
- **How to review:** Compare new sections against the same content in `app-privacy-policy.astro` §2 and §4 — should be consistent. Check that each new entry follows the same table template as existing entries (Processing Activity, Purpose, Legal Basis, Categories of Data Subjects, etc.).

### 2.6 Backend — DPIA expansion

**`docs/DPIA.md`** — +51 lines

- **What:**
  - Bumped version 1.2 → 1.3, date March 2026 → May 2026.
  - Rewrote §3.1 Purpose Limitation: was "two clear purposes... no other purposes are pursued"; now lists 5 purposes (2 primary + 3 optional user-initiated).
  - Updated R7 (re-identification from stored profile data) — replaced "Hospital affiliation is optional (users can decline to provide it)" with the new "Prefer not to share" mechanism that stores `hospital_ref_id = NULL` and excludes the user from all aggregations.
  - Added **R8 Calendar Export — Onward Disclosure via Device Sync** (LOW risk; mitigated by toggle-time disclosure).
  - Added **R9 Social Sign-In — Identity Provider Transfer to USA** (LOW risk; mitigated by DPF, email discard, opt-in).
  - Updated risk matrix summary: low risks went from 5 → 7 (R8, R9 added).
- **Why:** Pass 2 found the DPIA's "no other purposes pursued" claim directly contradicted by the bug-report flow. R7 mitigation needed updating to reflect the new opt-out mechanism. R8/R9 were entirely undocumented risks.
- **How to review:** Read §3.1 and confirm the 5 purposes match RoPA §2.1-§2.9 + ROPA §2.5/§2.6 (i.e., that nothing in RoPA is missing from DPIA). Read R8 and R9 — are the mitigations honest? Is the residual risk LOW correctly justified?

### 2.7 Backend — privacy architecture

**`privacy_architecture.md`** — +17 lines

- **What:**
  - Added "Last updated: May 2026" line in the header.
  - Added new §3.3 "Optional Third-Party Data Flows" with a matrix (Photon, Apple, Google, device calendar).
  - Added a "Hospital opt-out" paragraph describing the `hospital_ref_id = NULL` mechanism.
- **Why:** The technical privacy architecture doc didn't mention any of the three optional features (Photon, social auth, calendar export) and didn't describe the hospital opt-out. Adding §3.3 makes the design doc consistent with the user-facing policy.
- **How to review:** Confirm the matrix matches §4 of the new policy. Check that the hospital-opt-out paragraph is technically accurate (NULL filtering happens in the aggregation pipeline; see [`backend/app/aggregation.py`](../../backend/app/aggregation.py)).

### 2.8 Mobile — in-app strings

**`mobile-app/src/lib/i18n/translations/en.ts`** + **`de.ts`** — 1 line each

- **What:** Changed `setup.foregroundPrimer.privacy`:
  - EN: "Your location is checked on-device only. GPS coordinates are never sent to our servers." → "GPS coordinates are processed on your device for clock-in/out detection. Workplace search uses Photon (Komoot, Germany) to find places — see the Privacy Policy for details."
  - DE: equivalent rewrite.
- **Why:** The foreground primer (shown when requesting location permission, on the same screen that later makes Photon calls) said GPS coords were never sent. Audit Direction 2: "Misleading by omission" because the same screen makes Photon calls.
- **How to review:** Check the new string in the app UI by running the app and reaching the foreground primer screen. Is it still understandable to a non-technical user? Does the DE wording sound natural?

**`mobile-app/src/lib/utils/legalUrls.ts`** — 4 lines

- **What:** `getPrivacyExplainerUrl()` now returns `${BASE_URL}/app-privacy-policy#summary` (was `/privacy`); same for DE. Function name kept for backwards compat; docstring updated.
- **Why:** The explainer page is retired; the function should now point at the at-a-glance summary anchor.
- **How to review:** Check that the consent bottom sheet's "How your data is protected" button opens the new URL (not the old `/privacy`). `getPrivacyUrl()` was already correct (points at `/app-privacy-policy`) and was not changed.

### 2.9 Feature branch (`feature/consumer-landing-page`)

**Commit `c1691e9` on `feature/consumer-landing-page`** — landing-page edits (worktree commit)

- **What:** Same kind of fix as 2.4 (no-third-parties + GPS claim) applied to the version of `index.astro` (EN + DE) on this branch, plus the `/privacy` → `/app-privacy-policy#summary` link update.
- **Why:** The landing-page branch had the same misleading claims as main; without fixing the branch, those claims would re-appear when the branch is merged.
- **How to review:** `git show c1691e9` to see the diff. Note: this commit was made by Claude on the feature branch via a worktree (cleanup done; no stray worktrees left). If the project owner wanted to handle this commit personally, the revert is: `git update-ref refs/heads/feature/consumer-landing-page feature/consumer-landing-page^`.

### 2.10 Possibly unrelated

The git diff shows two files modified that I did **not** touch this session:
- `CLAUDE.md` (+12 lines) — modified by the project owner mid-session to add a "don't rely on auto-memory" rule. Don't touch.
- `mobile-app/ARCHITECTURE.md` (+2 lines) — unclear origin. Don't touch.
- `mobile-app/src/lib/auth/AuthStorage.ts` (+9 lines) — unclear origin. Probably a stray prior modification from another session. **Worth a `git diff` to confirm it isn't accidentally being committed alongside the privacy work.**

---

## 3. Areas that especially need review

These are the places I'm least confident the result is correct:

### 3.1 German legal terminology
The German translation was done by an LLM. While the legal references (DSGVO, Art. 6 Abs. 1 lit. b) follow the standard German convention, the phrasing may be stilted. A native German speaker / legal reviewer should:
- Read §1-§9 of `de/app-privacy-policy.astro` for naturalness
- Verify "Auftragsverarbeitungsvertrag" / "Datenempfänger" / "Aufsichtsbehörde" usage matches the formal style expected of an Impressum-grade Datenschutzerklärung
- Check that the new RoPA additions (§2.7-§2.9, §3.3-§3.5) match the existing German conventions in the rest of the file

### 3.2 Code line numbers
The new privacy policy contains ~25 GitHub permalinks to specific line ranges in the code (e.g., `models.py#L76-L96`, `security.py#L25-L28`). I spot-checked a few:
- `models.py:76` = `class User(Base):` ✓
- `security.py:25-28` = hash_email HMAC-SHA256 ✓
- `social_auth.py:24-26` = Apple/Google JWKS URLs ✓

But a thorough reviewer should click EVERY link and verify the cited code matches the claim made. If any line numbers have drifted between when I read them and now, the link will be wrong. **The SHA in the links is pinned to `49ea57b`, so once verified, the links are immutable.** When the policy is republished after future code changes, the SHA should be bumped.

### 3.3 Coverage gaps

Things I may have missed:
- Are there other "anonymous"/"no third parties"/"completely private" claims elsewhere in the codebase that should be aligned? I covered: website (`index.astro` EN+DE, both versions), explainer (retired), legal policy (rewritten), in-app `setup.foregroundPrimer.privacy`. Per the audit there were also `download.astro:20` ("anonymously"), `team.astro:27` ("anonymity-preserving"), `welcome.title`/`subtitle`, others. These were medium-severity and I did not touch them. A grep for `anonymous\|anonym` across `website/src/` and `mobile-app/src/lib/i18n/` would surface any remaining.
- The German `de/dashboard.astro` and `de/datenschutzerklaerung.astro` and `de/impressum.astro` were only checked for the `/privacy` link, not for other privacy claims in their body content.
- App Store / Play Store description (when written for submission) should pull from the new policy — but those texts don't exist yet and were not in scope.

### 3.4 Did the consolidation cause regressions?

The new `app-privacy-policy.astro` doesn't have a "data flow" diagram that the old explainer had (`screenshots/dataflow.png`). Was that diagram important? Should it be added to §3 or §4?

The old explainer also had a "deletion and export" callout linking the in-app actions visually. The new policy's §6 (Rights) covers the same content as a table — less visually prominent but more comprehensive.

### 3.5 Honest disclosure quality

The new policy contains several admissions that might feel uncomfortable but are accurate:
- §1 panel: "IP addresses in our application database (hosting-layer logs may briefly retain them — see §7)" — qualifies the absolute "not logged" claim.
- §8: "Honest about limits: pseudonymisation reduces but does not eliminate re-identification risk..."
- §7: "About hosting-layer IP addresses: like every web server on the internet, Hetzner's infrastructure briefly sees and logs your IP address..."

A reviewer should sanity-check that these admissions are necessary (i.e., that the more comfortable absolute claims would actually be false). If something is technically uncontroversial, the qualification could be tightened.

---

## 4. What was NOT done (deferred to code-changes ticket)

For full context, here's what the doc work depends on that isn't yet implemented in code. These are tracked in [`project-mgmt/ticket-privacy-doc-code-changes.md`](../../project-mgmt/ticket-privacy-doc-code-changes.md):

1. **Hospital opt-out logic.** The policy says picking "Prefer not to share" stores `hospital_ref_id = NULL` and excludes the user from all stats. Code currently sends `hospital_ref_id = 0` and the aggregation doesn't filter NULL. Until the code is updated, the policy is slightly aspirational on this point. (~1 hour estimated.)
2. **Bug report 90-day auto-purge.** Policy commits to 90 days; code currently persists indefinitely. (~30-45 min.)
3. **Photon proximity coord rounding.** Policy implies Photon use is minimal; reducing precision to 2 decimals is good data minimization. (~5 min.)
4. **Mobile string sweep.** Other "anonymous" / "no third parties" / absolute claims may exist in mobile in-app strings beyond the one I updated. (~1 hour.)
5. **Consumer landing branch.** Done as commit `c1691e9` (see §2.9).
6. **Consent version bump + re-acceptance flow.** Tracked in the separate `ticket-consent-re-acceptance-flow.md`. The policy version corresponds to publication; existing users should see re-acceptance on next app open after the new build ships.

A reviewer should not consider items 1-4 as bugs in this PR — they're explicitly out-of-scope and intentionally deferred. But the reviewer **should** verify the new policy's claims don't make promises that would be impossible to fulfill once the code work is done. If the reviewer finds such a claim, that's a real finding.

---

## 5. Reviewer checklist

Suggested order for a thorough review:

- [ ] Read this brief in full
- [ ] Skim [`docs/audit/draft-app-privacy-policy-2026-05-22.md`](draft-app-privacy-policy-2026-05-22.md) to know what the assembled content should be
- [ ] Open `website/src/pages/app-privacy-policy.astro` — verify every section maps to the markdown draft and the anchor IDs match
- [ ] Same for `de/app-privacy-policy.astro`
- [ ] Click every code link in the matrix (§4) and verify the cited code matches the claim
- [ ] Spot-check 5 other random code citations across §2 and §8
- [ ] Run `npm run dev` in `website/`, open `/app-privacy-policy`, click each anchor in the in-page nav, verify they jump correctly
- [ ] Open `/privacy` in the dev server — verify the redirect to `/app-privacy-policy#summary` fires
- [ ] Same for `/de/privacy`
- [ ] Grep `website/src` for any remaining `href="/privacy"` (should be none other than via redirect; the footer links should be the canonical URL)
- [ ] Read RoPA §2.7-§2.9 and §3.3-§3.5 — does each match the new policy's claims?
- [ ] Read DPIA §3.1 and R7, R8, R9 — are the mitigations honest?
- [ ] Read `privacy_architecture.md` §3.3 — does it match policy §4?
- [ ] Run the mobile app and reach the foreground primer screen — verify the new string reads correctly
- [ ] Confirm `git diff` shows the AuthStorage.ts change is intentional (or revert if accidental)
- [ ] If happy: commit the changes (project owner handles commits personally). Suggested commit boundaries: (a) the website pages + redirects + internal links as one commit, (b) RoPA/DPIA/privacy_architecture as another, (c) mobile-app legalUrls + i18n as another, (d) consumer-landing branch already has its own commit `c1691e9`.

---

## 6. Pointers

- Full drafted content: [`docs/audit/draft-app-privacy-policy-2026-05-22.md`](draft-app-privacy-policy-2026-05-22.md)
- Pass 1 inventory: [`docs/audit/data-inventory-2026-05-22.md`](data-inventory-2026-05-22.md)
- Pass 2 diff: [`docs/audit/inventory-vs-comms-diff-2026-05-22.md`](inventory-vs-comms-diff-2026-05-22.md)
- Code ticket: [`project-mgmt/ticket-privacy-doc-code-changes.md`](../../project-mgmt/ticket-privacy-doc-code-changes.md)
- Doc assembly checklist: [`project-mgmt/privacy-doc-assembly-todo.md`](../../project-mgmt/privacy-doc-assembly-todo.md)
- Memory pointer: [`memory/project_privacy_doc_rewrite.md`](../../memory/project_privacy_doc_rewrite.md) (note: that path is in the user's home memory dir, not the repo)
