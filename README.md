# PWA Offline Data Collector - Phase 1

オフライン対応PWAデータ収集システム（Android向け）

## 概要

事務所内サーバと接続し、オフライン環境でもデータ入力が可能なProgressive Web App (PWA)です。

### 主な機能

- **オフライン対応**: インターネット接続がなくてもデータ入力可能
- **自動同期**: オンライン復帰時に自動的にサーバと同期
- **データ永続化**: IndexedDBを使用したローカルストレージ
- **リアルタイム状態表示**: オンライン/オフライン状態、未同期データ数を表示

## 技術スタック

- **フロントエンド**: HTML5, CSS3, Vanilla JavaScript
- **PWA**: Service Worker, Web App Manifest, IndexedDB
- **バックエンド**: Flask (Python 3.9+)
- **プロトコル**: HTTP/HTTPS

## ディレクトリ構造

```
PWA-SYSTEM/
├── CLAUDE.md              # プロジェクト仕様書
├── README.md              # このファイル
├── .gitignore
├── frontend/              # フロントエンド
│   ├── index.html
│   ├── manifest.json
│   ├── sw.js
│   ├── css/
│   │   └── style.css
│   └── js/
│       ├── app.js
│       ├── db.js
│       └── sync.js
└── backend/               # バックエンド
    ├── app.py
    ├── requirements.txt
    └── data/              # データ保存ディレクトリ（自動生成）
```

## セットアップ手順

### 1. バックエンドサーバのセットアップ

```bash
# バックエンドディレクトリに移動
cd backend

# Python仮想環境の作成
python3 -m venv venv

# 仮想環境のアクティベート
# Linux/Mac:
source venv/bin/activate
# Windows:
# venv\Scripts\activate

# 依存パッケージのインストール
pip install -r requirements.txt

# サーバ起動
python app.py
```

サーバは `http://localhost:5000` で起動します。

### 2. フロントエンドのセットアップ

別のターミナルを開いて:

```bash
# プロジェクトルートに移動
cd PWA-SYSTEM

# フロントエンドディレクトリに移動
cd frontend

# Python組み込みHTTPサーバで起動（簡易テスト用）
python3 -m http.server 8000

# または、Node.jsのhttp-serverを使用（推奨）
# npm install -g http-server
# http-server -p 8000
```

フロントエンドは `http://localhost:8000` で起動します。

### 3. アクセス

ブラウザで以下にアクセス:
- **フロントエンド**: http://localhost:8000
- **バックエンドAPI**: http://localhost:5000/api/health

## 使い方

### 1. データ入力

1. フォームに以下の情報を入力:
   - **タイトル** (必須)
   - **説明** (任意)
   - **カテゴリ** (必須: 業務/調査/報告/その他)
   - **数値** (任意)
   - **メモ** (任意)

2. **保存**ボタンをクリック

3. データがIndexedDBに保存され、自動的に同期が試みられます

### 2. オフライン動作テスト

1. Chrome DevToolsを開く (F12)
2. **Network**タブを選択
3. **Offline**チェックボックスにチェック
4. データを入力して保存
5. 「保存済みデータ」セクションで「未同期」ステータスを確認

### 3. 同期テスト

**自動同期:**
1. オフライン状態でデータを入力
2. Networkタブで**Offline**チェックを外す
3. 自動的に同期が開始されます

**手動同期:**
1. **同期**ボタンをクリック
2. 未同期データがサーバに送信されます

## テスト手順

### Chrome DevToolsでの確認

1. **Application**タブを開く:
   - **Service Workers**: 登録状態を確認
   - **Storage > IndexedDB**: `OfflineDataDB`を確認
   - **Storage > Cache Storage**: キャッシュされたファイルを確認
   - **Manifest**: manifest.jsonの内容を確認

2. **Console**タブ:
   - ログメッセージを確認
   - エラーがないかチェック

3. **Network**タブ:
   - **Offline**モードでテスト
   - リクエスト/レスポンスを確認

### PWA機能のテスト

#### Service Worker

```javascript
// Console で実行
navigator.serviceWorker.getRegistration().then(reg => {
    console.log('Service Worker:', reg);
});
```

#### IndexedDB

```javascript
// Console で実行
openDatabase().then(() => getAllData()).then(data => {
    console.log('保存データ:', data);
});
```

#### オンライン/オフライン検出

```javascript
// Console で実行
console.log('オンライン状態:', navigator.onLine);
```

## Android端末でのテスト

### 1. 同一ネットワーク接続

Android端末とPCを同じWi-Fiネットワークに接続します。

### 2. PCのIPアドレス確認

```bash
# Linux/Mac:
ifconfig | grep inet
# または
ip addr show

# Windows:
ipconfig
```

例: `192.168.1.100`

### 3. バックエンド起動時のホスト設定確認

`backend/app.py`の最後の部分:
```python
app.run(host='0.0.0.0', port=5000, debug=True)
```

`host='0.0.0.0'`により、外部からのアクセスを許可します。

### 4. フロントエンド起動時のホスト設定

```bash
# Python HTTPサーバの場合
python3 -m http.server 8000 --bind 0.0.0.0

# http-serverの場合
http-server -p 8000 -a 0.0.0.0
```

### 5. Android端末からアクセス

Android端末のブラウザ（Chrome推奨）で:
```
http://192.168.1.100:8000
```

### 6. PWAインストール（Android）

1. Chromeで開くと「ホーム画面に追加」が表示されます
2. タップしてインストール
3. ホーム画面からアプリとして起動できます

### 7. オフラインテスト

1. Android端末の機内モードをON
2. PWAアプリを開く
3. データを入力して保存
4. 機内モードをOFF
5. 自動同期を確認

## トラブルシューティング

### Service Workerが登録されない

- HTTPSまたはlocalhostで実行していることを確認
- ブラウザでService Workerがサポートされていることを確認
- Consoleでエラーメッセージを確認

### キャッシュが更新されない

```javascript
// Service Workerをアンレジスター（DevTools Console）
navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(reg => reg.unregister());
});
```

または:
- Chrome: `Shift + F5` でハードリロード
- DevTools: Application > Service Workers > Unregister

### IndexedDBが動作しない

```javascript
// IndexedDBをクリア（DevTools Console）
clearDatabase().then(() => console.log('クリア完了'));
```

または:
- DevTools: Application > Storage > IndexedDB > `OfflineDataDB` > 右クリック > Delete

### CORSエラー

バックエンドサーバが起動していることを確認:
```bash
curl http://localhost:5000/api/health
```

### 同期が動作しない

1. バックエンドサーバが起動していることを確認
2. ネットワーク接続を確認
3. Consoleでエラーを確認

## API仕様

### POST /api/submit

データを受信するエンドポイント

**リクエスト:**
```json
{
  "title": "タイトル",
  "description": "説明",
  "category": "業務",
  "value": 100,
  "memo": "メモ",
  "timestamp": "2025-10-21T12:00:00.000Z"
}
```

**レスポンス:**
```json
{
  "success": true,
  "id": 1,
  "message": "Data received successfully"
}
```

### GET /api/health

ヘルスチェックエンドポイント

**レスポンス:**
```json
{
  "status": "ok",
  "timestamp": "2025-10-21T12:00:00.000Z",
  "service": "PWA Offline Data Collector API"
}
```

### GET /api/data

全データ取得（管理用）

**レスポンス:**
```json
{
  "success": true,
  "count": 10,
  "data": [...]
}
```

## セキュリティ

### 実装済み

- 入力データのサニタイゼーション
- HTMLエスケープ処理（XSS対策）
- Content-Type検証
- 必須フィールドバリデーション

### 推奨事項（Phase 2以降）

- HTTPS通信（本番環境）
- CSP (Content Security Policy) ヘッダー
- CSRF対策
- 認証機能
- レート制限

## 開発情報

### ログ確認

**フロントエンド:**
- ブラウザのConsoleタブ

**バックエンド:**
- ターミナルに出力されます
- すべてのAPIリクエストがログに記録されます

### データ保存場所

- **フロントエンド**: ブラウザのIndexedDB (`OfflineDataDB`)
- **バックエンド**: `backend/data/submissions.json`

### デバッグモード

バックエンドは開発モードで起動します:
```python
app.run(debug=True)
```

本番環境では`debug=False`に設定してください。

## 次のステップ（Phase 2）

- iOS対応（制限付き）
- 画像アップロード機能
- データの編集・削除機能
- 認証機能
- データのエクスポート機能

## ライセンス

このプロジェクトは内部使用を目的としています。

## サポート

問題が発生した場合は、以下を確認してください:
1. Chrome DevToolsのConsoleタブ
2. バックエンドサーバのログ
3. ネットワーク接続状態

---

**Phase 1 - Android Basic Implementation**
