/* 受講者ログイン画面（Supabase メール＋パスワード） */
(function () {
  const D = window.CTA.data;

  const loginView = document.getElementById("loginView");
  const signupView = document.getElementById("signupView");
  const alertBox = document.getElementById("alert");
  const alertSignup = document.getElementById("alertSignup");

  function showError(box, msg) { box.innerHTML = '<div class="alert error">' + msg + "</div>"; }
  function showOk(box, msg) { box.innerHTML = '<div class="alert ok">' + msg + "</div>"; }

  // パスワード規則：8文字以上・英字と数字を含む
  function validatePassword(pw) {
    if (pw.length < 8) return "パスワードは8文字以上にしてください";
    if (!/[A-Za-z]/.test(pw)) return "パスワードに英字（a〜z）を1つ以上含めてください";
    if (!/[0-9]/.test(pw)) return "パスワードに数字（0〜9）を1つ以上含めてください";
    return null;
  }

  // 既にログイン済みならマイページへ
  (async function () {
    const s = await D.currentSession();
    if (s && s.role === "member") location.href = "mypage.html";
  })();

  // 画面切替
  document.getElementById("toSignup").addEventListener("click", function (e) {
    e.preventDefault(); loginView.style.display = "none"; signupView.style.display = "block";
  });
  document.getElementById("backToLogin").addEventListener("click", function (e) {
    e.preventDefault(); signupView.style.display = "none"; loginView.style.display = "block";
  });
  document.getElementById("toReset").addEventListener("click", async function (e) {
    e.preventDefault();
    const email = document.getElementById("email").value;
    if (!email) { showError(alertBox, "先にメールアドレス欄にご登録のメールを入力してから、もう一度「パスワードを忘れた方」をタップしてください"); return; }
    const link = document.getElementById("toReset");
    link.style.pointerEvents = "none"; link.style.opacity = "0.5";
    try {
      await D.sendPasswordReset(email);
      showOk(alertBox,
        '<b>' + email + ' 宛にパスワード再設定メールを送りました。</b><br>' +
        '① メールが届くまで最大5分待つ<br>' +
        '② 届いたメール内の <b>「Reset Password」ボタン</b> をタップ<br>' +
        '③ 開いたページで新しいパスワードを入力<br><br>' +
        '<small>※ 届かない場合は<b>迷惑メールフォルダ</b>もご確認ください（差出人：<code>noreply@mail.app.supabase.io</code>）。<br>' +
        '※ リンクの有効時間は <b>24時間</b> です。</small>');
    } catch (err) {
      var m = err.message || "";
      if (/rate limit|too many|429/i.test(m)) {
        showError(alertBox, "リクエストが多すぎます。恐れ入りますが、しばらく待ってから再度お試しください（15秒〜数分）。");
      } else {
        showError(alertBox, m);
      }
      link.style.pointerEvents = "auto"; link.style.opacity = "1";
    }
  });

  // ログイン
  document.getElementById("loginForm").addEventListener("submit", async function (e) {
    e.preventDefault();
    alertBox.innerHTML = "";
    const email = document.getElementById("email").value;
    const pw = document.getElementById("pw").value;
    const btn = document.getElementById("loginBtn");
    if (!email || !pw) { showError(alertBox, "メールアドレスとパスワードを入力してください"); return; }
    btn.disabled = true; btn.textContent = "確認中…";
    try {
      await D.loginMemberEmail(email, pw);
      location.href = "mypage.html";
    } catch (err) {
      showError(alertBox, err.message);
      btn.disabled = false; btn.textContent = "ログイン";
    }
  });

  // 初回パスワード設定
  document.getElementById("signupForm").addEventListener("submit", async function (e) {
    e.preventDefault();
    alertSignup.innerHTML = "";
    const email = document.getElementById("suEmail").value;
    const pw = document.getElementById("suPw").value;
    const btn = document.getElementById("signupBtn");
    if (!email || !pw) { showError(alertSignup, "メールアドレスとパスワードを入力してください"); return; }
    const pwErr = validatePassword(pw);
    if (pwErr) { showError(alertSignup, pwErr); return; }
    btn.disabled = true; btn.textContent = "設定中…";
    try {
      const res = await D.signUpMember(email, pw);
      if (res.needsConfirm) {
        showOk(alertSignup, "確認メールを送りました。メール内のリンクを押すと設定完了です。その後ログインしてください。");
        btn.disabled = false; btn.textContent = "パスワードを設定する";
      } else {
        location.href = "mypage.html";
      }
    } catch (err) {
      showError(alertSignup, err.message);
      btn.disabled = false; btn.textContent = "パスワードを設定する";
    }
  });
})();
