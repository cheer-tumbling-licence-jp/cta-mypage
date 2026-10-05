#!/bin/bash
cd "$(dirname "$0")"
echo "=============================================="
echo " CTA マイページ 反映【実行モード】"
echo " 受講管理Excelの合否をマイページに反映します"
echo "=============================================="
python3 -c "import openpyxl" 2>/dev/null || pip3 install openpyxl --quiet
python3 sync_to_supabase.py
echo ""
echo "----- 上に「✅ 反映完了」と出ていれば成功です -----"
read -n 1 -s -r -p "キーを押して閉じてください"
