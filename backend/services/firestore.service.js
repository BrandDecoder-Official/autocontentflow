// services/firestore.service.js
const { Firestore } = require('@google-cloud/firestore');
const { PROJECT_ID } = require('../config/env.config');

// 初始化 Firestore (Cloud Run 環境會自動抓取預設憑證，不需要特別給 key)
const db = new Firestore({
    projectId: PROJECT_ID,
    databaseId: 'bd-autocontentflow-db' // 這是你設定的 DB ID
});

const COLLECTION_NAME = 'tasks';

/**
 * 更新任務狀態
 */
async function updateTaskStatus(taskId, status, extraData = {}) {
    try {
        const taskRef = db.collection(COLLECTION_NAME).doc(taskId);
        const updateData = {
            status: status,
            updatedAt: Firestore.Timestamp.now(),
            ...extraData
        };
        await taskRef.update(updateData);
        console.log(`✅ [Firestore] 任務 ${taskId} 狀態更新為: ${status}`);
    } catch (error) {
        console.error(`❌ [Firestore] 更新任務狀態失敗:`, error);
        throw error;
    }
}

/**
 * 取得單一任務資料
 */
async function getTask(taskId) {
    try {
        const doc = await db.collection(COLLECTION_NAME).doc(taskId).get();
        if (!doc.exists) return null;
        return doc.data();
    } catch (error) {
        console.error(`❌ [Firestore] 讀取任務失敗:`, error);
        throw error;
    }
}

/**
 * 📝 建立交易紀錄 (扣點存摺)
 */
async function createTransactionLog(data) {
    try {
        const logRef = db.collection('transactions').doc();
        await logRef.set({
            tenantId: data.tenantId,
            taskId: data.taskId || 'SYSTEM',
            type: data.type,         // e.g., 'TEXT_GEN', 'IMAGE_GEN'
            description: data.description,
            amount: data.amount,      // 扣除點數
            balanceAfter: data.balanceAfter, // 扣完後的餘額
            createdAt: new Date().toISOString()
        });
    } catch (error) {
        console.error("❌ [Firestore] 寫入交易紀錄失敗:", error);
    }
}

/**
 * 🔍 Super Admin 查詢全平台 Log (前 50 筆)
 */
async function getAdminLogs(limitCount = 50, startDate = null, endDate = null) {
    let query = db.collection('transactions')
                  .orderBy('createdAt', 'desc')
                  .limit(limitCount);

    if (startDate) query = query.where('createdAt', '>=', startDate);
    if (endDate) query = query.where('createdAt', '<=', endDate);

    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * 🚀 ✨ [新增] 建立全新的 Agent 任務 (V10 漏斗專用)
 */
async function createAgentTask(taskId, tenantId, missionContext, currentStatus) {
    try {
        const taskRef = db.collection(COLLECTION_NAME).doc(taskId);
        const taskData = {
            taskId: taskId,
            tenantId: tenantId,
            missionContext: missionContext, // 這裡面會有 topic 跟 platforms
            currentStatus: currentStatus,   // 預設應該會是 'DRAFTING'
            agentData: {},                  // 預留一個空物件，給後面存文案跟圖片
            createdAt: Firestore.Timestamp.now(),
            updatedAt: Firestore.Timestamp.now()
        };
        
        await taskRef.set(taskData);
        console.log(`✅ [Firestore] 成功建立新任務: ${taskId}`);
        return taskData;
    } catch (error) {
        console.error(`❌ [Firestore] 建立新任務失敗:`, error);
        throw error;
    }
}

// 確保在 module.exports 把他輸出去
module.exports = {
    updateTaskStatus,
    getTask,
    createTransactionLog,
    getAdminLogs,
    createAgentTask, // 👈 記得加這一行
    db
};
