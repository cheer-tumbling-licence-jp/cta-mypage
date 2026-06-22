/* =====================================================================
 * CTA マイページ — データ層（Supabase 本番実装・受講者向け）
 * ---------------------------------------------------------------------
 * モック版 data.js と同じ「窓口」を提供します。受講者ページ（index/mypage）
 * はこのファイルを読み込みます。認証はメール＋パスワード（Supabase Auth）。
 * セキュリティ（自分の行だけ読める）は DB 側の RLS が強制します。
 * ===================================================================== */
(function () {
  const cfg = window.CTA.SUPABASE;
  const client = window.supabase.createClient(cfg.url, cfg.key);

  // エラーメッセージを日本語に
  function jp(msg) {
    const m = String(msg || "");
    if (/Invalid login credentials/i.test(m)) return "メールアドレスまたはパスワードが違います";
    if (/Email not confirmed/i.test(m)) return "メールの確認がまだです。届いた確認メールのリンクを押してください";
    if (/User already registered/i.test(m)) return "このメールアドレスは既に登録済みです。ログインしてください";
    if (/Password should be at least/i.test(m)) return "パスワードは6文字以上にしてください";
    if (/rate limit|too many/i.test(m)) return "試行回数が多すぎます。しばらく待ってからお試しください";
    return m;
  }

  // ---- 認証 --------------------------------------------------------
  async function currentSession() {
    const { data } = await client.auth.getSession();
    if (!data || !data.session) return null;
    return { role: "member", email: data.session.user.email, userId: data.session.user.id };
  }

  // アプリの公開フォルダURL（…/cta-mypage/）を求める
  function appBaseUrl() {
    return location.origin + location.pathname.replace(/[^/]*$/, "");
  }

  // 初回：本人がパスワードを設定（メール＝既存登録メールと一致すれば自動でひもづく）
  // 確認メールのリンクの戻り先を必ずアプリ本体に固定（404防止）
  async function signUpMember(email, password) {
    const { data, error } = await client.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: appBaseUrl() },
    });
    if (error) throw new Error(jp(error.message));
    return { needsConfirm: !data.session, session: data.session };
  }

  async function loginMemberEmail(email, password) {
    const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw new Error(jp(error.message));
    return data;
  }

  async function sendPasswordReset(email) {
    const redirect = location.origin + location.pathname.replace(/[^/]*$/, "") + "reset.html";
    const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo: redirect });
    if (error) throw new Error(jp(error.message));
    return true;
  }

  async function logout() { await client.auth.signOut(); }

  // ---- データ取得（RLS により自動的に「自分の分だけ」） -------------
  function mapMember(r) {
    return { memberId: r.member_code, name: r.name, kana: r.kana, org: r.org, email: r.email };
  }
  function mapResult(r) {
    return {
      id: r.id, memberId: r.member_code, level: r.level, event: "",
      status: r.status, examDate: r.exam_date || "", comment: r.comment || "",
      certNo: r.cert_no || "", expiry: r.expiry || "", upperEligible: !!r.upper_eligible,
    };
  }

  async function getMyProfile() {
    const { data, error } = await client.from("members").select("*").limit(1);
    if (error) throw new Error(jp(error.message));
    return data && data[0] ? mapMember(data[0]) : null;
  }

  async function getMyResults() {
    const { data, error } = await client.from("results").select("*").order("exam_date", { ascending: false });
    if (error) throw new Error(jp(error.message));
    return (data || []).map(mapResult);
  }

  async function getMyCertificates() {
    const results = await getMyResults();
    return results
      .filter((r) => r.status === "合格" && r.certNo)
      .map((r) => ({
        certId: r.certNo, certNo: r.certNo, memberId: r.memberId,
        title: r.level + " 認定証", level: r.level, issuedAt: r.examDate, expiry: r.expiry,
      }));
  }

  async function getMyNews() {
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await client.from("news").select("*").order("published_at", { ascending: false });
    if (error) throw new Error(jp(error.message));
    return (data || [])
      .filter((n) => !n.expires_at || n.expires_at >= today)
      .sort((a, b) => {
        if (!!b.pinned !== !!a.pinned) return b.pinned ? 1 : -1;
        return String(b.published_at || "").localeCompare(String(a.published_at || ""));
      })
      .map((n) => ({
        id: n.id, title: n.title, body: n.body, publishedAt: n.published_at,
        expiresAt: n.expires_at, scope: n.scope, pinned: n.pinned,
      }));
  }

  function daysUntil(dateStr) {
    if (!dateStr) return null;
    const a = Date.parse(dateStr + "T00:00:00");
    const b = Date.parse(new Date().toISOString().slice(0, 10) + "T00:00:00");
    if (isNaN(a) || isNaN(b)) return null;
    return Math.round((a - b) / 86400000);
  }

  // 振込先（payment_info）— RLSにより合格者のみ読める。不合格/未ログインは空→null
  async function getPaymentInfo() {
    const { data, error } = await client.from("payment_info").select("*").limit(1);
    if (error) return null;
    return data && data[0] ? data[0] : null;
  }

  async function getMyNextSteps() {
    const results = await getMyResults();
    const steps = [];
    const latest = results[0];
    if (!latest) {
      steps.push({ tone: "info", text: "受験記録がまだありません。講習会の開催情報をご確認ください。" });
      return steps;
    }
    if (latest.status === "合格") {
      steps.push({ tone: "good", text: `${latest.level}に合格しました。認定証をダウンロードできます。` });
      if (latest.expiry) {
        const left = daysUntil(latest.expiry);
        if (left != null && left <= 90) {
          steps.push({ tone: "warn", text: `認定の有効期限（${latest.expiry}）まで残り${left}日です。更新手続きをお願いします。` });
        } else {
          steps.push({ tone: "info", text: `認定の有効期限は ${latest.expiry} です。期限内の更新をご検討ください。` });
        }
      }
      if (latest.upperEligible) {
        steps.push({ tone: "info", text: "上位級の受験対象です。次の級へのチャレンジをご検討ください。" });
      }
    } else if (latest.status === "不合格") {
      steps.push({ tone: "warn", text: `${latest.level}は再受験が可能です。講師コメントを確認し、次回講習会へお申し込みください。` });
    } else if (latest.status === "採点中") {
      steps.push({ tone: "info", text: `${latest.level}（${latest.examDate} 受験）の結果は現在採点中です。発表までお待ちください。` });
    }
    return steps;
  }

  // ---- 公開API（モック版と同じ窓口） -------------------------------
  window.CTA = window.CTA || {};
  window.CTA.data = {
    currentSession,
    signUpMember, loginMemberEmail, sendPasswordReset, logout,
    getMyProfile, getMyResults, getMyCertificates, getMyNews, getMyNextSteps,
    getPaymentInfo,
    _backend: "supabase",
  };
})();
