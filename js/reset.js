/* パスワード再設定（メールのリンクから来たときに使う） */
(function () {
  const cfg = window.CTA.SUPABASE;
  const client = window.supabase.createClient(cfg.url, cfg.key);
  const alertBox = document.getElementById("alert");

  function show(cls, msg) { alertBox.innerHTML = '<div class="alert ' + cls + '">' + msg + "</div>"; }

  document.getElementById("form").addEventListener("submit", async function (e) {
    e.preventDefault();
    const pw = document.getElementById("pw").value;
    if (pw.length < 8 || !/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) {
      show("error", "パスワードは8文字以上・英字と数字を含めてください");
      return;
    }
    const btn = document.getElementById("btn");
    btn.disabled = true; btn.textContent = "設定中…";
    try {
      const { error } = await client.auth.updateUser({ password: pw });
      if (error) throw error;
      show("ok", "パスワードを変更しました。ログイン画面からログインしてください。");
      setTimeout(function () { location.href = "index.html"; }, 2200);
    } catch (err) {
      const m = /Auth session missing|not authenticated/i.test(err.message || "")
        ? "リンクの有効期限が切れている可能性があります。お手数ですが、もう一度「パスワードを忘れた方」からやり直してください。"
        : (err.message || "エラーが発生しました");
      show("error", m);
      btn.disabled = false; btn.textContent = "パスワードを設定する";
    }
  });
})();
