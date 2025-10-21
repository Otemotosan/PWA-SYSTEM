# PWA Offline Data Collector - Phase 1

## プロジェクト概要
事務所内サーバと接続するオフライン対応PWAの検証プロジェクト。
アジェンダ式で段階的に機能拡張。Phase 1ではAndroidで基本機能を実装。

## 技術スタック
- **フロントエンド**: HTML5, CSS3, Vanilla JavaScript
- **PWA**: Service Worker, Web App Manifest, IndexedDB
- **バックエンド**: Flask (Python 3.9+)
- **サーバ**: ローカルサーバ(事務所内)
- **プロトコル**: HTTPS (開発時は自己署名証明書OK)

## ディレクトリ構造
```
pwa-offline-collector/
├── CLAUDE.md                 # このファイル
├── frontend/
│   ├── index.html           # メインHTML
│   ├── manifest.json        # PWA Manifest
│   ├── sw.js               # Service Worker
│   ├── css/
│   │   └── style.css       # スタイル
│   └── js/
│       ├── app.js          # メインアプリケーション
│       ├── db.js           # IndexedDB操作
│       └── sync.js         # 同期ロジック
├── backend/
│   ├── app.py              # Flaskサーバ
│   ├── requirements.txt    # Python依存関係
│   └── models.py           # データモデル(オプション)
└── .gitignore
```

## Phase 1 機能要件

### 1. データ入力フォーム
- 5つの入力フィールド:
  - タイトル (必須, text)
  - 説明 (任意, textarea)
  - カテゴリ (必須, select: オプション3-5個)
  - 数値 (任意, number)
  - メモ (任意, textarea)
- 入力日時を自動記録
- クライアント側バリデーション

### 2. オフラインストレージ (IndexedDB)
- データベース名: `OfflineDataDB`
- オブジェクトストア名: `pendingData`
- スキーマ:
  ```javascript
  {
    id: (auto-increment),
    title: string,
    description: string,
    category: string,
    value: number,
    memo: string,
    timestamp: Date,
    syncStatus: 'pending' | 'synced' | 'error'
  }
  ```

### 3. UI要素
- **入力フォーム**: 上記5項目
- **送信ボタン**: データをIndexedDBに保存
- **同期ボタン**: 手動同期をトリガー
- **ステータス表示**:
  - オンライン/オフライン状態
  - 未同期データ数
  - 同期成功/失敗メッセージ
- **データ一覧**: 保存済みデータの表示(同期ステータス付き)

### 4. Service Worker機能
- **キャッシュ戦略**: Cache First (静的ファイル)
- **キャッシュ対象**:
  - index.html
  - style.css
  - app.js, db.js, sync.js
  - manifest.json
- **Background Sync API**:
  - タグ名: `sync-data`
  - オンライン復帰時に自動実行

### 5. サーバ側 (Flask)
- **エンドポイント**:
  - `POST /api/submit`: データ受信
    - リクエスト: JSON形式のデータ
    - レスポンス: `{success: true, id: <server_id>}`
  - `GET /api/health`: ヘルスチェック
- **CORS**: 有効化(開発時)
- **ログ**: すべてのリクエストを記録

## 実装の優先順位

1. **Step 1**: 基本HTMLとCSSでUIを作成
2. **Step 2**: IndexedDB操作(db.js)を実装
3. **Step 3**: フォーム送信→IndexDB保存(app.js)
4. **Step 4**: Flaskサーバ構築(app.py)
5. **Step 5**: 同期ロジック(sync.js)実装
6. **Step 6**: Service Worker(sw.js)実装
7. **Step 7**: Web App Manifest作成
8. **Step 8**: 統合テストとデバッグ

## セキュリティ要件

### 必須
- HTTPS通信(自己署名証明書でも可)
- 入力データのサニタイゼーション
- SQLインジェクション対策(サーバ側)

### 推奨
- CSP (Content Security Policy) ヘッダー
- CSRF対策(今後のPhaseで)

## 開発環境セットアップ

### フロントエンド
```bash
# HTTPSローカルサーバ起動例
python -m http.server 8000 --bind 0.0.0.0
# または
npx http-server -p 8000 -S -C cert.pem -K key.pem
```

### バックエンド
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

## テスト項目

### オフライン機能
- [ ] オフライン時にフォーム送信→IndexedDBに保存
- [ ] オンライン復帰時に自動同期
- [ ] 手動同期ボタンで即座に同期

### UI/UX
- [ ] オンライン/オフライン状態が正確に表示
- [ ] 未同期データ数が表示される
- [ ] 同期成功時にユーザーへフィードバック
- [ ] 同期エラー時に適切なエラーメッセージ

### Service Worker
- [ ] 静的ファイルがキャッシュされる
- [ ] オフライン時でもUIが表示される
- [ ] Background Syncが動作する

### サーバ
- [ ] データを正常に受信・保存
- [ ] エラー時に適切なレスポンス

## デバッグ方法

### Chrome DevTools
- **Application** タブ:
  - Service Workers: 登録状態確認
  - Storage > IndexedDB: データ確認
  - Storage > Cache Storage: キャッシュ確認
  - Manifest: manifest.json確認
- **Network** タブ:
  - Offline チェックボックスでオフライン検証
  - Background Sync確認
- **Console**: エラーログ確認

### Tips
- Service Workerの更新: `Shift + F5` でハードリロード
- IndexedDBのクリア: Application > IndexedDB > 右クリック > Delete

## 注意事項

- Service Workerは**HTTPSまたはlocalhostでのみ動作**
- IndexedDBは**非同期API**のためPromise/async-awaitを使用
- Background Sync APIは**Androidでフルサポート**
- 開発中はService Workerのキャッシュに注意(古いファイルが残る)

## 次のPhase (参考)

Phase 2で追加予定の機能:
- iOS対応(制限付き)
- 画像アップロード対応
- データの編集・削除機能
- オフライン状態でのデータ閲覧改善
- 認証機能

## Claude Codeへの指示

このCLAUDE.mdに基づいて:
1. まず**ディレクトリ構造**を作成
2. **Step 1から順番に**実装
3. 各ステップ完了後、動作確認用の**簡単なテスト方法**を提示
4. コード内に**コメント**を適切に記載
5. セキュリティ要件を満たすコードを記述

質問や不明点があれば、実装前に確認してください。