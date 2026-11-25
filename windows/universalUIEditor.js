(function () {
    'use strict';
    const STORE = 'orvexa-universal-ui-edits-v1';
    const SELECTOR = 'h1,h2,h3,h4,h5,h6,p,span,strong,small,label,button,a,li';
    let enabled = false;
    let applying = false;
    let observer = null;
    function read() { try { return JSON.parse(localStorage.getItem(STORE) || '{}'); } catch (_) { return {}; } }
    function write(key, value) { const data = read(); data[key] = value; try { localStorage.setItem(STORE, JSON.stringify(data)); } catch (_) {} }
    function pathOf(node) {
        const parts = [];
        let current = node;
        while (current && current !== document.body) {
            const parent = current.parentElement;
            if (!parent) break;
            const siblings = Array.from(parent.children).filter((item) => item.tagName === current.tagName);
            parts.unshift(current.tagName.toLowerCase() + ':' + siblings.indexOf(current));
            current = parent;
        }
        return parts.join('/');
    }
    function isEditableLeaf(el) {
        if (!el.textContent.trim() || el.closest('[data-orvexa-editor],script,style,pre,code,textarea,input,select,option')) return false;
        return !el.querySelector(SELECTOR);
    }
    function scan(root) {
        if (!root || applying) return;
        applying = true;
        const data = read();
        const nodes = [];
        if (root.matches && root.matches(SELECTOR)) nodes.push(root);
        if (root.querySelectorAll) nodes.push(...root.querySelectorAll(SELECTOR));
        nodes.forEach((el) => {
            if (!isEditableLeaf(el)) return;
            const key = pathOf(el);
            if (!key) return;
            el.dataset.orvexaEditKey = key;
            if (Object.prototype.hasOwnProperty.call(data, key) && el.textContent !== data[key]) el.textContent = data[key];
            el.contentEditable = enabled ? 'true' : 'false';
            el.spellcheck = enabled;
        });
        applying = false;
    }
    function setMode(next) {
        enabled = Boolean(next);
        document.body.classList.toggle('orvexa-edit-mode', enabled);
        const button = document.querySelector('[data-orvexa-editor-toggle]');
        if (button) { button.textContent = enabled ? '✓ Finish editing' : '✎ Edit UI'; button.setAttribute('aria-pressed', String(enabled)); }
        scan(document.body);
    }
    function install() {
        if (!document.querySelector('.desktop')) return;
        if (!document.querySelector('[data-orvexa-editor]')) {
            const panel = document.createElement('div');
            panel.dataset.orvexaEditor = '';
            panel.innerHTML = '<button type="button" data-orvexa-editor-toggle aria-pressed="false">✎ Edit UI</button><span data-orvexa-editor-hint hidden>Click text to edit · Changes save automatically · Esc to finish</span>';
            document.body.appendChild(panel);
            panel.querySelector('button').addEventListener('click', () => setMode(!enabled));
        }
        scan(document.body);
        if (!observer) {
            observer = new MutationObserver((records) => records.forEach((record) => record.addedNodes.forEach((node) => { if (node.nodeType === 1) scan(node); })));
            observer.observe(document.body, { childList: true, subtree: true });
        }
    }
    document.addEventListener('input', (event) => {
        const el = event.target.closest('[data-orvexa-edit-key]');
        if (enabled && el) write(el.dataset.orvexaEditKey, el.textContent.trim());
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && enabled) { setMode(false); return; }
        if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'e') { event.preventDefault(); setMode(!enabled); }
    });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true }); else install();
    window.addEventListener('orvexa:app-template-mounted', () => scan(document.body));
})();