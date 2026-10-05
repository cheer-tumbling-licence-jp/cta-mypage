#!/bin/bash
cd "$(dirname "$0")"
echo "=============================================="
echo " CTA 受講管理ファイル データ点検（読むだけ）"
echo "=============================================="
python3 -c "import openpyxl" 2>/dev/null || pip3 install openpyxl --quiet
python3 cta_health_check.py
echo ""
read -n 1 -s -r -p "確認できたらキーを押して閉じてください"
