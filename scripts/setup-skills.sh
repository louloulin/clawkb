#!/bin/bash
# scripts/setup-skills.sh — Install ClawKB Skills to AI coding assistants

CLAWKB_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SKILLS_DIR="$CLAWKB_DIR/skills"
KB_PATH="${1:-$HOME/.clawkb/knowledge.mv2}"

# Ensure clawkb CLI is in PATH
export PATH="$CLAWKB_DIR/target/release:$PATH"

echo "Installing ClawKB Skills..."

# Claude Code
mkdir -p ~/.claude/skills
for skill in "$SKILLS_DIR"/*/; do
  skill_name=$(basename "$skill")
  cp -r "$skill" ~/.claude/skills/"$skill_name"
  echo "  ✓ Claude Code: installed $skill_name"
done

# Codex CLI
mkdir -p ~/.codex/skills
for skill in "$SKILLS_DIR"/*/; do
  skill_name=$(basename "$skill")
  cp -r "$skill" ~/.codex/skills/"$skill_name"
  echo "  ✓ Codex CLI: installed $skill_name"
done

# OpenClaw
mkdir -p ~/.openclaw/skills
for skill in "$SKILLS_DIR"/*/; do
  skill_name=$(basename "$skill")
  cp -r "$skill" ~/.openclaw/skills/"$skill_name"
  echo "  ✓ OpenClaw: installed $skill_name"
done

echo ""
echo "Done! Skills installed to Claude Code, Codex CLI, and OpenClaw."
echo "Knowledge base path: $KB_PATH"
