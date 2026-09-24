---
name: Audit identity history
description: Why audit decision actor names are preserved at evaluation time.
---

Preserve the authenticated actor's stable ID and their display name as observed when a decision is created. Do not replace historical display names by looking up the actor's current profile when rendering a timeline.

**Why:** Audit readers need to understand what identity was associated with the action at the time it happened; profile changes or deleted accounts should not silently rewrite historical attribution.

**How to apply:** For new immutable audit events, capture both the stable actor identity and a readable name at event creation. For older events missing either, show an explicit unknown-actor label rather than attributing them to the system.