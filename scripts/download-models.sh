#!/bin/bash
# download-models.sh — Download ONNX embedding models for ClawKB
set -e

MODELS_DIR="${1:-$HOME/.clawkb/models}"
mkdir -p "$MODELS_DIR"

echo "📥 Downloading ClawKB Embedding Models..."
echo "Target directory: $MODELS_DIR"
echo

# BGE-small-en-v1.5 (default, ~120MB)
MODEL_URL="https://huggingface.co/BAAI/bge-small-en-v1.5/resolve/main"
MODEL_NAME="bge-small-en-v1.5"

download_model() {
    local name=$1
    local url=$2
    local dir="$MODELS_DIR/$name"

    if [ -f "$dir/model.onnx" ]; then
        echo "✅ $name already downloaded"
        return
    fi

    echo "📦 Downloading $name..."
    mkdir -p "$dir"

    curl -L -o "$dir/model.onnx" "$url/onnx/model.onnx"
    curl -L -o "$dir/tokenizer.json" "$url/tokenizer.json"
    curl -L -o "$dir/config.json" "$url/config.json"

    echo "✅ $name downloaded"
}

# Download default model
download_model "$MODEL_NAME" "$MODEL_URL"

echo
echo "✅ Models downloaded to $MODELS_DIR"
echo
echo "To use a different model, set the environment variable:"
echo "  export CLAWKB_MODEL_PATH=$MODELS_DIR/<model-name>"
