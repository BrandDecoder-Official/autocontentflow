// js/ui.js
import { STATE } from './config.js';
import { showToast } from './utils.js';

// 🌟 動態渲染選項 (畫風、動態、角色)
export function renderDynamicOptions(mode, data) {
    const styleContainer = document.getElementById('styleRadioContainer');
    const motionSelect = document.getElementById('motionSelect');
    const charContainer = document.getElementById('dbCharacterContainer');
    const countLabel = document.getElementById('dbCharCount');

    if (!data) return;

    // 1. 畫風渲染
    if (styleContainer && data.styles) {
        styleContainer.innerHTML = '';
        const filteredStyles = data.styles.filter(s => s.category === mode || s.category === 'ALL');
        if (filteredStyles.length === 0) {
            styleContainer.innerHTML = '<span class="text-xs text-gray-400">此模式尚無畫風選項</span>';
        } else {
            filteredStyles.forEach((style, index) => {
                const isChecked = index === 0 ? 'checked' : '';
                // 🌟 修正：不再塞入 JSON，而是純粹塞入畫風的 id！
                styleContainer.innerHTML += `
                    <label class="flex items-center cursor-pointer bg-white border border-gray-200 rounded-lg px-3 py-2 hover:bg-blue-50 transition-colors">
                        <input type="radio" name="targetStyle" value="${style.id}" ${isChecked} class="w-4 h-4 text-blue-600 focus:ring-blue-500">
                        <span class="ml-2 text-sm font-bold text-gray-700">${style.name}</span>
                    </label>
                `;
            });
        }
    }

    // 2. 動態渲染
    if (motionSelect && data.motions) {
        motionSelect.innerHTML = '<option value="">不使用動態 (純圖片)</option>';
        data.motions.forEach(motion => {
            motionSelect.innerHTML += `<option value="${motion.prompt}">${motion.name}</option>`;
        });
    }

    // 🌟 3. 專屬角色庫渲染 (這裡換上全新的大頭照 UI 邏輯！)
    if (charContainer && data.characters) {
        charContainer.innerHTML = ''; // 清空載入中
        if (countLabel) countLabel.innerText = `(${data.characters.length}/10)`;

        if (data.characters.length === 0) {
            charContainer.innerHTML = '<span class="text-xs text-gray-400">角色庫尚無資料，請點擊右上方新增。</span>';
        } else {
            data.characters.forEach(char => {
                // 建立外層卡片
                const wrapper = document.createElement('div');
                wrapper.className = 'relative group flex flex-col items-center w-16';
                
                // 🌟 角色頭像 (顯示 GCS 圖片，滑鼠懸浮顯示 AI 基因)
                const img = document.createElement('img');
                img.src = char.imageUrl || 'https://via.placeholder.com/150'; // 顯示大頭照
                img.className = 'w-16 h-16 rounded-full border-2 border-white shadow-md cursor-pointer hover:border-blue-500 hover:shadow-lg transition-all object-cover bg-gray-100';
                img.title = `🧬 AI 提取基因:\n${char.aiExtractedFeatures}`; // 滑鼠移上去能看見基因！
                img.onclick = () => window.addCharacterFromDB(char);

                // 🗑️ 刪除按鈕 (移除 hidden，改為常駐顯示以支援手機版)
                const delBtn = document.createElement('button');
                delBtn.className = 'absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 text-[10px] flex items-center justify-center shadow-lg hover:bg-red-600 opacity-90 hover:opacity-100 transition-all z-10';
                delBtn.innerHTML = '✕';
                delBtn.title = '永久刪除此角色';
                delBtn.type = 'button'; 
                delBtn.onclick = (e) => {
                    e.stopPropagation(); 
                    window.deleteChar(char.id); 
                };

                // 名字標籤
                const nameLabel = document.createElement('span');
                nameLabel.className = 'text-[10px] mt-1.5 font-bold text-gray-700 truncate w-full text-center bg-white px-1 rounded';
                nameLabel.innerText = char.name;

                wrapper.appendChild(img);
                wrapper.appendChild(delBtn);
                wrapper.appendChild(nameLabel);
                charContainer.appendChild(wrapper);
            });
        }
    }
}

export function switchMode(toComic) {
    STATE.isComicModeActive = toComic;
    const btnStandard = document.getElementById('btnStandardMode');
    const btnComic = document.getElementById('btnComicMode');
    const charWarning = document.getElementById('realisticCharWarning');
    const sceneWarning = document.getElementById('realisticSceneWarning');
    const colorModeContainer = document.getElementById('colorModeContainer'); // 🌟 新增：色彩開關區塊

    if (toComic) {
        btnComic.classList.add('mode-active'); btnStandard.classList.remove('mode-active');
        if(charWarning) charWarning.classList.add('hidden'); if(sceneWarning) sceneWarning.classList.add('hidden');
        if(colorModeContainer) colorModeContainer.classList.remove('hidden'); // 🌟 動漫模式顯示色彩開關
        renderDynamicOptions('ANIME');
    } else {
        btnStandard.classList.add('mode-active'); btnComic.classList.remove('mode-active');
        if(charWarning) charWarning.classList.remove('hidden'); if(sceneWarning) sceneWarning.classList.remove('hidden');
        if(colorModeContainer) colorModeContainer.classList.add('hidden'); // 🌟 真實模式隱藏色彩開關
        renderDynamicOptions('REALISTIC');
    }
}

export function toggleSection(containerId, isSkipped) {
    const container = document.getElementById(containerId);
    if (isSkipped) container.classList.add('opacity-30', 'pointer-events-none');
    else container.classList.remove('opacity-30', 'pointer-events-none');
}

export function previewCharImage(input, previewId) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = document.getElementById(previewId);
            img.src = e.target.result; img.classList.remove('hidden');
        };
        reader.readAsDataURL(input.files[0]);
    }
}

export function handleFileSelect(input, type, maxCount, previewContainerId) {
    const targetArray = type === 'scene' ? STATE.sceneFiles : STATE.objectFiles;
    const newFiles = Array.from(input.files);
    if (targetArray.length + newFiles.length > maxCount) {
        alert(`⚠️ 此區塊最多只能上傳 ${maxCount} 張圖片！`); input.value = ''; return;
    }
    newFiles.forEach(file => targetArray.push(file));
    input.value = ''; 
    renderThumbnails(type, previewContainerId);
}

export function removeFileFromArray(index, type, containerId) {
    const targetArray = type === 'scene' ? STATE.sceneFiles : STATE.objectFiles;
    targetArray.splice(index, 1);
    renderThumbnails(type, containerId);
}

export function renderThumbnails(type, containerId) {
    const targetArray = type === 'scene' ? STATE.sceneFiles : STATE.objectFiles;
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    targetArray.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const isMainBg = (containerId === 'scenePreview' && index === 0);
            const div = document.createElement('div');
            div.className = `relative w-20 h-20 rounded-lg shadow-sm overflow-hidden flex-shrink-0 animate-fade-in ${isMainBg ? 'border-2 border-blue-500' : 'border border-gray-200'}`;
            div.innerHTML = `
                <img src="${e.target.result}" class="w-full h-full object-cover">
                <button type="button" onclick="window.removeFileFromArray(${index}, '${type}', '${containerId}')" class="absolute top-1 right-1 bg-red-500 bg-opacity-90 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold hover:bg-red-600 shadow-md">✕</button>
                ${isMainBg ? '<div class="absolute bottom-0 left-0 right-0 bg-blue-600 bg-opacity-90 text-white text-[10px] text-center font-bold py-0.5 tracking-widest">主背景</div>' : ''}
            `;
            container.appendChild(div);
        };
        reader.readAsDataURL(file);
    });
}

export function resetToStep1() {
    document.getElementById('step3-publish').classList.add('hidden');
    document.getElementById('step2-review').classList.add('hidden');
    document.getElementById('step1-setup').classList.remove('hidden');
    document.getElementById('topic').value = '';
    
    // 🌟 不再清空角色列表，讓「開啟新任務」時可以保留剛剛設定好的角色陣列
    // document.getElementById('characterList').innerHTML = '';
    
    STATE.sceneFiles = []; STATE.objectFiles = [];
    document.getElementById('scenePreview').innerHTML = ''; document.getElementById('objectPreview').innerHTML = '';
    
    document.getElementById('skipScene').checked = false; document.getElementById('skipObject').checked = false;
    toggleSection('sceneContainer', false); toggleSection('objectContainer', false);
    
    const btnPublish = document.getElementById('btnPublish');
    btnPublish.disabled = false; btnPublish.innerHTML = '🚀 發射！';
    if (btnPublish.classList.contains('bg-gray-500')) btnPublish.classList.replace('bg-gray-500', 'bg-green-600');
    document.getElementById('btnRegenerate').classList.remove('hidden');

    const btnVideo = document.getElementById('btnGenerateVideo');
    if (btnVideo) {
        btnVideo.disabled = false; btnVideo.innerHTML = '🎬 消耗點數，生成動態影片';
        btnVideo.classList.replace('bg-indigo-100', 'bg-white'); btnVideo.classList.replace('text-indigo-400', 'text-indigo-600');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast('🏠 已開啟新任務！場景已清空，角色設定已保留。', 'info');
}
// ==========================================
// 🌟 專屬角色 Modal 控制
// ==========================================
export function openCreateCharModal() {
    const modal = document.getElementById('createCharModal');
    modal.classList.remove('hidden');
    // 給予微小延遲以觸發 CSS 漸層動畫
    setTimeout(() => modal.classList.remove('opacity-0'), 10);
}

export function closeCreateCharModal() {
    const modal = document.getElementById('createCharModal');
    modal.classList.add('opacity-0');
    setTimeout(() => {
        modal.classList.add('hidden');
        // 關閉時清空表單，確保下次打開是乾淨的
        document.getElementById('newCharName').value = '';
        document.getElementById('newCharPersona').value = '';
        document.getElementById('newCharImage').value = '';
        document.getElementById('newCharPreview').classList.add('hidden');
        document.getElementById('newCharPreview').src = '';
    }, 300); // 300ms 剛好是動畫退場時間
}
