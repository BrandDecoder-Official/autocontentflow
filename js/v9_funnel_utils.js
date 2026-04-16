// js/v9_funnel_utils.js
export function decodeHTMLEntities(text) {
    if(!text) return '';
    const textArea = document.createElement('textarea');
    textArea.innerHTML = text;
    return textArea.value;
}
