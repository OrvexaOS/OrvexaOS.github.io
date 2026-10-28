(function () {
    'use strict';

    const metadataCache = new Map();
    const templateCache = new Map();
    const pending = new Map();
    const disabledTags = new Set(['SCRIPT', 'IFRAME', 'OBJECT', 'EMBED', 'BASE', 'META', 'LINK']);

    function safeTemplateFragment(html, appId) {
        const parser = new DOMParser();
        const documentFragment = parser.parseFromString(String(html), 'text/html');
        documentFragment.querySelectorAll('*').forEach((node) => {
            if (disabledTags.has(node.tagName)) {
                node.remove();
                return;
            }
            Array.from(node.attributes).forEach((attribute) => {
                const name = attribute.name.toLowerCase();
                const value = attribute.value.trim();
                if (name.startsWith('on') || name === 'srcdoc' || name === 'formaction') {
                    node.removeAttribute(attribute.name);
                    return;
                }
                if (['href', 'src', 'xlink:href', 'action'].includes(name) && /^\s*javascript:/i.test(value)) {
                    node.removeAttribute(attribute.name);
                }
            });
        });
        const marker = documentFragment.querySelector('[data-app-template], [data-app-root]');
        if (marker && marker.getAttribute('data-app-template') !== appId && marker.getAttribute('data-app-root') !== appId) {
            throw new Error('App template marker does not match requested app ID.');
        }
        return document.createDocumentFragment().append(...Array.from(documentFragment.body.childNodes));
    }

    async function fetchMetadata(appId) {
        if (metadataCache.has(appId)) return metadataCache.get(appId);
        const response = await fetch('/apps/' + encodeURIComponent(appId) + '/app.json', {
            cache: 'no-cache',
            credentials: 'same-origin'
        });
        if (!response.ok) throw new Error('App metadata unavailable: ' + appId);
        const metadata = await response.json();
        if (!metadata || metadata.id !== appId || metadata.template !== '/apps/' + appId + '/index.html') {
            throw new Error('App metadata failed validation: ' + appId);
        }
        metadataCache.set(appId, metadata);
        return metadata;
    }

    async function loadTemplate(appId) {
        if (templateCache.has(appId)) return templateCache.get(appId);
        if (pending.has(appId)) return pending.get(appId);
        const task = (async () => {
            const metadata = await fetchMetadata(appId);
            if (metadata.runtime !== 'template') return null;
            const response = await fetch(metadata.template, { cache: 'no-cache', credentials: 'same-origin' });
            if (!response.ok) throw new Error('App template unavailable: ' + appId);
            const html = await response.text();
            if (!html.trim() || html.length > 512 * 1024) throw new Error('App template is empty or too large: ' + appId);
            const fragment = safeTemplateFragment(html, appId);
            templateCache.set(appId, fragment);
            return fragment;
        })();
        pending.set(appId, task);
        try {
            return await task;
        } finally {
            pending.delete(appId);
        }
    }

    async function mount(element, appId) {
        if (!element || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(appId))) return false;
        try {
            const fragment = await loadTemplate(String(appId));
            if (!fragment || !element.isConnected) return false;
            const oldContent = element.querySelector('.window-content');
            if (!oldContent) return false;
            // Clone cached nodes so each window gets its own DOM tree.
            oldContent.replaceWith(fragment.cloneNode(true));
            element.dataset.appSource = 'template';
            element.dispatchEvent(new CustomEvent('orvexa:app-template-mounted', { bubbles: true, detail: { appId } }));
            return true;
        } catch (error) {
            // A source template is optional. Always keep the legacy app available.
            console.warn('[OrvexaOS] Using built-in app content for ' + appId + ':', error);
            return false;
        }
    }

    window.OrvexaAppSources = Object.freeze({ mount });
})();