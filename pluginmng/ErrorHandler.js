(function (global) {
    'use strict';

    const DEFAULT_OPTIONS = {
        enabled: true,
        logToConsole: true,
        maxReports: 100,
        prefix: '[ErrorHandler]',
        onReport: null,
        onError: null,
        includeStack: true,
        context: {}
    };

    function safeStringify(value) {
        try {
            if (typeof value === 'string') return value;
            return JSON.stringify(value, null, 2);
        } catch (_error) {
            return String(value);
        }
    }

    function normalizeError(error) {
        if (!error) {
            return {
                name: 'UnknownError',
                message: 'Unknown error',
                stack: ''
            };
        }

        if (error instanceof Error) {
            return {
                name: error.name || 'Error',
                message: error.message || 'An error occurred',
                stack: error.stack || ''
            };
        }

        return {
            name: typeof error === 'object' ? error.name || 'Error' : 'Error',
            message: safeStringify(error),
            stack: ''
        };
    }

    class ErrorHandler {
        constructor(options = {}) {
            this.options = Object.assign({}, DEFAULT_OPTIONS, options);
            this.reports = [];
            this.boundHandlers = null;
            this.isInstalled = false;
            this.context = Object.assign({}, this.options.context || {});
        }

        setContext(key, value) {
            if (typeof key === 'object') {
                this.context = Object.assign(this.context, key);
                return this;
            }

            this.context[key] = value;
            return this;
        }

        getReports() {
            return this.reports.slice();
        }

        report(error, extraContext = {}) {
            if (!this.options.enabled) return null;

            const normalized = normalizeError(error);
            const report = {
                id: this._makeId(),
                timestamp: new Date().toISOString(),
                name: normalized.name,
                message: normalized.message,
                stack: this.options.includeStack ? normalized.stack : '',
                context: Object.assign({}, this.context, extraContext),
                raw: error
            };

            this.reports.push(report);
            if (this.reports.length > this.options.maxReports) {
                this.reports.shift();
            }

            const message = this.options.prefix
                ? `${this.options.prefix} ${normalized.name}: ${normalized.message}`
                : `${normalized.name}: ${normalized.message}`;

            if (this.options.logToConsole && typeof console !== 'undefined') {
                if (console.error) {
                    console.error(message, report);
                } else {
                    console.log(message, report);
                }
            }

            if (typeof this.options.onReport === 'function') {
                this.options.onReport(report);
            }

            if (typeof this.options.onError === 'function') {
                this.options.onError(normalized, report);
            }

            return report;
        }

        install(target = global) {
            if (this.isInstalled || !target) return this;

            this.boundHandlers = {
                onError: (message, source, lineno, colno, error) => {
                    this.report(error || new Error(message), {
                        source,
                        line: lineno,
                        column: colno
                    });
                },
                onUnhandledRejection: (event) => {
                    const reason = event && event.reason ? event.reason : 'Unhandled Promise Rejection';
                    this.report(reason, { type: 'unhandledrejection' });
                }
            };

            if (target.addEventListener) {
                target.addEventListener('error', this.boundHandlers.onError);
                target.addEventListener('unhandledrejection', this.boundHandlers.onUnhandledRejection);
            } else {
                target.onerror = this.boundHandlers.onError;
                target.onunhandledrejection = this.boundHandlers.onUnhandledRejection;
            }

            this.isInstalled = true;
            return this;
        }

        uninstall(target = global) {
            if (!this.isInstalled || !this.boundHandlers || !target) return this;

            if (target.removeEventListener) {
                target.removeEventListener('error', this.boundHandlers.onError);
                target.removeEventListener('unhandledrejection', this.boundHandlers.onUnhandledRejection);
            } else {
                target.onerror = null;
                target.onunhandledrejection = null;
            }

            this.isInstalled = false;
            this.boundHandlers = null;
            return this;
        }

        _makeId() {
            return `err_${Date.now()}_${Math.random().toString(16).slice(2)}`;
        }
    }

    const plugin = {
        name: 'ErrorHandler',
        version: '1.0.0',
        create(options) {
            return new ErrorHandler(options);
        },
        install(options, target) {
            const instance = new ErrorHandler(options);
            instance.install(target);
            return instance;
        }
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = plugin;
        module.exports.ErrorHandler = ErrorHandler;
    }

    if (typeof window !== 'undefined') {
        window.ErrorHandlerPlugin = plugin;
        window.ErrorHandler = ErrorHandler;
    }

    global.ErrorHandlerPlugin = plugin;
    global.ErrorHandler = ErrorHandler;
})(typeof window !== 'undefined' ? window : globalThis);
