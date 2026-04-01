---
name: kb-note
description: Add a note or knowledge entry to the user's personal knowledge base. Use when capturing decisions, insights, code patterns, or any information worth remembering for future sessions.
user-invocable: true
allowed-tools: Bash(clawkb *)
argument-hint: [note content or title]
---

## Add Knowledge Note

Capture important information into the personal knowledge base.

### Usage
When the user explicitly asks to save something, or when a significant decision is made:

1. **Compose**: Extract the key information into a clear, searchable note
2. **Tag**: Add relevant tags for future retrieval
3. **Save**: Run `clawkb add-note --title "<title>" --content "<content>" --tags "<tag1>,<tag2>"`

### Example Commands
```bash
# Save a design decision
clawkb add-note \
  --title "Auth Strategy: JWT vs Sessions" \
  --content "Decided to use JWT for microservices. Refresh tokens stored in httpOnly cookies. Access token TTL: 15min." \
  --tags "auth,architecture,decision"

# Save a code pattern
clawkb add-note \
  --title "Error Handling Pattern" \
  --content "Use Result<T, AppError> everywhere. AppError has variants: NotFound, Validation, Internal." \
  --tags "rust,pattern,error-handling"

# Import a file
clawkb import ./docs/api-spec.md --tags "api,spec"
```

### What to Capture
- **Decisions**: Architecture choices, library selections, trade-off rationale
- **Patterns**: Reusable code patterns, conventions, naming rules
- **Insights**: Bug root causes, performance findings, security considerations
- **Context**: Meeting outcomes, requirement clarifications, scope changes

### Quality Guidelines
- Title: Concise, descriptive, searchable
- Content: Self-contained, includes enough context to be useful without the conversation
- Tags: 2-5 tags covering the domain, technology, and type (decision/pattern/insight)
