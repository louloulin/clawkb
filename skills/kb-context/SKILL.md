---
name: kb-context
description: Automatically load relevant knowledge base context for the current task. Use at the start of coding sessions or when switching to a new task area.
disable-model-invocation: false
allowed-tools: Bash(clawkb *), Read, Grep
---

## Session Context Loader

At the start of a coding session or when switching tasks:

1. **Detect project**: Identify the current project from the working directory
2. **Quick search**: Run `clawkb search "$ARGUMENTS" --mode hybrid --limit 3 --format json`
3. **Load context**: Present the relevant knowledge entries
4. **Apply**: Follow the patterns and conventions found

### Auto-Load Triggers
- Starting a new file or feature
- The user mentions a domain-specific term
- Debugging unfamiliar code
- About to make an architectural decision

### Context Budget
- Maximum 3 documents per auto-load
- Use `clawkb stats` to check KB health
- If no results, silently proceed without mentioning the KB

### Output Format
When context is loaded, briefly mention:
"Found relevant context from your knowledge base: [title1], [title2]. Applying these conventions."
