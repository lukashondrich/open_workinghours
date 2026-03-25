# Ticket: PostgreSQL Encryption at Rest

**Priority:** Medium
**Context:** DPIA update (R7 — re-identification from stored profile data)
**Status:** Open

## Problem

The DPIA lists "encryption at rest" as an existing control for stored profile data. Currently, this relies solely on Hetzner's infrastructure-level disk encryption. There is no application-level or PostgreSQL-level encryption configured.

With the v2 taxonomy adding `hospital_ref_id` (linking to ~1,220 named hospitals), stored profile data is more identifying than before. The combination of hospital + profession + seniority + department could narrow to a small number of individuals at smaller hospitals. Proper encryption at rest strengthens the mitigation for this risk.

## Options to Evaluate

1. **PostgreSQL TDE (Transparent Data Encryption)** — encrypts data files at the database level. Not natively supported in standard PostgreSQL; requires extensions or enterprise forks.

2. **Column-level encryption** — encrypt sensitive columns (`hospital_ref_id`, `email_hash`) using `pgcrypto`. Application decrypts at query time. Adds complexity but targets the highest-risk fields.

3. **Full-disk encryption (LUKS)** — encrypt the Docker volume or data partition. Hetzner may already provide this at the infrastructure level — needs verification.

4. **Accept Hetzner infra-level encryption** — document what Hetzner provides, verify it covers the DB volume, and note in the DPIA that encryption at rest is infrastructure-provided rather than application-level.

## Action Items

- [ ] Verify what Hetzner actually provides (volume encryption? LUKS? at-rest guarantees?)
- [ ] Decide on approach (options above)
- [ ] Implement
- [ ] Update DPIA R7 controls to accurately reflect what's in place

## Notes

This was identified during the DPIA review for the v2 taxonomy data model update (March 2026). The DPIA should accurately reflect the *actual* controls, not aspirational ones. If we decide Hetzner infra-level encryption is sufficient, the DPIA wording should say "infrastructure-level encryption at rest (Hetzner)" rather than implying application-level encryption.
