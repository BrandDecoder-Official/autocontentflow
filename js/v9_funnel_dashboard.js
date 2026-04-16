// js/v9_funnel_dashboard.js
import { MISSION, SYSTEM_DB, IS_EDIT_MODE } from './v9_state.js';
import { updateStepHeader, createSkillUI, releaseUI, addLog } from './v9_ui.js';
import { decodeHTMLEntities } from './v9_funnel_utils.js';
import { triggerCharacterSkill } from './v9_funnel_skills.js';

export async function triggerMissionSummary() {
    updateStepHeader("MISSION CONTROL");
    await addLog("專案總監", "📋", "總編，這是目前的任務總表。您可以點擊各項進行微調，或透過對話讓 Agent 協助您。", true);

    const isComic = MISSION.universe === 'COMIC';
    const isEnhance = MISSION.universe === 'ENHANCE';
    const decodedTopic = decodeHTMLEntities(MISSION.topic);

    let charsHtml = '';
    if(MISSION.characters.length > 0) {
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

    const stylePrefix = isEnhance ? 'REALISTIC' : MISSION.universe;
    const availableStyles = SYSTEM_DB.styles.filter(s => s.type === stylePrefix);

    const ui = createSkillUI(`
        <div id="missionDashboard" class="bg-slate-900 border border-indigo-500/30 rounded-3xl p-4 lg:p-6 shadow-2xl space-y-4 mb-4 animate-fade-in text-[11px] lg:text-xs">
            
            <div class="bg-indigo-500/10 border border-indigo-500/20 p-3 rounded-xl flex items-start gap-3">
                <span class="text-xl">🤖</span>
                <p id="agentDashboardAdvice" class="text-indigo-300 italic leading-relaxed">
                    「目前人設為【${MISSION.persona}】，我已準備好最佳配置。點擊下方選項可即時微調內容。」
                </p>
            </div>

            <div class="space-y-2">
                <div class="dashboard-item border border-white/5 rounded-2xl overflow-hidden bg-white/5">
                    <button class="w-full p-4 flex justify-between items-center hover:bg-white/5 transition-all accordion-trigger" data-target="dash-topic">
                        <span class="text-slate-400 font-bold">📝 任務主題</span>
                        <span class="text-white font-black dash-val-topic truncate max-w-[200px] text-right">${decodedTopic} ✎</span>
                    </button>
                    <div id="dash-topic" class="hidden p-4 bg-black/20 space-y-3 border-t border-white/5">
                        <p class="text-[10px] text-slate-400 mb-1">請在此編輯完整主題或補充細節：</p>
                        <textarea id="editDashTopic" class="w-full bg-slate-800 border border-white/10 rounded-xl p-3 text-xs text-white focus:border-indigo-500 outline-none h-32 resize-y">${decodedTopic}</textarea>
                    </div>
                </div>

                <div class="dashboard-item border border-white/5 rounded-2xl overflow-hidden bg-white/5">
                    <button class="w-full p-4 flex justify-between items-center hover:bg-white/5 transition-all accordion-trigger" data-target="dash-strategy">
                        <span class="text-slate-400 font-bold">🎯 發文戰術</span>
                        <span class="text-white font-black dash-val-strategy">${MISSION.hookType} / ${MISSION.contentLength.split(' ')[0]} ✎</span>
                    </button>
                    <div id="dash-strategy" class="hidden p-4 bg-black/20 grid grid-cols-2 gap-3 border-t border-white/5">
                        <div class="space-y-1">
                            <label class="text-[10px] text-slate-500">開場勾子</label>
                            <select id="editDashHook" class="w-full bg-slate-800 border border-white/10 rounded-lg p-2 text-[10px] text-white outline-none">
                                <option value="痛點提問" ${MISSION.hookType==='痛點提問'?'selected':''}>❓ 痛點提問</option>
                                <option value="反直覺爆點" ${MISSION.hookType==='反直覺爆點'?'selected':''}>💥 反直覺爆點</option>
                                <option value="利益誘惑" ${MISSION.hookType==='利益誘惑'?'selected':''}>🎁 利益誘惑</option>
                                <option value="爭議站隊" ${MISSION.hookType==='爭議站隊'?'selected':''}>⚔️ 爭議站隊</option>
                            </select>
                        </div>
                        <div class="space-y-1">
                            <label class="text-[10px] text-slate-500">文案節奏</label>
                            <select id="editDashLen" class="w-full bg-slate-800 border border-white/10 rounded-lg p-2 text-[10px] text-white outline-none">
                                <option value="短平快 (約150字)" ${MISSION.contentLength.includes('短平快')?'selected':''}>⚡ 短平快 (IG/Threads)</option>
                                <option value="深度文 (約300字)" ${MISSION.contentLength.includes('深度文')?'selected':''}>📖 深度文 (FB/Blog)</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div class="dashboard-item border border-white/5 rounded-2xl overflow-hidden bg-white/5">
                    <button class="w-full p-4 flex justify-between items-center hover:bg-white/5 transition-all accordion-trigger" data-target="dash-team">
                        <span class="text-slate-400 font-bold">🎭 人設與平台</span>
                        <span class="text-white font-black dash-val-team text-right">${MISSION.persona} / ${MISSION.platforms.join(',')} ✎</span>
                    </button>
                    <div id="dash-team" class="hidden p-4 bg-black/20 space-y-4 border-t border-white/5">
                        <div class="space-y-2">
                            <label class="text-[10px] text-slate-500">指派人設角色</label>
                            <div class="flex flex-wrap gap-2">
                                ${SYSTEM_DB.personas.map(p => `<button class="btn-dash-persona px-3 py-2 rounded-lg border ${MISSION.persona===p.name?'border-indigo-500 bg-indigo-500/20 text-white':'border-white/10 text-slate-400'}" data-val="${p.name}">${p.icon} ${p.name}</button>`).join('')}
                            </div>
                        </div>
                        <div class="space-y-2 pt-3 border-t border-white/5">
                            <label class="text-[10px] text-slate-500">部署社群平台 (可多選)</label>
                            <div class="flex flex-wrap gap-2">
                                ${['FB','IG','THREADS'].map(plat => `<button class="btn-dash-plat px-3 py-2 rounded-lg border ${MISSION.platforms.includes(plat)?'border-blue-500 bg-blue-500/20 text-white':'border-white/10 text-slate-400'}" data-val="${plat}">${plat}</button>`).join('')}
                            </div>
                        </div>
                    </div>
                </div>

                <div class="dashboard-item border border-white/5 rounded-2xl overflow-hidden bg-white/5">
                    <button class="w-full p-4 flex justify-between items-center hover:bg-white/5 transition-all accordion-trigger" data-target="dash-characters">
                        <span class="text-slate-400 font-bold">👥 登場角色基因</span>
                        <div class="flex items-center gap-2 max-w-[150px] overflow-hidden dash-val-characters">${charsHtml} ✎</div>
                    </button>
                    <div id="dash-characters" class="hidden p-4 bg-black/20 space-y-3 border-t border-white/5">
                        <div class="dash-val-characters-list">${charsHtml}</div>
                        <p class="text-[10px] text-slate-400 pt-2 border-t border-white/5">若需更換登場角色，請對 Agent 說「我想更換角色」，或點擊下方重啟召喚儀式。</p>
                        <button id="btnBackToChar" class="bg-slate-800 border border-white/10 text-slate-200 px-4 py-2 rounded-lg text-xs active:scale-95 transition-all">✎ 重啟召喚儀式</button>
                    </div>
                </div>

                <div class="dashboard-item border border-white/5 rounded-2xl overflow-hidden bg-white/5">
                    <button class="w-full p-4 flex justify-between items-center hover:bg-white/5 transition-all accordion-trigger" data-target="dash-universe-style">
                        <span class="text-slate-400 font-bold">🌌 風格宇宙與色系</span>
                        <span class="text-white font-black dash-val-universe-style text-right">${MISSION.universe} / ${MISSION.style} / ${MISSION.colorMode==='BW'?'黑白':'彩色'} ✎</span>
                    </button>
                    <div id="dash-universe-style" class="hidden p-4 bg-black/20 space-y-4 border-t border-white/5">
                        <div class="space-y-2">
                            <label class="text-[10px] text-slate-500">宇宙類型</label>
                            <div class="grid grid-cols-3 gap-2">
                                ${[{v:'REALISTIC',i:'📷',n:'攝影'},{v:'COMIC',i:'🎨',n:'動漫'},{v:'ENHANCE',i:'✨',n:'美化'}].map(u => `<button class="btn-dash-uni py-2 rounded-lg border ${MISSION.universe===u.v?'border-indigo-500 bg-indigo-500/20 text-white':'border-white/10 text-slate-400'}" data-val="${u.v}">${u.i} ${u.n}</button>`).join('')}
                            </div>
                        </div>
                        <div class="space-y-2 pt-3 border-t border-white/5">
                            <label class="text-[10px] text-slate-500">視覺風格</label>
                            <div class="flex flex-wrap gap-2">
                                ${availableStyles.map(s => `<button class="btn-dash-style px-3 py-2 rounded-lg border ${MISSION.style===s.name?'border-indigo-500 bg-indigo-500/20 text-white':'border-white/10 text-slate-400'}" data-val="${s.name}">${s.name}</button>`).join('')}
                            </div>
                        </div>
                        <div class="space-y-2 pt-3 border-t border-white/5">
                            <label class="text-[10px] text-slate-500">色系模式</label>
                            <div class="grid grid-cols-2 gap-2">
                                ${[{v:'BW',i:'🏁',n:'黑白'},{v:'Color',i:'🌈',n:'彩色'}].map(c => `<button class="btn-dash-color py-2 rounded-lg border ${MISSION.colorMode===c.v?'border-indigo-500 bg-indigo-500/20 text-white':'border-white/10 text-slate-400'}" data-val="${c.v}">${c.i} ${c.n}</button>`).join('')}
                            </div>
                        </div>
                    </div>
                </div>

                <div class="dashboard-item border border-white/5 rounded-2xl overflow-hidden bg-white/5">
                    <button class="w-full p-4 flex justify-between items-center hover:bg-white/5 transition-all accordion-trigger" data-target="dash-visual-specs">
                        <span class="text-slate-400 font-bold">📐 畫面規格</span>
                        <span class="text-white font-black dash-val-visual-specs">${MISSION.ratio} / ${isComic ? MISSION.panelCount + '格' : ''} ✎</span>
                    </button>
                    <div id="dash-visual-specs" class="hidden p-4 bg-black/20 space-y-4 border-t border-white/5">
                        ${!isEnhance ? `
                        <div class="space-y-2">
                            <label class="text-[10px] text-slate-500">漫畫格數</label>
                            <div class="grid grid-cols-4 gap-2">
                                ${[1,2,3,4].map(n => `<button class="btn-dash-panel py-2 rounded-lg border ${MISSION.panelCount===n?'border-indigo-500 bg-indigo-500/20 text-white':'border-white/10 text-slate-400'}" data-val="${n}">${n}格</button>`).join('')}
                            </div>
                        </div>` : ''}
                        <div class="space-y-2 pt-3 border-t border-white/5">
                            <label class="text-[10px] text-slate-500">畫面比例</label>
                            <div class="grid grid-cols-3 gap-2">
                                ${['9:16','16:9','1:1'].map(r => `<button class="btn-dash-ratio py-2 rounded-lg border ${MISSION.ratio===r?'border-indigo-500 bg-indigo-500/20 text-white':'border-white/10 text-slate-400'}" data-val="${r}">${r}</button>`).join('')}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <button id="btnRender" class="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-2xl font-black text-sm shadow-[0_0_20px_rgba(79,70,229,0.4)] active:scale-95 transition-all">
                ⚡ 鎖定配置並產出校稿卡
            </button>
        </div>
    `);

    ui.querySelectorAll('.accordion-trigger').forEach(trigger => {
        trigger.onclick = () => {
            const targetId = trigger.dataset.target;
            const targetEl = ui.querySelector(`#${targetId}`);
            const isHidden = targetEl.classList.contains('hidden');
            
            ui.querySelectorAll('.dashboard-item > div:not(.hidden)').forEach(el => el.classList.add('hidden'));
            ui.querySelectorAll('.accordion-trigger > span:nth-child(2)').forEach(span => span.style.display = 'block');

            if (isHidden) {
                targetEl.classList.remove('hidden');
                trigger.querySelector('span:nth-child(2)').style.display = 'none';
            }
        };
    });

    const updateDashDisplay = () => {
        ui.querySelector('.dash-val-topic').innerText = decodeHTMLEntities(MISSION.topic) + ' ✎';
        ui.querySelector('.dash-val-strategy').innerText = `${MISSION.hookType} / ${MISSION.contentLength.split(' ')[0]} ✎`;
        ui.querySelector('.dash-val-team').innerText = `${MISSION.persona} / ${MISSION.platforms.join(',')} ✎`;
        const isComicNow = MISSION.universe === 'COMIC';
        ui.querySelector('.dash-val-universe-style').innerText = `${MISSION.universe} / ${MISSION.style} / ${MISSION.colorMode==='BW'?'黑白':'彩色'} ✎`;
        ui.querySelector('.dash-val-visual-specs').innerText = `${MISSION.ratio} / ${isComicNow ? MISSION.panelCount + '格' : ''} ✎`;
    };

    ui.querySelector('#editDashTopic').oninput = (e) => { MISSION.topic = e.target.value; updateDashDisplay(); };
    ui.querySelector('#editDashHook').onchange = (e) => { MISSION.hookType = e.target.value; updateDashDisplay(); };
    ui.querySelector('#editDashLen').onchange = (e) => { MISSION.contentLength = e.target.value; updateDashDisplay(); };

    ui.querySelectorAll('.btn-dash-persona').forEach(btn => {
        btn.onclick = () => {
            MISSION.persona = btn.dataset.val;
            ui.querySelectorAll('.btn-dash-persona').forEach(b => b.classList.add('border-white/10', 'text-slate-400'));
            ui.querySelectorAll('.btn-dash-persona').forEach(b => b.classList.remove('border-indigo-500', 'bg-indigo-500/20', 'text-white'));
            btn.classList.remove('border-white/10', 'text-slate-400');
            btn.classList.add('border-indigo-500', 'bg-indigo-500/20', 'text-white');
            updateDashDisplay();
        };
    });

    ui.querySelectorAll('.btn-dash-plat').forEach(btn => {
        btn.onclick = () => {
            const p = btn.dataset.val;
            if (MISSION.platforms.includes(p)) {
                if (MISSION.platforms.length > 1) MISSION.platforms = MISSION.platforms.filter(x => x!==p);
            } else { MISSION.platforms.push(p); }
            btn.classList.toggle('border-blue-500'); btn.classList.toggle('bg-blue-500/20'); btn.classList.toggle('text-white'); btn.classList.toggle('border-white/10'); btn.classList.toggle('text-slate-400');
            updateDashDisplay();
        };
    });

    ui.querySelector('#btnBackToChar').onclick = async () => { IS_EDIT_MODE.value = true; releaseUI(ui); await triggerCharacterSkill(); };

    ui.querySelectorAll('.btn-dash-uni').forEach(btn => {
        btn.onclick = async () => {
            const oldUni = MISSION.universe; MISSION.universe = btn.dataset.val;
            if (oldUni !== MISSION.universe) {
                MISSION.style = ''; MISSION.colorMode = ''; MISSION.characters = []; MISSION.sceneFiles = [];
            }
            releaseUI(ui); await triggerMissionSummary(); 
        };
    });

    ui.querySelectorAll('.btn-dash-style').forEach(btn => {
        btn.onclick = () => {
            MISSION.style = btn.dataset.val;
            ui.querySelectorAll('.btn-dash-style').forEach(b => b.classList.add('border-white/10', 'text-slate-400'));
            ui.querySelectorAll('.btn-dash-style').forEach(b => b.classList.remove('border-indigo-500', 'bg-indigo-500/20', 'text-white'));
            btn.classList.remove('border-white/10', 'text-slate-400');
            btn.classList.add('border-indigo-500', 'bg-indigo-500/20', 'text-white');
            updateDashDisplay();
        };
    });

    ui.querySelectorAll('.btn-dash-color').forEach(btn => {
        btn.onclick = () => {
            MISSION.colorMode = btn.dataset.val;
            ui.querySelectorAll('.btn-dash-color').forEach(b => b.classList.add('border-white/10', 'text-slate-400'));
            ui.querySelectorAll('.btn-dash-color').forEach(b => b.classList.remove('border-indigo-500', 'bg-indigo-500/20', 'text-white'));
            btn.classList.remove('border-white/10', 'text-slate-400');
            btn.classList.add('border-indigo-500', 'bg-indigo-500/20', 'text-white');
            updateDashDisplay();
        };
    });

    if (!isEnhance && isComic) {
        ui.querySelectorAll('.btn-dash-panel').forEach(btn => {
            btn.onclick = () => {
                MISSION.panelCount = parseInt(btn.dataset.val);
                ui.querySelectorAll('.btn-dash-panel').forEach(b => b.classList.add('border-white/10', 'text-slate-400'));
                ui.querySelectorAll('.btn-dash-panel').forEach(b => b.classList.remove('border-indigo-500', 'bg-indigo-500/20', 'text-white'));
                btn.classList.remove('border-white/10', 'text-slate-400');
                btn.classList.add('border-indigo-500', 'bg-indigo-500/20', 'text-white');
                updateDashDisplay();
            };
        });
    }

    ui.querySelectorAll('.btn-dash-ratio').forEach(btn => {
        btn.onclick = () => {
            MISSION.ratio = btn.dataset.val;
            ui.querySelectorAll('.btn-dash-ratio').forEach(b => b.classList.add('border-white/10', 'text-slate-400'));
            ui.querySelectorAll('.btn-dash-ratio').forEach(b => b.classList.remove('border-indigo-500', 'bg-indigo-500/20', 'text-white'));
            btn.classList.remove('border-white/10', 'text-slate-400');
            btn.classList.add('border-indigo-500', 'bg-indigo-500/20', 'text-white');
            updateDashDisplay();
        };
    });

    ui.querySelector('#btnRender').onclick = async () => {
        await window.FunnelActions.generateDraft();
    };

    window.refreshMissionDashboard = () => {
        updateDashDisplay();
        ui.querySelector('#agentDashboardAdvice').innerHTML = `「已根據指示更新參數。總編確認沒問題後，即可發包。」`;
        
        ui.querySelectorAll('button[data-val]').forEach(btn => {
            const val = btn.dataset.val;
            let isActive = false;
            
            if (btn.classList.contains('btn-dash-plat')) {
                isActive = MISSION.platforms.includes(val);
                if (isActive) {
                    btn.classList.add('border-blue-500', 'bg-blue-500/20', 'text-white');
                    btn.classList.remove('border-white/10', 'text-slate-400');
                } else {
                    btn.classList.remove('border-blue-500', 'bg-blue-500/20', 'text-white');
                    btn.classList.add('border-white/10', 'text-slate-400');
                }
                return; 
            }

            if (btn.classList.contains('btn-dash-persona')) isActive = (val === MISSION.persona);
            else if (btn.classList.contains('btn-dash-uni')) isActive = (val === MISSION.universe);
            else if (btn.classList.contains('btn-dash-style')) isActive = (val === MISSION.style);
            else if (btn.classList.contains('btn-dash-color')) isActive = (val === MISSION.colorMode);
            else if (btn.classList.contains('btn-dash-panel')) isActive = (parseInt(val) === MISSION.panelCount);
            else if (btn.classList.contains('btn-dash-ratio')) isActive = (val === MISSION.ratio);

            if (isActive) {
                btn.classList.add('border-indigo-500', 'bg-indigo-500/20', 'text-white');
                btn.classList.remove('border-white/10', 'text-slate-400');
            } else {
                btn.classList.remove('border-indigo-500', 'bg-indigo-500/20', 'text-white');
                btn.classList.add('border-white/10', 'text-slate-400');
            }
        });
    };
}
