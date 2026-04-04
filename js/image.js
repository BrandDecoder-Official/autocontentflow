// js/image.js
import { STATE } from './config.js';
import { showToast } from './utils.js';

// ==========================================
// 🚀 前端防當機「極速壓縮 & 濾鏡引擎」
// ==========================================
export function compressImageToBase64(file, maxWidth = 1024, forceGrayscale = false) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = function (event) {
            const img = new Image();
            img.src = event.target.result;
            img.onload = function () {
                const canvas = document.createElement('canvas');
                let width = img.width; let height = img.height;
                
                // 依比例縮放
                if (width > maxWidth) { 
                    height = Math.round((height * maxWidth) / width); 
                    width = maxWidth; 
                }
                
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d'); 
                ctx.drawImage(img, 0, 0, width, height);
                
                // 處理黑白濾鏡
                if (forceGrayscale) {
                    const imageData = ctx.getImageData(0, 0, width, height); 
                    const data = imageData.data;
                    for (let i = 0; i < data.length; i += 4) {
                        const lum = data[i] * 0.299 + data[i+1] * 0.587 + data[i+2] * 0.114;
                        data[i] = lum; data[i+1] = lum; data[i+2] = lum;
                    }
                    ctx.putImageData(imageData, 0, 0);
                }
                
                // 輸出壓縮後的 Base64
                const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.6);
                resolve({ data: compressedDataUrl.replace(/^data:image\/\w+;base64,/, ""), mimeType: 'image/jpeg' });
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
}

// ==========================================
// 🌟 攔截圖片選取 (Step 1 & 2)：使用全域雷達抓取精準座標
// ==========================================
const originalHandleFileSelect = window.handleFileSelect; 
window.handleFileSelect = async function(input, type, max, previewId) {
    const targetButton = window.LAST_CLICKED_EL || input; // 👈 破除幽靈座標，鎖定實體按鈕
    
    if (typeof UI !== 'undefined' && UI.handleFileSelect) {
        UI.handleFileSelect(input, type, max, previewId);
    }
    if (input.files && input.files.length > 0) {
        const msg = type === 'scene' ? '收到實境背景圖！正在進行特徵分析...' : '收到道具參考圖！已放入素材庫。';
        await window.addAgentLog('影像處理組', '📐', msg, false, targetButton);
    }
};

// ==========================================
// 🌟 Step 2：多圖輪播設定 (AI圖 vs 原圖直發)
// ==========================================
window.renderMultiImages = function() {
    const container = document.getElementById('multiImageContainer');
    const countDisplay = document.getElementById('multiImageCountDisplay');
    if(!container || !countDisplay) return;
    
    countDisplay.innerText = STATE.multiImages.length; 
    container.innerHTML = '';
    
    STATE.multiImages.forEach((img, index) => {
        const isAI = img.processType === 'AI_SYNTHESIS';
        const hasOrig = !!img.originalUrl;
        const div = document.createElement('div');
        div.className = `bg-white p-3 rounded-xl shadow-sm border ${!hasOrig ? 'border-indigo-400 bg-indigo-50/30' : 'border-gray-200'} flex items-center gap-3 relative animate-fade-in`;
        
        div.innerHTML = `
            <button type="button" onclick="window.removeMultiImage('${img.id}')" class="absolute -top-2 -right-2 bg-red-100 text-red-500 hover:bg-red-500 hover:text-white rounded-full w-6 h-6 flex items-center justify-center font-bold shadow-sm z-10">&times;</button>
            <img src="${hasOrig ? img.originalUrl : 'https://cdn-icons-png.flaticon.com/512/8636/8636831.png'}" class="w-16 h-16 object-cover rounded-lg border ${!hasOrig ? 'border-indigo-300 p-2 bg-white' : 'border-gray-200'}">
            <div class="flex-grow">
                <h4 class="font-bold text-gray-800 text-sm mb-1">${!hasOrig ? '🌟 AI 腳本配圖' : '附加圖片 ' + (index + 1)}</h4>
                <div class="flex bg-gray-100 rounded-lg p-1 w-max">
                    <button type="button" onclick="window.toggleMultiImageType('${img.id}', 'AI_SYNTHESIS')" class="${isAI ? 'bg-indigo-500 text-white' : 'text-gray-500 hover:text-gray-700'} text-xs font-bold px-3 py-1 rounded-md transition-all">🪄 AI 算圖</button>
                    ${hasOrig ? `<button type="button" onclick="window.toggleMultiImageType('${img.id}', 'ORIGINAL')" class="${!isAI ? 'bg-green-500 text-white' : 'text-gray-500 hover:text-gray-700'} text-xs font-bold px-3 py-1 rounded-md transition-all">📸 原圖直發</button>` : ''}
                </div>
            </div>`;
        container.appendChild(div);
    });
    
    // 若未滿 10 張，顯示「新增卡位」按鈕
    if (STATE.multiImages.length < 10) {
        const addBtnDiv = document.createElement('div');
        addBtnDiv.className = "w-full mt-2 animate-fade-in";
        addBtnDiv.innerHTML = `<button type="button" onclick="window.addAITemplate()" class="w-full py-2 border-2 border-dashed border-indigo-300 text-indigo-500 rounded-xl hover:bg-indigo-50 text-sm font-bold transition-colors">➕ 新增一張 AI 算圖卡位</button>`;
        container.appendChild(addBtnDiv);
    }
};

window.addAITemplate = async function() {
    if (STATE.multiImages.length >= 10) return;
    const targetButton = window.LAST_CLICKED_EL; // 抓取點擊的按鈕座標
    STATE.multiImages.push({ id: `img_ai_${Date.now()}_${Math.floor(Math.random() * 1000)}`, originalUrl: '', processType: 'AI_SYNTHESIS' });
    window.renderMultiImages();
    await window.addAgentLog('美術總監', '👨‍🎨', '已為您新增一張 AI 算圖排位，準備構思新分鏡。', false, targetButton);
};

window.handleMultiImageSelect = async function(input) {
    const max = 10; 
    const newFiles = Array.from(input.files);
    const targetButton = window.LAST_CLICKED_EL || input; // 👈 破除幽靈座標

    if ((STATE.multiImages?.length || 0) + newFiles.length > max) {
        return showToast('❌ 最多只能 10 張！', 'error');
    }
    if (!STATE.multiImages) STATE.multiImages = [];

    for (let file of newFiles) {
        showToast('📐 正在壓縮附加實拍圖片...', 'info');
        try {
            const compressed = await compressImageToBase64(file, 1024, false);
            STATE.multiImages.push({ 
                id: `img_${Date.now()}_${Math.floor(Math.random() * 1000)}`, 
                originalUrl: `data:${compressed.mimeType};base64,${compressed.data}`, 
                processType: 'ORIGINAL' 
            });
        } catch(e) {
            console.error(e);
            showToast('❌ 圖片壓縮失敗', 'error');
        }
    }
    input.value = ''; 
    window.renderMultiImages();
    await window.addAgentLog('影像處理組', '☁️', '附加圖片已成功上傳並壓縮完畢。', false, targetButton);
};

window.removeMultiImage = async function(id) {
    const targetButton = window.LAST_CLICKED_EL;
    STATE.multiImages = STATE.multiImages.filter(img => img.id !== id);
    window.renderMultiImages();
    await window.addAgentLog('系統管理員', '⚙️', '已將該張圖片從輪播列表中移除。', false, targetButton);
};

window.toggleMultiImageType = async function(id, type) {
    const targetButton = window.LAST_CLICKED_EL;
    const img = STATE.multiImages.find(i => i.id === id);
    if(img) img.processType = type;
    window.renderMultiImages();
    
    const msg = type === 'AI_SYNTHESIS' ? '模式切換：🪄 AI 強化合成' : '模式切換：📸 原圖直接發佈';
    await window.addAgentLog('美術總監', '👨‍🎨', msg, false, targetButton);
};
