# Build Journal — Append Only

Every fix, dead end and decision on Procella is logged in `build journal.md` at the repository root.

**Format:** a `## YYYY-MM-DD HH:MM` heading (IST), then what broke, what was tried, why the decision
went the way it did. Newest entries at the BOTTOM.

**Why:** code and READMEs hold outcomes; the journal holds the reasoning. It stops the next session,
or the other partner, from repeating a mistake.

**How to apply:**
- Append with shell `>>` only. Never rewrite earlier entries and never read the whole file back.
- Every fix gets an entry in the same working session, before the commit that contains the fix.
- The journal is committed and pushed with the work it describes.
- No credentials, tokens or key values in the journal, ever.
