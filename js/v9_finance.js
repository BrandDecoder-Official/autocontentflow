// js/v9_finance.js
import { STATE } from './config.js';
import { addLog, showError, updatePointsDisplay } from './v9_ui.js';
import { SYSTEM_DB } from './v9_state.js';

/**
 * ==========================================
 * 📌 函數名稱：getPricingConfig
 * 💡 功能說明：安全獲取系統動態報價表 (Config as Code)
 * ==========================================
 */
export function getPricingConfig() {
    // 確保 SYSTEM_DB 裡面有 pricing 屬性，若無則提供安全預設值
    if (SYSTEM_DB && SYSTEM_DB.pricing && SYSTEM_DB.pricing.BASE_FEES) {
        return SYSTEM_DB.pricing;
    }
    // 預防萬一後端沒傳回來，給予保底設定
    return {
        BASE_FEES: {
            CREATE_PERSONA: 500,
            CREATE_CHARACTER: 800,
            GENERATE_DRAFT: 200
        }
    };
}

/**
 * ==========================================
 * 📌 函數名稱：validatePoints
 * 💡 功能說明：執行前端防呆閘門，確認餘額是否足夠扣抵「基礎費用」。
 * ==========================================
 */
export function validatePoints(requiredPoints, actionName = "此操作") {
    // 由於我們把 userPoints 改成從 STATE 管理，這邊多加個防護
    const currentPoints = STATE.userPoints || 0;
    
    if (currentPoints < requiredPoints) {
        showError(`⚠️ 算力不足！${actionName} 起步價需 ${requiredPoints} PTS，您目前剩餘 ${currentPoints} PTS。請前往儲值。`);
        return false; // 餘額不足，阻斷流程
    }
    return true; // 餘額充足，放行
}

/**
 * ==========================================
 * 📌 函數名稱：applyPointDeduction
 * 💡 功能說明：前端虛擬扣點展演 (真正的扣點由後端執行)。
 * 🚀 優化情境：將拉霸動畫統一委派給 v9_ui.js 的 updatePointsDisplay。
 * ==========================================
 */
export async function applyPointDeduction(deducted, reason = "") {
    if (deducted <= 0) return;

    // 1. 扣除本地狀態的數字
    STATE.userPoints = (STATE.userPoints || 0) - deducted;
    
    // 2. 呼叫 UI 統一重力拉霸更新
    updatePointsDisplay(STATE.userPoints);
    
    // 3. 顯示靈魂上飄 (這裡我們保留您原本喜歡的上飄設計，做為局部回饋)
    showPointDeductionEffect(deducted, 'userPoints');

    if (reason) {
        await addLog("計費系統", "🪙", `<span class="text-[10px] text-red-400 font-bold border border-red-500/30 bg-red-500/10 px-2 py-1 rounded shadow-inner">本次消耗 ${deducted} 點 (${reason})</span>`);
    }
}

/**
 * 私有函數：靈魂慢飄特效 (局部點數回饋)
 */
function showPointDeductionEffect(points, targetElementId) {
    const target = document.getElementById(targetElementId);
    if (!target) return;

    const rect = target.getBoundingClientRect();
    const soul = document.createElement('div');
    soul.innerText = `-${points}`;
    soul.className = 'fixed font-black text-red-500 pointer-events-none z-[9999] text-2xl drop-shadow-[0_0_12px_rgba(239,68,68,1)]';
    soul.style.left = `${rect.left + (rect.width / 2) - 15}px`;
    soul.style.top = `${rect.top - 5}px`;
    document.body.appendChild(soul);

    const animation = soul.animate([
        { transform: 'translate(0, 0) scale(1)', opacity: 1 },
        { transform: 'translate(-15px, -30px) scale(1.4)', opacity: 0.9, offset: 0.3 }, 
        { transform: 'translate(10px, -60px) scale(1.1)', opacity: 0.7, offset: 0.6 },  
        { transform: 'translate(-5px, -100px) scale(0.8)', opacity: 0 }                 
    ], { duration: 2500, easing: 'ease-out', fill: 'forwards' });

    animation.onfinish = () => soul.remove();
}
