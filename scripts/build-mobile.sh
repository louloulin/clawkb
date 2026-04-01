#!/bin/bash
# build-mobile.sh — Build ClawKB mobile apps (Android/iOS)
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

build_android() {
    echo "🤖 Building Android..."
    cd "$PROJECT_ROOT"

    # Check for Android SDK
    if [ -z "$ANDROID_HOME" ]; then
        echo "❌ ANDROID_HOME not set. Please install Android SDK."
        exit 1
    fi

    # Initialize Android if not already done
    if [ ! -d "src-tauri/gen/android" ]; then
        echo "📱 Initializing Android project..."
        cargo tauri android init
    fi

    # Build APK
    echo "📦 Building APK..."
    cargo tauri android build --release

    echo "✅ Android build complete!"
    echo "   APK: src-tauri/gen/android/app/build/outputs/apk/release/"
}

build_ios() {
    echo "🍎 Building iOS..."
    cd "$PROJECT_ROOT"

    # Check for macOS
    if [ "$(uname)" != "Darwin" ]; then
        echo "❌ iOS builds require macOS."
        exit 1
    fi

    # Check for Xcode
    if ! command -v xcodebuild &> /dev/null; then
        echo "❌ Xcode not found. Please install Xcode."
        exit 1
    fi

    # Initialize iOS if not already done
    if [ ! -d "src-tauri/gen/apple" ]; then
        echo "📱 Initializing iOS project..."
        cargo tauri ios init
    fi

    # Build IPA
    echo "📦 Building IPA..."
    cargo tauri ios build --release

    echo "✅ iOS build complete!"
    echo "   IPA: src-tauri/gen/apple/"
}

# Main
case "${1:-all}" in
    android)
        build_android
        ;;
    ios)
        build_ios
        ;;
    all)
        build_android
        build_ios
        ;;
    *)
        echo "Usage: $0 [android|ios|all]"
        exit 1
        ;;
esac
