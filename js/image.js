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
                let width = img.width;
                let height = img.height;

                // 依比例縮放
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // 處理黑白濾鏡
                if (forceGrayscale) {
                    const imageData = ctx.getImageData(0, 0, width, height);
                    const data = imageData.data;
                    for (let i = 0; i < data.length; i += 4) {
                        const luminance = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
                        data[i] = luminance;     // Red
                        data[i + 1] = luminance; // Green
                        data[i + 2] = luminance; // Blue
                    }
                    ctx.putImageData(imageData, 0, 0);
                }

                // 輸出壓縮後的 Base64
                const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.6); // 預設 0.6 畫質強力瘦身
                resolve({
                    data: compressedDataUrl.replace(/^data:image\/\w+;base64,/, ""),
                    mimeType: 'image/jpeg'
                });
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
}

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
        const hasOriginal = !!img.originalUrl;
        
        const div = document.createElement('div');
        div.className = `bg-white p-3 rounded-xl shadow-sm border ${!hasOriginal ? 'border-indigo-400 bg-indigo-50/30' : 'border-gray-200'} flex items-center gap-3 relative animate-fade-in`;
        
        let html = '';
        // 刪除按鈕
        html += `<button type="button" onclick="window.removeMultiImage('${img.id}')" class="absolute -top-2 -right-2 bg-red-100 text-red-500 hover:bg-red-500 hover:text-white rounded-full w-6 h-6 flex items-center justify-center font-bold transition-all shadow-sm z-10">&times;</button>`;
        
        // 圖片預覽縮圖
        html += `<img src="${hasOriginal ? img.originalUrl : 'https://cdn-icons-png.flaticon.com/512/8636/8636831.png'}" class="w-16 h-16 object-cover rounded-lg border ${!hasOriginal ? 'border-indigo-300 p-2 bg-white' : 'border-gray-200'}">`;
        
        // 資訊與控制項
        html += `<div class="flex-grow">`;
        html += `<h4 class="font-bold text-gray-800 text-sm mb-1">${!hasOriginal ? '🌟 AI 腳本配圖' : '附加圖片 ' + (index + 1)}</h4>`;
        
        html += `<div class="flex bg-gray-100 rounded-lg p-1 w-max">`;
        html += `<button type="button" onclick="window.toggleMultiImageType('${img.id}', 'AI_SYNTHESIS')" class="${isAI ? 'bg-indigo-500 text-white' : 'text-gray-500 hover:text-gray-700'} text-xs font-bold px-3 py-1 rounded-md transition-all">🪄 AI 算圖</button>`;
        if (hasOriginal) {
            html += `<button type="button" onclick="window.toggleMultiImageType('${img.id}', 'ORIGINAL')" class="${!isAI ? 'bg-green-500 text-white' : 'text-gray-500 hover:text-gray-700'} text-xs font-bold px-3 py-1 rounded-md transition-all">📸 原圖直發</button>`;
        }
        html += `</div></div>`;
        
        div.innerHTML = html;
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

window.addAITemplate = function() {
    if (STATE.multiImages.length >= 10) return showToast('❌ 最多只能 10 張圖片！', 'error');
    STATE.multiImages.push({
        id: `img_ai_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        originalUrl: '',
        processType: 'AI_SYNTHESIS'
    });
    window.renderMultiImages();
};

window.handleMultiImageSelect = async function(input) {
    const maxAllowed = 10;
    const currentCount = STATE.multiImages ? STATE.multiImages.length : 0;
    const newFiles = Array.from(input.files);

    if (currentCount + newFiles.length > maxAllowed) {
        showToast(`❌ 最多只能上傳 ${maxAllowed} 張圖片！`, 'error');
        return;
    }

    if (!STATE.multiImages) STATE.multiImages = [];

    for (let file of newFiles) {
        showToast('📐 正在壓縮附加實拍圖片...', 'info');
        try {
            // 這裡呼叫自己的 compressImageToBase64 函數，寬度設為 1024 即可，因為這不是送給 AI 看的
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
};

window.removeMultiImage = function(id) {
    STATE.multiImages = STATE.multiImages.filter(img => img.id !== id);
    window.renderMultiImages();
};

window.toggleMultiImageType = function(id, type) {
    const img = STATE.multiImages.find(i => i.id === id);
    if(img) img.processType = type;
    window.renderMultiImages();
};
