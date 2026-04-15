// js/v9_finance.js
import { STATE } from './config.js';
import { addLog, showError } from './v9_ui.js'; // 🚀 記得補上 showError

// 🚀 [新增] 共用的算力檢查閘門
export function validatePoints(requiredPoints, actionName = "此操作") {
    if (STATE.userPoints < requiredPoints) {
        showError(`⚠️ 算力不足！${actionName}需要 ${requiredPoints} PTS，您目前剩餘 ${STATE.userPoints} PTS。請前往儲值。`);
        return false; // 餘額不足，回傳 false 阻斷流程
    }
    return true; // 餘額充足，放行
}

// (以下為您原本的代碼，完全不變)
export async function applyPointDeduction(deducted, reason = "") {
    if (deducted <= 0) return;

    const targetEl = document.getElementById('userPoints');
    if (targetEl) {
        const oldPoints = STATE.userPoints;
        STATE.userPoints -= deducted;
        animateNumberRoll(targetEl, oldPoints, STATE.userPoints, 1500);
        showPointDeductionEffect(deducted, 'userPoints');
    }

    if (reason) {
        await addLog("計費系統", "🪙", `<span class="text-[10px] text-red-400 font-bold border border-red-500/30 bg-red-500/10 px-2 py-1 rounded shadow-inner">本次消耗 ${deducted} 點 (${reason})</span>`);
    }
}

// 私有函數：拉霸滾動特效
function animateNumberRoll(obj, start, end, duration) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const easeProgress = 1 - Math.pow(1 - progress, 4);
        obj.innerText = Math.floor(start + easeProgress * (end - start)).toLocaleString();
        
        if (progress < 1) window.requestAnimationFrame(step);
        else obj.innerText = end.toLocaleString(); 
    };
    window.requestAnimationFrame(step);
}

// 私有函數：靈魂慢飄特效
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
