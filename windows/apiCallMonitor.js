/* OrvexaOS API Call Monitor — metadata only; never records headers or bodies. */
(function (root) {
    'use strict';
    if (root.OrvexaAPIMonitor) return;
    const MAX_ENTRIES = 250;
    const entries = [];
    const listeners = new Set();
    let sequence = 0;
    const sensitive = /(?:token|secret|password|passwd|authorization|api[-_]?key|session|credential|signature)/i;
    function safeEndpoint(input) {
        try {
            const url = new URL(String(input || ''), location.href);
            let path = url.pathname.replace(/\/+/g, '/').replace(/\/(?:[a-f0-9]{24,}|[A-Za-z0-9_-]{32,})(?=\/|$)/gi, '/[redacted]');
            const params = [];
            url.searchParams.forEach((value, key) => { params.push(sensitive.test(key) ? encodeURIComponent(key) + '=[redacted]' : encodeURIComponent(key) + '=[value]'); });
            return path + (params.length ? '?' + params.join('&') : '');
        } catch (_) { return '[unavailable endpoint]'; }
    }
    function publish(entry) {
        entries.unshift(Object.freeze(entry));
        if (entries.length > MAX_ENTRIES) entries.length = MAX_ENTRIES;
        listeners.forEach((listener) => { try { listener(entries.slice()); } catch (_) {} });
        try { root.dispatchEvent(new CustomEvent('orvexa:api-log-updated', { detail: { id: entry.id } })); } catch (_) {}
    }
    function begin(method, endpoint) {
        return { id: ++sequence, method: String(method || 'GET').toUpperCase().slice(0, 12), endpoint: safeEndpoint(endpoint), timestamp: new Date().toISOString(), status: 'pending', statusCode: null, error: '' };
    }
    function finish(entry, statusCode, error) {
        const updated = Object.assign({}, entry, { status: error ? 'error' : statusCode >= 400 ? 'error' : 'success', statusCode: Number.isFinite(Number(statusCode)) ? Number(statusCode) : null, error: error ? String(error).replace(/[\r\n\t]+/g, ' ').slice(0, 240) : '' });
        const index = entries.findIndex((item) => item.id === entry.id);
        if (index >= 0) entries.splice(index, 1);
        publish(updated);
    }
    const originalFetch = typeof root.fetch === 'function' ? root.fetch : null;
    if (originalFetch) {
        root.fetch = function (input, init) {
            let url = typeof input === 'string' || input instanceof URL ? input : input && input.url;
            let method = (init && init.method) || (input && input.method) || 'GET';
            const entry = begin(method, url);
            publish(entry);
            let request;
            try { request = originalFetch.apply(this, arguments); }
            catch (error) { finish(entry, null, error && error.message || 'Network request failed'); throw error; }
            return Promise.resolve(request).then((response) => {
                finish(entry, response.status, response.ok ? '' : 'HTTP ' + response.status + (response.statusText ? ' ' + response.statusText : ''));
                return response;
            }, (error) => { finish(entry, null, error && error.message || 'Network request failed'); throw error; });
        };
    }
    if (root.XMLHttpRequest && root.XMLHttpRequest.prototype) {
        const proto = root.XMLHttpRequest.prototype;
        const originalOpen = proto.open;
        const originalSend = proto.send;
        proto.open = function (method, url) {
            this.__orvexaRequest = { method: method, url: url };
            return originalOpen.apply(this, arguments);
        };
        proto.send = function () {
            const request = this.__orvexaRequest || {};
            const entry = begin(request.method, request.url);
            publish(entry);
            let settled = false;
            const complete = (error) => {
                if (settled) return;
                settled = true;
                let status = null;
                try { status = this.status; } catch (_) {}
                finish(entry, status, error || (status === 0 ? 'Network request failed or request was blocked' : status >= 400 ? 'HTTP ' + status : ''));
            };
            this.addEventListener('loadend', () => complete(''), { once: true });
            this.addEventListener('error', () => complete('Network request failed'), { once: true });
            this.addEventListener('timeout', () => complete('Request timed out'), { once: true });
            this.addEventListener('abort', () => complete('Request aborted'), { once: true });
            try { return originalSend.apply(this, arguments); }
            catch (error) { complete(error && error.message || 'Request failed'); throw error; }
        };
    }
    root.OrvexaAPIMonitor = Object.freeze({
        getEntries: () => entries.slice(),
        subscribe: (listener) => { if (typeof listener !== 'function') return () => {}; listeners.add(listener); listener(entries.slice()); return () => listeners.delete(listener); },
        clear: () => { entries.length = 0; listeners.forEach((listener) => { try { listener([]); } catch (_) {} }); },
        supported: Boolean(originalFetch || (root.XMLHttpRequest && root.XMLHttpRequest.prototype))
    });
})(window);