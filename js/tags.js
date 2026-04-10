// public/js/tags.js
import { STATE } from './config.js';

export function initTags() {
    STATE.currentTags = [];
    const tagInput = document.getElementById('newTagInput');
    if (tagInput) {
        tagInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const val = e.target.value.trim();
                if (val) {
                    const newTags = val.split(/[,，\s]+/).filter(t => t.trim() !== '');
                    STATE.currentTags = [...STATE.currentTags, ...newTags];
                    window.renderTagChips();
                    e.target.value = '';
                }
            }
        });
    }
}

export function renderTagChips() {
    const container = document.getElementById('tagChipsContainer');
    if (!container) return;
    container.innerHTML = '';
    STATE.currentTags.forEach((tag, index) => {
        const cleanTag = tag.replace(/^#/, '').trim(); 
        if (!cleanTag) return;
        const chip = document.createElement('span');
        chip.className = 'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 shadow-sm border border-blue-200 animate-fade-in mb-1 mr-1';
        chip.innerHTML = `#${cleanTag} <button type="button" class="ml-1.5 text-blue-500 hover:text-blue-800 focus:outline-none" onclick="window.removeTag(${index})">&times;</button>`;
        container.appendChild(chip);
    });
}

export function removeTag(index) {
    STATE.currentTags.splice(index, 1);
    window.renderTagChips();
}
