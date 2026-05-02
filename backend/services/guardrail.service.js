// services/guardrail.service.js
const { FieldValue } = require('@google-cloud/firestore');
const { db } = require('./firestore.service'); // 🚀 完美繼承總編的統一資料庫配置

class GuardrailService {
    async preCheck(tenantId, requiredPoints = 0) {
        if (!tenantId) throw new Error("Guardrail: 缺少 Tenant ID");
        
        // 使用統一配置的 db 實例
        const tenantRef = db.collection('tenants').doc(tenantId);
        const docSnap = await tenantRef.get();
        
        if (!docSnap.exists) throw new Error("Guardrail: 找不到租戶資料");
        
        const tenantData = docSnap.data();
        if (tenantData.status !== 'ACTIVE') throw new Error("您的帳號已被停權，請聯繫管理員。");
        if ((tenantData.totalPoints || 0) < requiredPoints) {
            throw new Error(`點數不足！執行此動作需要 ${requiredPoints} 點。`);
        }
        return tenantData;
    }

    async chargeTokens({ tenantId, taskId, actionType, inputTokens = 0, outputTokens = 0 }) {
        try {
            // 精準打到 bd-autocontentflow-db 裡面的設定檔
            const pricingSnap = await db.collection('system_configs').doc('global_pricing').get();
            if (!pricingSnap.exists) throw new Error("系統定價設定檔遺失");
            const pricingData = pricingSnap.data();

            let totalPointsToDeduct = 0;
            const totalComputeUnits = inputTokens + outputTokens; 

            // 判斷走固定費率還是 Token 微量費率
            if (pricingData.actions && pricingData.actions[actionType] && pricingData.actions[actionType].isActive) {
                totalPointsToDeduct = pricingData.actions[actionType].retailPoints || 0;
            } else if (pricingData.token_rates) {
                const inP = Math.ceil(inputTokens / (pricingData.token_rates.input_divisor || 100));
                const outP = Math.ceil(outputTokens / (pricingData.token_rates.output_divisor || 50));
                totalPointsToDeduct = inP + outP;
            }

            // 如果沒有消耗，安全退出
            if (totalPointsToDeduct <= 0 && totalComputeUnits <= 0) return { deducted: 0, computeUnits: 0 };

            // 執行扣款與記錄
            const tenantRef = db.collection('tenants').doc(tenantId);
            const logRef = db.collection('transactions').doc();
            
            const batch = db.batch();
            
            // 1. 寫入交易日誌
            batch.set(logRef, {
                tenantId, taskId, actionType,
                pointsDeducted: totalPointsToDeduct,
                computeUnits: totalComputeUnits, 
                metrics: { inputTokens, outputTokens },
                createdAt: new Date().toISOString()
            });
            
            // 2. 扣除租戶點數 (改用 @google-cloud/firestore 的 FieldValue)
            batch.update(tenantRef, {
                totalPoints: FieldValue.increment(-totalPointsToDeduct),
                totalComputeUsed: FieldValue.increment(totalComputeUnits)
            });

            await batch.commit();
            console.log(`[Guardrail] 結帳成功: -${totalPointsToDeduct} 點`);
            
            return { deducted: totalPointsToDeduct, computeUnits: totalComputeUnits };
            
        } catch (error) {
            console.error(`[Guardrail Error] 計費失敗:`, error.message);
            // 即使計費失敗，也不要卡死主流程，回傳 0 讓大腦繼續運作
            return { deducted: 0, computeUnits: 0 }; 
        }
    }
}

module.exports = new GuardrailService();