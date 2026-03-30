// js/ui.js
import { STATE } from './config.js';
import { showToast } from './utils.js';

export function renderDynamicOptions(targetCategory) {
    const container = document.getElementById('styleRadioContainer');
    container.innerHTML = ''; 
    const filteredStyles = STATE.globalSystemStyles.filter(s => s.category === targetCategory);
    filteredStyles.forEach((style, index) => {
        const wrapper = document.createElement('label');
        wrapper.className = 'flex items-center cursor-pointer bg-white border border-gray-300 px-3 py-2 rounded-lg shadow-sm hover:bg-blue-50 transition-colors';
        const radio = document.createElement('input');
        radio.type = 'radio'; radio.className = 'w-4 h-4 text-blue-600 focus:ring-blue-500';
        radio.name = 'targetStyle';
        radio.value = JSON.stringify({ 
                prefix: style.promptPrefix || '', 
                negative: style.negativePrompt || '' 
            });
        if (index === 0) radio.checked = true;
        const span = document.createElement('span');
        span.className = 'ml-2 text-sm font-bold text-gray-700'; span.innerText = style.name;
        wrapper.appendChild(radio); wrapper.appendChild(span); container.appendChild(wrapper);
    });

    const select = document.getElementById('motionSelect');
    select.innerHTML = ''; 
    const filteredMotions = STATE.globalSystemMotions.filter(m => m.supportedCategories.includes(targetCategory) || m.supportedCategories.includes('ALL'));
    filteredMotions.forEach(motion => {
        const option = document.createElement('option');
        option.value = motion.motionPrompt; option.innerText = motion.name; select.appendChild(option);
    });
    if (filteredMotions.length === 0) select.innerHTML = '<option value="">(目前無支援的動態)</option>';
}

export function switchMode(toComic) {
    STATE.isComicModeActive = toComic;
    const btnStandard = document.getElementById('btnStandardMode');
    const btnComic = document.getElementById('btnComicMode');
    const charWarning = document.getElementById('realisticCharWarning');
    const sceneWarning = document.getElementById('realisticSceneWarning');

    if (toComic) {
        btnComic.classList.add('mode-active'); btnStandard.classList.remove('mode-active');
        if(charWarning) charWarning.classList.add('hidden'); if(sceneWarning) sceneWarning.classList.add('hidden');
        renderDynamicOptions('ANIME');
    } else {
        btnStandard.classList.add('mode-active'); btnComic.classList.remove('mode-active');
        if(charWarning) charWarning.classList.remove('hidden'); if(sceneWarning) sceneWarning.classList.remove('hidden');
        renderDynamicOptions('REALISTIC');
    }
}

export function toggleSection(containerId, isSkipped) {
    const container = document.getElementById(containerId);
    if (isSkipped) container.classList.add('opacity-30', 'pointer-events-none');
    else container.classList.remove('opacity-30', 'pointer-events-none');
}

export function addCharacterSlot(name = "", personality = "") {
    const list = document.getElementById('characterList');
    if (list.children.length >= 4) { alert("⚠️ 最多 4 位登場角色"); return; }
    const charId = 'char_' + Date.now();
    const charCard = document.createElement('div');
    charCard.className = 'char-item relative animate-fade-in shadow-sm border border-gray-200';
    charCard.innerHTML = `
        <button type="button" onclick="this.parentElement.remove()" class="absolute top-1 right-2 text-gray-300 font-bold text-xl hover:text-red-500 z-10 transition-colors">✕</button>
        <div class="flex gap-3 items-center">
            <div class="w-16 h-16 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer overflow-hidden group relative flex-shrink-0" onclick="document.getElementById('${charId}').click()">
                <span class="text-xs text-gray-400 font-bold group-hover:text-blue-500">+ 照片</span>
                <img id="${charId}_preview" class="absolute inset-0 w-full h-full object-cover hidden bg-white">
                <input type="file" id="${charId}" name="charAvatar" accept="image/png, image/jpeg, image/webp" class="hidden" onchange="window.previewCharImage(this, '${charId}_preview')">
            </div>
            <div class="flex-grow space-y-2">
                <input type="text" name="charName" value="${name}" placeholder="本名(必填)" class="w-full bg-gray-50 border border-gray-300 rounded-md p-1.5 font-bold focus:ring-blue-500 focus:border-blue-500 text-sm" required>
                <input type="text" name="charPersona" value="${personality}" placeholder="外觀特徵" class="w-full bg-gray-50 border border-gray-300 rounded-md p-1.5 font-medium focus:ring-blue-500 focus:border-blue-500 text-xs">
            </div>
        </div>`;
    list.appendChild(charCard);
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
    showToast('🏠 已開啟新任務！場景已清空，請重新設定。', 'info');
}
