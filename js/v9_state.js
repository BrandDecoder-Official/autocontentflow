// js/v9_state.js

import { STATE } from './config.js';
import * as API from './api.js';

export const APP_VERSION = "V10.0.1";

export const MISSION = {
    // 原有核心參數
    currentTaskId: null, 
    topic: '', 
    universe: '', 
    style: '', 
    colorMode: '', 
    ratio: '9:16', 
    resolution: '1K', 
    panelCount: 4, 
    characters: [], 
    sceneFiles: [], 
    attachmentFiles: [], // 確保這裡有初始化 9張附加圖的陣列
    scheduledAt: null,
    persona: '', 
    hookType: '痛點提問', 
    contentLength: '深度文 (約300字)',
    platforms: [], 

    // 🆕 V10 新增：平台獨立發文開關
    isIndependentPost: false, 
    
    // 🆕 V10 新增：各平台獨立的發文戰術
    platformStrategies: {
        FB: { hookType: '痛點提問', contentLength: '深度文 (約300字)' },
        IG: { hookType: '視覺誘惑', contentLength: '短平快 (約150字)' },
        THREADS: { hookType: '反直覺爆點', contentLength: '極短篇 (約50字)' }
    },

    // 🆕 V10 新增：多租戶 Telegram 設定
    tgConfig: {
        botToken: '',
        chatId: ''
    },

    // 🆕 V10 結構升級：支援多平台的內容與標籤儲存
    currentCaptions: { UNIFIED: '', FB: '', IG: '', THREADS: '' },
    currentHashtags: { UNIFIED: [], FB: [], IG: [], THREADS: [] },
    
    // 保留舊有欄位名稱以向下相容
    currentCaption: '',
    currentHashtagsArray: [],
    currentPanels: null,
    plannedImageCount: 1,
    isStoryMode: false,

    // 生圖資產池：保留每次扣點生成的批次，供用戶回選
    generatedImageBatches: [],
    selectedImageBatchId: null,
    imageRegenerationRequired: false,
    lastGeneratedContextKey: ''
};

export const IS_EDIT_MODE = { value: false };

export const SYSTEM_DB = { characters: [], personas: [], styles: [], pricing: {} };

export function isMissionComplete() {
    if (!MISSION.topic || !MISSION.universe) return false;
    if (MISSION.universe === 'COMIC' && (!MISSION.style || !MISSION.colorMode)) return false;
    return true;
}

function normalizeImageSourceList(items = []) {
    return items.map(x => (x?.imageUrl || x?.dataUrl || '')).filter(Boolean).sort();
}

export function buildImageGenerationContextKey() {
    const context = {
        topic: MISSION.topic || '',
        universe: MISSION.universe || '',
        style: MISSION.style || '',
        colorMode: MISSION.colorMode || '',
        characters: [...(MISSION.characters || [])].sort(),
        sceneRefs: normalizeImageSourceList(MISSION.sceneFiles || [])
    };
    return JSON.stringify(context);
}

export function markImageRegenerationRequired(reason = '') {
    if (!MISSION.generatedImageBatches || MISSION.generatedImageBatches.length === 0) return;
    MISSION.imageRegenerationRequired = true;
    if (reason) console.log(`[State] 需重生圖：${reason}`);
}

export function recordGeneratedImageBatch(images = [], caption = '') {
    if (!Array.isArray(images) || images.length === 0) return null;
    const batchId = `img_batch_${Date.now()}`;
    const batch = {
        id: batchId,
        createdAt: new Date().toISOString(),
        caption,
        contextKey: buildImageGenerationContextKey(),
        images
    };
    MISSION.generatedImageBatches = MISSION.generatedImageBatches || [];
    MISSION.generatedImageBatches.unshift(batch);
    MISSION.selectedImageBatchId = batchId;
    MISSION.lastGeneratedContextKey = batch.contextKey;
    MISSION.imageRegenerationRequired = false;
    return batch;
}

/**
 * ==========================================
 * 🚀 新增兵器：loadMissionFromDB
 * 💡 功能說明：將後端撈回來的任務 JSON 完美還原到前端 MISSION 狀態中。
 * 支援「草稿復活」與「歷史檢視」。
 * ==========================================
 */
export function loadMissionFromDB(taskData) {
    if (!taskData) return null;

    // 1. 抓取核心 Context (相容新舊資料結構)
    const ctx = taskData.missionContext || taskData.payload?.missionContext || taskData.payload || {};

    // 2. 還原基礎參數
    MISSION.currentTaskId = taskData.taskId || taskData.id;
    MISSION.topic = ctx.topic || '';
    MISSION.universe = ctx.universe || '';
    MISSION.style = ctx.style || '';
    MISSION.colorMode = ctx.colorMode || '';
    MISSION.ratio = ctx.ratio || '9:16';
    MISSION.resolution = ctx.resolution || '1K';
    MISSION.panelCount = ctx.panelCount || 4;
    MISSION.plannedImageCount = ctx.plannedImageCount || 1;
    MISSION.isStoryMode = !!ctx.isStoryMode;
    MISSION.characters = ctx.characters || [];
    MISSION.persona = ctx.persona || '';
    MISSION.hookType = ctx.hookType || '痛點提問';
    MISSION.contentLength = ctx.contentLength || '深度文 (約300字)';
    MISSION.platforms = ctx.platforms || [];
    MISSION.isIndependentPost = ctx.isIndependentPost || false;
    
    if (ctx.platformStrategies) {
        MISSION.platformStrategies = JSON.parse(JSON.stringify(ctx.platformStrategies));
    }

    MISSION.scheduledAt = ctx.scheduledAt || taskData.scheduledAt || null;

    // 3. 還原圖片庫 (從 image_options 提取背景與 9張附加圖)
    MISSION.sceneFiles = [];
    MISSION.attachmentFiles = [];
    const imgOpts = taskData.image_options || ctx.image_options || {};

    if (imgOpts.referenceImages && Array.isArray(imgOpts.referenceImages)) {
        imgOpts.referenceImages.forEach(img => {
            if (img.type === 'scene') {
                // 為了讓前台預覽能顯示，把 imageUrl 塞給 imageUrl 或 dataUrl
                MISSION.sceneFiles.push({ imageUrl: img.imageUrl, dataUrl: img.imageUrl, name: img.name });
            }
        });
    }

    if (imgOpts.attachmentFiles && Array.isArray(imgOpts.attachmentFiles)) {
        imgOpts.attachmentFiles.forEach(img => {
            MISSION.attachmentFiles.push({ imageUrl: img.imageUrl, dataUrl: img.imageUrl, name: img.name });
        });
    }

    // 4. 回傳當前任務狀態，讓外層決定要跳轉到漏斗的哪一步
    const finalStatus = taskData.status || taskData.currentStatus || 'UNKNOWN';
    console.log(`[State] 任務 ${MISSION.currentTaskId} 已成功還原，當前狀態：${finalStatus}`);
    return finalStatus;
}

/**
 * ==========================================
 * 📌 函數名稱：updateSidebarCountUI
 * ==========================================
 */
export function updateSidebarCountUI() {
    const countLabel = document.getElementById('charCountLabel');
    if (countLabel) {
        const charCount = SYSTEM_DB.characters.length;
        const personaCount = SYSTEM_DB.personas.length;
        countLabel.innerText = `已擁有 ${charCount} 組角色 / ${personaCount} 組人設模型`;
    }
}

export async function bootSystemData() {
    const defaultPersonas = [
        { id: 'p_default_1', icon: '👔', name: '專業顧問', desc: '客觀、數據導向', taboos: '' },
        { id: 'p_default_2', icon: '😎', name: '毒舌教官', desc: '犀利、一針見血', taboos: '' },
        { id: 'p_default_3', icon: '🌸', name: '溫暖知心', desc: '同理心、感性', taboos: '' },
        { id: 'p_default_4', icon: '🤡', name: '迷因小編', desc: '愛用網路梗、浮誇', taboos: '' }
    ];

    try {
        const res = await API.fetchSystemOptionsAPI(STATE.uid);
        if (res && res.success) {
            const dbData = res.data || {};
            SYSTEM_DB.characters = dbData.characters || [];
            SYSTEM_DB.styles = dbData.styles || [];
            SYSTEM_DB.pricing = dbData.pricing || {};
            const customPersonas = dbData.personas || [];
            SYSTEM_DB.personas = [...defaultPersonas, ...customPersonas];
        } else {
            SYSTEM_DB.personas = [...defaultPersonas];
        }
    } catch (e) {
        console.error("系統資料載入失敗:", e);
        SYSTEM_DB.personas = [...defaultPersonas];
    } finally {
        updateSidebarCountUI();
    }
}

export function compressImage(file, maxWidth = 1024, forceGrayscale = false) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader(); reader.readAsDataURL(file);
        reader.onload = function (event) {
            const img = new Image(); img.src = event.target.result;
            img.onload = function () {
                const canvas = document.createElement('canvas'); let width = img.width; let height = img.height;
                if (width > maxWidth) { height = Math.round((height * maxWidth) / width); width = maxWidth; }
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, width, height);
                if (forceGrayscale) {
                    const imageData = ctx.getImageData(0, 0, width, height); const data = imageData.data;
                    for (let i = 0; i < data.length; i += 4) {
                        const lum = data[i] * 0.299 + data[i+1] * 0.587 + data[i+2] * 0.114;
                        data[i] = lum; data[i+1] = lum; data[i+2] = lum;
                    }
                    ctx.putImageData(imageData, 0, 0);
                }
                resolve(canvas.toDataURL('image/jpeg', 0.8));
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
}
