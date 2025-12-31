#!/bin/bash

# feedToHtml - RSS to HTML converter
# Usage: ./feedtohtml.sh <RSS_URL> <OUTPUT_FILE> [--config <CONFIG_FILE>]

# スクリプトのディレクトリを取得
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Node.jsでCLIを実行
node "${SCRIPT_DIR}/src/cli/main.js" "$@"
