import './style.css';
import { isFirebaseConfigured, auth, db } from './firebase.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, updateProfile, signOut } from 'firebase/auth';
import { addDoc, collection, doc, getDoc, serverTimestamp } from 'firebase/firestore';

const app = document.querySelector('#app');
const demoUserKey = 'birthday-card-demo-user';
const demoCardsKey = 'birthday-card-demo-cards';
let currentUser = null;
let currentView = 'home';

const sampleCard = {
  to: 'あかり',
  message: '生まれてきてくれてありがとう。これからも、たくさん笑って過ごそうね。',
  sender: 'ゆうた',
  theme: 'lemon',
};

function escapeHTML(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' })[char]);
}

function getDemoUser() {
  try { return JSON.parse(localStorage.getItem(demoUserKey)); } catch { return null; }
}
function getDemoCards() {
  try { return JSON.parse(localStorage.getItem(demoCardsKey)) || {}; } catch { return {}; }
}
function saveDemoCards(cards) { localStorage.setItem(demoCardsKey, JSON.stringify(cards)); }
function uid() { return Math.random().toString(36).slice(2, 10); }
function shareUrl(id) { return `${location.origin}${location.pathname}#card/${id}`; }

function renderShell(content, active = 'home') {
  app.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <a class="brand" href="#home" aria-label="ホームへ"><span class="brand-mark">B</span><span>birthday<span class="brand-dot">.</span>card</span></a>
        <nav class="nav-links" aria-label="メインメニュー">
          <a class="${active === 'home' ? 'is-active' : ''}" href="#home">カードを見る</a>
          <a class="${active === 'create' ? 'is-active' : ''}" href="#create">カードをつくる</a>
        </nav>
        <div class="account-area">${accountButton()}</div>
      </header>
      <main>${content}</main>
      <footer><span>birthday.card</span><span>大切な日に、ちゃんと届く。</span></footer>
    </div>`;
  bindCommonEvents();
}

function accountButton() {
  const user = currentUser || getDemoUser();
  if (user) return `<button class="account-pill" data-action="account"><span class="avatar">${escapeHTML((user.displayName || user.nickname || '？').slice(0, 1))}</span>${escapeHTML(user.displayName || user.nickname)}<span class="chevron">⌄</span></button>`;
  return `<button class="button button-small button-dark" data-action="auth">ログイン / 登録</button>`;
}

function homeView() {
  renderShell(`
    <section class="hero-section">
      <div class="hero-copy">
        <p class="eyebrow"><span class="eyebrow-line"></span> a little card, a lot of feeling</p>
        <h1>おめでとうを、<br><em>カードに。</em></h1>
        <p class="hero-lede">誕生日の人にしか開けない、<br>小さなサプライズを贈ろう。</p>
        <div class="hero-actions"><a href="#create" class="button button-primary">カードをつくる <span>↗</span></a><a href="#how" class="text-link">このサービスについて <span>↓</span></a></div>
      </div>
      <div class="hero-art" aria-label="バースデーカードのプレビュー">
        <div class="confetti confetti-a">✦</div><div class="confetti confetti-b">•</div><div class="confetti confetti-c">✳</div>
        <div class="card-stack behind-card"></div>
        <div class="birthday-card">
          <div class="card-top"><span>birthday.card</span><span>2026</span></div>
          <div class="card-sun">✦</div>
          <div class="card-title">Happy<br><i>Birthday</i></div>
          <div class="card-bottom"><span>for あかり</span><span>♡</span></div>
        </div>
        <div class="hero-note">あなたの言葉で、<br><b>今日を特別に。</b></div>
      </div>
    </section>
    <section class="feature-strip" id="how">
      <div><span class="feature-no">01</span><b>ニックネームで<br>すぐに始める</b><small>本名の登録は必要ありません</small></div>
      <div><span class="feature-no">02</span><b>気持ちを込めて<br>カードをデザイン</b><small>3つのテーマから選べます</small></div>
      <div><span class="feature-no">03</span><b>リンクを送って<br>サプライズ</b><small>受け取った人だけが開けます</small></div>
    </section>
    <section class="quote-section"><span class="quote-mark">“</span><p>言葉にするのはちょっと照れるけど、<br>カードならちゃんと伝えられる。</p><span class="quote-caption">— birthday.card について</span></section>
  `);
}

function createView() {
  const user = currentUser || getDemoUser();
  if (!user) { renderShell(authView('create'), 'create'); return; }
  renderShell(`
    <section class="form-page"><div class="form-intro"><p class="eyebrow"><span class="eyebrow-line"></span> make it personal</p><h2>誰に、<em>贈る？</em></h2><p>あなたの言葉で、世界にひとつのカードを。</p></div>
      <form id="card-form" class="card-form">
        <label>贈る相手のニックネーム<input name="to" required maxlength="24" placeholder="例：あかり" /></label>
        <label>メッセージ<textarea name="message" required maxlength="240" placeholder="お誕生日おめでとう！"></textarea><span class="field-hint">最大240文字</span></label>
        <fieldset><legend>カードの雰囲気</legend><div class="theme-options">
          <label class="theme-choice"><input type="radio" name="theme" value="lemon" checked><span class="theme-swatch lemon"></span><b>陽だまり</b></label>
          <label class="theme-choice"><input type="radio" name="theme" value="berry"><span class="theme-swatch berry"></span><b>ベリー</b></label>
          <label class="theme-choice"><input type="radio" name="theme" value="sky"><span class="theme-swatch sky"></span><b>そら</b></label>
        </div></fieldset>
        <button class="button button-primary button-wide" type="submit">カードを完成させる <span>↗</span></button>
      </form>
      <aside class="form-preview"><span class="preview-label">PREVIEW</span><div class="mini-card lemon" id="mini-card"><div class="mini-card-spark">✦</div><strong>Happy<br><i>Birthday</i></strong><span>for <b>あなた</b></span></div><p>あとから何度でも作り直せます</p></aside>
    </section>
  `, 'create');
  document.querySelector('#card-form').addEventListener('submit', handleCardSubmit);
  document.querySelectorAll('input[name="theme"]').forEach((input) => input.addEventListener('change', (event) => { document.querySelector('#mini-card').className = `mini-card ${event.target.value}`; }));
}

function authView(next = 'home') {
  return `<section class="auth-page"><div class="auth-copy"><p class="eyebrow"><span class="eyebrow-line"></span> welcome to birthday.card</p><h2>あなたの名前で、<br><em>はじめよう。</em></h2><p>ニックネームだけで登録できます。<br>大切な人へのカードを、ここから。</p><div class="auth-stamp">your words<br>matter <span>♡</span></div></div><div class="auth-panel"><div class="auth-tabs"><button class="auth-tab is-active" data-auth-mode="signup">新規登録</button><button class="auth-tab" data-auth-mode="login">ログイン</button></div><form id="auth-form"><div class="signup-only"><label>ニックネーム<input name="nickname" maxlength="20" placeholder="例：ゆうた" required /></label></div><label>メールアドレス<input name="email" type="email" placeholder="you@example.com" required /></label><label>パスワード<input name="password" type="password" minlength="6" placeholder="6文字以上" required /></label><p class="auth-error" id="auth-error"></p><button class="button button-dark button-wide" type="submit" id="auth-submit">アカウントをつくる <span>↗</span></button></form><p class="privacy-note">本名は必要ありません。<br>あなたの情報はカードを届けるためだけに使います。</p></div></section>`;
}

async function handleAuthSubmit(event) {
  event.preventDefault(); const form = event.target; const mode = form.dataset.mode || 'signup'; const data = Object.fromEntries(new FormData(form)); const error = document.querySelector('#auth-error');
  try {
    if (isFirebaseConfigured) {
      if (mode === 'signup') { const cred = await createUserWithEmailAndPassword(auth, data.email, data.password); await updateProfile(cred.user, { displayName: data.nickname }); currentUser = cred.user; }
      else { const cred = await signInWithEmailAndPassword(auth, data.email, data.password); currentUser = cred.user; }
    } else {
      const user = { uid: uid(), email: data.email, nickname: data.nickname || getDemoUser()?.nickname || 'birthday friend', displayName: data.nickname || getDemoUser()?.nickname || 'birthday friend' }; localStorage.setItem(demoUserKey, JSON.stringify(user)); currentUser = user;
    }
    location.hash = mode === 'signup' && nextTarget() === 'create' ? '#create' : '#home'; route();
  } catch (err) { error.textContent = '入力内容を確認してください。登録できない場合は別のメールアドレスをお試しください。'; }
}
function nextTarget() { return location.hash.includes('create') ? 'create' : 'home'; }

async function handleCardSubmit(event) {
  event.preventDefault(); const data = Object.fromEntries(new FormData(event.target)); const user = currentUser || getDemoUser(); const card = { ...data, sender: user.displayName || user.nickname, createdAt: new Date().toISOString() }; let id;
  if (isFirebaseConfigured) { const ref = await addDoc(collection(db, 'cards'), { ...card, ownerId: user.uid, createdAt: serverTimestamp() }); id = ref.id; }
  else { id = uid(); const cards = getDemoCards(); cards[id] = card; saveDemoCards(cards); }
  location.hash = `#card/${id}`; route();
}

async function cardView(id) {
  let card;
  if (isFirebaseConfigured) { const snapshot = await getDoc(doc(db, 'cards', id)); if (snapshot.exists()) card = snapshot.data(); }
  else card = getDemoCards()[id];
  if (!card) { renderShell(`<section class="empty-page"><div class="empty-icon">?</div><h2>カードが見つかりません</h2><p>リンクが正しいか、もう一度確認してみてください。</p><a class="button button-primary" href="#home">ホームへ戻る</a></section>`); return; }
  renderShell(`<section class="received-page"><p class="eyebrow centered"><span class="eyebrow-line"></span> a card for you <span class="eyebrow-line"></span></p><p class="received-lead">${escapeHTML(card.to)}さんへ</p><div class="received-card ${escapeHTML(card.theme || 'lemon')}"><div class="received-card-top"><span>birthday.card</span><span>♡</span></div><div class="received-spark">✦</div><h1>Happy<br><i>Birthday</i></h1><div class="message">${escapeHTML(card.message).replace(/\n/g, '<br>')}</div><div class="received-from">— ${escapeHTML(card.sender)}より</div></div><p class="received-foot">このカードは、あなたのためにつくられました。</p><div class="received-actions"><a href="#create" class="button button-primary">自分もカードをつくる <span>↗</span></a><button class="text-link" data-action="copy" data-url="${escapeHTML(shareUrl(id))}">リンクをコピー</button></div></section>`);
  burst();
}

function bindCommonEvents() {
  document.querySelectorAll('[data-action="auth"]').forEach((el) => el.addEventListener('click', () => { renderShell(authView(), 'home'); }));
  document.querySelectorAll('[data-action="account"]').forEach((el) => el.addEventListener('click', () => { if (confirm('ログアウトしますか？')) { if (isFirebaseConfigured) signOut(auth); else { localStorage.removeItem(demoUserKey); currentUser = null; } route(); } }));
  document.querySelectorAll('[data-action="copy"]').forEach((el) => el.addEventListener('click', async () => { await navigator.clipboard?.writeText(el.dataset.url); el.textContent = 'コピーしました ✓'; }));
  const authForm = document.querySelector('#auth-form'); if (authForm) bindAuth();
}
function bindAuth() {
  const form = document.querySelector('#auth-form'); if (!form) return;
  document.querySelectorAll('[data-auth-mode]').forEach((tab) => tab.addEventListener('click', () => { document.querySelectorAll('[data-auth-mode]').forEach((t) => t.classList.remove('is-active')); tab.classList.add('is-active'); const signup = tab.dataset.authMode === 'signup'; form.dataset.mode = signup ? 'signup' : 'login'; document.querySelector('.signup-only').hidden = !signup; document.querySelector('[name="nickname"]').required = signup; document.querySelector('#auth-submit').innerHTML = signup ? 'アカウントをつくる <span>↗</span>' : 'ログインする <span>↗</span>'; }));
  form.addEventListener('submit', handleAuthSubmit);
}
function burst() { for (let i = 0; i < 18; i += 1) { const piece = document.createElement('i'); piece.className = 'burst-piece'; piece.style.setProperty('--x', `${Math.random() * 100 - 50}px`); piece.style.setProperty('--r', `${Math.random() * 360}deg`); piece.style.setProperty('--d', `${Math.random() * .5}s`); piece.textContent = i % 2 ? '•' : '✦'; document.body.append(piece); setTimeout(() => piece.remove(), 1500); } }

function route() { const hash = location.hash.slice(1) || 'home'; if (hash.startsWith('card/')) cardView(hash.split('/')[1]); else if (hash === 'create') createView(); else homeView(); }
if (isFirebaseConfigured) onAuthStateChanged(auth, (user) => { currentUser = user; route(); }); else { currentUser = getDemoUser(); route(); }
window.addEventListener('hashchange', route);
