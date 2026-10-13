#!/bin/bash
cd "$(dirname "$0")"
echo "=============================================="
echo " CTA マイページ 確認＋反映（1クリック）"
echo "=============================================="
python3 -c "import openpyxl" 2>/dev/null || pip3 install openpyxl --quiet
python3 mypage_audit_sync.py
echo ""
read -n 1 -s -r -p "キーを押して閉じてください"
