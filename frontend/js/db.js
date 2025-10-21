/**
 * IndexedDB操作モジュール
 * データベース名: OfflineDataDB
 * オブジェクトストア名: pendingData
 */

const DB_NAME = 'OfflineDataDB';
const DB_VERSION = 1;
const STORE_NAME = 'pendingData';

let db = null;

/**
 * データベースを開く/初期化
 * @returns {Promise<IDBDatabase>}
 */
function openDatabase() {
    return new Promise((resolve, reject) => {
        // データベースが既に開かれている場合は再利用
        if (db) {
            resolve(db);
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        // データベースアップグレード時の処理（初回作成時も含む）
        request.onupgradeneeded = (event) => {
            const database = event.target.result;

            // オブジェクトストアが存在しない場合は作成
            if (!database.objectStoreNames.contains(STORE_NAME)) {
                const objectStore = database.createObjectStore(STORE_NAME, {
                    keyPath: 'id',
                    autoIncrement: true
                });

                // インデックスを作成（検索用）
                objectStore.createIndex('syncStatus', 'syncStatus', { unique: false });
                objectStore.createIndex('timestamp', 'timestamp', { unique: false });

                console.log('IndexedDB: オブジェクトストア作成完了');
            }
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            console.log('IndexedDB: データベース接続成功');
            resolve(db);
        };

        request.onerror = (event) => {
            console.error('IndexedDB: データベース接続エラー', event.target.error);
            reject(event.target.error);
        };
    });
}

/**
 * データを追加
 * @param {Object} data - 追加するデータオブジェクト
 * @returns {Promise<number>} 追加されたデータのID
 */
async function addData(data) {
    const database = await openDatabase();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORE_NAME], 'readwrite');
        const objectStore = transaction.objectStore(STORE_NAME);

        // データに現在時刻と同期ステータスを追加
        const dataWithMeta = {
            ...data,
            timestamp: new Date().toISOString(),
            syncStatus: 'pending'
        };

        const request = objectStore.add(dataWithMeta);

        request.onsuccess = (event) => {
            const id = event.target.result;
            console.log('IndexedDB: データ追加成功', id);
            resolve(id);
        };

        request.onerror = (event) => {
            console.error('IndexedDB: データ追加エラー', event.target.error);
            reject(event.target.error);
        };
    });
}

/**
 * すべてのデータを取得
 * @returns {Promise<Array>} データの配列
 */
async function getAllData() {
    const database = await openDatabase();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORE_NAME], 'readonly');
        const objectStore = transaction.objectStore(STORE_NAME);
        const request = objectStore.getAll();

        request.onsuccess = (event) => {
            const data = event.target.result;
            console.log('IndexedDB: データ取得成功', data.length, '件');
            resolve(data);
        };

        request.onerror = (event) => {
            console.error('IndexedDB: データ取得エラー', event.target.error);
            reject(event.target.error);
        };
    });
}

/**
 * 特定のステータスのデータを取得
 * @param {string} status - 同期ステータス ('pending', 'synced', 'error')
 * @returns {Promise<Array>} データの配列
 */
async function getDataByStatus(status) {
    const database = await openDatabase();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORE_NAME], 'readonly');
        const objectStore = transaction.objectStore(STORE_NAME);
        const index = objectStore.index('syncStatus');
        const request = index.getAll(status);

        request.onsuccess = (event) => {
            const data = event.target.result;
            console.log(`IndexedDB: ${status}データ取得成功`, data.length, '件');
            resolve(data);
        };

        request.onerror = (event) => {
            console.error('IndexedDB: データ取得エラー', event.target.error);
            reject(event.target.error);
        };
    });
}

/**
 * データを更新
 * @param {number} id - 更新するデータのID
 * @param {Object} updates - 更新内容
 * @returns {Promise<void>}
 */
async function updateData(id, updates) {
    const database = await openDatabase();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORE_NAME], 'readwrite');
        const objectStore = transaction.objectStore(STORE_NAME);

        // 既存データを取得
        const getRequest = objectStore.get(id);

        getRequest.onsuccess = (event) => {
            const data = event.target.result;

            if (!data) {
                reject(new Error('データが見つかりません'));
                return;
            }

            // データを更新
            const updatedData = { ...data, ...updates };
            const updateRequest = objectStore.put(updatedData);

            updateRequest.onsuccess = () => {
                console.log('IndexedDB: データ更新成功', id);
                resolve();
            };

            updateRequest.onerror = (event) => {
                console.error('IndexedDB: データ更新エラー', event.target.error);
                reject(event.target.error);
            };
        };

        getRequest.onerror = (event) => {
            console.error('IndexedDB: データ取得エラー', event.target.error);
            reject(event.target.error);
        };
    });
}

/**
 * データを削除
 * @param {number} id - 削除するデータのID
 * @returns {Promise<void>}
 */
async function deleteData(id) {
    const database = await openDatabase();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORE_NAME], 'readwrite');
        const objectStore = transaction.objectStore(STORE_NAME);
        const request = objectStore.delete(id);

        request.onsuccess = () => {
            console.log('IndexedDB: データ削除成功', id);
            resolve();
        };

        request.onerror = (event) => {
            console.error('IndexedDB: データ削除エラー', event.target.error);
            reject(event.target.error);
        };
    });
}

/**
 * 未同期データ数を取得
 * @returns {Promise<number>} 未同期データの件数
 */
async function getPendingCount() {
    const pendingData = await getDataByStatus('pending');
    return pendingData.length;
}

/**
 * データベースを初期化（開発/テスト用）
 * @returns {Promise<void>}
 */
async function clearDatabase() {
    const database = await openDatabase();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORE_NAME], 'readwrite');
        const objectStore = transaction.objectStore(STORE_NAME);
        const request = objectStore.clear();

        request.onsuccess = () => {
            console.log('IndexedDB: データベースクリア完了');
            resolve();
        };

        request.onerror = (event) => {
            console.error('IndexedDB: データベースクリアエラー', event.target.error);
            reject(event.target.error);
        };
    });
}

// 初期化: ページ読み込み時にデータベースを開く
openDatabase().catch(error => {
    console.error('IndexedDB: 初期化エラー', error);
});
