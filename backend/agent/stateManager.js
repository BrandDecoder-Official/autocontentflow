// agent/stateManager.js

// 🚀 關鍵：直接引用您 services/firestore.service.js 裡匯出的 db 實例！
// 這樣就完美繼承了您設定的 databaseId: 'bd-autocontentflow-db'
const { db } = require('../services/firestore.service'); 

// V10 正式任務一律存在 `tasks`（見 firestore.service / draft / publish）。
// 舊版曾使用 `agent_tasks`，已廢止；此模組改與主流程共用同一集合以免資料分裂。
const COLLECTION_NAME = 'tasks';

/**
 * 💾 讀取記憶 (讀取任務狀態)
 */
exports.loadState = async (taskId) => {
    try {
        console.log(`[StateManager] 嘗試連線資料庫，讀取任務: ${taskId}...`);
        
        // 使用繼承來的 db 進行連線
        const doc = await db.collection(COLLECTION_NAME).doc(taskId).get();
        
        if (!doc.exists) {
            console.log(`[StateManager] 任務 ${taskId} 不存在，回傳 null。`);
            return null;
        }
        
        console.log(`[StateManager] 成功從資料庫喚醒任務 ${taskId}`);
        return doc.data();
    } catch (error) {
        console.error(`[StateManager] 讀取任務 ${taskId} 發生致命錯誤:`, error);
        throw new Error(`資料庫讀取異常: ${error.message}`);
    }
};

/**
 * 💾 寫入記憶 (儲存或更新任務狀態)
 */
exports.saveState = async (state) => {
    try {
        console.log(`[StateManager] 準備寫入資料庫，任務: ${state.taskId}...`);
        
        // 使用 set 並加上 merge: true，確保是「更新」而不是「洗掉原本的」
        await db.collection(COLLECTION_NAME).doc(state.taskId).set(state, { merge: true });
        
        console.log(`[StateManager] 任務 ${state.taskId} 已成功封存至 Firestore！`);
    } catch (error) {
        console.error(`[StateManager] 寫入任務 ${state.taskId} 發生致命錯誤:`, error);
        throw new Error(`資料庫寫入異常: ${error.message}`);
    }
};

/**
 * 🔍 撈取使用者的歷史任務清單 (Task Center 用)
 */
exports.getTasksByTenant = async (tenantId, limitCount = 10) => {
    try {
        const { db } = require('../services/firestore.service');
        const snapshot = await db.collection(COLLECTION_NAME)
            .where('tenantId', '==', tenantId)
            .orderBy('updatedAt', 'desc')
            .limit(limitCount)
            .get();
            
        return snapshot.docs.map(doc => doc.data());
    } catch (error) {
        console.error("❌ [StateManager] 撈取歷史任務失敗:", error);
        throw error;
    }
};