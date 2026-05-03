// js/v9_funnel_resume.js — 漏斗斷點推論與接續（返回大廳後「接續漏斗」）
import { MISSION, IS_EDIT_MODE, isMissionComplete } from './v9_state.js';
import { addLog } from './v9_ui.js';
import {
    triggerTopicSkill,
    triggerPlatformSkill,
    triggerPersonaSkill,
    triggerHookSkill,
    triggerUniverseSkill,
    triggerStyleSkill,
    triggerCharacterSkill,
    triggerVisualSkill,
    triggerScheduleSkill
} from './v9_funnel_skills.js';
import { triggerMissionSummary } from './v9_funnel_dashboard.js';
import { renderDraftEditorCard } from './v9_funnel_editor.js';

const STEP_KEYS = [
    'topic',
    'platforms',
    'persona',
    'hook',
    'universe',
    'style',
    'character',
    'visual',
    'schedule',
    'dashboard',
    'draft'
];

/**
 * 無 funnelNextStep 舊資料時，依 MISSION 欄位推論下一個合法步驟。
 */
export function inferFunnelNextStepFromMission() {
    if (!MISSION.topic?.trim()) return 'topic';
    if (!MISSION.platforms?.length) return 'platforms';
    if (!MISSION.persona) return 'persona';
    if (!MISSION.universe) return 'universe';
    if (!isMissionComplete()) return 'style';
    if (MISSION.currentTaskId && MISSION.currentDraft) return 'draft';
    if (MISSION.currentTaskId) return 'dashboard';
    // 已具備完整 mission 但無斷點紀錄（舊資料）：導向總表最安全，避免誤回到角色卡
    return 'dashboard';
}

export function resolveResumeStep() {
    let s = MISSION.funnelNextStep;
    if (!s || !STEP_KEYS.includes(s)) {
        s = inferFunnelNextStepFromMission();
    } else if (s === 'topic' && MISSION.topic?.trim()) {
        s = inferFunnelNextStepFromMission();
    }
    if (s === 'draft' && MISSION.currentTaskId && !MISSION.currentDraft) {
        s = 'dashboard';
    }
    return s || 'topic';
}

/** 頂部「返回漏斗首頁」是否應保留 MISSION（可再接斷點或從任務列表續） */
export function canPreserveFunnelOnHome() {
    if (MISSION.currentTaskId) return true;
    if (MISSION.generatedImageBatches?.length) return true;
    if (MISSION.currentDraft) return true;
    const step = MISSION.funnelNextStep;
    if (step && step !== 'topic') return true;
    if (MISSION.topic?.trim()) return true;
    return false;
}

/** 大廳是否顯示「接續漏斗斷點」按鈕 */
export function canShowResumeFunnelButton() {
    if (MISSION.currentTaskId && MISSION.currentDraft) return true;
    const r = resolveResumeStep();
    return r !== 'topic';
}

/**
 * 清空漏斗區並接續當前斷點（由大廳按鈕呼叫）
 */
export async function resumeFunnelFromCheckpoint() {
    const log = document.getElementById('funnelLog');
    if (log) log.innerHTML = '';

    IS_EDIT_MODE.value = true; // 與從任務列表續接一致，完成步驟時可導向儀表板
    const chatBar = document.getElementById('agentChatBar');
    if (chatBar) chatBar.classList.remove('translate-y-full');

    const step = resolveResumeStep();

    if (step === 'draft') {
        if (MISSION.currentTaskId && MISSION.currentDraft) {
            return renderDraftEditorCard(
                MISSION.currentTaskId,
                MISSION.currentDraft,
                MISSION.universe === 'COMIC'
            );
        }
        await addLog(
            '系統',
            '💡',
            '草稿在雲端：請點下方「進行中任務」的載入按鈕接續（或重新整理後再試）。',
            true
        );
        return;
    }

    switch (step) {
        case 'topic':
            return triggerTopicSkill();
        case 'platforms':
            return triggerPlatformSkill();
        case 'persona':
            return triggerPersonaSkill();
        case 'hook':
            return triggerHookSkill();
        case 'universe':
            return triggerUniverseSkill();
        case 'style':
            return triggerStyleSkill();
        case 'character':
            return triggerCharacterSkill();
        case 'visual':
            return triggerVisualSkill();
        case 'schedule':
            return triggerScheduleSkill();
        case 'dashboard':
            return triggerMissionSummary();
        default:
            return triggerTopicSkill();
    }
}
