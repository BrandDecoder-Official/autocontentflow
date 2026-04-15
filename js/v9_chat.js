// js/v9_chat.js
import { MISSION } from './v9_state.js';
import { addLog, showError } from './v9_ui.js';
import { AgentClient } from './v9_agent_client.js';
// ⚠️ 注意：這裡移除了 applyPointDeduction 的 import
// 因為實時扣點我們已經交給 v9_agent_client.js 裡面的 sendChatMessage 統一處理了，避免重複扣點。

export function initAgentChatBar(callbacks) {
    if(document.getElementById('agentChatBar')) return;
    
    const chatBar = document.createElement('div');
    chatBar.id = "agentChatBar";
    chatBar.className = "fixed bottom-0 left-0 w-full bg-slate-900/95 backdrop-blur-md border-t border-indigo-500/50 p-3 pb-safe z-[9000] flex items-end justify-center transition-transform translate-y-full duration-500 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]";
    
    chatBar.innerHTML = `
        <div class="max-w-4xl w-full flex items-end gap-2">
                <textarea id="agentChatInput" rows="1" class="flex-1 bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-indigo-500 outline-none resize-none max-h-32 overflow-y-auto no-scrollbar" placeholder="請透過對話讓 Agent 協助您修改 (例如：幫我把主題換成啦啦隊，Shift+Enter 換行)..."></textarea>            <button id="btnSendChat" class="flex-none bg-indigo-600 hover:bg-indigo-500 text-white px-4 sm:px-6 py-3 rounded-xl font-black text-sm shadow-[0_0_15px_rgba(79,70,229,0.5)] active:scale-95 transition-all h-[46px]">
                <span class="hidden sm:inline">送出指令</span>
                <span class="sm:hidden text-xl">🚀</span>
            </button>
        </div>
    `;
    document.body.appendChild(chatBar);

    const input = document.getElementById('agentChatInput');

    input.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
        if(this.value === '') this.style.height = 'auto'; 
    });

    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault(); 
            document.getElementById('btnSendChat').click();
        }
    });

    document.getElementById('btnSendChat').onclick = async () => {
        const msg = input.value.trim();
        if(!msg) return;

        input.value = '';
        input.style.height = 'auto';
        input.disabled = true;

        await addLog("總編", "👤", `<span class="whitespace-pre-wrap">${msg}</span>`);
        const spinId = 'spin_chat_' + Date.now();
        await addLog("Agent", "🤖", `<div class="flex items-center gap-2"><div id="${spinId}" class="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div><span id="text_${spinId}">思考與執行中...</span></div>`, true);

        setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 100);

        try {
            // 🚀 核心替換：改呼叫我們今天寫的、支援 Function Calling 與實時扣點的 API
            const response = await AgentClient.sendChatMessage(msg);
            
            // 移除轉圈圈
            const spEl = document.getElementById(spinId); 
            if(spEl) spEl.closest('.flex').parentElement.remove();
            
            // 印出大腦的回覆 (不管是文字聊天還是執行結果)
            const colorClass = response.type === 'action' ? 'text-green-400' : 'text-indigo-300';
            await addLog("Agent", "🤖", `<span class="${colorClass} whitespace-pre-wrap font-bold">${response.message}</span>`);

            setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 300);

        } catch(e) {
            const spEl = document.getElementById(spinId); 
            if(spEl) { 
                spEl.classList.remove('animate-spin', 'border-t-transparent'); 
                spEl.classList.add('border-red-500'); 
                document.getElementById(`text_${spinId}`).innerText = "連線失敗"; 
            }
            showError(`Agent 回應失敗：${e.message}`);
        } finally {
            input.disabled = false; input.focus();
        }
    };
}
