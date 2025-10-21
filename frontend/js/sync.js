/**
 * 同期ロジックモジュール
 * サーバとのデータ同期を管理
 */

// サーバAPIのベースURL（環境に応じて変更）
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? `${window.location.protocol}//${window.location.hostname}:5000`
    : '';

const API_ENDPOINTS = {
    submit: `${API_BASE_URL}/api/submit`,
    health: `${API_BASE_URL}/api/health`
};

/**
 * サーバのヘルスチェック
 * @returns {Promise<boolean>} サーバが利用可能かどうか
 */
async function checkServerHealth() {
    try {
        const response = await fetch(API_ENDPOINTS.health, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 5000
        });

        return response.ok;
    } catch (error) {
        console.error('サーバヘルスチェックエラー:', error);
        return false;
    }
}

/**
 * データをサーバに送信
 * @param {Object} data - 送信するデータ
 * @returns {Promise<Object>} サーバからのレスポンス
 */
async function submitToServer(data) {
    const response = await fetch(API_ENDPOINTS.submit, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            title: data.title,
            description: data.description,
            category: data.category,
            value: data.value,
            memo: data.memo,
            timestamp: data.timestamp
        })
    });

    if (!response.ok) {
        throw new Error(`サーバエラー: ${response.status} ${response.statusText}`);
    }

    return await response.json();
}

/**
 * 未同期データをサーバと同期
 * @returns {Promise<Object>} 同期結果 {success: number, failed: number, errors: Array}
 */
async function syncData() {
    console.log('同期処理開始');

    try {
        // オンライン状態チェック
        if (!navigator.onLine) {
            console.log('オフライン: 同期をスキップ');
            return { success: 0, failed: 0, errors: ['オフラインです'] };
        }

        // サーバヘルスチェック
        const serverAvailable = await checkServerHealth();
        if (!serverAvailable) {
            console.log('サーバ接続不可: 同期をスキップ');
            return { success: 0, failed: 0, errors: ['サーバに接続できません'] };
        }

        // 未同期データを取得
        const pendingData = await getDataByStatus('pending');

        if (pendingData.length === 0) {
            console.log('同期対象データなし');
            if (typeof showMessage === 'function') {
                showMessage('同期するデータがありません', 'info');
            }
            return { success: 0, failed: 0, errors: [] };
        }

        console.log(`同期対象データ: ${pendingData.length}件`);

        let successCount = 0;
        let failedCount = 0;
        const errors = [];

        // 各データを順次送信
        for (const data of pendingData) {
            try {
                // サーバに送信
                const result = await submitToServer(data);
                console.log('送信成功:', data.id, result);

                // ステータスを'synced'に更新
                await updateData(data.id, {
                    syncStatus: 'synced',
                    serverId: result.id
                });

                successCount++;

            } catch (error) {
                console.error('送信失敗:', data.id, error);

                // ステータスを'error'に更新
                await updateData(data.id, {
                    syncStatus: 'error',
                    errorMessage: error.message
                });

                failedCount++;
                errors.push({
                    id: data.id,
                    title: data.title,
                    error: error.message
                });
            }
        }

        console.log(`同期完了: 成功 ${successCount}件, 失敗 ${failedCount}件`);

        // UI更新
        if (typeof updateUI === 'function') {
            await updateUI();
        }

        // メッセージ表示
        if (typeof showMessage === 'function') {
            if (failedCount === 0) {
                showMessage(`${successCount}件のデータを同期しました`, 'success');
            } else {
                showMessage(`成功: ${successCount}件, 失敗: ${failedCount}件`, 'error');
            }
        }

        return { success: successCount, failed: failedCount, errors };

    } catch (error) {
        console.error('同期処理エラー:', error);

        if (typeof showMessage === 'function') {
            showMessage('同期処理でエラーが発生しました', 'error');
        }

        return { success: 0, failed: 0, errors: [error.message] };
    }
}

/**
 * Background Sync用の同期処理
 * Service Workerから呼び出される
 */
async function backgroundSync() {
    console.log('Background Sync実行');

    try {
        const result = await syncData();
        console.log('Background Sync結果:', result);

        // 同期成功時は通知を表示（オプション）
        if (result.success > 0 && 'Notification' in window && Notification.permission === 'granted') {
            new Notification('PWA Offline Collector', {
                body: `${result.success}件のデータを同期しました`,
                icon: '/manifest-icon-192.png',
                badge: '/manifest-icon-192.png'
            });
        }

        return result;

    } catch (error) {
        console.error('Background Syncエラー:', error);
        throw error;
    }
}

/**
 * エラー再試行処理
 * 'error'ステータスのデータを再度同期
 */
async function retryFailedSync() {
    console.log('エラーデータ再同期開始');

    try {
        const errorData = await getDataByStatus('error');

        if (errorData.length === 0) {
            console.log('再同期対象データなし');
            return { success: 0, failed: 0, errors: [] };
        }

        // 'pending'に戻して再同期
        for (const data of errorData) {
            await updateData(data.id, { syncStatus: 'pending' });
        }

        // 同期実行
        return await syncData();

    } catch (error) {
        console.error('再同期エラー:', error);
        throw error;
    }
}

/**
 * 通知パーミッションをリクエスト（オプション）
 */
async function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        try {
            const permission = await Notification.requestPermission();
            console.log('通知パーミッション:', permission);
            return permission;
        } catch (error) {
            console.error('通知パーミッションエラー:', error);
            return 'denied';
        }
    }
    return Notification.permission;
}
