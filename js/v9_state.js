// js/v9_state.js
import { STATE } from './config.js';
import * as API from './api.js';

export const APP_VERSION = "V0.31 模組壓縮版";
export const MISSION = { persona: '', platforms: [], topic: '', universe: '', style: '', ratio: '9:16', resolution: '1K', characters: [], sceneFiles: [] };
export const IS_EDIT_MODE = { value: false }; // 使用物件包裝以利跨模組修改

export const SYSTEM_DB = {
    styles: [], characters: [],
    personas: [
        { id: 'HUMOR', name: '幽默酸民', icon: '🤡', desc: '時事嘲諷、網路迷因語氣' },
        { id: 'PRO', name: '專業權威', icon: '💼', desc: '數據導向、菁英分析觀點' },
        { id: 'WARM', name: '溫暖知性', icon: '☕', desc: '心靈雞湯、柔和共鳴語氣' }
    ]
};

export async function bootSystemData() {
    try {
        const result = await API.fetchSystemOptionsAPI(STATE.uid);
        if(result.success && result.data) {
            SYSTEM_DB.styles = result.data.styles || [];
            SYSTEM_DB.characters = result.data.characters || [];
            const charCountEl = document.getElementById('charCountLabel');
            if (charCountEl) charCountEl.innerText = `已擁有 ${SYSTEM_DB.characters.length} 組角色模型`;
        }
    } catch(e) { console.error("同步資料失敗", e); }
}

export function isMissionComplete() {
    if (!MISSION.persona || MISSION.platforms.length === 0 || !MISSION.topic || !MISSION.universe || !MISSION.style) return false;
    return !(MISSION.universe === 'ENHANCE' && MISSION.sceneFiles.length === 0);
}

// 🌟 核心修復：前端影像極速壓縮引擎 (解決 GCP 1MB 上限爆掉的問題)
export async function compressImage(file, maxWidth = 800) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width; let height = img.height;
                if (width > maxWidth) { height = Math.round(height * maxWidth / width); width = maxWidth; }
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                // 壓縮為 80% 畫質的 JPEG，體積將大幅縮小至 100KB 左右
                resolve(canvas.toDataURL('image/jpeg', 0.8));
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });
}
