// js/v9_ui.js
export function updateStepHeader(name) { document.getElementById('missionStep').innerText = name; }
export function lockUI(el) { el.classList.add('opacity-40', 'pointer-events-none'); }
export function scrollDown() { document.getElementById('funnelLog').scrollTo({ top: document.getElementById('funnelLog').scrollHeight, behavior: 'smooth' }); }

export function createSkillUI(html) {
    const log = document.getElementById('funnelLog');
    const oldActive = document.getElementById('activeControlCard');
    if (oldActive) {
        oldActive.removeAttribute('id');
        oldActive.querySelectorAll('button').forEach(b => b.disabled = true);
        const inputs = oldActive.querySelectorAll('input, textarea, select');
        if(inputs) inputs.forEach(i => i.disabled = true);
    }
    const div = document.createElement('div');
    div.className = 'skill-card ml-8 lg:ml-12 bg-slate-900/50 p-4 rounded-2xl border border-white/5 shadow-2xl mb-6';
    div.id = 'activeControlCard';
    div.innerHTML = html;
    log.appendChild(div);
    scrollDown();
    return div;
}

export function releaseUI(ui) {
    lockUI(ui);
    ui.removeAttribute('id');
    ui.querySelectorAll('button').forEach(b => b.disabled = true);
    const inputs = ui.querySelectorAll('input, textarea, select');
    if(inputs) inputs.forEach(i => i.disabled = true);
}

export async function addLog(role, icon, msg, skipTyping = false) {
    const log = document.getElementById('funnelLog');
    const div = document.createElement('div');
    div.className = 'flex items-start gap-3 lg:gap-4 animate-fade-in mb-4';
    div.innerHTML = `<div class="text-2xl">${icon}</div><div class="bg-slate-800/80 p-3 lg:p-4 rounded-2xl rounded-tl-none border border-white/5 max-w-[90%] lg:max-w-[85%] shadow-md"><div class="text-[9px] font-black text-slate-500 mb-1 uppercase">${role}</div><div class="msg-content text-xs lg:text-sm leading-relaxed">${skipTyping ? msg : '<span class="animate-pulse">...</span>'}</div></div>`;
    const activeCard = document.getElementById('activeControlCard');
    if (activeCard) log.insertBefore(div, activeCard); else log.appendChild(div);
    scrollDown();
    if (!skipTyping) { await new Promise(r => setTimeout(r, 600)); div.querySelector('.msg-content').innerHTML = msg; }
}

export async function showError(msg) {
    const log = document.getElementById('funnelLog'); const div = document.createElement('div');
    div.className = 'flex justify-center w-full my-2 animate-bounce';
    div.innerHTML = `<div class="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-2 rounded-full text-xs font-bold shadow-[0_0_15px_rgba(239,68,68,0.2)] flex items-center gap-2"><span class="text-lg">🚨</span> <span>${msg}</span></div>`;
    const activeCard = document.getElementById('activeControlCard');
    if (activeCard) log.insertBefore(div, activeCard); else log.appendChild(div);
    scrollDown();
}
