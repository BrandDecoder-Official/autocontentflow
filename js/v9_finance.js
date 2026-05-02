// js/v9_finance.js
import { STATE } from './config.js';
import { appendBillingNotice, showError } from './v9_ui.js';
import { SYSTEM_DB } from './v9_state.js';
import { triggerWalletSync } from './api.js';

/**
 * ==========================================
 * 📌 函數名稱：getPricingConfig
 * 💡 功能說明：安全獲取系統動態報價表 (Config as Code)
 * ==========================================
 */
/**
 * 生圖扣點倍率（相對 1K），需與 backend/config/pricing.config.js 之 IMAGE_PER_GEN 比例一致。
 * 官方說明：https://ai.google.dev/gemini-api/docs/pricing
 */
export function getImageGenBillingMultiplier(resolution) {
    const table = { '0.5K': 0.045, '1K': 0.067, '2K': 0.101, '4K': 0.151 };
    const base = 0.067;
    let key = String(resolution || '1K').trim().toUpperCase();
    if (key === '512') key = '0.5K';
    const c = table[key] ?? base;
    return base > 0 ? c / base : 1;
}

/**
 * 與後端 billingService 一致：優先使用 Firestore global_pricing.actions[actionKey].retailPoints（經 system-options 下發），
 * 否則退回 pricing.config 的 BASE_FEES。
 */
export function getPricingConfig() {
    const p = SYSTEM_DB?.pricing;
    const actions = p?.actions || {};
    const base = p?.BASE_FEES || {};

    function fee(actionKey, hardFallback) {
        const row = actions[actionKey];
        if (row && row.isActive !== false && row.retailPoints != null && row.retailPoints !== '') {
            const n = Number(row.retailPoints);
            if (Number.isFinite(n)) return n;
        }
        if (base[actionKey] != null) return Number(base[actionKey]);
        return hardFallback;
    }

    if (!p) {
        return {
            BASE_FEES: {
                CREATE_PERSONA: 500,
                CREATE_CHARACTER: 800,
                GENERATE_DRAFT: 200
            }
        };
    }

    return {
        ...p,
        BASE_FEES: {
            ...base,
            CREATE_CHARACTER: fee('CREATE_CHARACTER', 800),
            CREATE_PERSONA: fee('CREATE_PERSONA', 500),
            GENERATE_DRAFT: fee('GENERATE_DRAFT', base.GENERATE_DRAFT ?? 200)
        }
    };
}

/**
 * 與 Firestore global_pricing.actions[actionKey].name 一致，供漏斗扣點橫條顯示。
 */
export function getBillingActionDisplayName(actionKey, fallback = '算力扣除') {
    if (!actionKey) return fallback;
    const raw = SYSTEM_DB?.pricing?.actions?.[actionKey]?.name;
    const s = typeof raw === 'string' ? raw.trim() : '';
    return s || fallback;
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
 * 💡 功能說明：扣點後立即與後端錢包同步，避免右上角與側欄紀錄脫鉤；漏斗內顯示扣點橫條。
 * ==========================================
 */
export async function applyPointDeduction(deducted, reason = "") {
    if (deducted <= 0) return;

    appendBillingNotice(reason || '算力扣除', deducted);
    showPointDeductionEffect(deducted, 'userPoints');

    await triggerWalletSync();
}

/**
 * 扣點數字「重力下墜」至餘額附近再淡出（相對於往上飄出畫面）
 */
function showPointDeductionEffect(points, targetElementId) {
    const target = document.getElementById(targetElementId);
    if (!target) return;

    const rect = target.getBoundingClientRect();
    const soul = document.createElement('div');
    soul.textContent = `−${Number(points).toLocaleString()}`;
    soul.className = 'fixed font-black text-red-400 pointer-events-none z-[9999] text-base sm:text-lg drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]';
    soul.style.left = `${rect.left + rect.width / 2}px`;
    soul.style.top = `${rect.top - 24}px`;
    soul.style.transform = 'translateX(-50%)';
    document.body.appendChild(soul);

    // 下墜距離約為先前版本的兩倍、總時長約 1s，曲線前段緩、後段加速模擬重力
    soul.animate(
        [
            { transform: 'translateX(-50%) translateY(0) scale(1)', opacity: 1 },
            { transform: 'translateX(-50%) translateY(16px) scale(1.08)', opacity: 1, offset: 0.12 },
            { transform: 'translateX(-50%) translateY(44px) scale(1.02)', opacity: 0.95, offset: 0.35 },
            { transform: 'translateX(-50%) translateY(84px) scale(0.98)', opacity: 0.55, offset: 0.62 },
            { transform: 'translateX(-50%) translateY(118px) scale(0.92)', opacity: 0.22, offset: 0.82 },
            { transform: 'translateX(-50%) translateY(128px) scale(0.88)', opacity: 0 },
        ],
        { duration: 1000, easing: 'cubic-bezier(0.33, 0.02, 0.45, 1)', fill: 'forwards' }
    ).onfinish = () => soul.remove();
}
