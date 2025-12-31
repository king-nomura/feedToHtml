#!/bin/bash

# outboxToHtml - ActivityPub Outbox to HTML converter
# Usage: ./outboxtohtml.sh <OUTBOX_URL> [options]
#        ./outboxtohtml.sh --file <FILE> [options]

# スクリプトのディレクトリを取得
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Node.jsでCLIを実行
node "${SCRIPT_DIR}/src/cli/outbox_main.js" "$@"
