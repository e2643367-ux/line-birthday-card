import './style.css';
import { isFirebaseConfigured, auth, db } from './firebase.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, updateProfile, signOut } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, addDoc, query, where, serverTimestamp, setDoc } from 'firebase/firestore';

const app = document.querySelector('#app');
const demoUserKey = 'birthday-card-demo-user';
const demoCardsKey = 'birthday-card-demo-cards';
const demoFriendsKey = 'birthday-card-demo-friends';
let currentUser = null;

function escapeHTML(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' })[char]);
}
function uid() { return Math.random().toString(36).slice(2, 10); }
function friendCode() { return Math.random().toString(36).slice(2, 8).toUpperCase(); }
function getDemoUser() { try { return JSON.parse(localStorage.getItem(demoUserKey)); } catch { return null; } }
function saveDemoUser(user) { localStorage.setItem(demoUserKey, JSON.stringify(user)); }
function getDemoCards() { try { return JSON.parse(localStorage.getItem(demoCardsKey)) || {}; } catch { return {}; } }
function saveDemoCards(cards) { localStorage.setItem(demoCardsKey, JSON.stringify(cards)); }
function getDemoFriends() { try { return JSON.parse(localStorage.getItem(demoFriendsKey)) || []; } catch { return []; } }
function saveDemoFriends(friends) { localStorage.setItem(demoFriendsKey, JSON.stringify(friends)); }
function activeUser() { return currentUser || getDemoUser(); }
function encodeCard(card) { return btoa(unescape(encodeURIComponent(JSON.stringify(card)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function decodeCard(value) { try { return JSON.parse(decodeURIComponent(escape(atob(value.replace(/-/g, '+').replace(/_/g, '/'))))); } catch { return null; } }
function shareUrl(id, card) { return `${location.origin}${location.pathname}#card/${id}?data=${encodeCard(card)}`; }
function formatBirthday(date) { if (!date) return '誕生日未登録'; const [y, m, d] = date.split('-'); return `${Number(m)}月${Number(d)}日`; }
function birthdaySortValue(date) { if (!date) return 9999; const [, m, d] = date.split('-').map(Number); const now = new Date(); const value = m * 100 + d; const today = (now.getMonth() + 1) * 100 + now.getDate(); return value < today ? value + 1300 : value; }
function sortFriends(friends) { return [...friends].sort((a, b) => birthdaySortValue(a.birthday) - birthdaySortValue(b.birthday)); }

async function getProfile(user) {
  if (!isFirebaseConfigured) return user;
  const snapshot = await getDoc(doc(db, 'users', user.uid));
  if (snapshot.exists()) return { ...user, ...snapshot.data() };
  const profile = { nickname: user.displayName || 'birthday friend', birthday: '', friendCode: friendCode(), createdAt: serverTimestamp() };
  await setDoc(doc(db, 'users', user.uid), profile);
  return { ...user, ...profile };
}
async function getFriends() {
  const user = activeUser();
  if (!user) return [];
  if (!isFirebaseConfigured) return sortFriends(getDemoFriends());
  const snapshot = await getDocs(collection(db, 'users', user.uid, 'friends'));
  return sortFriends(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
}

function renderShell(content, active = 'home') {
  app.innerHTML = `<div class="app-shell"><header class="topbar"><a class="brand" href="#home" aria-label="ホームへ"><span class="brand-mark">B</span><span>birthday<span class="brand-dot">.</span>card</span></a><nav class="nav-links" aria-label="メインメニュー"><a class="${active === 'home' ? 'is-active' : ''}" href="#home">ホーム</a><a class="${active === 'friends' ? 'is-active' : ''}" href="#friends">友達</a><a class="${active === 'create' ? 'is-active' : ''}" href="#create">カードをつくる</a></nav><div class="account-area">${accountButton()}</div></header><main>${content}</main><footer><span>birthday.card</span><span>大切な日に、ちゃんと届く。</span></footer></div>`;
  bindCommonEvents();
}
function accountButton() { const user = activeUser(); if (user) return `<button class="account-pill" data-action="account"><span class="avatar">${escapeHTML((user.displayName || user.nickname || '？').slice(0, 1))}</span>${escapeHTML(user.displayName || user.nickname)}<span class="chevron">⌄</span></button>`; return '<button class="button button-small button-dark" data-action="auth">ログイン / 登録</button>'; }

function homeView() {
  renderShell(`<section class="hero-section"><div class="hero-copy"><p class="eyebrow"><span class="eyebrow-line"></span> a little card, a lot of feeling</p><h1>おめでとうを、<br><em>カードに。</em></h1><p class="hero-lede">誕生日の人にしか開けない、<br>小さなサプライズを贈ろう。</p><div class="hero-actions"><a href="#create" class="button button-primary">カードをつくる <span>↗</span></a><a href="#friends" class="text-link">友達の誕生日を見る <span>↓</span></a></div></div><div class="hero-art" aria-label="バースデーカードのプレビュー"><div class="confetti confetti-a">✦</div><div class="confetti confetti-b">•</div><div class="confetti confetti-c">✳</div><div class="card-stack behind-card"></div><div class="birthday-card"><div class="card-top"><span>birthday.card</span><span>2026</span></div><div class="card-sun">✦</div><div class="card-title">Happy<br><i>Birthday</i></div><div class="card-bottom"><span>for あかり</span><span>♡</span></div></div><div class="hero-note">あなたの言葉で、<br><b>今日を特別に。</b></div></div></section><section class="feature-strip" id="how"><div><span class="feature-no">01</span><b>ニックネームで<br>すぐに始める</b><small>本名の登録は必要ありません</small></div><div><span class="feature-no">02</span><b>友達の誕生日を<br>忘れずにチェック</b><small>誕生日が近い順に表示します</small></div><div><span class="feature-no">03</span><b>カードをつくって<br>サプライズ</b><small>受け取った人だけが開けます</small></div></section><section class="quote-section"><span class="quote-mark">“</span><p>言葉にするのはちょっと照れるけど、<br>カードならちゃんと伝えられる。</p><span class="quote-caption">— birthday.card について</span></section>`);
}

async function friendsView() {
  const user = activeUser();
  if (!user) { renderShell(authView(), 'friends'); return; }
  const friends = await getFriends();
  const profile = await getProfile(user);
  const rows = friends.length ? friends.map((friend, index) => `<div class="friend-row"><div class="friend-date"><strong>${escapeHTML(formatBirthday(friend.birthday))}</strong><small>${index === 0 ? '次のバースデー' : 'お誕生日'}</small></div><div class="friend-avatar ${index % 3 === 1 ? 'berry' : index % 3 === 2 ? 'sky' : ''}">${escapeHTML((friend.nickname || '？').slice(0, 1))}</div><div class="friend-info"><b>${escapeHTML(friend.nickname)}</b><span>${escapeHTML(friend.friendCode || '')}</span></div><a class="button button-small button-primary" href="#create?friend=${encodeURIComponent(friend.id)}">カードを贈る <span>↗</span></a></div>`).join('') : '<div class="empty-friends"><div class="empty-icon">♡</div><h3>まだ友達がいません</h3><p>友達コードを交換して、誕生日を登録しましょう。</p></div>';
  renderShell(`<section class="friends-page"><div class="page-heading"><div><p class="eyebrow"><span class="eyebrow-line"></span> your birthday circle</p><h2>友達の、<em>誕生日。</em></h2><p>誕生日が近い順に並んでいます。<br>大切な人を忘れずにお祝いしよう。</p></div><div class="profile-badge"><span>あなたの友達コード</span><strong>${escapeHTML(profile.friendCode || '未発行')}</strong><small>このコードを友達に共有してください</small></div></div><div class="friend-actions"><button class="button button-dark" data-action="add-friend">＋ 友達を追加</button><span>${friends.length}人の友達</span></div><div class="friends-list">${rows}</div></section>`, 'friends');
}

async function createView() {
  const user = activeUser();
  if (!user) { renderShell(authView('create'), 'create'); return; }
  const friends = await getFriends();
  if (!friends.length) { renderShell(`<section class="empty-page"><div class="empty-icon">♡</div><h2>まず友達を追加しましょう</h2><p>カードを贈る相手を友達一覧から選べるようになります。</p><a class="button button-primary" href="#friends">友達を追加する <span>↗</span></a></section>`, 'create'); return; }
  const selectedId = new URLSearchParams(location.hash.split('?')[1] || '').get('friend');
  const selected = friends.find((friend) => friend.id === selectedId) || friends[0];
  renderShell(`<section class="form-page"><div class="form-intro"><p class="eyebrow"><span class="eyebrow-line"></span> make it personal</p><h2>誰に、<em>贈る？</em></h2><p>友達の誕生日に合わせて、カードを届けよう。</p><div class="selected-friend-card"><span>送る相手</span><strong>${escapeHTML(selected.nickname)}</strong><small>${escapeHTML(formatBirthday(selected.birthday))} · ${escapeHTML(selected.friendCode || '')}</small></div><a class="text-link" href="#friends">別の友達を選ぶ →</a></div><form id="card-form" class="card-form"><input type="hidden" name="recipientId" value="${escapeHTML(selected.id)}"><input type="hidden" name="to" value="${escapeHTML(selected.nickname)}"><label>メッセージ<textarea name="message" required maxlength="240" placeholder="お誕生日おめでとう！"></textarea><span class="field-hint">最大240文字</span></label><fieldset><legend>カードの雰囲気</legend><div class="theme-options"><label class="theme-choice"><input type="radio" name="theme" value="lemon" checked><span class="theme-swatch lemon"></span><b>陽だまり</b></label><label class="theme-choice"><input type="radio" name="theme" value="berry"><span class="theme-swatch berry"></span><b>ベリー</b></label><label class="theme-choice"><input type="radio" name="theme" value="sky"><span class="theme-swatch sky"></span><b>そら</b></label></div></fieldset><button class="button button-primary button-wide" type="submit">カードを完成させる <span>↗</span></button></form><aside class="form-preview"><span class="preview-label">PREVIEW · ${escapeHTML(selected.nickname)}</span><div class="mini-card lemon" id="mini-card"><div class="mini-card-spark">✦</div><strong>Happy<br><i>Birthday</i></strong><span>for <b>${escapeHTML(selected.nickname)}</b></span></div><p>あとから何度でも作り直せます</p></aside></section>`, 'create');
  document.querySelector('#card-form').addEventListener('submit', handleCardSubmit);
  document.querySelectorAll('input[name="theme"]').forEach((input) => input.addEventListener('change', (event) => { document.querySelector('#mini-card').className = `mini-card ${event.target.value}`; }));
}

function authView() { return `<section class="auth-page"><div class="auth-copy"><p class="eyebrow"><span class="eyebrow-line"></span> welcome to birthday.card</p><h2>あなたの名前で、<br><em>はじめよう。</em></h2><p>ニックネームと誕生日を登録して、<br>友達の大切な日をお祝いしましょう。</p><div class="auth-stamp">your words<br>matter <span>♡</span></div></div><div class="auth-panel"><div class="auth-tabs"><button class="auth-tab is-active" data-auth-mode="signup">新規登録</button><button class="auth-tab" data-auth-mode="login">ログイン</button></div><form id="auth-form"><div class="signup-only"><label>ニックネーム<input name="nickname" maxlength="20" placeholder="例：ゆうた" required /></label><label>誕生日<input name="birthday" type="date" required /></label></div><label>メールアドレス<input name="email" type="email" placeholder="you@example.com" required /></label><label>パスワード<input name="password" type="password" minlength="6" placeholder="6文字以上" required /></label><p class="auth-error" id="auth-error"></p><button class="button button-dark button-wide" type="submit" id="auth-submit">アカウントをつくる <span>↗</span></button></form><p class="privacy-note">本名は必要ありません。<br>誕生日は友達に表示するために使います。</p></div></section>`; }

async function handleAuthSubmit(event) {
  event.preventDefault(); const form = event.target; const mode = form.dataset.mode || 'signup'; const data = Object.fromEntries(new FormData(form)); const error = document.querySelector('#auth-error');
  try {
    if (isFirebaseConfigured) {
      if (mode === 'signup') { const cred = await createUserWithEmailAndPassword(auth, data.email, data.password); await updateProfile(cred.user, { displayName: data.nickname }); currentUser = { ...cred.user, nickname: data.nickname, birthday: data.birthday, friendCode: friendCode() }; await setDoc(doc(db, 'users', cred.user.uid), { nickname: data.nickname, birthday: data.birthday, friendCode: currentUser.friendCode, createdAt: serverTimestamp() }); }
      else { const cred = await signInWithEmailAndPassword(auth, data.email, data.password); currentUser = await getProfile(cred.user); }
    } else { const old = getDemoUser(); const user = { uid: old?.uid || uid(), email: data.email, nickname: data.nickname || old?.nickname || 'birthday friend', displayName: data.nickname || old?.nickname || 'birthday friend', birthday: data.birthday || old?.birthday || '', friendCode: old?.friendCode || friendCode() }; saveDemoUser(user); currentUser = user; }
    location.hash = mode === 'signup' && location.hash.includes('create') ? '#create' : '#home'; route();
  } catch (err) { error.textContent = '入力内容を確認してください。登録できない場合は別のメールアドレスをお試しください。'; }
}

async function settingsView() {
  const user = activeUser();
  if (!user) { renderShell(authView(), 'home'); return; }
  const profile = await getProfile(user);
  renderShell(`<section class="settings-page"><div class="page-heading"><div><p class="eyebrow"><span class="eyebrow-line"></span> your account</p><h2>アカウント<em>設定。</em></h2><p>ニックネームと誕生日は、いつでも変更できます。</p></div><div class="settings-avatar">${escapeHTML((profile.nickname || profile.displayName || '？').slice(0, 1))}</div></div><form id="profile-form" class="settings-form"><div class="settings-section"><div><span class="settings-label">PROFILE</span><h3>プロフィール</h3><p>友達に表示される情報です。</p></div><div class="settings-fields"><label>ニックネーム<input name="nickname" maxlength="20" required value="${escapeHTML(profile.nickname || profile.displayName || '')}" placeholder="例：ゆうた"></label><label>誕生日<input name="birthday" type="date" value="${escapeHTML(profile.birthday || '')}" required><small>友達の誕生日一覧に表示されます</small></label><label>メールアドレス<input value="${escapeHTML(profile.email || '')}" disabled><small>メールアドレスはログインに使用します</small></label></div></div><div class="settings-section settings-code"><div><span class="settings-label">FRIEND CODE</span><h3>友達コード</h3><p>このコードを友達に共有して追加してもらえます。</p></div><div><strong>${escapeHTML(profile.friendCode || '未発行')}</strong><button type="button" class="text-link" data-action="copy" data-url="${escapeHTML(profile.friendCode || '')}">コードをコピー</button></div></div><p class="settings-message" id="settings-message"></p><div class="settings-footer"><button type="submit" class="button button-primary">変更を保存 <span>↗</span></button><button type="button" class="button button-ghost" data-action="logout">ログアウト</button></div></form></section>`, 'home');
  document.querySelector('#profile-form').addEventListener('submit', handleProfileSubmit);
}

async function handleProfileSubmit(event) {
  event.preventDefault();
  const user = activeUser();
  const data = Object.fromEntries(new FormData(event.target));
  const message = document.querySelector('#settings-message');
  try {
    if (isFirebaseConfigured) {
      await updateProfile(auth.currentUser, { displayName: data.nickname });
      await setDoc(doc(db, 'users', user.uid), { nickname: data.nickname, birthday: data.birthday, friendCode: user.friendCode || friendCode() }, { merge: true });
      const friendSnapshot = await getDocs(collection(db, 'users', user.uid, 'friends'));
      await Promise.all(friendSnapshot.docs.map((friend) => setDoc(doc(db, 'users', friend.id, 'friends', user.uid), { nickname: data.nickname, birthday: data.birthday, friendCode: user.friendCode }, { merge: true })));
      currentUser = { ...currentUser, displayName: data.nickname, nickname: data.nickname, birthday: data.birthday };
    } else {
      const updated = { ...user, nickname: data.nickname, displayName: data.nickname, birthday: data.birthday };
      saveDemoUser(updated); currentUser = updated;
      saveDemoFriends(getDemoFriends().map((friend) => friend.id === user.uid ? { ...friend, nickname: data.nickname, birthday: data.birthday } : friend));
    }
    message.textContent = 'プロフィールを保存しました。';
    message.classList.add('is-success');
    setTimeout(() => settingsView(), 900);
  } catch (error) { message.textContent = '保存できませんでした。入力内容とFirebaseルールを確認してください。'; }
}

async function addFriend() {
  const code = prompt('友達から教えてもらった友達コードを入力してください');
  if (!code) return;
  const user = activeUser();
  try {
    if (!isFirebaseConfigured) {
      const friends = getDemoFriends(); if (friends.some((friend) => friend.friendCode === code.toUpperCase())) throw new Error('duplicate');
      const friend = { id: uid(), nickname: `友達 ${code.toUpperCase()}`, birthday: '', friendCode: code.toUpperCase() }; saveDemoFriends([...friends, friend]);
    } else {
      const profileQuery = await getDocs(query(collection(db, 'users'), where('friendCode', '==', code.trim().toUpperCase())));
      if (profileQuery.empty) throw new Error('not-found');
      const target = profileQuery.docs[0]; if (target.id === user.uid) throw new Error('self');
      const targetProfile = target.data();
      await setDoc(doc(db, 'users', user.uid, 'friends', target.id), { nickname: targetProfile.nickname, birthday: targetProfile.birthday || '', friendCode: targetProfile.friendCode });
      await setDoc(doc(db, 'users', target.id, 'friends', user.uid), { nickname: user.nickname || user.displayName, birthday: user.birthday || '', friendCode: user.friendCode });
    }
    alert('友達を追加しました。誕生日一覧に表示されます。'); friendsView();
  } catch (err) { alert(err.message === 'self' ? '自分自身は追加できません。' : 'その友達コードは見つかりませんでした。コードを確認してください。'); }
}

async function handleCardSubmit(event) { event.preventDefault(); const data = Object.fromEntries(new FormData(event.target)); const user = activeUser(); const card = { ...data, sender: user.displayName || user.nickname, createdAt: new Date().toISOString() }; let id; if (isFirebaseConfigured) { const ref = await addDoc(collection(db, 'cards'), { ...card, ownerId: user.uid, createdAt: serverTimestamp() }); id = ref.id; } else { id = uid(); const cards = getDemoCards(); cards[id] = card; saveDemoCards(cards); } location.hash = `#card/${id}?data=${encodeCard(card)}`; route(); }
async function cardView(rawId) { const [id, queryString] = rawId.split('?'); const sharedData = new URLSearchParams(queryString || '').get('data'); let card; if (isFirebaseConfigured) { const snapshot = await getDoc(doc(db, 'cards', id)); if (snapshot.exists()) card = snapshot.data(); } else card = getDemoCards()[id]; if (!card && sharedData) card = decodeCard(sharedData); if (!card) { renderShell(`<section class="empty-page"><div class="empty-icon">?</div><h2>カードが見つかりません</h2><p>リンクが正しいか、もう一度確認してみてください。</p><a class="button button-primary" href="#home">ホームへ戻る</a></section>`); return; } renderShell(`<section class="received-page"><p class="eyebrow centered"><span class="eyebrow-line"></span> a card for you <span class="eyebrow-line"></span></p><p class="received-lead">${escapeHTML(card.to)}さんへ</p><div class="received-card ${escapeHTML(card.theme || 'lemon')}"><div class="received-card-top"><span>birthday.card</span><span>♡</span></div><div class="received-spark">✦</div><h1>Happy<br><i>Birthday</i></h1><div class="message">${escapeHTML(card.message).replace(/\n/g, '<br>')}</div><div class="received-from">— ${escapeHTML(card.sender)}より</div></div><p class="received-foot">このカードは、あなたのためにつくられました。</p><div class="received-actions"><a href="#create" class="button button-primary">自分もカードをつくる <span>↗</span></a><button class="text-link" data-action="copy" data-url="${escapeHTML(shareUrl(id, card))}">リンクをコピー</button></div></section>`); burst(); }

function bindCommonEvents() { document.querySelectorAll('[data-action="auth"]').forEach((el) => el.addEventListener('click', () => { renderShell(authView()); })); document.querySelectorAll('[data-action="account"]').forEach((el) => el.addEventListener('click', () => { location.hash = '#settings'; route(); })); document.querySelectorAll('[data-action="logout"]').forEach((el) => el.addEventListener('click', () => { if (confirm('ログアウトしますか？')) { if (isFirebaseConfigured) signOut(auth); else { localStorage.removeItem(demoUserKey); currentUser = null; } route(); } })); document.querySelectorAll('[data-action="copy"]').forEach((el) => el.addEventListener('click', async () => { await navigator.clipboard?.writeText(el.dataset.url); el.textContent = 'コピーしました ✓'; })); document.querySelectorAll('[data-action="add-friend"]').forEach((el) => el.addEventListener('click', addFriend)); const authForm = document.querySelector('#auth-form'); if (authForm) bindAuth(); }
function bindAuth() { const form = document.querySelector('#auth-form'); if (!form) return; document.querySelectorAll('[data-auth-mode]').forEach((tab) => tab.addEventListener('click', () => { document.querySelectorAll('[data-auth-mode]').forEach((item) => item.classList.remove('is-active')); tab.classList.add('is-active'); const signup = tab.dataset.authMode === 'signup'; form.dataset.mode = signup ? 'signup' : 'login'; document.querySelector('.signup-only').hidden = !signup; document.querySelectorAll('.signup-only input').forEach((input) => { input.required = signup; }); document.querySelector('#auth-submit').innerHTML = signup ? 'アカウントをつくる <span>↗</span>' : 'ログインする <span>↗</span>'; })); form.addEventListener('submit', handleAuthSubmit); }
function burst() { for (let i = 0; i < 18; i += 1) { const piece = document.createElement('i'); piece.className = 'burst-piece'; piece.style.setProperty('--x', `${Math.random() * 100 - 50}px`); piece.style.setProperty('--r', `${Math.random() * 360}deg`); piece.style.setProperty('--d', `${Math.random() * .5}s`); piece.textContent = i % 2 ? '•' : '✦'; document.body.append(piece); setTimeout(() => piece.remove(), 1500); } }
function route() { const hash = location.hash.slice(1) || 'home'; if (hash.startsWith('card/')) cardView(hash.split('/')[1]); else if (hash.startsWith('create')) createView(); else if (hash === 'friends') friendsView(); else if (hash === 'settings') settingsView(); else homeView(); }
if (isFirebaseConfigured) onAuthStateChanged(auth, async (user) => { currentUser = user ? await getProfile(user) : null; route(); }); else { currentUser = getDemoUser(); route(); }
window.addEventListener('hashchange', route);
