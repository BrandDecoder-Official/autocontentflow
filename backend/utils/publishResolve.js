'use strict';

/**
 * 統一解析「要發哪些平台」與「用哪些圖片網址」，供 publish API 與 Cron 共用。
 * 修正：payload.platforms 與 missionContext.platforms 不一致、別名、前端 selectedImages 未寫回 Firestore 等問題。
 */

const PLATFORM_ALIASES = {
    FACEBOOK: 'FB',
    FB: 'FB',
    META: 'FB',
    IG: 'IG',
    INSTAGRAM: 'IG',
    THREADS: 'THREADS',
    THREAD: 'THREADS',
};

function normalizePlatforms(raw) {
    if (!Array.isArray(raw)) return [];
    const out = [];
    for (const p of raw) {
        const k = String(p ?? '')
            .trim()
            .toUpperCase()
            .replace(/\s+/g, '');
        const mapped = PLATFORM_ALIASES[k] || (['FB', 'IG', 'THREADS'].includes(k) ? k : null);
        if (mapped && !out.includes(mapped)) out.push(mapped);
    }
    return out;
}

function resolvePlatformsFromTask(taskData) {
    const payloadPlats = taskData.payload?.platforms;
    const missionPlats = taskData.missionContext?.platforms;
    const chosen =
        Array.isArray(payloadPlats) && payloadPlats.length ? payloadPlats : Array.isArray(missionPlats) ? missionPlats : [];
    return normalizePlatforms(chosen);
}

function collectAttachmentUrls(taskData, body = {}) {
    const urls = [];
    const buckets = [
        body.attachmentFiles,
        taskData.payload?.attachmentFiles,
        taskData.missionContext?.attachmentFiles,
        taskData.image_options?.attachmentFiles
    ];
    for (const arr of buckets) {
        if (!Array.isArray(arr)) continue;
        for (const file of arr) {
            const u = file?.imageUrl || file?.url || file?.dataUrl;
            if (typeof u === 'string' && u.startsWith('http')) urls.push(u);
        }
    }
    return [...new Set(urls)];
}

/**
 * @param {object} taskData Firestore 任務文件
 * @param {object} [body] HTTP body（可含 selectedImages）
 */
function resolveImageUrlsFromTask(taskData, body = {}) {
    const urls = [];

    // 1. 收集 AI 生圖或主圖
    const fromSelected = body.selectedImages;
    if (Array.isArray(fromSelected) && fromSelected.length > 0) {
        const selectedUrls = fromSelected
            .map((i) => i.finalUrl || i.imageUrl)
            .filter((u) => typeof u === 'string' && u.startsWith('http'));
        urls.push(...selectedUrls);
    } else if (taskData.images?.length > 0) {
        const taskUrls = taskData.images.map((img) => img.finalUrl).filter(Boolean);
        urls.push(...taskUrls);
    } else if (taskData.generated_image_url && typeof taskData.generated_image_url === 'string') {
        urls.push(taskData.generated_image_url);
    }

    // 2. 收集並合併附掛圖
    const attach = collectAttachmentUrls(taskData, body);
    if (attach.length) {
        urls.push(...attach);
    }

    // 3. 去重並限制最多 10 張（與前端 PUBLISH_MEDIA_MAX_TOTAL = 10 限制一致）
    const finalUrls = [...new Set(urls)].slice(0, 10);

    return finalUrls;
}

module.exports = {
    normalizePlatforms,
    resolvePlatformsFromTask,
    resolveImageUrlsFromTask,
};
