// js/v9_state.js

import { STATE } from './config.js';
import * as API from './api.js';

export const APP_VERSION = "V10.0.1";

export const MISSION = {
    // 原有核心參數
    currentTaskId: null, 
    topic: '', 
    universe: '', 
    taskMode: 'GENERATE',
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
    locationId: null,
    locationName: null,

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
    currentDraft: null,
    plannedImageCount: 1,
    isStoryMode: false,

    // 生圖資產池：保留每次扣點生成的批次，供用戶回選
    generatedImageBatches: [],
    selectedImageBatchId: null,
    /** 目前預覽中：所選批次內第幾張（0-based） */
    selectedImagePreviewIndex: 0,
    imageRegenerationRequired: false,
    lastGeneratedContextKey: '',

    /** 發佈時是否納入各批次的合成圖：batchId -> boolean[]（與該批 images 對齊） */
    publishSyntheticMaskByBatch: {},

    /**
     * 漏斗斷點：下一步要接續的畫面（由每一步 confirm 寫入；reset 時回到 topic）
     * topic → platforms → persona → hook → universe → style → character → visual → schedule → dashboard → draft
     */
    funnelNextStep: 'topic',
    quickSnapMode: null
};

/** 發佈媒體上限：使用者勾選的合成圖 + 非合成附件圖合計（相簿式 0～10 張，可多選） */
export const PUBLISH_MEDIA_MAX_TOTAL = 10;

/**
 * 確保該批次有與圖片數量對齊的勾選陣列；新增索引預設為 true（納入發佈）。
 */
export function ensureSyntheticPublishMask(batchId, imageCount) {
    if (!batchId || imageCount < 1) return [];
    MISSION.publishSyntheticMaskByBatch = MISSION.publishSyntheticMaskByBatch || {};
    const cur = MISSION.publishSyntheticMaskByBatch[batchId];
    if (!Array.isArray(cur) || cur.length !== imageCount) {
        const next = [];
        for (let i = 0; i < imageCount; i++) {
            next.push(cur && cur[i] !== undefined ? !!cur[i] : true);
        }
        MISSION.publishSyntheticMaskByBatch[batchId] = next;
    }
    return MISSION.publishSyntheticMaskByBatch[batchId];
}

/**
 * 返回任務大廳時將 MISSION 還原為乾淨預設，避免上一筆任務殘留污染新任務。
 * 不替換 tgConfig 物件本體（TG 推播設定彈窗 input 綁定同一參考）。
 */
export function resetMissionStateForLobby() {
    const token = MISSION.tgConfig?.botToken ?? '';
    const chatId = MISSION.tgConfig?.chatId ?? '';

    MISSION.currentTaskId = null;
    MISSION.topic = '';
    MISSION.universe = '';
    MISSION.taskMode = 'GENERATE';
    MISSION.style = '';
    MISSION.colorMode = '';
    MISSION.ratio = '9:16';
    MISSION.resolution = '1K';
    MISSION.panelCount = 4;
    MISSION.characters = [];
    MISSION.sceneFiles = [];
    MISSION.characterFiles = [];
    MISSION.accessoryFiles = [];
    MISSION.attachmentFiles = [];
    MISSION.scheduledAt = null;
    MISSION.persona = '';
    MISSION.hookType = '痛點提問';
    MISSION.contentLength = '深度文 (約300字)';
    MISSION.platforms = [];
    MISSION.locationId = null;
    MISSION.locationName = null;
    MISSION.isIndependentPost = false;
    MISSION.platformStrategies = {
        FB: { hookType: '痛點提問', contentLength: '深度文 (約300字)' },
        IG: { hookType: '視覺誘惑', contentLength: '短平快 (約150字)' },
        THREADS: { hookType: '反直覺爆點', contentLength: '極短篇 (約50字)' }
    };
    MISSION.currentCaptions = { UNIFIED: '', FB: '', IG: '', THREADS: '' };
    MISSION.currentHashtags = { UNIFIED: [], FB: [], IG: [], THREADS: [] };
    MISSION.currentCaption = '';
    MISSION.currentHashtagsArray = [];
    MISSION.currentPanels = null;
    MISSION.currentDraft = null;
    MISSION.plannedImageCount = 1;
    MISSION.isStoryMode = false;
    MISSION.generatedImageBatches = [];
    MISSION.selectedImageBatchId = null;
    MISSION.selectedImagePreviewIndex = 0;
    MISSION.imageRegenerationRequired = false;
    MISSION.lastGeneratedContextKey = '';
    MISSION.publishSyntheticMaskByBatch = {};
    MISSION.funnelNextStep = 'topic';
    MISSION.quickSnapMode = null;

    MISSION.tgConfig.botToken = token;
    MISSION.tgConfig.chatId = chatId;
}

export const IS_EDIT_MODE = { value: false };

export const SYSTEM_DB = { characters: [], personas: [], styles: [], pricing: {} };

/**
 * 任務中的角色可能是字串（漏斗內）或 { name, persona }（後端 / 草稿 API 回寫）。
 * 統一成角色名稱字串陣列，供比對基因庫與組 referenceImages。
 */
export function getMissionCharacterNames(chars) {
    const list = chars ?? MISSION.characters;
    if (!Array.isArray(list)) return [];
    return list
        .map((c) => {
            if (c == null) return '';
            if (typeof c === 'string') return c.trim();
            if (typeof c === 'object' && typeof c.name === 'string') return c.name.trim();
            return '';
        })
        .filter(Boolean);
}

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
        characters: [...getMissionCharacterNames(MISSION.characters)].sort(),
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
    MISSION.selectedImagePreviewIndex = 0;
    MISSION.lastGeneratedContextKey = batch.contextKey;
    MISSION.imageRegenerationRequired = false;
    MISSION.publishSyntheticMaskByBatch = MISSION.publishSyntheticMaskByBatch || {};
    MISSION.publishSyntheticMaskByBatch[batchId] = images.map(() => true);
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

    // 🚀 關鍵修復：恢復任務時先重設/清空快取狀態與舊圖，防止前一任務的生圖/發佈快取污染
    resetMissionStateForLobby();

    // 1. 抓取核心 Context (相容新舊資料結構)
    const payloadRoot = taskData.payload || {};
    const ctx = taskData.missionContext || payloadRoot.missionContext || payloadRoot || {};

    // 2. 還原基礎參數
    MISSION.currentTaskId = taskData.taskId || taskData.id;
    MISSION.topic = ctx.topic || payloadRoot.topic || '';
    const legacyUniverse = ctx.universe || '';
    MISSION.universe = legacyUniverse === 'ENHANCE' ? 'REALISTIC' : legacyUniverse;
    MISSION.taskMode = ctx.taskMode || (legacyUniverse === 'ENHANCE' ? 'ENHANCE' : 'GENERATE');
    MISSION.style = ctx.style || '';
    MISSION.colorMode = ctx.colorMode || '';
    MISSION.ratio = ctx.ratio || '9:16';
    MISSION.resolution = ctx.resolution || '1K';
    MISSION.panelCount = ctx.panelCount || 4;
    MISSION.plannedImageCount = ctx.plannedImageCount || 1;
    MISSION.isStoryMode = !!ctx.isStoryMode;
    MISSION.characters = getMissionCharacterNames(ctx.characters || []);
    MISSION.persona = ctx.persona || '';
    MISSION.hookType = ctx.hookType || '痛點提問';
    MISSION.contentLength = ctx.contentLength || '深度文 (約300字)';
    MISSION.platforms = ctx.platforms?.length ? ctx.platforms : payloadRoot.platforms || [];
    MISSION.isIndependentPost = ctx.isIndependentPost || payloadRoot.isIndependentPost || false;
    MISSION.quickSnapMode = ctx.quickSnapMode || null;
    MISSION.locationId = ctx.locationId || null;
    MISSION.locationName = ctx.locationName || null;
    
    if (ctx.platformStrategies) {
        MISSION.platformStrategies = JSON.parse(JSON.stringify(ctx.platformStrategies));
    }

    MISSION.scheduledAt = ctx.scheduledAt || taskData.scheduledAt || null;

    // 3. 還原圖片庫 (從 image_options 提取背景與 9張附加圖)
    MISSION.sceneFiles = [];
    MISSION.characterFiles = [];
    MISSION.accessoryFiles = [];
    MISSION.attachmentFiles = [];
    const imgOpts = taskData.image_options || ctx.image_options || {};

    if (imgOpts.referenceImages && Array.isArray(imgOpts.referenceImages)) {
        imgOpts.referenceImages.forEach(img => {
            if (img.type === 'scene') {
                MISSION.sceneFiles.push({ imageUrl: img.imageUrl, dataUrl: img.imageUrl, name: img.name });
            } else if (img.type === 'character') {
                MISSION.characterFiles.push({ imageUrl: img.imageUrl, dataUrl: img.imageUrl, name: img.name });
            } else if (img.type === 'accessory' || img.type === 'object') {
                MISSION.accessoryFiles.push({ imageUrl: img.imageUrl, dataUrl: img.imageUrl, name: img.name });
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
    if (taskData.draftContent) {
        MISSION.currentDraft = taskData.draftContent;
    }
    if (finalStatus === 'DRAFTING') {
        MISSION.funnelNextStep = 'draft';
    }
    console.log(`[State] 任務 ${MISSION.currentTaskId} 已成功還原，當前狀態：${finalStatus}`);
    return finalStatus;
}

/**
 * ==========================================
 * 📌 函數名稱：updateSidebarCountUI
 * ==========================================
 */
export function updateSidebarCountUI() {
    const charCount = SYSTEM_DB.characters.length;
    const personaCount = SYSTEM_DB.personas.length;
    const charLabel = document.getElementById('charCountLabel');
    if (charLabel) charLabel.innerText = `已擁有 ${charCount} 組視覺角色`;
    const personaLabel = document.getElementById('personaCountLabel');
    if (personaLabel) {
        personaLabel.innerText = `共 ${personaCount} 組品牌人設（含系統預設模版）`;
    }
    const sidebarChar = document.getElementById('sidebarCharSummary');
    if (sidebarChar) sidebarChar.textContent = `視覺角色 ${charCount} 組`;
    const sidebarPersona = document.getElementById('sidebarPersonaSummary');
    if (sidebarPersona) sidebarPersona.textContent = `品牌人設 ${personaCount} 組`;
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
