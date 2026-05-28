# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## アプリ概要

**雀ログ (Jong-Log)** — Mリーグルール準拠の麻雀スコア管理 PWA。セッション（半荘の集まり）単位でスコアを記録し、ウマ・オカを自動計算、累積成績・グラフ表示・リーグ戦・精算・ルーレット・SNSシェア用画像生成までを1つのSPAで提供する。UIは日本語。

## 技術スタック

- **フロントエンド**: バニラJS（モジュールなし、`window.*` 名前空間でグローバル公開）。ビルドステップなし。
- **CDN読み込み**: Firebase 10.7.1 compat SDK（app/firestore/auth）、Chart.js、chartjs-plugin-datalabels、html2canvas。
- **バックエンド**: Firebase（Firestore + Auth）。プロジェクトID: `jong-log`。
- **PWA**: [manifest.json](manifest.json) + [sw.js](sw.js)（Cache-first戦略）。
- **デプロイ**: `main` への push で GitHub Actions ([`.github/workflows/firebase-hosting-merge.yml`](.github/workflows/firebase-hosting-merge.yml)) が Firebase Hosting に自動デプロイ。

## 開発・デプロイコマンド

ビルド・テスト・lint はなし（純粋なHTML/CSS/JS）。

- **ローカル確認**: `index.html` を直接ブラウザで開く、または静的サーバを立てる（例: `python -m http.server`）。Firebase 接続はCDNから初期化されるためインターネット必須。
- **デプロイ**: `main` へマージすれば GitHub Actions が走る。手動なら `firebase deploy --only hosting`。
- **キャッシュ更新**: 静的アセットを変更したら **必ず [sw.js:1](sw.js#L1) の `CACHE_NAME` を bump する**。さもないとユーザー側で古いアセットが返り続ける。新規ファイルを追加した場合は `ASSETS_TO_CACHE` にも追記。

ユーザー向けGit操作手順は [.agent/workflows/](.agent/workflows/) に記載あり。

### Git運用ルール（重要）

- **作業ブランチ → リモート作業ブランチへの push は OK**（例: `git push origin feature/xxx`）。
- **このセッションからは `main` ブランチを触らない**こと。`git checkout main`・`main` への merge / commit / push はユーザー側で行う。
- **Firebase への反映 = `main` へのマージ**であり、これは **GitHub のWeb画面上でユーザーがPRをマージすることでトリガー**する運用。Claude Code 側から `main` へ直接 push したり、ローカルで merge してから push するのは禁止。
- 動作確認・レビュー前のコードを誤って本番反映させないためのフロー。

## アーキテクチャ全体像

### ページ構成（SPA）
`index.html` 1ファイル内に全 `<section>` を含め、`js/app.js` がナビゲーション制御で表示切替する。主なセクション: `login`/`signup`/`link-user`/`home`(セッション一覧)/`session-detail`/`input`(点数入力)/`users`/`settings`/`roulette`/`gallery`/`league-section`/`user-detail`。

### JSファイルの責務分担

| ファイル | グローバル | 役割 |
|---|---|---|
| [js/mahjong.js](js/mahjong.js) | `window.Mahjong` | スコア計算（オカ・ウマ・同点処理）。**純関数のみ**、DOM/Firestoreに非依存。 |
| [js/storage.js](js/storage.js) | `window.AppStorage` | Firestore CRUD + Firebase Auth ラッパ。全データI/Oはここを経由。 |
| [js/league.js](js/league.js) | `window.League` | リーグ戦機能（一覧・詳細・チャート）。 |
| [js/settlement.js](js/settlement.js) | `window.Settlement` | セッション単位の精算（場代等の経費按分含む）。 |
| [js/share.js](js/share.js) | `Share` | html2canvas で 9:16 シェア画像を生成。 |
| [js/app.js](js/app.js) | （DOM/状態） | 4600行超のメインコントローラ。DOM要素取得 → 認証フロー → ナビゲーション → 各セクションのrender/イベント。 |

読み込み順は [index.html:691-702](index.html#L691) で固定されており、依存関係的に `mahjong → storage → settlement → league → share → app` の順。

### データモデル（Firestore コレクション）

- `users/{name}` — ドキュメントIDがユーザー名（日本語可）。フィールド: `name`, `uid`（Authユーザーとの紐付け）, `title`, `titleRecords`, `myMembers`。
- `sessions/{sessionId}` — セッション内に `games[]` 配列（各局の `players[].rawScore/finalScore/rank` を含む）と `expenses[]`、`rules`。
- `leagues/{leagueId}` — リーグ設定とステータス（`status: 'active'|'completed'`）、参加プレイヤー、紐付けセッション。
- `settings/{docId}` — グローバル設定（startScore/returnScore/uma/tieBreaker 等）とルーレット項目。

### 認証 + 「デバイスユーザー」二段構成

Firebase Auth でログイン後、`users` コレクション内のドキュメント（表示名）と `uid` で紐付ける。ログイン中ユーザーの表示名は `localStorage.getItem('deviceUser')` に保持され、Firebase接続不能時の表示や権限判定にも使われる。**`deviceUser === 'ヒロム'` は管理者扱い**で全権限を持つハードコードあり（例: [js/league.js:13](js/league.js#L13)）。新規ユーザー権限ロジックを書くときはこの分岐を確認すること。

### スコア計算の同点処理（重要な設計）

[js/mahjong.js](js/mahjong.js) の `calculateResult(scores, settings, priorityInput)` は2モード:
- `tieBreaker: 'priority'`: 同点時は風（東>南>西>北）の優先度で順位確定。優先度未指定 or 同点+同優先度なら `{ needsTieBreaker: true, tiedGroups }` を返し、呼び出し側でUI（[`tie-breaker-modal`](index.html#L59)）を表示してユーザーに選ばせる必要がある。
- `tieBreaker: 'split'`: 同点者の順位ボーナス（ウマ・オカ）を頭割り。

スコア入力時は **合計100000点** を厳密検証 ([`window.Mahjong.validateTotal`](js/mahjong.js#L152))。

### キャッシュ戦略の落とし穴

[sw.js](sw.js) は Cache-first（キャッシュにあればネットを叩かない）。Firestore APIへの POST/PUT/DELETE はSW内で `event.request.method !== 'GET'` で除外している。アセット変更時に `CACHE_NAME` を更新しないとリリースが反映されないので、UI/JS変更を含む PR では原則 bump が必要。
