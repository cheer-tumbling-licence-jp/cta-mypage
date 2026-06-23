/* 受講者マイページのロジック（Supabase） */
(function () {
  const D = window.CTA.data;
  let memberName = "";

  document.getElementById("logoutBtn").addEventListener("click", async function () {
    await D.logout();
    location.href = "index.html";
  });

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function statusBadge(status) {
    if (status === "合格") return '<span class="badge good">合格</span>';
    if (status === "不合格") return '<span class="badge warn">不合格</span>';
    if (status === "採点中") return '<span class="badge pending">採点中</span>';
    return '<span class="badge">' + esc(status) + "</span>";
  }

  // お祝い／応援メッセージ（文章は協会の言葉に差し替え可）
  function buildResultMessage(isPass, name, level) {
    const n = esc(name); const lv = esc(level);
    if (isPass) {
      return "おめでとうございます！<br>" + n + " さんは、" + lv +
        "認定試験に<b>合格</b>されました。<br>" +
        "これまでの努力が実を結びました。指導者としてのさらなるご活躍を期待しています。";
    }
    return "今回は惜しくも合格基準に届きませんでした。<br>" +
      "講師コメントを参考に、ぜひ<b>次年度の試験</b>に再チャレンジしてください。<br>" +
      "あなたの挑戦を協会は応援しています。";
  }

  async function render() {
    // ログイン確認
    const session = await D.currentSession();
    if (!session || session.role !== "member") { location.href = "index.html"; return; }

    // プロフィール（お名前・受講者ID・所属）
    let profile = null;
    try { profile = await D.getMyProfile(); } catch (e) {}
    memberName = (profile && profile.name) || session.email || "受講者";
    document.getElementById("who").textContent = memberName + " さん";
    document.getElementById("greeting").textContent = memberName + " さんのマイページ";
    if (profile) {
      const meta = [profile.memberId, profile.org].filter(Boolean).join("　／　");
      document.getElementById("memberMeta").textContent = meta;
    }

    // 新着情報
    try {
      const news = await D.getMyNews();
      const el = document.getElementById("news");
      if (!news.length) {
        el.innerHTML = '<p class="empty">現在お知らせはありません。</p>';
      } else {
        el.innerHTML = news.map(function (n) {
          const pin = n.pinned ? '<span class="pin-flag">📌 重要</span>' : "";
          const exp = n.expiresAt ? '<span class="muted">（掲載期限 ' + esc(n.expiresAt) + "）</span>" : "";
          return (
            '<div class="news-item">' +
              '<div class="t">' + pin + esc(n.title) + "</div>" +
              '<div class="d">' + esc(n.publishedAt) + " " + exp + "</div>" +
              '<div class="b">' + esc(n.body) + "</div>" +
            "</div>"
          );
        }).join("");
      }
    } catch (e) {}

    // 合否結果（タップで大きく発表）
    try {
      const results = await D.getMyResults();
      const el = document.getElementById("results");
      if (!results.length) {
        el.innerHTML = '<p class="empty">受験記録はまだありません。</p>';
      } else {
        el.innerHTML = results.map(function (r) {
          const title = esc(r.level) + (r.event ? "　/　" + esc(r.event) : "");
          if (r.status === "採点中") {
            return (
              '<div class="result-item">' +
                '<div class="result-head"><span class="lv">' + title + "</span>" +
                  statusBadge("採点中") + "</div>" +
                '<div class="result-meta">受験日：' + esc(r.examDate || "—") +
                  "　／　結果は現在採点中です。発表までお待ちください。</div>" +
              "</div>"
            );
          }
          const isPass = r.status === "合格";
          const big = isPass ? "good" : "warn";
          const msg = buildResultMessage(isPass, memberName, r.level);
          const comment = r.comment
            ? '<div class="result-comment"><span class="lab">講師コメント</span>' + esc(r.comment) + "</div>"
            : "";
          const meta = '<div class="result-meta" style="text-align:center">受験日：' + esc(r.examDate || "—") + "</div>";
          const noteText = isPass
            ? "なお、認定試験に合格されただけでは、まだ資格の登録は完了していません。今後のお手続きを必ずご確認ください。"
            : "再受験が可能です。今後のお手続き（再受験のお申し込み等）を、下のボタンからご確認ください。";
          const procBtn = '<a class="btn proc-btn" href="procedures.html">今後のお手続きについて　→</a>';
          return (
            '<div class="reveal-card" data-reveal="' + esc(r.id) + '" data-pass="' + (isPass ? "1" : "0") + '">' +
              '<button class="reveal-btn" type="button"><span class="ic">✉️</span>' + title + 'の結果を見る</button>' +
              '<div class="reveal-panel"><div class="reveal-inner">' +
                '<div class="reveal-exam">' + title + "</div>" +
                '<div class="reveal-big ' + big + '">' + esc(r.status) + "</div>" +
                '<div class="reveal-msg">' + msg + "</div>" +
                meta + comment +
                '<div class="reveal-note">' + noteText + "</div>" +
                procBtn +
              "</div></div>" +
            "</div>"
          );
        }).join("");
        el.querySelectorAll(".reveal-card").forEach(function (card) {
          const btn = card.querySelector(".reveal-btn");
          const panel = card.querySelector(".reveal-panel");
          btn.addEventListener("click", function () {
            const open = card.classList.toggle("open");
            panel.style.maxHeight = open ? panel.scrollHeight + 60 + "px" : "0";
            // 合格を開いたときだけ認定証セクションを表示（タップ前は結果を隠す）
            if (open && card.getAttribute("data-pass") === "1") {
              const cc = document.getElementById("certsCard");
              if (cc) cc.style.display = "";
            }
          });
        });
      }
    } catch (e) {}

    // 認定証
    try {
      const certs = await D.getMyCertificates();
      const el = document.getElementById("certs");
      if (!certs.length) {
        el.innerHTML = '<p class="empty">ダウンロードできる認定証はまだありません。合格すると発行されます。</p>';
      } else {
        el.innerHTML = certs.map(function (c) {
          const meta = [
            c.certNo ? "認定番号：" + esc(c.certNo) : "",
            c.issuedAt ? "認定日：" + esc(c.issuedAt) : "",
            c.expiry ? "有効期限：" + esc(c.expiry) : "",
          ].filter(Boolean).join("　／　");
          return (
            '<div class="result-item">' +
              '<div class="result-head"><span class="lv">' + esc(c.title) + "</span>" +
                '<button class="btn sm" data-member="' + esc(c.memberId) + '">📥 ダウンロード</button></div>' +
              '<div class="result-meta">' + meta + "</div>" +
            "</div>"
          );
        }).join("");
        el.querySelectorAll("[data-member]").forEach(function (btn) {
          btn.addEventListener("click", async function () {
            const orig = btn.textContent;
            btn.disabled = true; btn.textContent = "準備中…";
            try {
              const url = await D.getCertificateUrl(btn.getAttribute("data-member"));
              if (url) {
                location.href = url;
              } else {
                alert("認定証は現在発行準備中です。発行されましたら、こちらからダウンロードできます。");
              }
            } catch (e) {
              alert("認定証は現在発行準備中です。発行されましたら、こちらからダウンロードできます。");
            } finally {
              btn.disabled = false; btn.textContent = orig;
            }
          });
        });
      }
    } catch (e) {}
  }

  render();
})();
