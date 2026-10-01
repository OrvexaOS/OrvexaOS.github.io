(function (root) {
    'use strict';

    const DEFAULT_PLUGIN = Object.freeze({
        id: '',
        name: '',
        version: '1.0.0',
        enabled: true,
        entry: null,
        metadata: {},
        api: {}
    });

    function isObject(value) {
        return value !== null && typeof value === 'object' && !Array.isArray(value);
    }

    function normalizePlugin(plugin, fallback = {}) {
        if (!isObject(plugin)) {
            throw new TypeError('Plugin definition must be an object.');
        }

        const merged = {
            ...DEFAULT_PLUGIN,
            ...fallback,
            ...plugin,
            metadata: {
                ...(fallback.metadata || {}),
                ...(plugin.metadata || {})
            },
            api: {
                ...(fallback.api || {}),
                ...(plugin.api || {})
            }
        };

        merged.id = (merged.id || merged.name || '').trim() || `plugin-${Date.now()}`;
        merged.name = (merged.name || merged.id || 'Unnamed Plugin').trim();
        merged.version = merged.version || '1.0.0';
        merged.entry = merged.entry || merged.main || null;

        return merged;
    }

    function validatePlugin(plugin) {
        const normalized = normalizePlugin(plugin);

        if (!normalized.id) {
            throw new Error('Plugin id is required.');
        }

        if (!normalized.entry) {
            throw new Error(`Plugin "${normalized.id}" is missing an entry point.`);
        }

        return normalized;
    }

    function resolveEntry(plugin, requireFn) {
        if (typeof plugin.entry === 'function') {
            return plugin.entry;
        }

        if (typeof plugin.entry === 'string' && requireFn) {
            try {
                const loaded = requireFn(plugin.entry);
                if (typeof loaded === 'function') {
                    return loaded;
                }

                if (loaded && typeof loaded.default === 'function') {
                    return loaded.default;
                }
            } catch (error) {
                throw new Error(`Unable to resolve plugin entry for "${plugin.id}": ${error.message}`);
            }
        }

        return null;
    }

    function createContext(plugin, overrides = {}) {
        const normalized = normalizePlugin(plugin, overrides);

        return {
            plugin: normalized,
            metadata: normalized.metadata,
            api: normalized.api,
            state: {
                enabled: normalized.enabled,
                loaded: false,
                started: false,
                error: null
            },
            createdAt: new Date().toISOString()
        };
    }

    function registerPlugin(registry, plugin, runtime = {}) {
        const normalized = validatePlugin(plugin);
        const target = registry || {};
        const plugins = Array.isArray(target.plugins)
            ? target.plugins
            : Array.isArray(target.list)
                ? target.list
                : Array.isArray(target)
                    ? target
                    : [];

        const existingIndex = plugins.findIndex((item) => item && item.id === normalized.id);
        if (existingIndex > -1) {
            plugins[existingIndex] = normalized;
        } else {
            plugins.push(normalized);
        }

        if (target.plugins) {
            target.plugins = plugins;
        } else if (target.list) {
            target.list = plugins;
        } else if (Array.isArray(target)) {
            target.splice(0, target.length, ...plugins);
        } else {
            target.plugins = plugins;
        }

        const context = createContext(normalized, runtime.context || {});
        context.state.loaded = true;

        if (runtime.onRegister) {
            runtime.onRegister(context, normalized);
        }

        return { registry: target, plugin: normalized, context };
    }

    function executePlugin(plugin, runtime = {}, contextOverrides = {}) {
        const normalized = validatePlugin(plugin);
        const requireFn = runtime.require || (typeof require === 'function' ? require : null);
        const entry = resolveEntry(normalized, requireFn);

        if (typeof entry !== 'function') {
            throw new Error(`Plugin "${normalized.id}" does not provide a valid executable entry function.`);
        }

        const executionContext = {
            plugin: normalized,
            metadata: normalized.metadata,
            api: {
                ...(normalized.api || {}),
                ...(runtime.api || {})
            },
            env: runtime.env || {},
            logger: runtime.logger || console,
            ...contextOverrides
        };

        return entry(executionContext);
    }

    function getPlugin(registry, pluginId) {
        const target = registry || {};
        const plugins = Array.isArray(target.plugins)
            ? target.plugins
            : Array.isArray(target.list)
                ? target.list
                : Array.isArray(target)
                    ? target
                    : [];

        return plugins.find((item) => item && item.id === pluginId) || null;
    }

    const pluginHelper = {
        DEFAULT_PLUGIN,
        normalizePlugin,
        validatePlugin,
        createContext,
        registerPlugin,
        executePlugin,
        getPlugin,
        resolveEntry
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = pluginHelper;
    }

    root.pluginHelper = pluginHelper;
})(typeof globalThis !== 'undefined' ? globalThis : this);
