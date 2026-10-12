# birthday.card

LINEのバースデーカードのように、ニックネームでアカウントを作成し、カードを作ってURLで贈る静的Webアプリです。

## ローカルで起動

```bash
npm install
npm run dev
```

Firebaseの環境変数がない場合は、ブラウザの `localStorage` を使ったデモモードで動きます。

## Firebase接続

1. Firebase ConsoleでWebアプリを作成
2. Authentication → Sign-in method → Email/Passwordを有効化
3. Firestore Databaseを作成
4. `.env.example`を`.env.local`にコピーし、Firebase SDK設定値を入力
5. Firestore Rulesで、必要に応じて`cards`コレクションの読み取り・作成ルールを設定

カードの保存先は `cards` コレクションです。カードには `to`, `message`, `sender`, `theme`, `ownerId`, `createdAt` が保存されます。

## GitHub Pages

`main`ブランチへpushすると`.github/workflows/deploy.yml`が自動実行されます。GitHubリポジトリのSettings → Secrets and variables → Actionsに、`.env.local`と同名の`VITE_FIREBASE_*`シークレットを登録してください。

Settings → Pages → Build and deploymentでSourceを「GitHub Actions」にします。

## 注意

Firebaseのブラウザ向け設定値は通常公開前提ですが、Firestore RulesとAuthenticationの設定でアクセス制御を行ってください。本番公開前に、カードを誰でも読めるか・所有者だけが作成できるかを確認してください。
