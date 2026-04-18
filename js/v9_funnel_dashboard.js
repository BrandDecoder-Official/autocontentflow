// js/v9_funnel_dashboard.js
import { MISSION, SYSTEM_DB, IS_EDIT_MODE } from './v9_state.js';
import { updateStepHeader, createSkillUI, releaseUI, addLog, showError, updatePointsDisplay } from './v9_ui.js';
import { decodeHTMLEntities } from './v9_funnel_utils.js';
import { triggerCharacterSkill, triggerVisualSkill, triggerScheduleSkill } from './v9_funnel_skills.js';
import * as API from './api.js';
import { STATE } from './config.js';

export async function triggerMissionSummary() {
    try {
        updateStepHeader("MISSION CONTROL");
        await addLog("專案總監", "📋", "總編，這是目前的任務總表。您可以自由點開各項進行微調，確認無誤後即可發包給大腦。", true);

        const isComic = MISSION.universe === 'COMIC';
        const isEnhance = MISSION.universe === 'ENHANCE';
        const decodedTopic = decodeHTMLEntities(MISSION.topic || '');

        if (!MISSION.platformStrategies) {
            MISSION.platformStrategies = {
                FB: { hookType: '痛點提問', contentLength: '深度文 (約300字)' },
                IG: { hookType: '視覺誘惑', contentLength: '短平快 (約150字)' },
                THREADS: { hookType: '反直覺爆點', contentLength: '極短篇 (約50字)' }
            };
        }

        let charsHtml = '';
        if(MISSION.characters && MISSION.characters.length > 0) {
            charsHtml = '<div class="flex items-center gap-2 flex-wrap">';
            MISSION.characters.forEach(c => {
                const o = SYSTEM_DB.characters.find(mc => mc.name === c);
                if(o && o.imageUrl) charsHtml += `<img src="${o.imageUrl}" class="w-8 h-8 rounded-full border border-indigo-500 flex-shrink-0" title="${c}">`;
                else charsHtml += `<span class="text-[10px] bg-indigo-900/50 text-indigo-200 px-2 py-1 rounded border border-indigo-500/50">${c}</span>`;
            });
            charsHtml += '</div>';
        } else {
            charsHtml = `<span class="text-xs text-slate-500">純場景模式</span>`;
        }

        let scenesHtml = '';
        let sceneStatus = '無 ✎';
        if(MISSION.sceneFiles && MISSION.sceneFiles.length > 0) {
            const firstImgUrl = MISSION.sceneFiles[0].dataUrl;
            sceneStatus = `<div class="flex items-center gap-2"><img src="${firstImgUrl}" class="w-8 h-8 rounded-md border border-slate-500 object-cover flex-shrink-0"><span>已上傳 ${MISSION.sceneFiles.length} 張 ✎</span></div>`;
            
            scenesHtml = '<div class="flex items-center gap-2 flex-wrap">';
            MISSION.sceneFiles.forEach((file, idx) => {
                 scenesHtml += `
                    <div class="relative w-16 h-16 rounded-md overflow-hidden border border-white/20 group">
                        <img src="${file.dataUrl}" class="w-full h-full object-cover">
                    </div>`;
            });
            scenesHtml += '</div>';
        } else {
            scenesHtml = `<span class="text-[10px] text-slate-500">未上傳任何參考圖片</span>`;
        }

        const stylePrefix = isEnhance ? 'REALISTIC' : (MISSION.universe || 'REALISTIC');
        const availableStyles = SYSTEM_DB.styles ? SYSTEM_DB.styles.filter(s => s.type === stylePrefix) : [];

        const hookOptions = ['❓ 痛點提問', '💥 反直覺爆點', '🎁 利益誘惑', '⚔️ 爭議站隊', '💖 情境共鳴'];
        const lenOptions = ['⚡ 極短篇 (約50字)', '📝 短平快 (約150字)', '📖 深度文 (約300字)', '📜 長篇連載 (約800字)'];

        let scheduleDisplay = '⚡ 立即部署';
        if (MISSION.scheduledAt) {
            const d = new Date(MISSION.scheduledAt);
            scheduleDisplay = d.toLocaleString('zh-TW', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        }

        const getStrategyHtml = () => {
            if (MISSION.isIndependentPost && MISSION.platforms && MISSION.platforms.length > 0) {
                return MISSION.platforms.map(p => `
                    <div class="mb-3 border border-white/10 p-3 rounded-xl bg-slate-900/50 animate-fade-in">
                        <div class="text-[10px] font-bold text-indigo-400 mb-2 flex items-center gap-1">📍 ${p} 專屬戰術</div>
                        <div class="grid grid-cols-2 gap-2">
                            <select class="indie-hook w-full bg-slate-800 border border-white/10 rounded-lg p-2 text-[10px] text-white outline-none" data-plat="${p}">
                                ${hookOptions.map(opt => `<option value="${opt.split(' ')[1]}" ${MISSION.platformStrategies[p]?.hookType === opt.split(' ')[1] ? 'selected' : ''}>${opt}</option>`).join('')}
                            </select>
                            <select class="indie-len w-full bg-slate-800 border border-white/10 rounded-lg p-2 text-[10px] text-white outline-none" data-plat="${p}">
                                ${lenOptions.map(opt => `<option value="${opt.split(' ')[1]}" ${MISSION.platformStrategies[p]?.contentLength === opt.split(' ')[1] ? 'selected' : ''}>${opt}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                `).join('');
            } else {
                return `
                    <div class="grid grid-cols-2 gap-3 animate-fade-in">
                        <div class="space-y-1">
                            <label class="text-[10px] text-slate-500">全平台統一勾子</label>
                            <select id="editDashHook" class="w-full bg-slate-800 border border-white/10 rounded-lg p-2 text-[10px] text-white outline-none">
                                ${hookOptions.map(opt => `<option value="${opt.split(' ')[1]}" ${MISSION.hookType === opt.split(' ')[1] ? 'selected' : ''}>${opt}</option>`).join('')}
                            </select>
                        </div>
                        <div class="space-y-1">
                            <label class="text-[10px] text-slate-500">全平台統一節奏</label>
                            <select id="editDashLen" class="w-full bg-slate-800 border border-white/10 rounded-lg p-2 text-[10px] text-white outline-none">
                                ${lenOptions.map(opt => `<option value="${opt.split(' ')[1]}" ${MISSION.contentLength === opt.split(' ')[1] ? 'selected' : ''}>${opt}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                `;
            }
        };

        const ui = createSkillUI(`
            <div id="missionDashboard" class="bg-slate-900 border border-indigo-500/30 rounded-3xl p-4 lg:p-6 shadow-2xl space-y-4 mb-4 animate-fade-in text-[11px] lg:text-xs w-full">
                
                <div class="bg-indigo-500/10 border border-indigo-500/20 p-3 rounded-xl flex items-start gap-3">
                    <span class="text-xl">🤖</span>
                    <p id="agentDashboardAdvice" class="text-indigo-300 italic leading-relaxed">
                        ${MISSION.isIndependentPost 
                            ? `「總編，已開啟【平台適配模式】！請在下方分別設定各平台的專屬字數與開場戰術。」`
                            : `「目前文案將採用【統一內容】發布。點擊下方選項可即時微調。」`}
                    </p>
                </div>

                <div class="space-y-3">
                    <div class="dashboard-item border border-white/10 rounded-2xl overflow-hidden bg-slate-800 shadow-md">
                        <button class="w-full p-4 flex justify-between items-center hover:bg-slate-700 transition-all accordion-trigger group" data-target="dash-topic">
                            <span class="text-slate-300 font-bold group-hover:text-white flex items-center gap-2">📝 任務主題 <span class="text-[10px] text-slate-500 transition-transform duration-300 transform rotate-0 arrow-icon">▼</span></span>
                            <span class="text-indigo-300 font-black dash-val-topic truncate max-w-[180px] text-right">${decodedTopic} ✎</span>
                        </button>
                        <div id="dash-topic" class="hidden p-4 bg-slate-900 shadow-inner border-t border-indigo-500/20 space-y-3">
                            <p class="text-[10px] text-slate-400 mb-1">請在此編輯完整主題或補充細節：</p>
                            <textarea id="editDashTopic" class="w-full bg-slate-800 border border-white/10 rounded-xl p-3 text-xs text-white focus:border-indigo-500 outline-none h-32 resize-y">${decodedTopic}</textarea>
                        </div>
                    </div>

                    <div class="dashboard-item border border-white/10 rounded-2xl overflow-hidden bg-slate-800 shadow-md">
                        <div class="w-full p-4 flex justify-between items-center bg-transparent border-b border-white/5">
                             <div class="flex items-center gap-2">
                                 <span class="text-slate-300 font-bold">🎯 發文戰術與字數</span>
                             </div>
                             <div class="flex bg-slate-900 rounded-lg p-1 border border-white/10 shadow-inner">
                                 <button id="btnModeUnified" class="px-3 py-1.5 rounded-md text-[10px] font-bold transition-all ${!MISSION.isIndependentPost ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500'}">統一內容</button>
                                 <button id="btnModeIndie" class="px-3 py-1.5 rounded-md text-[10px] font-bold transition-all ${MISSION.isIndependentPost ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500'}">平台適配</button>
                             </div>
                        </div>
                        <button class="w-full px-4 py-3 flex justify-between items-center hover:bg-slate-700 transition-all accordion-trigger group" data-target="dash-strategy">
                            <span class="text-[10px] text-slate-500 group-hover:text-slate-300 flex items-center gap-1">目前配置 <span class="text-[8px] transition-transform duration-300 transform rotate-0 arrow-icon">▼</span></span>
                            <span class="text-indigo-300 font-black dash-val-strategy">${MISSION.isIndependentPost ? '獨立配置' : (MISSION.hookType || '') + ' / ' + (MISSION.contentLength || '')} ✎</span>
                        </button>
                        <div id="dash-strategy" class="hidden p-4 bg-slate-900 shadow-inner border-t border-indigo-500/20">
                            ${getStrategyHtml()}
                        </div>
                    </div>

                    <div class="dashboard-item border border-white/10 rounded-2xl overflow-hidden bg-slate-800 shadow-md">
                        <button class="w-full p-4 flex justify-between items-center hover:bg-slate-700 transition-all accordion-trigger group" data-target="dash-team">
                            <span class="text-slate-300 font-bold group-hover:text-white flex items-center gap-2">🎭 人設與平台 <span class="text-[10px] text-slate-500 transition-transform duration-300 transform rotate-0 arrow-icon">▼</span></span>
                            <span class="text-indigo-300 font-black dash-val-team text-right">${MISSION.persona || ''} / ${(MISSION.platforms || []).join(',')} ✎</span>
                        </button>
                        <div id="dash-team" class="hidden p-4 bg-slate-900 shadow-inner border-t border-indigo-500/20 space-y-4">
                            <div class="space-y-2">
                                <label class="text-[10px] text-slate-500">指派人設角色</label>
                                <div class="flex flex-wrap gap-2">
                                    ${SYSTEM_DB.personas.map(p => `<button class="btn-dash-persona px-3 py-2 rounded-lg border shadow-sm transition-all ${MISSION.persona===p.name?'border-indigo-500 bg-indigo-600 text-white':'border-white/10 bg-slate-800 text-slate-400 hover:border-slate-500'}" data-val="${p.name}">${p.icon} ${p.name}</button>`).join('')}
                                </div>
                            </div>
                            <div class="space-y-2 pt-3 border-t border-white/5">
                                <label class="text-[10px] text-slate-500">部署社群平台 (可多選)</label>
                                <div class="flex flex-wrap gap-2">
                                    ${['FB','IG','THREADS'].map(plat => `<button class="btn-dash-plat px-3 py-2 rounded-lg border shadow-sm transition-all ${MISSION.platforms.includes(plat)?'border-blue-500 bg-blue-600 text-white':'border-white/10 bg-slate-800 text-slate-400 hover:border-slate-500'}" data-val="${plat}">${plat}</button>`).join('')}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="dashboard-item border border-white/10 rounded-2xl overflow-hidden bg-slate-800 shadow-md">
                        <button class="w-full p-4 flex justify-between items-center hover:bg-slate-700 transition-all accordion-trigger group" data-target="dash-characters">
                            <span class="text-slate-300 font-bold group-hover:text-white flex items-center gap-2">👥 登場角色基因 <span class="text-[10px] text-slate-500 transition-transform duration-300 transform rotate-0 arrow-icon">▼</span></span>
                            <div class="flex items-center gap-2 max-w-[150px] overflow-hidden dash-val-characters">${charsHtml} ✎</div>
                        </button>
                        <div id="dash-characters" class="hidden p-4 bg-slate-900 shadow-inner border-t border-indigo-500/20 space-y-3">
                            <div class="dash-val-characters-list">${charsHtml}</div>
                            <p class="text-[10px] text-slate-400 pt-2 border-t border-white/5">若需更換登場角色，請點擊下方重啟召喚儀式。</p>
                            <button id="btnBackToChar" class="bg-indigo-600/20 border border-indigo-500/50 text-indigo-300 px-4 py-2 rounded-lg text-xs active:scale-95 transition-all w-full text-center hover:bg-indigo-600 hover:text-white">✎ 重啟召喚儀式</button>
                        </div>
                    </div>

                    <div class="dashboard-item border border-white/10 rounded-2xl overflow-hidden bg-slate-800 shadow-md">
                        <button class="w-full p-4 flex justify-between items-center hover:bg-slate-700 transition-all accordion-trigger group" data-target="dash-scenes">
                            <span class="text-slate-300 font-bold group-hover:text-white flex items-center gap-2">🖼️ 參考場景與圖檔 <span class="text-[10px] text-slate-500 transition-transform duration-300 transform rotate-0 arrow-icon">▼</span></span>
                            <div class="text-indigo-300 font-black dash-val-scenes">${sceneStatus}</div>
                        </button>
                        <div id="dash-scenes" class="hidden p-4 bg-slate-900 shadow-inner border-t border-indigo-500/20 space-y-3">
                            <div class="dash-val-scenes-list">${scenesHtml}</div>
                            <p class="text-[10px] text-slate-400 pt-2 border-t border-white/5">若需新增或更換圖檔，請點擊下方返回設定畫面。</p>
                            <button id="btnBackToVisual" class="bg-indigo-600/20 border border-indigo-500/50 text-indigo-300 px-4 py-2 rounded-lg text-xs active:scale-95 transition-all w-full text-center hover:bg-indigo-600 hover:text-white">✎ 重新上傳 / 更改圖檔</button>
                        </div>
                    </div>

                    <div class="dashboard-item border border-white/10 rounded-2xl overflow-hidden bg-slate-800 shadow-md">
                        <button class="w-full p-4 flex justify-between items-center hover:bg-slate-700 transition-all accordion-trigger group" data-target="dash-universe-style">
                            <span class="text-slate-300 font-bold group-hover:text-white flex items-center gap-2">🌌 風格宇宙與色系 <span class="text-[10px] text-slate-500 transition-transform duration-300 transform rotate-0 arrow-icon">▼</span></span>
                            <span class="text-indigo-300 font-black dash-val-universe-style text-right">${MISSION.universe || ''} / ${MISSION.style || ''} / ${MISSION.colorMode==='BW'?'黑白':'彩色'} ✎</span>
                        </button>
                        <div id="dash-universe-style" class="hidden p-4 bg-slate-900 shadow-inner border-t border-indigo-500/20 space-y-4">
                            <div class="space-y-2">
                                <label class="text-[10px] text-slate-500">宇宙類型</label>
                                <div class="grid grid-cols-3 gap-2">
                                    ${[{v:'REALISTIC',i:'📷',n:'攝影'},{v:'COMIC',i:'🎨',n:'動漫'},{v:'ENHANCE',i:'✨',n:'美化'}].map(u => `<button class="btn-dash-uni py-2 rounded-lg border shadow-sm transition-all ${MISSION.universe===u.v?'border-indigo-500 bg-indigo-600 text-white':'border-white/10 bg-slate-800 text-slate-400 hover:border-slate-500'}" data-val="${u.v}">${u.i} ${u.n}</button>`).join('')}
                                </div>
                            </div>
                            <div class="space-y-2 pt-3 border-t border-white/5">
                                <label class="text-[10px] text-slate-500">視覺風格</label>
                                <div class="flex flex-wrap gap-2">
                                    ${availableStyles.map(s => `<button class="btn-dash-style px-3 py-2 rounded-lg border shadow-sm transition-all ${MISSION.style===s.name?'border-indigo-500 bg-indigo-600 text-white':'border-white/10 bg-slate-800 text-slate-400 hover:border-slate-500'}" data-val="${s.name}">${s.name}</button>`).join('')}
                                </div>
                            </div>
                            <div class="space-y-2 pt-3 border-t border-white/5">
                                <label class="text-[10px] text-slate-500">色系模式</label>
                                <div class="grid grid-cols-2 gap-2">
                                    ${[{v:'BW',i:'🏁',n:'黑白'},{v:'Color',i:'🌈',n:'彩色'}].map(c => `<button class="btn-dash-color py-2 rounded-lg border shadow-sm transition-all ${MISSION.colorMode===c.v?'border-indigo-500 bg-indigo-600 text-white':'border-white/10 bg-slate-800 text-slate-400 hover:border-slate-500'}" data-val="${c.v}">${c.i} ${c.n}</button>`).join('')}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="dashboard-item border border-white/10 rounded-2xl overflow-hidden bg-slate-800 shadow-md">
                        <button class="w-full p-4 flex justify-between items-center hover:bg-slate-700 transition-all accordion-trigger group" data-target="dash-visual-specs">
                            <span class="text-slate-300 font-bold group-hover:text-white flex items-center gap-2">📐 畫面規格 <span class="text-[10px] text-slate-500 transition-transform duration-300 transform rotate-0 arrow-icon">▼</span></span>
                            <span class="text-indigo-300 font-black dash-val-visual-specs">${MISSION.ratio || '9:16'} / ${isComic ? (MISSION.panelCount || 4) + '格' : ''} ✎</span>
                        </button>
                        <div id="dash-visual-specs" class="hidden p-4 bg-slate-900 shadow-inner border-t border-indigo-500/20 space-y-4">
                            ${!isEnhance ? `
                            <div class="space-y-2">
                                <label class="text-[10px] text-slate-500">漫畫格數</label>
                                <div class="grid grid-cols-4 gap-2">
                                    ${[1,2,3,4].map(n => `<button class="btn-dash-panel py-2 rounded-lg border shadow-sm transition-all ${MISSION.panelCount===n?'border-indigo-500 bg-indigo-600 text-white':'border-white/10 bg-slate-800 text-slate-400 hover:border-slate-500'}" data-val="${n}">${n}格</button>`).join('')}
                                </div>
                            </div>` : ''}
                            <div class="space-y-2 pt-3 border-t border-white/5">
                                <label class="text-[10px] text-slate-500">畫面比例</label>
                                <div class="grid grid-cols-3 gap-2">
                                    ${['9:16','16:9','1:1'].map(r => `<button class="btn-dash-ratio py-2 rounded-lg border shadow-sm transition-all ${MISSION.ratio===r?'border-indigo-500 bg-indigo-600 text-white':'border-white/10 bg-slate-800 text-slate-400 hover:border-slate-500'}" data-val="${r}">${r}</button>`).join('')}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="dashboard-item border border-white/10 rounded-2xl overflow-hidden bg-slate-800 shadow-md">
                        <button class="w-full p-4 flex justify-between items-center hover:bg-slate-700 transition-all accordion-trigger group" data-target="dash-schedule">
                            <span class="text-slate-300 font-bold group-hover:text-white flex items-center gap-2">📅 部署排程 <span class="text-[10px] text-slate-500 transition-transform duration-300 transform rotate-0 arrow-icon">▼</span></span>
                            <span class="text-indigo-300 font-black dash-val-schedule text-right">${scheduleDisplay} ✎</span>
                        </button>
                        <div id="dash-schedule" class="hidden p-4 bg-slate-900 shadow-inner border-t border-indigo-500/20 space-y-3">
                            <p class="text-[10px] text-slate-400 mb-1">若需修改發佈時間，請點擊下方按鈕重新設定：</p>
                            <button id="btnBackToSchedule" class="bg-indigo-600/20 border border-indigo-500/50 text-indigo-300 px-4 py-2 rounded-lg text-xs active:scale-95 transition-all w-full text-center hover:bg-indigo-600 hover:text-white">✎ 重新設定時間</button>
                        </div>
                    </div>
                </div>

                <button id="btnRender" class="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-2xl font-black text-sm shadow-[0_0_20px_rgba(79,70,229,0.4)] active:scale-95 transition-all mt-4">
                    ⚡ 鎖定配置並產出校稿卡
                </button>
            </div>
        `);

        const bindStrategyEvents = () => {
            if (MISSION.isIndependentPost) {
                ui.querySelectorAll('.indie-hook').forEach(el => el.onchange = (e) => { MISSION.platformStrategies[e.target.dataset.plat].hookType = e.target.value; });
                ui.querySelectorAll('.indie-len').forEach(el => el.onchange = (e) => { MISSION.platformStrategies[e.target.dataset.plat].contentLength = e.target.value; });
            } else {
                const hEl = ui.querySelector('#editDashHook'); if(hEl) hEl.onchange = (e) => { MISSION.hookType = e.target.value; updateDashDisplay(); };
                const lEl = ui.querySelector('#editDashLen'); if(lEl) lEl.onchange = (e) => { MISSION.contentLength = e.target.value; updateDashDisplay(); };
            }
        };
        bindStrategyEvents();

        const refreshStrategyPanelUI = () => {
            const strategyContainer = ui.querySelector('#dash-strategy');
            strategyContainer.innerHTML = getStrategyHtml();
            bindStrategyEvents();
            updateDashDisplay();
        };

        ui.querySelector('#btnModeUnified').onclick = () => { 
            if(MISSION.isIndependentPost) { 
                MISSION.isIndependentPost = false; 
                ui.querySelector('#btnModeUnified').classList.replace('text-slate-500', 'bg-indigo-600');
                ui.querySelector('#btnModeUnified').classList.add('text-white', 'shadow-md');
                ui.querySelector('#btnModeIndie').classList.replace('bg-indigo-600', 'text-slate-500');
                ui.querySelector('#btnModeIndie').classList.remove('text-white', 'shadow-md');
                ui.querySelector('#agentDashboardAdvice').innerHTML = `「目前文案將採用【統一內容】發布。點擊下方選項可即時微調。」`;
                refreshStrategyPanelUI(); 
                ui.querySelector('#dash-strategy').classList.remove('hidden');
            }
        };
        ui.querySelector('#btnModeIndie').onclick = () => { 
            if(!MISSION.isIndependentPost) { 
                MISSION.isIndependentPost = true; 
                ui.querySelector('#btnModeIndie').classList.replace('text-slate-500', 'bg-indigo-600');
                ui.querySelector('#btnModeIndie').classList.add('text-white', 'shadow-md');
                ui.querySelector('#btnModeUnified').classList.replace('bg-indigo-600', 'text-slate-500');
                ui.querySelector('#btnModeUnified').classList.remove('text-white', 'shadow-md');
                ui.querySelector('#agentDashboardAdvice').innerHTML = `「總編，已開啟【平台適配模式】！請在下方分別設定各平台的專屬字數與開場戰術。」`;
                refreshStrategyPanelUI(); 
                ui.querySelector('#dash-strategy').classList.remove('hidden');
            }
        };

        // 💡 優化：旋轉箭頭動畫控制
        ui.querySelectorAll('.accordion-trigger').forEach(trigger => {
            trigger.onclick = () => {
                const targetId = trigger.dataset.target;
                const targetEl = ui.querySelector(`#${targetId}`);
                const arrowIcon = trigger.querySelector('.arrow-icon');
                const isHidden = targetEl.classList.contains('hidden');
                
                if (isHidden) { 
                    targetEl.classList.remove('hidden'); 
                    if(arrowIcon) arrowIcon.classList.replace('rotate-0', 'rotate-180');
                } else {
                    targetEl.classList.add('hidden'); 
                    if(arrowIcon) arrowIcon.classList.replace('rotate-180', 'rotate-0');
                }
            };
        });

        const updateDashDisplay = () => {
            ui.querySelector('.dash-val-topic').innerText = decodeHTMLEntities(MISSION.topic || '') + ' ✎';
            ui.querySelector('.dash-val-strategy').innerText = MISSION.isIndependentPost ? '獨立配置 ✎' : `${MISSION.hookType || ''} / ${MISSION.contentLength || ''} ✎`;
            ui.querySelector('.dash-val-team').innerText = `${MISSION.persona || ''} / ${(MISSION.platforms || []).join(',')} ✎`;
            const isComicNow = MISSION.universe === 'COMIC';
            ui.querySelector('.dash-val-universe-style').innerText = `${MISSION.universe || ''} / ${MISSION.style || ''} / ${MISSION.colorMode==='BW'?'黑白':'彩色'} ✎`;
            ui.querySelector('.dash-val-visual-specs').innerText = `${MISSION.ratio || '9:16'} / ${isComicNow ? (MISSION.panelCount || 4) + '格' : ''} ✎`;
            
            let sDisp = '⚡ 立即部署';
            if (MISSION.scheduledAt) {
                const d = new Date(MISSION.scheduledAt);
                sDisp = d.toLocaleString('zh-TW', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            }
            ui.querySelector('.dash-val-schedule').innerText = sDisp + ' ✎';

            if(MISSION.sceneFiles && MISSION.sceneFiles.length > 0) {
                const firstImgUrl = MISSION.sceneFiles[0].dataUrl;
                ui.querySelector('.dash-val-scenes').innerHTML = `<div class="flex items-center gap-2"><img src="${firstImgUrl}" class="w-8 h-8 rounded-md border border-slate-500 object-cover flex-shrink-0"><span>已上傳 ${MISSION.sceneFiles.length} 張 ✎</span></div>`;
            } else {
                ui.querySelector('.dash-val-scenes').innerText = '無 ✎';
            }
        };

        ui.querySelector('#editDashTopic').oninput = (e) => { MISSION.topic = e.target.value; updateDashDisplay(); };

        ui.querySelectorAll('.btn-dash-persona').forEach(btn => {
            btn.onclick = () => {
                MISSION.persona = btn.dataset.val;
                ui.querySelectorAll('.btn-dash-persona').forEach(b => {
                    b.classList.remove('border-indigo-500', 'bg-indigo-600', 'text-white');
                    b.classList.add('border-white/10', 'bg-slate-800', 'text-slate-400');
                });
                btn.classList.remove('border-white/10', 'bg-slate-800', 'text-slate-400');
                btn.classList.add('border-indigo-500', 'bg-indigo-600', 'text-white');
                updateDashDisplay();
            };
        });

        ui.querySelectorAll('.btn-dash-plat').forEach(btn => {
            btn.onclick = () => {
                const p = btn.dataset.val;
                if (MISSION.platforms.includes(p)) {
                    if (MISSION.platforms.length > 1) {
                        MISSION.platforms = MISSION.platforms.filter(x => x!==p);
                        btn.classList.remove('border-blue-500', 'bg-blue-600', 'text-white');
                        btn.classList.add('border-white/10', 'bg-slate-800', 'text-slate-400');
                    }
                } else { 
                    MISSION.platforms.push(p); 
                    btn.classList.add('border-blue-500', 'bg-blue-600', 'text-white');
                    btn.classList.remove('border-white/10', 'bg-slate-800', 'text-slate-400');
                }
                if (MISSION.isIndependentPost) {
                    refreshStrategyPanelUI();
                } else {
                    updateDashDisplay();
                }
            };
        });

        ui.querySelector('#btnBackToChar').onclick = async () => { IS_EDIT_MODE.value = true; releaseUI(ui); await triggerCharacterSkill(); };
        ui.querySelector('#btnBackToVisual').onclick = async () => { IS_EDIT_MODE.value = true; releaseUI(ui); await triggerVisualSkill(); };
        ui.querySelector('#btnBackToSchedule').onclick = async () => { IS_EDIT_MODE.value = true; releaseUI(ui); await triggerScheduleSkill(); };

        ui.querySelectorAll('.btn-dash-uni').forEach(btn => {
            btn.onclick = async () => {
                const oldUni = MISSION.universe; MISSION.universe = btn.dataset.val;
                if (oldUni !== MISSION.universe) { MISSION.style = ''; MISSION.colorMode = ''; MISSION.characters = []; MISSION.sceneFiles = []; MISSION.ratio = MISSION.universe === 'ENHANCE' ? '原圖比例' : '9:16'; }
                releaseUI(ui); await triggerMissionSummary(); 
            };
        });

        ui.querySelectorAll('.btn-dash-style').forEach(btn => {
            btn.onclick = () => {
                MISSION.style = btn.dataset.val;
                ui.querySelectorAll('.btn-dash-style').forEach(b => {
                    b.classList.remove('border-indigo-500', 'bg-indigo-600', 'text-white');
                    b.classList.add('border-white/10', 'bg-slate-800', 'text-slate-400');
                });
                btn.classList.remove('border-white/10', 'bg-slate-800', 'text-slate-400');
                btn.classList.add('border-indigo-500', 'bg-indigo-600', 'text-white');
                updateDashDisplay();
            };
        });

        ui.querySelectorAll('.btn-dash-color').forEach(btn => {
            btn.onclick = () => {
                MISSION.colorMode = btn.dataset.val;
                ui.querySelectorAll('.btn-dash-color').forEach(b => {
                    b.classList.remove('border-indigo-500', 'bg-indigo-600', 'text-white');
                    b.classList.add('border-white/10', 'bg-slate-800', 'text-slate-400');
                });
                btn.classList.remove('border-white/10', 'bg-slate-800', 'text-slate-400');
                btn.classList.add('border-indigo-500', 'bg-indigo-600', 'text-white');
                updateDashDisplay();
            };
        });

        if (!isEnhance && isComic) {
            ui.querySelectorAll('.btn-dash-panel').forEach(btn => {
                btn.onclick = () => {
                    MISSION.panelCount = parseInt(btn.dataset.val);
                    ui.querySelectorAll('.btn-dash-panel').forEach(b => {
                        b.classList.remove('border-indigo-500', 'bg-indigo-600', 'text-white');
                        b.classList.add('border-white/10', 'bg-slate-800', 'text-slate-400');
                    });
                    btn.classList.remove('border-white/10', 'bg-slate-800', 'text-slate-400');
                    btn.classList.add('border-indigo-500', 'bg-indigo-600', 'text-white');
                    updateDashDisplay();
                };
            });
        }

        ui.querySelectorAll('.btn-dash-ratio').forEach(btn => {
            btn.onclick = () => {
                MISSION.ratio = btn.dataset.val;
                ui.querySelectorAll('.btn-dash-ratio').forEach(b => {
                    b.classList.remove('border-indigo-500', 'bg-indigo-600', 'text-white');
                    b.classList.add('border-white/10', 'bg-slate-800', 'text-slate-400');
                });
                btn.classList.remove('border-white/10', 'bg-slate-800', 'text-slate-400');
                btn.classList.add('border-indigo-500', 'bg-indigo-600', 'text-white');
                updateDashDisplay();
            };
        });

        ui.querySelector('#btnRender').onclick = async () => {
            const btn = ui.querySelector('#btnRender');
            const oriText = btn.innerHTML;
            btn.innerHTML = '<div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block align-middle mr-2"></div> 任務驗證與建檔中...';
            btn.disabled = true;

            try {
                if (MISSION.scheduledAt) {
                    const schDate = new Date(MISSION.scheduledAt);
                    const oneHourLater = new Date(Date.now() + 60 * 60 * 1000);
                    if (schDate < oneHourLater) {
                        throw new Error("排程時間需大於目前時間 1 個小時。");
                    }
                }

                if (!MISSION.currentTaskId) {
                    const payload = {
                        tenantId: STATE.uid || 'user_chief_001',
                        missionContext: {
                            topic: MISSION.topic,
                            platforms: MISSION.platforms,
                            persona: MISSION.persona,
                            hookType: MISSION.hookType,
                            contentLength: MISSION.contentLength,
                            universe: MISSION.universe,
                            style: MISSION.style,
                            colorMode: MISSION.colorMode,
                            ratio: MISSION.ratio,
                            resolution: MISSION.resolution,
                            panelCount: MISSION.panelCount,
                            scheduledAt: MISSION.scheduledAt
                        },
                        currentStatus: 'DRAFTING'
                    };

                    const data = await API.createAgentTaskAPI(payload);
                    MISSION.currentTaskId = data.taskId;

                    const shortId = MISSION.currentTaskId.slice(-6);
                    await addLog("系統", "💾", `任務已成功建檔。追蹤碼：<span class="text-xs font-mono text-indigo-400 cursor-pointer hover:text-indigo-300 bg-indigo-900/50 px-2 py-0.5 rounded border border-indigo-500/50" onclick="navigator.clipboard.writeText('${MISSION.currentTaskId}'); alert('已複製完整追蹤碼');" title="點擊複製完整 ID">***${shortId} 📋</span>`, true);
                }

                btn.innerHTML = '<div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block align-middle mr-2"></div> 啟動大腦生成草稿...';
                await window.FunnelActions.generateDraft();

                btn.innerHTML = '✅ 任務已送出';
                btn.classList.replace('bg-indigo-600', 'bg-emerald-600');
                btn.classList.remove('hover:bg-indigo-500');

                // 🎰 觸發拉霸：我們現在統一呼叫全域的同步樞紐！
                if(typeof window.API !== 'undefined' && window.API.triggerWalletSync) {
                     window.API.triggerWalletSync();
                }

            } catch (err) {
                showError(err.message);
                btn.innerHTML = oriText;
                btn.disabled = false;
            }
        };

        window.refreshMissionDashboard = () => { updateDashDisplay(); };

    } catch (err) {
        console.error("[Dashboard] 渲染失敗:", err);
        showError("儀表板載入失敗: " + err.message);
    }
}
