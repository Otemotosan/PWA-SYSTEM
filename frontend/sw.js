/**
 * Service Worker
 * オフライン対応、キャッシュ管理、Background Sync
 */

const CACHE_NAME = 'pwa-offline-collector-v1';
const CACHE_FILES = [
    './',
    './index.html',
    './css/style.css',
    './js/app.js',
    './js/db.js',
    './js/sync.js',
    './manifest.json'
];

/**
 * Service Workerインストール時
 * 静的ファイルをキャッシュ
 */
self.addEventListener('install', (event) => {
    console.log('Service Worker: インストール開始');

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Service Worker: キャッシュ作成');
                return cache.addAll(CACHE_FILES);
            })
            .then(() => {
                console.log('Service Worker: インストール完了');
                // 即座にアクティブ化
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('Service Worker: キャッシュエラー', error);
            })
    );
});

/**
 * Service Workerアクティベーション時
 * 古いキャッシュを削除
 */
self.addEventListener('activate', (event) => {
    console.log('Service Worker: アクティベーション開始');

    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME) {
                            console.log('Service Worker: 古いキャッシュ削除', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('Service Worker: アクティベーション完了');
                // 全てのクライアントを即座に制御
                return self.clients.claim();
            })
    );
});

/**
 * フェッチイベント
 * キャッシュファーストストラテジー
 */
self.addEventListener('fetch', (event) => {
    // POSTリクエストはキャッシュしない
    if (event.request.method !== 'GET') {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                // キャッシュがあればそれを返す
                if (cachedResponse) {
                    console.log('Service Worker: キャッシュから返却', event.request.url);
                    return cachedResponse;
                }

                // キャッシュがなければネットワークから取得
                console.log('Service Worker: ネットワークから取得', event.request.url);
                return fetch(event.request)
                    .then((response) => {
                        // レスポンスが有効でない場合はそのまま返す
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }

                        // レスポンスをキャッシュに追加（静的ファイルのみ）
                        const responseToCache = response.clone();
                        const url = new URL(event.request.url);

                        // 同一オリジンの静的ファイルのみキャッシュ
                        if (url.origin === location.origin &&
                            (url.pathname.endsWith('.html') ||
                             url.pathname.endsWith('.css') ||
                             url.pathname.endsWith('.js') ||
                             url.pathname.endsWith('.json'))) {
                            caches.open(CACHE_NAME)
                                .then((cache) => {
                                    cache.put(event.request, responseToCache);
                                });
                        }

                        return response;
                    })
                    .catch((error) => {
                        console.error('Service Worker: フェッチエラー', error);
                        // オフライン時のフォールバック（オプション）
                        return new Response('オフラインです', {
                            status: 503,
                            statusText: 'Service Unavailable',
                            headers: new Headers({
                                'Content-Type': 'text/plain'
                            })
                        });
                    });
            })
    );
});

/**
 * Background Sync
 * オンライン復帰時に未同期データを送信
 */
self.addEventListener('sync', (event) => {
    console.log('Service Worker: Background Sync イベント', event.tag);

    if (event.tag === 'sync-data') {
        event.waitUntil(
            syncPendingData()
                .then((result) => {
                    console.log('Service Worker: 同期完了', result);
                })
                .catch((error) => {
                    console.error('Service Worker: 同期エラー', error);
                    // 再試行のためにエラーをthrow
                    throw error;
                })
        );
    }
});

/**
 * 未同期データの同期処理
 * @returns {Promise}
 */
async function syncPendingData() {
    try {
        // IndexedDBから未同期データを取得
        const db = await openIndexedDB();
        const pendingData = await getPendingDataFromDB(db);

        if (pendingData.length === 0) {
            console.log('Service Worker: 同期対象データなし');
            return { success: 0, failed: 0 };
        }

        console.log(`Service Worker: 同期対象データ ${pendingData.length}件`);

        let successCount = 0;
        let failedCount = 0;

        // 各データをサーバに送信
        for (const data of pendingData) {
            try {
                const response = await fetch('/api/submit', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data)
                });

                if (response.ok) {
                    // 成功: ステータスを更新
                    await updateDataStatus(db, data.id, 'synced');
                    successCount++;
                } else {
                    // 失敗: エラーステータスに更新
                    await updateDataStatus(db, data.id, 'error');
                    failedCount++;
                }

            } catch (error) {
                console.error('Service Worker: データ送信エラー', error);
                await updateDataStatus(db, data.id, 'error');
                failedCount++;
            }
        }

        // クライアントに通知
        await notifyClients({ type: 'sync-complete', success: successCount, failed: failedCount });

        return { success: successCount, failed: failedCount };

    } catch (error) {
        console.error('Service Worker: 同期処理エラー', error);
        throw error;
    }
}

/**
 * IndexedDBを開く
 * @returns {Promise<IDBDatabase>}
 */
function openIndexedDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('OfflineDataDB', 1);

        request.onsuccess = (event) => {
            resolve(event.target.result);
        };

        request.onerror = (event) => {
            reject(event.target.error);
        };
    });
}

/**
 * 未同期データを取得
 * @param {IDBDatabase} db
 * @returns {Promise<Array>}
 */
function getPendingDataFromDB(db) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['pendingData'], 'readonly');
        const objectStore = transaction.objectStore('pendingData');
        const index = objectStore.index('syncStatus');
        const request = index.getAll('pending');

        request.onsuccess = (event) => {
            resolve(event.target.result);
        };

        request.onerror = (event) => {
            reject(event.target.error);
        };
    });
}

/**
 * データの同期ステータスを更新
 * @param {IDBDatabase} db
 * @param {number} id
 * @param {string} status
 * @returns {Promise}
 */
function updateDataStatus(db, id, status) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['pendingData'], 'readwrite');
        const objectStore = transaction.objectStore('pendingData');
        const getRequest = objectStore.get(id);

        getRequest.onsuccess = (event) => {
            const data = event.target.result;
            data.syncStatus = status;

            const updateRequest = objectStore.put(data);

            updateRequest.onsuccess = () => {
                resolve();
            };

            updateRequest.onerror = (event) => {
                reject(event.target.error);
            };
        };

        getRequest.onerror = (event) => {
            reject(event.target.error);
        };
    });
}

/**
 * 全クライアントに通知
 * @param {Object} message
 * @returns {Promise}
 */
async function notifyClients(message) {
    const clients = await self.clients.matchAll({ type: 'window' });

    clients.forEach(client => {
        client.postMessage(message);
    });
}

/**
 * メッセージイベント
 * クライアントからのメッセージを受信
 */
self.addEventListener('message', (event) => {
    console.log('Service Worker: メッセージ受信', event.data);

    if (event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
