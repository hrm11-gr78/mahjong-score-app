---
description: How to deploy the Mahjong Score App to GitHub Pages for free
---

# GitHub Pagesへの公開手順

このアプリを無料でWeb上に公開し、スマホからアクセスできるようにする手順です。

## 1. GitHubアカウントの作成
まだお持ちでない場合は、[GitHub](https://github.com/) でアカウントを作成してください（無料）。

## 2. 新しいリポジトリの作成
1. GitHubにログインし、右上の「+」アイコンから「New repository」を選択します。
2. **Repository name**: `mahjong-score-app` （など好きな名前）
3. **Public/Private**: `Public` を選択（無料版PagesはPublicのみ）。
4. 「Create repository」をクリック。

## 3. ファイルのアップロード
以下の手順で、パソコンにあるファイルをGitHubにアップロードします。

### ブラウザを使う場合（一番簡単）
1. 作成したリポジトリの画面で、「uploading an existing file」というリンクをクリックします。
2. `c:\Users\hirom\OneDrive\Desktop\麻雀スコア管理` フォルダの中身（`index.html`, `css`, `js`, `manifest.json`, `sw.js` など全て）をドラッグ＆ドロップします。
3. 下の「Commit changes」ボタンをクリックします。

### コマンドラインを使う場合（Git導入済みの方）
```bash
cd c:\Users\hirom\OneDrive\Desktop\麻雀スコア管理
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/[あなたのユーザー名]/mahjong-score-app.git
git push -u origin main
```

## 4. GitHub Pagesの設定
1. リポジトリのページで「Settings」タブを開きます。
2. 左側のメニューから「Pages」を選択します。
3. **Build and deployment** > **Source** で `Deploy from a branch` を選択。
4. **Branch** で `main` (または `master`) を選択し、フォルダは `/ (root)` のまま「Save」をクリック。

## 5. 公開の確認
数分待つと、ページ上部に「Your site is live at...」とURLが表示されます。
そのURLをスマホで開くと、アプリとして使えます！

## 注意点
- 公開されるのは「プログラム」だけです。あなたのパソコンに入っている「スコアデータ」は公開されません。
- 誰がアクセスしても、最初はデータが空の状態から始まります。
