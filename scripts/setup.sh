#!/bin/bash
# setup.sh — One-click setup script for ClawKB
set -e

echo "🦀 ClawKB Setup Script"
echo "========================"

# Check Rust
if ! command -v cargo &> /dev/null; then
    echo "❌ Rust not found. Installing..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
    source "$HOME/.cargo/env"
fi

echo "✅ Rust: $(cargo --version)"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 20+ from https://nodejs.org"
    exit 1
fi

echo "✅ Node.js: $(node --version)"

# Install frontend dependencies
echo ""
echo "📦 Installing frontend dependencies..."
cd "$(dirname "$0")/../src"
npm install

# Build Rust workspace
echo ""
echo "🔧 Building Rust workspace..."
cd ..
cargo build --workspace --release

# Install CLI globally (optional)
read -p "Install clawkb CLI globally? [y/N] " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "📦 Installing clawkb CLI..."
    cargo install --path crates/clawkb-cli
fi

# Install Skills
read -p "Install Skills to AI assistants? [y/N] " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "📦 Installing Skills..."
    ./scripts/setup-skills.sh
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "Usage:"
echo "  clawkb create ~/.clawkb/knowledge.mv2"
echo "  clawkb add-note --title 'Hello' --content 'World'"
echo "  clawkb search 'query'"
echo ""
echo "For Tauri desktop app:"
echo "  cargo tauri dev"
