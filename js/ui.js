// public/js/ui.js
import { STATE } from './config.js';
import { showToast } from './utils.js';

/**
 * 🌟 動態渲染選項 (畫風、動態、角色)
 */
export function renderDynamicOptions(mode, data) {
    const styleContainer = document.getElementById('styleRadioContainer');
    const motionSelect = document.getElementById('motionSelect');
    const charContainer = document.getElementById('dbCharacterContainer');
    const countLabel = document.getElementById('dbCharCount');

    // 如果沒有傳入 data，則嘗試使用 STATE 快取的資料 (用於模式切換時重新渲染)
    const sourceData = data || STATE.lastSystemData;
    if (!sourceData) return;
    if (data) STATE.lastSystemData = data; // 快取一份供 switchMode 使用

    // 1. 畫風渲染
    if (styleContainer && sourceData.styles) {
        styleContainer.innerHTML = '';
        const filteredStyles = sourceData.styles.filter(s => s.category === mode || s.category === 'ALL');
        if (filteredStyles.length === 0) {
            styleContainer.innerHTML = '<span class="text-xs text-gray-400">此模式尚無畫風選項</span>';
        } else {
            filteredStyles.forEach((style, index) => {
                const isChecked = index === 0 ? 'checked' : '';
                styleContainer.innerHTML += `
                    <label class="flex items-center cursor-pointer group">
                        <input type="radio" name="targetStyle" value="${style.id}" ${isChecked} class="hidden peer">
                        <div class="px-3 py-1.5 bg-white border border-gray-200 rounded-full text-xs font-bold text-gray-600 peer-checked:bg-blue-600 peer-checked:text-white peer-checked:border-blue-600 transition-all shadow-sm group-hover:border-blue-300">
                            ${style.name}
                        </div>
                    </label>
                `;
            });
        }
    }

    // 2. 動態渲染
    if (motionSelect && sourceData.motions) {
        motionSelect.innerHTML = '<option value="">不使用動態 (純圖片)</option>';
        sourceData.motions.forEach(motion => {
            motionSelect.innerHTML += `<option value="${motion.prompt}">${motion.name}</option>`;
        });
    }

    // 3. 專屬角色庫渲染 (保留您的圖片點擊與刪除邏輯)
    if (charContainer && sourceData.characters) {
        charContainer.innerHTML = '';
        if (countLabel) countLabel.innerText = `(${sourceData.characters.length}/10)`;

        if (sourceData.characters.length === 0) {
            charContainer.innerHTML = '<span class="text-xs text-gray-400">角色庫尚無資料，請點擊右上方新增。</span>';
        } else {
            sourceData.characters.forEach(char => {
                const wrapper = document.createElement('div');
                wrapper.className = 'relative group flex flex-col items-center w-16';
                
                const img = document.createElement('img');
                img.src = char.imageUrl || 'https://via.placeholder.com/150';
                img.className = 'w-16 h-16 rounded-full border-2 border-white shadow-md cursor-pointer hover:border-blue-500 hover:shadow-lg transition-all object-cover bg-gray-100';
                img.title = `🧬 AI 提取基因:\n${char.aiExtractedFeatures}`;
                img.onclick = () => window.addCharacterFromDB(char);

                const delBtn = document.createElement('button');
                delBtn.className = 'absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 text-[10px] flex items-center justify-center shadow-lg hover:bg-red-600 opacity-90 hover:opacity-100 transition-all z-10';
                delBtn.innerHTML = '✕';
                delBtn.onclick = (e) => {
                    e.stopPropagation(); 
                    if(confirm(`確定要刪除角色「${char.name}」嗎？`)) window.deleteChar(char.id); 
                };

                const nameLabel = document.createElement('span');
                nameLabel.className = 'text-[10px] mt-1.5 font-bold text-gray-700 truncate w-full text-center bg-white px-1 rounded shadow-sm';
                nameLabel.innerText = char.name;

                wrapper.appendChild(img);
                wrapper.appendChild(delBtn);
                wrapper.appendChild(nameLabel);
                charContainer.appendChild(wrapper);
            });
        }
    }
}

/**
 * 🚀 切換主模式 (動漫 vs 真實)
 */
export function switchMode(toComic) {
    STATE.isComicModeActive = toComic;
    const btnStandard = document.getElementById('btnStandardMode');
    const btnComic = document.getElementById('btnComicMode');
    const colorModeContainer = document.getElementById('colorModeContainer');
    const panelCountContainer = document.getElementById('panelCountContainer');
    const realModeSubOptions = document.getElementById('realModeSubOptions');
    const styleOptionsWrapper = document.getElementById('styleOptionsWrapper');

    if (toComic) {
        btnComic.classList.add('mode-active'); 
        btnStandard.classList.remove('mode-active');
        if(colorModeContainer) colorModeContainer.classList.remove('hidden');
        if(panelCountContainer) panelCountContainer.classList.remove('hidden');
        if(styleOptionsWrapper) styleOptionsWrapper.classList.remove('hidden');
        if(realModeSubOptions) realModeSubOptions.classList.add('hidden');
        
        STATE.currentAction = 'GENERATE_IMAGE';
        renderDynamicOptions('ANIME');
    } else {
        btnStandard.classList.add('mode-active'); 
        btnComic.classList.remove('mode-active');
        if(colorModeContainer) colorModeContainer.classList.add('hidden');
        if(panelCountContainer) panelCountContainer.classList.add('hidden');
        if(styleOptionsWrapper) styleOptionsWrapper.classList.add('hidden');
        if(realModeSubOptions) realModeSubOptions.classList.remove('hidden');
        
        // 真實攝影預設啟動子模式
        if (window.setRealSubMode) window.setRealSubMode('INFLUENCER');
        renderDynamicOptions('REALISTIC');
    }
}

// 保留您的檔案處理邏輯 (未變更)
export function handleFileSelect(input, type, maxCount, previewContainerId) {
    const targetArray = type === 'scene' ? STATE.sceneFiles : STATE.objectFiles;
    const newFiles = Array.from(input.files);
    if (targetArray.length + newFiles.length > maxCount) {
        showToast(`⚠️ 此區塊最多只能上傳 ${maxCount} 張圖片！`, 'warning'); input.value = ''; return;
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
            div.className = `relative w-20 h-20 rounded-xl shadow-md overflow-hidden flex-shrink-0 animate-fade-in border-2 ${isMainBg ? 'border-blue-500' : 'border-white'}`;
            div.innerHTML = `
                <img src="${e.target.result}" class="w-full h-full object-cover">
                <button type="button" onclick="window.removeFileFromArray(${index}, '${type}', '${containerId}')" class="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold hover:bg-red-600 shadow-lg">✕</button>
                ${isMainBg ? '<div class="absolute bottom-0 left-0 right-0 bg-blue-600 bg-opacity-90 text-white text-[9px] text-center font-black py-0.5 tracking-tighter">主背景 / 原圖</div>' : ''}
            `;
            container.appendChild(div);
        };
        reader.readAsDataURL(file);
    });
}

// 發布模式切換 (保留您的邏輯並優化 1:10 顯示)
export function togglePublishMode(mode) {
    const slider = document.getElementById('publishModeSlider');
    const btnImm = document.getElementById('btnModeImmediate');
    const btnSch = document.getElementById('btnModeSchedule');
    const scheduleContainer = document.getElementById('scheduleTimeContainer');
    const btnPublish = document.getElementById('btnPublish');

    if (mode === 'IMMEDIATE') {
        slider.style.transform = 'translateX(0)';
        btnImm.classList.replace('text-gray-500', 'text-blue-700');
        btnSch.classList.replace('text-blue-700', 'text-gray-500');
        scheduleContainer.classList.add('hidden');
        btnPublish.innerHTML = '🚀 執行發射任務';
    } else if (mode === 'SCHEDULE') {
        slider.style.transform = 'translateX(100%)';
        btnSch.classList.replace('text-gray-500', 'text-blue-700');
        btnImm.classList.replace('text-blue-700', 'text-gray-500');
        scheduleContainer.classList.remove('hidden');
        btnPublish.innerHTML = '⏰ 確認排程 (預扣 1 點)';
        
        const now = new Date();
        now.setMinutes(Math.ceil(now.getMinutes() / 15) * 15 + 15);
        const localTime = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
        document.getElementById('scheduleTime').value = localTime;
    }
}

// 角色 Modal (保留您的邏輯並優化動畫)
export function openCreateCharModal() {
    const modal = document.getElementById('createCharModal');
    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.remove('opacity-0'), 10);
}

export function closeCreateCharModal() {
    const modal = document.getElementById('createCharModal');
    modal.classList.add('opacity-0');
    setTimeout(() => {
        modal.classList.add('hidden');
        document.getElementById('newCharName').value = '';
        document.getElementById('newCharImage').value = '';
        const preview = document.getElementById('newCharPreview');
        preview.classList.add('hidden'); preview.src = '';
    }, 300);
}
