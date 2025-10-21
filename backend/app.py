"""
Flask Backend Server
PWA Offline Data Collector API
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime
import logging
import os
import json

# ロギング設定
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Flaskアプリ初期化
app = Flask(__name__)

# CORS設定（開発時はすべて許可、本番環境では適切に設定）
CORS(app, resources={r"/api/*": {"origins": "*"}})

# データ保存ディレクトリ
DATA_DIR = 'data'
DATA_FILE = os.path.join(DATA_DIR, 'submissions.json')

# データディレクトリの作成
if not os.path.exists(DATA_DIR):
    os.makedirs(DATA_DIR)
    logger.info(f'データディレクトリを作成: {DATA_DIR}')

# データファイルの初期化
if not os.path.exists(DATA_FILE):
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump([], f)
    logger.info(f'データファイルを作成: {DATA_FILE}')


def load_data():
    """データファイルから全データを読み込む"""
    try:
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        logger.error(f'データ読み込みエラー: {e}')
        return []


def save_data(data):
    """データファイルに全データを保存"""
    try:
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        logger.error(f'データ保存エラー: {e}')
        return False


def get_next_id():
    """次のIDを取得"""
    data = load_data()
    if not data:
        return 1
    return max(item.get('id', 0) for item in data) + 1


@app.route('/api/health', methods=['GET'])
def health_check():
    """ヘルスチェックエンドポイント"""
    logger.info('ヘルスチェック')
    return jsonify({
        'status': 'ok',
        'timestamp': datetime.now().isoformat(),
        'service': 'PWA Offline Data Collector API'
    }), 200


@app.route('/api/submit', methods=['POST'])
def submit_data():
    """データ受信エンドポイント"""
    try:
        # リクエストデータの取得
        if not request.is_json:
            logger.warning('無効なContent-Type')
            return jsonify({'error': 'Content-Type must be application/json'}), 400

        data = request.get_json()

        # バリデーション
        if not data:
            logger.warning('空のリクエスト')
            return jsonify({'error': 'Empty request body'}), 400

        # 必須フィールドのチェック
        required_fields = ['title', 'category']
        missing_fields = [field for field in required_fields if not data.get(field)]

        if missing_fields:
            logger.warning(f'必須フィールド欠落: {missing_fields}')
            return jsonify({
                'error': 'Missing required fields',
                'missing_fields': missing_fields
            }), 400

        # データのサニタイゼーション
        sanitized_data = {
            'title': str(data.get('title', '')).strip(),
            'description': str(data.get('description', '')).strip() if data.get('description') else None,
            'category': str(data.get('category', '')).strip(),
            'value': float(data.get('value')) if data.get('value') is not None else None,
            'memo': str(data.get('memo', '')).strip() if data.get('memo') else None,
            'timestamp': data.get('timestamp', datetime.now().isoformat()),
            'received_at': datetime.now().isoformat()
        }

        # IDを割り当て
        sanitized_data['id'] = get_next_id()

        # 既存データを読み込み
        all_data = load_data()

        # 新しいデータを追加
        all_data.append(sanitized_data)

        # データを保存
        if not save_data(all_data):
            logger.error('データ保存失敗')
            return jsonify({'error': 'Failed to save data'}), 500

        logger.info(f'データ受信成功: ID={sanitized_data["id"]}, Title={sanitized_data["title"]}')

        # 成功レスポンス
        return jsonify({
            'success': True,
            'id': sanitized_data['id'],
            'message': 'Data received successfully'
        }), 201

    except ValueError as e:
        logger.error(f'バリデーションエラー: {e}')
        return jsonify({'error': f'Validation error: {str(e)}'}), 400

    except Exception as e:
        logger.error(f'サーバエラー: {e}', exc_info=True)
        return jsonify({'error': 'Internal server error'}), 500


@app.route('/api/data', methods=['GET'])
def get_all_data():
    """全データ取得エンドポイント（管理用）"""
    try:
        data = load_data()
        logger.info(f'データ取得: {len(data)}件')

        return jsonify({
            'success': True,
            'count': len(data),
            'data': data
        }), 200

    except Exception as e:
        logger.error(f'データ取得エラー: {e}')
        return jsonify({'error': 'Failed to retrieve data'}), 500


@app.route('/api/data/<int:data_id>', methods=['GET'])
def get_data_by_id(data_id):
    """特定データ取得エンドポイント（管理用）"""
    try:
        all_data = load_data()
        data_item = next((item for item in all_data if item.get('id') == data_id), None)

        if not data_item:
            logger.warning(f'データが見つかりません: ID={data_id}')
            return jsonify({'error': 'Data not found'}), 404

        logger.info(f'データ取得: ID={data_id}')
        return jsonify({
            'success': True,
            'data': data_item
        }), 200

    except Exception as e:
        logger.error(f'データ取得エラー: {e}')
        return jsonify({'error': 'Failed to retrieve data'}), 500


@app.errorhandler(404)
def not_found(error):
    """404エラーハンドラ"""
    return jsonify({'error': 'Endpoint not found'}), 404


@app.errorhandler(500)
def internal_error(error):
    """500エラーハンドラ"""
    logger.error(f'内部エラー: {error}')
    return jsonify({'error': 'Internal server error'}), 500


if __name__ == '__main__':
    # 開発サーバ起動
    # 本番環境ではgunicornなどのWSGIサーバを使用
    logger.info('Flask開発サーバ起動')
    logger.info('CORS: 有効（全オリジン許可）')
    logger.info(f'データ保存先: {DATA_FILE}')

    app.run(
        host='0.0.0.0',  # すべてのインターフェースでリッスン
        port=5000,
        debug=True  # 本番環境ではFalseに設定
    )
