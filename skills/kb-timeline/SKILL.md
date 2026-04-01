---
name: kb-timeline
description: Query the knowledge base timeline to see when information was added or how knowledge evolved over time.
user-invocable: true
allowed-tools: Bash(clawkb *)
argument-hint: [time range, e.g. "last week"]
---

## Knowledge Timeline

Browse knowledge entries chronologically.

### Usage
```bash
# Recent entries
clawkb timeline --limit 10 --format json

# Specific time range
clawkb timeline --from "2026-01-01" --to "2026-03-30" --format json
```
