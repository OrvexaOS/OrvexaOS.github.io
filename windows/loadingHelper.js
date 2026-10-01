(function (global) {
    const DEFAULT_ID = 'orvexa-loading-helper';

    function getOverlay(id = DEFAULT_ID) {
        return document.getElementById(id);
    }

    function createOverlay(id = DEFAULT_ID, options = {}) {
        const overlay = document.createElement('div');
        overlay.id = id;
        overlay.className = 'orvexa-loading-overlay';

        const style = document.createElement('style');
        style.textContent = `
      .orvexa-loading-overlay {
        position: fixed;
        inset: 0;
        z-index: 999999;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(10, 12, 18, 0.62);
        backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px);
        opacity: 0;
        visibility: hidden;
        pointer-events: none;
        transition: opacity 0.18s ease, visibility 0.18s ease;
      }

      .orvexa-loading-overlay.visible {
        opacity: 1;
        visibility: visible;
        pointer-events: all;
      }

      .orvexa-loading-panel {
        min-width: 240px;
        max-width: min(420px, calc(100vw - 32px));
        padding: 22px 20px;
        border-radius: 16px;
        background: rgba(22, 25, 34, 0.9);
        border: 1px solid rgba(255, 255, 255, 0.08);
        box-shadow: 0 22px 55px rgba(0, 0, 0, 0.45);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
        text-align: center;
        color: #f3f6ff;
        font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
      }

      .orvexa-loading-spinner {
        width: 42px;
        height: 42px;
        border-radius: 50%;
        border: 4px solid rgba(255, 255, 255, 0.18);
        border-top-color: #7cc4ff;
        animation: orvexa-spin 0.9s linear infinite;
      }

      .orvexa-loading-title {
        margin: 0;
        font-size: 14px;
        font-weight: 600;
        letter-spacing: 0.02em;
        color: #edf5ff;
      }

      .orvexa-loading-subtitle {
        margin: 0;
        font-size: 12px;
        color: rgba(237, 245, 255, 0.72);
      }

      .orvexa-loading-progress {
        width: 100%;
        height: 8px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.09);
        overflow: hidden;
        display: none;
      }

      .orvexa-loading-progress-bar {
        height: 100%;
        width: 0%;
        background: linear-gradient(90deg, #6ec5ff 0%, #8cf0d8 100%);
        border-radius: inherit;
        transition: width 0.2s ease;
      }

      @keyframes orvexa-spin {
        to {
          transform: rotate(360deg);
        }
      }
    `;

        const existingStyle = document.head.querySelector('style[data-orvexa-loading-helper]');
        if (!existingStyle) {
            style.setAttribute('data-orvexa-loading-helper', 'true');
            document.head.appendChild(style);
        }

        const panel = document.createElement('div');
        panel.className = 'orvexa-loading-panel';

        const spinner = document.createElement('div');
        spinner.className = 'orvexa-loading-spinner';

        const title = document.createElement('p');
        title.className = 'orvexa-loading-title';
        title.textContent = options.message || 'Loading...';

        const subtitle = document.createElement('p');
        subtitle.className = 'orvexa-loading-subtitle';
        subtitle.textContent = options.subtitle || '';

        const progressWrap = document.createElement('div');
        progressWrap.className = 'orvexa-loading-progress';

        const progressBar = document.createElement('div');
        progressBar.className = 'orvexa-loading-progress-bar';

        progressWrap.appendChild(progressBar);
        panel.appendChild(spinner);
        panel.appendChild(title);
        panel.appendChild(subtitle);
        panel.appendChild(progressWrap);
        overlay.appendChild(panel);

        overlay._titleEl = title;
        overlay._subtitleEl = subtitle;
        overlay._progressWrap = progressWrap;
        overlay._progressBar = progressBar;
        overlay._spinner = spinner;

        document.body.appendChild(overlay);
        return overlay;
    }

    function ensureVisibleOverlay(id = DEFAULT_ID, options = {}) {
        let overlay = getOverlay(id);
        if (!overlay) {
            overlay = createOverlay(id, options);
        }

        if (options.message) {
            overlay._titleEl.textContent = options.message;
        }
        if (options.subtitle) {
            overlay._subtitleEl.textContent = options.subtitle;
        }

        if (options.showProgress) {
            overlay._progressWrap.style.display = 'block';
        } else {
            overlay._progressWrap.style.display = 'none';
        }

        return overlay;
    }

    function showLoading(message = 'Loading...', options = {}) {
        const finalOptions = { ...options, message };
        const overlay = ensureVisibleOverlay(options.id || DEFAULT_ID, finalOptions);
        overlay.classList.add('visible');

        if (typeof options.onShow === 'function') {
            options.onShow(overlay);
        }

        return overlay;
    }

    function hideLoading(id = DEFAULT_ID) {
        const overlay = getOverlay(id);
        if (!overlay) return false;
        overlay.classList.remove('visible');
        return true;
    }

    function setLoadingText(message = 'Loading...', id = DEFAULT_ID) {
        const overlay = getOverlay(id);
        if (!overlay) return false;
        overlay._titleEl.textContent = message;
        return true;
    }

    function setLoadingSubtitle(subtitle = '', id = DEFAULT_ID) {
        const overlay = getOverlay(id);
        if (!overlay) return false;
        overlay._subtitleEl.textContent = subtitle;
        return true;
    }

    function setLoadingProgress(value = 0, id = DEFAULT_ID) {
        const overlay = getOverlay(id);
        if (!overlay) return false;
        const safeValue = Math.max(0, Math.min(100, Number(value) || 0));
        overlay._progressWrap.style.display = 'block';
        overlay._progressBar.style.width = `${safeValue}%`;
        return true;
    }

    function withLoading(task, options = {}) {
        const message = options.message || 'Loading...';
        const id = options.id || DEFAULT_ID;

        showLoading(message, options);

        const runTask = async () => {
            try {
                const result = typeof task === 'function' ? await task() : await task;
                return result;
            } finally {
                hideLoading(id);
            }
        };

        return runTask();
    }

    function createLoadingHelper(prefix = 'orvexa') {
        const helperId = `${prefix}-loading-helper`;

        return {
            showLoading: (message = 'Loading...', opts = {}) => showLoading(message, { ...opts, id: opts.id || helperId }),
            hideLoading: () => hideLoading(helperId),
            setLoadingText: (message = 'Loading...') => setLoadingText(message, helperId),
            setLoadingSubtitle: (subtitle = '') => setLoadingSubtitle(subtitle, helperId),
            setLoadingProgress: (value = 0) => setLoadingProgress(value, helperId),
            withLoading: (task, opts = {}) => withLoading(task, { ...opts, id: opts.id || helperId }),
        };
    }

    const loadingHelper = {
        showLoading,
        hideLoading,
        setLoadingText,
        setLoadingSubtitle,
        setLoadingProgress,
        withLoading,
        createLoadingHelper,
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = loadingHelper;
    }

    global.loadingHelper = loadingHelper;
    global.OrvexaLoadingHelper = loadingHelper;
})(typeof window !== 'undefined' ? window : globalThis);
