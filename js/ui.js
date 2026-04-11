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

    // 🌟 3. 專屬角色庫渲染
    if (charContainer && data.characters) {
        charContainer.innerHTML = '';
        if (countLabel) countLabel.innerText = `(${data.characters.length}/10)`;

        if (data.characters.length === 0) {
            charContainer.innerHTML = '<span class="text-xs text-gray-400">角色庫尚無資料，請點擊右上方新增。</span>';
        } else {
            data.characters.forEach(char => {
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
                delBtn.title = '永久刪除此角色';
                delBtn.type = 'button'; 
                delBtn.onclick = (e) => {
                    e.stopPropagation(); 
                    window.deleteChar(char.id); 
                };

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
    const colorModeContainer = document.getElementById('colorModeContainer');

    if (toComic) {
        btnComic.classList.add('mode-active'); btnStandard.classList.remove('mode-active');
        if(charWarning) charWarning.classList.add('hidden'); if(sceneWarning) sceneWarning.classList.add('hidden');
        if(colorModeContainer) colorModeContainer.classList.remove('hidden');
        renderDynamicOptions('ANIME');
    } else {
        btnStandard.classList.add('mode-active'); btnComic.classList.remove('mode-active');
        if(charWarning) charWarning.classList.remove('hidden'); if(sceneWarning) sceneWarning.classList.remove('hidden');
        if(colorModeContainer) colorModeContainer.classList.add('hidden');
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

// ==========================================
// ✨ 新增：Step 3 發布模式切換 UI 邏輯
// ==========================================
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
        btnPublish.className = 'w-2/3 text-white bg-blue-600 hover:bg-blue-700 font-black rounded-xl text-lg px-4 py-4 shadow-lg transition-colors';
        
    } else if (mode === 'SCHEDULE') {
        slider.style.transform = 'translateX(100%)';
        btnSch.classList.replace('text-gray-500', 'text-blue-700');
        btnImm.classList.replace('text-blue-700', 'text-gray-500');
        scheduleContainer.classList.remove('hidden');
        
        btnPublish.innerHTML = '⏰ 確認排程 (預扣 1 點)';
        btnPublish.className = 'w-2/3 text-white bg-indigo-600 hover:bg-indigo-700 font-black rounded-xl text-lg px-4 py-4 shadow-lg transition-colors';
        
        // 預填明天的同一個時間，避免用戶還要手動滑很久
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setMinutes(tomorrow.getMinutes() - tomorrow.getTimezoneOffset());
        document.getElementById('scheduleTime').value = tomorrow.toISOString().slice(0, 16);
    }
}

export function resetToStep1() {
    document.getElementById('step3-publish').classList.add('hidden');
    document.getElementById('step2-review').classList.add('hidden');
    document.getElementById('step1-setup').classList.remove('hidden');
    document.getElementById('topic').value = '';
    
    STATE.sceneFiles = []; STATE.objectFiles = [];
    document.getElementById('scenePreview').innerHTML = ''; document.getElementById('objectPreview').innerHTML = '';
    
    document.getElementById('skipScene')?.checked && (document.getElementById('skipScene').checked = false); 
    document.getElementById('skipObject')?.checked && (document.getElementById('skipObject').checked = false);
    toggleSection('sceneContainer', false); toggleSection('objectContainer', false);
    
    // 復原發射按鈕狀態
    const btnPublish = document.getElementById('btnPublish');
    btnPublish.disabled = false; btnPublish.innerHTML = '🚀 執行發射任務';
    if (btnPublish.classList.contains('bg-gray-500')) btnPublish.classList.replace('bg-gray-500', 'bg-blue-600');
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast('🏠 已開啟新任務！場景已清空，角色設定已保留。', 'info');
}

// ==========================================
// 🌟 專屬角色 Modal 控制
// ==========================================
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
        if(document.getElementById('newCharPersona')) document.getElementById('newCharPersona').value = '';
        document.getElementById('newCharImage').value = '';
        document.getElementById('newCharPreview').classList.add('hidden');
        document.getElementById('newCharPreview').src = '';
    }, 300);
}
