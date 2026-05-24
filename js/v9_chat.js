// js/v9_chat.js
import { MISSION, SYSTEM_DB } from './v9_state.js';
import { addLog, showError } from './v9_ui.js';
import { AgentClient } from './v9_agent_client.js';
import { getBillingActionDisplayName } from './v9_finance.js';

export function initAgentChatBar(callbacks) {
    // 💡 在雙欄模式下，事件重綁定由 window.rebindAgentChat 處理
    window.rebindAgentChat();
}

window.rebindAgentChat = function() {
    const input = document.getElementById('agentChatInput');
    const sendBtn = document.getElementById('btnSendChat');
    if (!input || !sendBtn) return;

    // 清除舊事件 (重設 oninput / onkeydown / onclick)
    input.oninput = function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
        if(this.value === '') this.style.height = 'auto'; 
    };

    input.onkeydown = function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault(); 
            sendBtn.click();
        }
    };

    sendBtn.onclick = async () => {
        const msg = input.value.trim();
        if(!msg) return;

        input.value = '';
        input.style.height = 'auto';
        input.disabled = true;

        await addLog("總編", "👤", `<span class="whitespace-pre-wrap">${msg}</span>`);
        const spinId = 'spin_chat_' + Date.now();
        await addLog("Agent", "🤖", `<div class="flex items-center gap-2"><div id="${spinId}" class="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div><span id="text_${spinId}">思考與執行中...</span></div>`, true);

        const chatMessages = document.getElementById('chatMessages');
        if(chatMessages) {
            chatMessages.scrollTo({ top: chatMessages.scrollHeight, behavior: 'smooth' });
        }

        try {
            // 🚀 呼叫支援 Function Calling 與扣點單一來源的 API
            const response = await AgentClient.sendChatMessage(msg);
            
            // 移除轉圈圈
            const spEl = document.getElementById(spinId); 
            if(spEl) {
                const bubble = spEl.closest('.flex');
                if (bubble && bubble.parentElement) bubble.parentElement.remove();
            }
            
            // 印出大腦的回覆 (不管是文字聊天還是執行結果)
            const colorClass = response.type === 'action' ? 'text-green-400' : 'text-indigo-300';
            await addLog("Agent", "🤖", `<span class="${colorClass} whitespace-pre-wrap font-bold">${response.message}</span>`);

            if(chatMessages) {
                setTimeout(() => chatMessages.scrollTo({ top: chatMessages.scrollHeight, behavior: 'smooth' }), 300);
            }

        } catch(e) {
            const spEl = document.getElementById(spinId); 
            if(spEl) { 
                spEl.classList.remove('animate-spin', 'border-t-transparent'); 
                spEl.classList.add('border-red-500'); 
                const textSpan = document.getElementById(`text_${spinId}`);
                if (textSpan) textSpan.innerText = "連線失敗"; 
            }
            showError(`Agent 回應失敗：${e.message}`);
        } finally {
            input.disabled = false; input.focus();
        }
    };

    // 渲染引導按鈕
    window.renderQuickReplies();
};

/**
 * ==========================================
 * 🎨 引導式快捷按鈕動態渲染 (OiiOii 靈感)
 * ==========================================
 */
window.renderQuickReplies = function() {
    const container = document.getElementById('quickRepliesContainer');
    if (!container) return;
    
    container.innerHTML = '';
    const step = MISSION.funnelNextStep || '';
    
    let replies = [];
    
    if (step === 'topic') {
        replies = [
            { text: '🍵 冷泡茶推廣文案', cmd: '寫一篇夏天冷泡茶的推廣發文' },
            { text: '☕ 咖啡館開幕宣傳', cmd: '寫一篇精品咖啡館開幕的社群文案' },
            { text: '📰 帶入第一則熱門新聞', action: () => {
                const firstRss = document.querySelector('#rssList > div');
                if (firstRss) firstRss.click();
                else alert('新聞清單尚無內容，請稍候。');
            }}
        ];
    } else if (step === 'platforms') {
        replies = [
            { text: '📱 選擇 FB & IG', cmd: '幫我選擇 Facebook 和 Instagram 平台' },
            { text: '💬 選擇 Threads', cmd: '幫我選擇 Threads 平台' },
            { text: '✅ 下一步', cmd: '鎖定發布平台' }
        ];
    } else if (step === 'persona') {
        const personas = (SYSTEM_DB?.personas || []).slice(0, 3);
        personas.forEach(p => {
            replies.push({ text: `${p.icon} ${p.name}`, cmd: `幫我選擇品牌人設：${p.name}` });
        });
    } else if (step === 'hook') {
        replies = [
            { text: '❓ 痛點提問', cmd: '開場使用痛點提問' },
            { text: '💥 反直覺爆點', cmd: '開場使用反直覺爆點' },
            { text: '🎁 利益誘惑', cmd: '開場使用利益誘惑' }
        ];
    } else if (step === 'universe') {
        replies = [
            { text: '📷 真實攝影', cmd: '選擇真實攝影宇宙' },
            { text: '🎨 2D 動漫', cmd: '選擇2D動漫宇宙' }
        ];
    } else if (step === 'style') {
        if (MISSION.universe === 'REALISTIC') {
            const styles = (SYSTEM_DB?.styles || []).filter(s => s.category === 'REALISTIC_MODE').slice(0, 3);
            styles.forEach(s => {
                replies.push({ text: s.name, cmd: `對焦合成模式選擇：${s.name}` });
            });
        } else {
            const styles = (SYSTEM_DB?.styles || []).filter(s => s.category === 'ANIME' || s.category === 'ANIME_STYLE').slice(0, 3);
            styles.forEach(s => {
                replies.push({ text: s.name, cmd: `風格選擇：${s.name}` });
            });
        }
    } else if (step === 'character') {
        replies = [
            { text: '⏭️ 純場景不召喚', cmd: '純場景模式不召喚角色' }
        ];
        const chars = (SYSTEM_DB?.characters || []).slice(0, 2);
        chars.forEach(c => {
            replies.push({ text: `🧬 召喚 ${c.name}`, cmd: `本次任務召喚角色：${c.name}` });
        });
    } else if (step === 'visual') {
        replies = [
            { text: '🚀 生成劇本', action: () => {
                const btn = document.getElementById('btnAcceptVisualManual');
                if (btn) btn.click();
            }}
        ];
    } else if (step === 'draft') {
        replies = [
            { text: '🎨 影像合成', cmd: '立即進行影像合成' },
            { text: '✍️ 內容改幽默點', cmd: '幫我修改劇本，讓語氣更幽默有趣' },
            { text: '✍️ 改精簡字數', cmd: '幫我修改劇本，內容簡短有力' }
        ];
    } else if (step === 'image') {
        replies = [
            { text: '🚀 社群發佈', cmd: '立即發佈到社群平台' },
            { text: '🔄 重新合成圖片', cmd: '圖片重新生成一次' }
        ];
    }
    
    if (replies.length === 0) {
        container.classList.add('hidden');
        return;
    }
    
    container.classList.remove('hidden');
    
    replies.forEach(r => {
        const btn = document.createElement('button');
        btn.className = 'px-3 py-1.5 bg-slate-800/80 hover:bg-indigo-600 text-slate-300 hover:text-white rounded-full text-[10px] font-bold border border-white/5 active:scale-95 transition-all whitespace-nowrap shadow-md';
        btn.textContent = r.text;
        btn.onclick = () => {
            if (r.action) {
                r.action();
            } else if (r.cmd) {
                const input = document.getElementById('agentChatInput');
                if (input) {
                    input.value = r.cmd;
                    const sendBtn = document.getElementById('btnSendChat');
                    if (sendBtn) sendBtn.click();
                }
            }
        };
        container.appendChild(btn);
    });
};
