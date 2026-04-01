---
name: kb-search
description: Search the ClawKB personal knowledge base for documents, notes, code snippets, and domain knowledge. Use when you need project context, past decisions, or domain-specific information.
user-invocable: true
allowed-tools: Bash(clawkb *)
argument-hint: [search query]
---

## Knowledge Base Search

Search the user's personal knowledge base to find relevant context.

### Usage
When the user asks about a topic, or you need background context for a task:

1. **Search**: Run `clawkb search "$ARGUMENTS" --mode hybrid --limit 5 --format json`
2. **Review**: Examine the top results for relevance
3. **Synthesize**: Combine findings into your response with citations
4. **Deep dive**: If needed, run `clawkb entities "<entity-name>"`

### Search Modes
- `--mode lex` — Fast keyword matching (BM25), best for exact terms
- `--mode sem` — Semantic vector search, best for conceptual queries
- `--mode hybrid` — Combined (default), best balance of precision and recall

### Example Commands
```bash
# Find documents about authentication
clawkb search "authentication JWT tokens" --mode hybrid --limit 5 --format json

# Quick lexical search
clawkb search "Rust error handling pattern" --mode lex --limit 3

# Check knowledge base statistics
clawkb stats
```

### When to Use
- Starting a new feature or debugging task
- The user references "that document" or "what we decided about X"
- You need project conventions, API patterns, or architectural decisions
- Reviewing code that references domain-specific concepts

### Context Budget
Load no more than 3-5 relevant documents per search to stay within context limits.
