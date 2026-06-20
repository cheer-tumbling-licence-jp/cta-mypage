/* 今後のお手続きページ（合否で内容を出し分け） */
(function () {
  const D = window.CTA.data;

  document.getElementById("logoutBtn").addEventListener("click", async function () {
    await D.logout();
    location.href = "index.html";
  });

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // 手続きステップのカードHTML
  function stepCard(no, title, body) {
    return (
      '<section class="card proc-card">' +
        '<h2><span class="proc-no">' + no + "</span>" + esc(title) + "</h2>" +
        '<div class="proc-body">' + body + "</div>" +
      "</section>"
    );
  }

  async function render() {
    const session = await D.currentSession();
    if (!session || session.role !== "member") { location.href = "index.html"; return; }

    let profile = null;
    try { profile = await D.getMyProfile(); } catch (e) {}
    const name = (profile && profile.name) || session.email || "受講者";
    document.getElementById("who").textContent = name + " さん";

    let results = [];
    try { results = await D.getMyResults(); } catch (e) {}
    const latest = results[0];
    const proc = document.getElementById("proc");
    const sub = document.getElementById("leadSub");

    if (!latest) {
      sub.textContent = "";
      proc.innerHTML = '<p class="empty">受験記録がまだありません。</p>';
      return;
    }

    if (latest.status === "採点中") {
      sub.textContent = latest.level + "（" + (latest.examDate || "") + " 受験）";
      proc.innerHTML =
        '<div class="alert info">結果は現在採点中です。発表後、こちらで今後のお手続きをご案内します。</div>';
      return;
    }

    if (latest.status === "合格") {
      const isLevel1 = /1級|１級/.test(latest.level);
      sub.textContent = latest.level + " 合格 ／ " + name + " さん";
      let n = 0;
      let html = "";
      html += '<div class="alert info">認定試験に合格されただけでは、まだ資格の登録は完了していません。下のお手続きを順にご確認ください。</div>';

      // 振込先は合格者だけがDBから取得できる（コードには書かない）
      let pay = null;
      try { if (D.getPaymentInfo) pay = await D.getPaymentInfo(); } catch (e) {}
      const bankHtml = pay
        ? '<div class="bank-box">' +
            '<div class="bank-label">お振込先</div>' +
            "<div>" + esc(pay.bank) + "　" + esc(pay.branch) + "　" + esc(pay.account_type) + " <b>" + esc(pay.account_no) + "</b></div>" +
            "<div>口座名義：" + esc(pay.account_name) + "</div>" +
            (pay.note ? '<div class="muted" style="margin-top:6px">※' + esc(pay.note) + "</div>" : "") +
          "</div>"
        : '<span class="muted">※お振込先は別途ご案内します。</span>';

      html += stepCard(String(++n), "認定登録のお手続き（認定登録料のお支払い）",
        "合格後、<b>認定登録料</b>をお支払いいただくと、正式に資格が認定されます。" +
        '<ul class="proc-list">' +
          "<li>認定登録料：<b>3,300円（税込）</b></li>" +
          "<li>お支払い方法：<b>銀行振込</b></li>" +
          "<li>お支払い期限：合格発表から<b>14日以内</b></li>" +
        "</ul>" +
        bankHtml);

      html += stepCard(String(++n), "認定証の発行",
        "入金確認後、<b>1ヶ月以内</b>に認定証を発行します。発行されると、マイページの「<b>合格証・認定証</b>」からダウンロードできます。");

      // 更新は現在「1級のみ」（2級は更新なし／上位級へのステップアップを案内）
      if (isLevel1) {
        const expiryLine = latest.expiry
          ? "現在の認定の有効期限は <b>" + esc(latest.expiry) + "</b> です。"
          : "認定には有効期限があります。";
        html += stepCard(String(++n), "ライセンスの更新",
          expiryLine +
          '<ul class="proc-list">' +
            "<li>更新のご案内：有効期限の<b>2ヶ月前</b>にマイページでお知らせします</li>" +
            "<li>更新料：<b>11,000円</b></li>" +
          "</ul>");
      }

      if (latest.upperEligible) {
        html += stepCard(String(++n), "上位級へのチャレンジ",
          "あなたは<b>上位級（1級）の受験対象</b>です。次の級の講習・試験もぜひご検討ください。詳細は新着情報・公式サイトでご案内します。");
      }

      proc.innerHTML = html;
      return;
    }

    if (latest.status === "不合格") {
      sub.textContent = latest.level + " ／ " + name + " さん";
      let html = "";
      html += '<div class="alert info">再受験が可能です。下のご案内に沿ってお申し込みください。</div>';
      html += stepCard("1", "再受験のお申し込み",
        "次回の認定試験・講習会にお申し込みいただけます。<br>" +
        "お申し込み方法は現在準備中です。詳細は<b>協会事務局までお問い合わせ</b>ください。");
      html += stepCard("2", "必要書類・準備",
        "再受験にあたって特別な書類は必要ありません（ご登録内容に変更がある場合のみ、協会へご連絡ください）。");
      html += stepCard("3", "次回開催のご案内",
        "講習会・試験の日程は、マイページの<b>新着情報</b>、または<b>協会公式サイト</b>でご確認ください。");
      if (latest.comment) {
        html += stepCard("4", "講師からのアドバイス", esc(latest.comment));
      }
      proc.innerHTML = html;
      return;
    }

    proc.innerHTML = '<p class="empty">ご案内はありません。</p>';
  }

  render();
})();
