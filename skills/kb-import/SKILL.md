---
name: kb-import
description: Import files, documents, or text content into the knowledge base. Use when the user wants to add existing knowledge to their local KB.
user-invocable: true
allowed-tools: Bash(clawkb *)
argument-hint: [file path or content]
---

## Import to Knowledge Base

Add existing content to the personal knowledge base.

### Usage
```bash
# Import a file
clawkb import "$ARGUMENTS" --tags "imported"

# Import a directory
clawkb import ./docs/ --recursive --tags "docs"
```
