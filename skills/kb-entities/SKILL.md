---
name: kb-entities
description: Query structured entity information from the knowledge base. Use when you need details about people, organizations, concepts, or any named entity.
user-invocable: true
allowed-tools: Bash(clawkb *)
argument-hint: [entity name]
---

## Entity Lookup

Retrieve structured information about named entities in the knowledge base.

### Usage
```bash
# Look up entity details
clawkb entities "$ARGUMENTS" --format json

# List all known entities
clawkb entities --list --format json
```

### When to Use
- The user mentions a person, team, or organization
- You need to understand relationships between concepts
- Looking up project stakeholders or domain terminology
