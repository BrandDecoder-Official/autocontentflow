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
    scheduledAt: null,
    persona: '', 
    hookType: '痛點提問', 
    contentLength: '深度文 (約300字)',
    platforms: [], // 用戶選擇發布的平台，例如 ['FB', 'IG']

    // 🆕 V10 新增：平台獨立發文開關 (true: 平台適配, false: 統一內容)
    isIndependentPost: false, 
    
    // 🆕 V10 新增：各平台獨立的發文戰術 (字數與勾子)
    platformStrategies: {
        FB: { hookType: '痛點提問', contentLength: '深度文 (約300字)' },
        IG: { hookType: '視覺誘惑', contentLength: '短平快 (約150字)' },
        THREADS: { hookType: '反直覺爆點', contentLength: '極短篇 (約50字)' }
    },

    // 🆕 V10 新增：多租戶 Telegram 設定 (供側欄綁定用)
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
    currentPanels: null
};

export const IS_EDIT_MODE = { value: false };

export const SYSTEM_DB = { characters: [], personas: [], styles: [], pricing: {} };

export function isMissionComplete() {
    if (!MISSION.topic || !MISSION.universe) return false;
    if (MISSION.universe === 'COMIC' && (!MISSION.style || !MISSION.colorMode)) return false;
    return true;
}

// 💡 新增：獨立出一個專門把 SYSTEM_DB 數字同步到側邊欄的 UI 函數
export function updateSidebarCountUI() {
    const countLabel = document.getElementById('charCountLabel');
    if (countLabel) {
        const total = SYSTEM_DB.characters.length + SYSTEM_DB.personas.length;
        countLabel.innerText = `已擁有 ${total} 組角色/人設模型`;
    }
}

// 🚀 正確解析後端傳來的 res.data
export async function bootSystemData() {
    // 預先準備好四大經典預設人設
    const defaultPersonas = [
        { id: 'p_default_1', icon: '👔', name: '專業顧問', desc: '客觀、數據導向', taboos: '' },
        { id: 'p_default_2', icon: '😎', name: '毒舌教官', desc: '犀利、一針見血', taboos: '' },
        { id: 'p_default_3', icon: '🌸', name: '溫暖知心', desc: '同理心、感性', taboos: '' },
        { id: 'p_default_4', icon: '🤡', name: '迷因小編', desc: '愛用網路梗、浮誇', taboos: '' }
    ];

    try {
        const res = await API.fetchSystemOptionsAPI(STATE.uid);
        if (res && res.success) {
            // 🐛 資料是包在 res.data 裡面的
            const dbData = res.data || {};
            
            SYSTEM_DB.characters = dbData.characters || [];
            SYSTEM_DB.styles = dbData.styles || [];
            SYSTEM_DB.pricing = dbData.pricing || {};
            
            // 將後端傳回的客製化人設與預設人設接合
            const customPersonas = dbData.personas || [];
            SYSTEM_DB.personas = [...defaultPersonas, ...customPersonas];
        } else {
            SYSTEM_DB.personas = [...defaultPersonas];
        }
    } catch (e) {
        console.error("系統資料載入失敗:", e);
        // 斷線時至少保留預設人設
        SYSTEM_DB.personas = [...defaultPersonas];
    } finally {
        // 🎯 關鍵架構修復：資料載入完畢後，統一發送通知更新 UI！
        // 這樣不管是剛開機(F5)、還是新增/刪除角色後重新載入，數字永遠跟著大腦走。
        updateSidebarCountUI();
    }
}

// 圖片壓縮引擎保持不變
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
