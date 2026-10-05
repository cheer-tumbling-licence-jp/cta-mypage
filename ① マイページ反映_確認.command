#!/bin/bash
cd "$(dirname "$0")"
echo "=============================================="
echo " CTA マイページ 反映【確認モード】"
echo " ※ここでは書き込みません。反映される内容を表示するだけです"
echo "=============================================="
python3 -c "import openpyxl" 2>/dev/null || pip3 install openpyxl --quiet
python3 sync_to_supabase.py --dry-run
echo ""
read -n 1 -s -r -p "確認できたらキーを押して閉じてください"
