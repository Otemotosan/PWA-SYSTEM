/**
 * メインアプリケーション
 * フォーム処理、UI更新、オンライン/オフライン状態管理
 */

// DOM要素の取得
const dataForm = document.getElementById('data-form');
const syncBtn = document.getElementById('sync-btn');
const onlineStatus = document.getElementById('online-status');
const pendingCount = document.getElementById('pending-count');
const syncMessage = document.getElementById('sync-message');
const dataList = document.getElementById('data-list');

/**
 * アプリケーション初期化
 */
async function initApp() {
    console.log('アプリケーション初期化開始');

    // オンライン/オフライン状態の初期化
    updateOnlineStatus();

    // UI更新
    await updateUI();

    // イベントリスナーの設定
    setupEventListeners();

    // Service Workerの登録
    registerServiceWorker();

    console.log('アプリケーション初期化完了');
}

/**
 * イベントリスナーの設定
 */
function setupEventListeners() {
    // フォーム送信
    dataForm.addEventListener('submit', handleFormSubmit);

    // 同期ボタン
    syncBtn.addEventListener('click', handleSyncClick);

    // オンライン/オフライン状態の監視
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
}

/**
 * フォーム送信処理
 * @param {Event} event - submitイベント
 */
async function handleFormSubmit(event) {
    event.preventDefault();

    try {
        // フォームデータを取得
        const formData = new FormData(dataForm);
        const data = {
            title: formData.get('title'),
            description: formData.get('description'),
            category: formData.get('category'),
            value: formData.get('value') ? parseFloat(formData.get('value')) : null,
            memo: formData.get('memo')
        };

        // バリデーション
        if (!data.title || !data.category) {
            showMessage('タイトルとカテゴリは必須です', 'error');
            return;
        }

        // IndexedDBに保存
        await addData(data);

        // 成功メッセージ
        showMessage('データを保存しました', 'success');

        // フォームをリセット
        dataForm.reset();

        // UI更新
        await updateUI();

        // オンライン時は自動同期を試みる
        if (navigator.onLine) {
            setTimeout(() => {
                syncData();
            }, 500);
        }

    } catch (error) {
        console.error('フォーム送信エラー:', error);
        showMessage('データの保存に失敗しました', 'error');
    }
}

/**
 * 同期ボタンクリック処理
 */
async function handleSyncClick() {
    if (!navigator.onLine) {
        showMessage('オフラインです。オンラインになってから同期してください', 'error');
        return;
    }

    try {
        syncBtn.disabled = true;
        syncBtn.textContent = '同期中...';

        await syncData();

    } catch (error) {
        console.error('同期エラー:', error);
        showMessage('同期に失敗しました', 'error');
    } finally {
        syncBtn.disabled = false;
        syncBtn.textContent = '同期';
    }
}

/**
 * オンライン状態になった時の処理
 */
function handleOnline() {
    console.log('オンラインになりました');
    updateOnlineStatus();
    showMessage('オンラインに戻りました。データを同期します...', 'info');

    // 自動同期
    setTimeout(() => {
        syncData();
    }, 1000);
}

/**
 * オフライン状態になった時の処理
 */
function handleOffline() {
    console.log('オフラインになりました');
    updateOnlineStatus();
    showMessage('オフラインです。データはローカルに保存されます', 'info');
}

/**
 * オンライン/オフライン状態の表示更新
 */
function updateOnlineStatus() {
    if (navigator.onLine) {
        onlineStatus.textContent = 'Online';
        onlineStatus.className = 'status-badge online';
    } else {
        onlineStatus.textContent = 'Offline';
        onlineStatus.className = 'status-badge offline';
    }
}

/**
 * UI全体を更新
 */
async function updateUI() {
    await updatePendingCount();
    await updateDataList();
}

/**
 * 未同期データ数の更新
 */
async function updatePendingCount() {
    try {
        const count = await getPendingCount();
        pendingCount.textContent = count;
    } catch (error) {
        console.error('未同期データ数取得エラー:', error);
    }
}

/**
 * データ一覧の表示更新
 */
async function updateDataList() {
    try {
        const allData = await getAllData();

        if (allData.length === 0) {
            dataList.innerHTML = '<p class="no-data">データがありません</p>';
            return;
        }

        // 新しい順にソート
        allData.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        // HTMLを生成
        const html = allData.map(data => createDataCard(data)).join('');
        dataList.innerHTML = html;

    } catch (error) {
        console.error('データ一覧更新エラー:', error);
        dataList.innerHTML = '<p class="no-data">データの取得に失敗しました</p>';
    }
}

/**
 * データカードのHTMLを生成
 * @param {Object} data - データオブジェクト
 * @returns {string} HTML文字列
 */
function createDataCard(data) {
    const statusClass = data.syncStatus;
    const statusText = {
        'pending': '未同期',
        'synced': '同期済み',
        'error': 'エラー'
    }[data.syncStatus] || data.syncStatus;

    const timestamp = new Date(data.timestamp).toLocaleString('ja-JP');

    return `
        <div class="data-card">
            <div class="data-card-header">
                <div>
                    <div class="data-card-title">${escapeHtml(data.title)}</div>
                    <span class="data-card-category">${escapeHtml(data.category)}</span>
                </div>
                <span class="data-card-status ${statusClass}">${statusText}</span>
            </div>
            <div class="data-card-body">
                ${data.description ? `<div class="data-card-field"><span class="data-card-field-label">説明:</span>${escapeHtml(data.description)}</div>` : ''}
                ${data.value !== null ? `<div class="data-card-field"><span class="data-card-field-label">数値:</span>${data.value}</div>` : ''}
                ${data.memo ? `<div class="data-card-field"><span class="data-card-field-label">メモ:</span>${escapeHtml(data.memo)}</div>` : ''}
            </div>
            <div class="data-card-timestamp">${timestamp}</div>
        </div>
    `;
}

/**
 * HTMLエスケープ処理（XSS対策）
 * @param {string} str - エスケープする文字列
 * @returns {string} エスケープ済み文字列
 */
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * メッセージを表示
 * @param {string} message - メッセージ内容
 * @param {string} type - メッセージタイプ ('success', 'error', 'info')
 */
function showMessage(message, type = 'info') {
    syncMessage.textContent = message;
    syncMessage.className = `message-box ${type}`;

    // 3秒後に非表示
    setTimeout(() => {
        syncMessage.className = 'message-box hidden';
    }, 3000);
}

/**
 * Service Workerの登録
 */
async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('sw.js');
            console.log('Service Worker登録成功:', registration.scope);

            // Background Sync APIのサポートチェック
            if ('sync' in registration) {
                console.log('Background Sync API サポートあり');
            } else {
                console.log('Background Sync API サポートなし（フォールバック動作）');
            }

        } catch (error) {
            console.error('Service Worker登録エラー:', error);
        }
    } else {
        console.log('Service Worker未サポート');
    }
}

// ページ読み込み時にアプリケーションを初期化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
