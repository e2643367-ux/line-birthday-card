# Firebase接続ガイド

このサイトは、Firebaseの設定値が存在するとFirebaseモードで動作し、設定値がない場合はブラウザの`localStorage`を使うデモモードで動作します。

## 1. Firebaseプロジェクトを作成

1. [Firebase Console](https://console.firebase.google.com/)を開く
2. 「プロジェクトを追加」を選択
3. プロジェクト名を入力して作成
4. Google Analyticsは任意

## 2. Webアプリを登録

Firebaseプロジェクトの概要ページで、Webアイコン（`</>`）をクリックします。

アプリのニックネームは、例えば`birthday-card-web`にします。Firebase Hostingの設定は、このプロジェクトではGitHub Pagesを使うため必須ではありません。

登録後に表示されるSDK設定から、次の値を取得します。

```js
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...firebaseapp.com",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

## 3. Authenticationを有効化

1. Firebase Consoleの「Authentication」を開く
2. 「始める」をクリック
3. 「Sign-in method」タブを開く
4. 「メール / パスワード」を有効化
5. 保存

このサイトの新規登録処理は、Firebase Authenticationの`createUserWithEmailAndPassword`を使います。

登録時には以下を保存します。

- メールアドレス
- パスワードのハッシュ（パスワード自体はサイト側で保存しません）
- FirebaseユーザーID
- ニックネーム（Firebaseユーザーの`displayName`）

## 4. Firestore Databaseを作成

1. Firebase Consoleの「Firestore Database」を開く
2. 「データベースを作成」を選択
3. 本番環境モードで作成
4. 利用リージョンを選択

このサイトでは、カード作成時に`cards`コレクションへ保存します。

カードのデータ例：

```json
{
  "to": "あかり",
  "message": "お誕生日おめでとう！",
  "sender": "ゆうた",
  "theme": "lemon",
  "ownerId": "FirebaseユーザーID",
  "createdAt": "Firestore server timestamp"
}
```

## 5. Firestoreセキュリティルールを設定

リポジトリ直下の`firestore.rules`に基本ルールを用意しています。

設計方針は次の通りです。

- カードの読み取り：共有URLで表示するため誰でも可能
- カードの作成：ログインユーザーのみ可能
- 作成時の`ownerId`：ログイン中のユーザーIDと一致する必要がある
- メッセージ：文字列かつ240文字以下
- 更新・削除：作成者本人のみ可能

Firebase ConsoleのFirestore Database → Rulesに、`firestore.rules`の内容を貼り付けて公開してください。

> 共有URLを知っている人はカードを読める設計です。LINEのトークルームでURLを送る用途を想定しています。完全な非公開カードにしたい場合は、受取人用の認証やワンタイムトークンを追加する必要があります。

## 6. ローカル開発で接続

プロジェクト直下で`.env.example`をコピーします。

```bash
cp .env.example .env.local
```

`.env.local`にFirebase Consoleの値を入力します。

```env
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=birthday-card-xxxxx.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=birthday-card-xxxxx
VITE_FIREBASE_STORAGE_BUCKET=birthday-card-xxxxx.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=1234567890
VITE_FIREBASE_APP_ID=1:1234567890:web:abcdef
VITE_USE_FIREBASE_EMULATOR=false
```

その後、再起動します。

```bash
npm run dev
```

Viteは起動時に環境変数を読み込むため、`.env.local`を編集した後は開発サーバーを再起動してください。

## 7. Firebaseの承認済みドメイン

Authentication → Settings → Authorized domainsで、次のドメインを確認します。

- `localhost`（ローカル開発用）
- `e2643367-ux.github.io`（GitHub Pages用）

GitHub PagesのURLが`https://e2643367-ux.github.io/line-birthday-card/`の場合、承認するドメインはパスを含めず`e2643367-ux.github.io`です。

## 8. GitHub PagesでFirebase接続

GitHubリポジトリのSettings → Secrets and variables → Actions → New repository secretから、次の6つを登録します。

| Secret名 | Firebase設定値 |
|---|---|
| `VITE_FIREBASE_API_KEY` | `apiKey` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `authDomain` |
| `VITE_FIREBASE_PROJECT_ID` | `projectId` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `storageBucket` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` |
| `VITE_FIREBASE_APP_ID` | `appId` |

GitHub Actionsの`.github/workflows/deploy.yml`では、ビルド時にこれらを環境変数として渡します。

```yaml
env:
  VITE_FIREBASE_API_KEY: ${{ secrets.VITE_FIREBASE_API_KEY }}
  VITE_FIREBASE_AUTH_DOMAIN: ${{ secrets.VITE_FIREBASE_AUTH_DOMAIN }}
  VITE_FIREBASE_PROJECT_ID: ${{ secrets.VITE_FIREBASE_PROJECT_ID }}
  VITE_FIREBASE_STORAGE_BUCKET: ${{ secrets.VITE_FIREBASE_STORAGE_BUCKET }}
  VITE_FIREBASE_MESSAGING_SENDER_ID: ${{ secrets.VITE_FIREBASE_MESSAGING_SENDER_ID }}
  VITE_FIREBASE_APP_ID: ${{ secrets.VITE_FIREBASE_APP_ID }}
```

そのため、GitHub Pagesに公開されたJavaScriptへFirebaseの設定値が含まれます。これはFirebase Web SDKの通常の仕組みで、`apiKey`などは秘密鍵ではありません。実際のアクセス制御はAuthenticationとFirestore Rulesで行います。

## 9. GitHub Pagesを有効化

GitHubリポジトリのSettings → Pagesで、Build and deploymentのSourceを「GitHub Actions」にします。

その後、`main`ブランチへpushするとWorkflowが実行されます。

```bash
git add .
git commit -m "docs: add Firebase setup guide"
git push origin main
```

Actionsタブで`Deploy to GitHub Pages`の完了を確認してください。

## 10. 接続確認

本番URLで次の順番に確認します。

1. 新規登録画面を開く
2. ニックネーム、メールアドレス、パスワードを入力
3. Firebase Console → Authentication → Usersにユーザーが作成されていることを確認
4. カードを作成
5. Firebase Console → Firestore Database → `cards`にドキュメントが作成されていることを確認
6. 表示されたカードURLをログアウト状態または別ブラウザで開く
7. カードが表示されることを確認

## 11. よくあるエラー

### `Firebase: Error (auth/operation-not-allowed)`

Authenticationの「メール / パスワード」が有効になっていません。Sign-in methodから有効化してください。

### `auth/unauthorized-domain`

Authentication → Settings → Authorized domainsに、アクセス元のホスト名を追加してください。`localhost`とGitHub Pagesのホスト名は別々に登録します。

### `Missing or insufficient permissions`

Firestore Rulesが未公開、またはログイン状態・`ownerId`の条件が一致していません。`firestore.rules`を公開し、作成処理がFirebase Authentication後に実行されているか確認してください。

### Firebase設定後もデモモードになる

6つの`VITE_FIREBASE_*`値がすべて存在しないと、アプリはデモモードになります。`.env.local`のファイル名、変数名、開発サーバーの再起動を確認してください。

### GitHub Pagesだけデモモードになる

GitHub ActionsのRepository secretsが未登録です。6つのSecretsを登録してから、ActionsのWorkflowを再実行してください。

## 12. 本番公開前の推奨設定

- Firebase Authenticationでメールアドレスの確認を有効化
- Firebase App Checkを導入
- Firestore Rulesにメッセージ長・テーマ値・必須フィールドの検証を追加
- Firebase Consoleの使用量アラートを設定
- 不要になったカードの自動削除方針を決める
- 不正な大量カード作成への対策としてApp Checkやレート制限を検討
