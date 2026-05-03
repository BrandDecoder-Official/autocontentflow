// js/v9_funnel.js (V10 模組化聚合器)

import './v9_funnel_actions.js'; // 註冊全局 FunnelActions

export { startNewFunnel } from './v9_funnel_skills.js';
export { triggerMissionSummary } from './v9_funnel_dashboard.js';
export { renderDraftEditorCard, renderFinalPublishCard } from './v9_funnel_editor.js';
export {
    resumeFunnelFromCheckpoint,
    canPreserveFunnelOnHome,
    canShowResumeFunnelButton,
    resolveResumeStep,
    inferFunnelNextStepFromMission
} from './v9_funnel_resume.js';
