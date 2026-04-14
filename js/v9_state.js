// js/v9_state.js

import { STATE } from './config.js';
import * as API from './api.js';

export const APP_VERSION = "V9.0.1";

export const MISSION = {
    currentTaskId: null, topic: '', universe: '', style: '', colorMode: '', ratio: '9:16', resolution: '1K', panelCount: 4, characters: [], sceneFiles: [], scheduledAt: null,
    persona: '', hookType: '痛點提問', contentLength: '深度文 (約300字)'
};

export const IS_EDIT_MODE = { value: false };

export const SYSTEM_DB = { characters: [], personas: [], styles: [], pricing: {} };

export function isMissionComplete() {
    if (!MISSION.topic || !MISSION.universe) return false;
    if (MISSION.universe === 'COMIC' && (!MISSION.style || !MISSION.colorMode)) return false;
    return true;
}

// 🚀 修改點：載入資料庫並合併人設
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
        if (res && res.success !== false) {
            SYSTEM_DB.characters = res.characters || [];
            SYSTEM_DB.styles = res.styles || [];
            SYSTEM_DB.pricing = res.pricing || {};
            // 將後端傳回的客製化人設與預設人設接合
            const customPersonas = res.personas || [];
            SYSTEM_DB.personas = [...defaultPersonas, ...customPersonas];
        }
    } catch (e) {
        console.error("系統資料載入失敗:", e);
        // 斷線時至少保留預設人設
        SYSTEM_DB.personas = [...defaultPersonas];
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
