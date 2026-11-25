/* Developer Tools: live API activity panel. */
(function () {
    'use strict';
    let unsubscribe = null;
    let activeRoot = null;
    function formatTime(value) {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString([], { dateStyle: 'short', timeStyle: 'medium' });
    }
    function render(root, entries) {
        if (!root || !root.isConnected) return;
        const list = root.querySelector('[data-api-log-list]');
        const state = root.querySelector('[data-api-log-state]');
        const count = root.querySelector('[data-api-log-count]');
        if (!list || !state || !count) return;
        count.textContent = String(entries.length);
        list.replaceChildren();
        if (!window.OrvexaAPIMonitor || !window.OrvexaAPIMonitor.supported) {
            state.hidden = false; state.dataset.state = 'error';
            state.textContent = 'API monitoring is unavailable in this browser environment.';
            return;
        }
        if (!entries.length) {
            state.hidden = false; state.dataset.state = 'empty';
            state.textContent = 'No API calls recorded yet. Calls made by OrvexaOS will appear here as they happen.';
            return;
        }
        state.hidden = true;
        entries.forEach((entry) => {
            const row = document.createElement('article');
            row.className = 'api-log-entry';
            row.dataset.status = entry.status;
            const top = document.createElement('div'); top.className = 'api-log-entry-top';
            const method = document.createElement('span'); method.className = 'api-log-method'; method.textContent = entry.method;
            const status = document.createElement('span'); status.className = 'api-log-status'; status.textContent = entry.status === 'pending' ? 'Pending' : entry.statusCode === null ? 'Failed' : String(entry.statusCode) + (entry.status === 'error' ? ' · Error' : ' · OK');
            const time = document.createElement('time'); time.dateTime = entry.timestamp; time.textContent = formatTime(entry.timestamp);
            top.append(method, status, time);
            const endpoint = document.createElement('code'); endpoint.className = 'api-log-endpoint'; endpoint.textContent = entry.endpoint;
            row.append(top, endpoint);
            if (entry.error) { const error = document.createElement('p'); error.className = 'api-log-error'; error.textContent = entry.error; row.appendChild(error); }
            list.appendChild(row);
        });
    }
    function attach(root) {
        if (!root || root === activeRoot) return;
        if (unsubscribe) unsubscribe();
        activeRoot = root;
        const state = root.querySelector('[data-api-log-state]');
        if (state) { state.hidden = false; state.dataset.state = 'loading'; state.textContent = 'Loading API activity…'; }
        if (!window.OrvexaAPIMonitor) {
            window.setTimeout(() => {
                if (!root.isConnected) return;
                if (window.OrvexaAPIMonitor) attach(root);
                else { const status = root.querySelector('[data-api-log-state]'); if (status) { status.dataset.state = 'error'; status.textContent = 'API monitor could not be initialized. Reload OrvexaOS to try again.'; } }
            }, 1200);
            return;
        }
        unsubscribe = window.OrvexaAPIMonitor.subscribe((entries) => render(root, entries));
    }
    document.addEventListener('click', (event) => {
        const root = event.target.closest('[data-settings-root]');
        if (!root) return;
        if (event.target.closest('[data-api-log-refresh]')) {
            if (window.OrvexaAPIMonitor) render(root, window.OrvexaAPIMonitor.getEntries());
            else attach(root);
        }
        if (event.target.closest('[data-api-log-clear]') && window.OrvexaAPIMonitor) window.OrvexaAPIMonitor.clear();
    });
    const observer = new MutationObserver(() => {
        const root = document.querySelector('[data-settings-root] [data-settings-panel="developer"]');
        if (root && !root.hidden) attach(root.closest('[data-settings-root]'));
    });
    function start() {
        observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
        const root = document.querySelector('[data-settings-root]');
        if (root) attach(root);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
})();