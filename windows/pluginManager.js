(function () {
    'use strict';

    const plugins = [];
    const listeners = [];
    const installedStorageKey = 'orvexa-installed-plugins';
    const pluginContent = (id) => window.OrvexaPluginRuntime
        ? window.OrvexaPluginRuntime.createContent(id)
        : `<div class="window-content"><h2>${id}</h2><p>Plugin runtime unavailable.</p></div>`;
    const storeCatalog = [
        { id: 'smart-task', name: 'Smart Task App', icon: '⚡', description: 'Organize tasks, build routines, and track your next actions.', content: pluginContent('smart-task') },
        { id: 'security-shield', name: 'Security Shield', icon: '🛡️', description: 'Review privacy and security settings from one place.', content: pluginContent('security-shield') },
        { id: 'focus-mode', name: 'Focus Mode', icon: '🎯', description: 'Set up distraction-free sessions for focused work.', content: pluginContent('focus-mode') },
        { id: 'terminal-commander', name: 'Terminal Commander', icon: '💻', description: 'A compact workspace for safe Orvexa preview commands.', content: pluginContent('terminal-commander') },
        { id: 'ai-assistant', name: 'AI Assistant', icon: '🤖', description: 'Local writing helpers for summaries, actions, and replies.', content: pluginContent('ai-assistant') },
        { id: 'cloud-sync', name: 'Cloud Sync', icon: '☁️', description: 'Export and restore a local backup of OrvexaOS data.', content: pluginContent('cloud-sync') },
        { id: 'device-manager', name: 'Device Manager', icon: '🧩', description: 'View device details exposed by the browser.', content: pluginContent('device-manager') },
        { id: 'analytics-insight', name: 'Analytics Insight', icon: '📊', description: 'Review locally stored app launch counts.', content: pluginContent('analytics-insight') },
        { id: 'unit-converter', name: 'Unit Converter', icon: '↔️', description: 'Convert common length, mass, and temperature units offline.', content: pluginContent('unit-converter') },
        { id: 'color-studio', name: 'Color Studio', icon: '🎨', description: 'Sample colors, copy hex values, and save a local palette.', content: pluginContent('color-studio') },
        { id: 'password-generator', name: 'Password Generator', icon: '🔐', description: 'Generate strong passwords locally with browser cryptography.', content: pluginContent('password-generator') },
        { id: 'json-studio', name: 'JSON Studio', icon: '🧰', description: 'Validate, format, and minify JSON locally.', content: pluginContent('json-studio') }
    ];

    function notifyPluginListeners() {
        listeners.slice().forEach((listener) => {
            try {
                listener(plugins.slice());
            } catch (error) {
                console.warn('Orvexa plugin listener failed:', error);
            }
        });
    }

    function normalizePlugin(plugin) {
        const id = String(plugin && plugin.id ? plugin.id : plugin && plugin.name ? plugin.name.toLowerCase().replace(/\s+/g, '-') : 'plugin-' + Date.now());
        const normalized = {
            id,
            name: plugin && plugin.name ? plugin.name : 'Plugin',
            icon: plugin && plugin.icon ? plugin.icon : '🧩',
            description: plugin && plugin.description ? plugin.description : 'Installed plugin.',
            version: plugin && plugin.version ? plugin.version : '1.0.0',
            enabled: plugin && typeof plugin.enabled === 'boolean' ? plugin.enabled : true,
            entry: plugin && plugin.entry ? plugin.entry : null,
            content: plugin && plugin.content ? plugin.content : '<div class="window-content"><h2>Plugin</h2><p>Plugin loaded successfully.</p></div>'
        };

        return normalized;
    }

    function registerPlugin(plugin) {
        const normalized = normalizePlugin(plugin);
        const existing = plugins.findIndex((item) => item.id === normalized.id);
        if (existing >= 0) {
            plugins[existing] = normalized;
        } else {
            plugins.push(normalized);
        }

        notifyPluginListeners();
        return normalized;
    }

    function getPlugins() {
        return plugins.slice();
    }

    function getStorePlugins() {
        return storeCatalog.map((plugin) => ({ ...plugin }));
    }

    function saveInstalledPlugins() {
        try {
            const installedIds = plugins
                .filter((plugin) => storeCatalog.some((storePlugin) => storePlugin.id === plugin.id))
                .map((plugin) => plugin.id);
            window.localStorage.setItem(installedStorageKey, JSON.stringify(installedIds));
        } catch (error) {
            console.warn('Unable to save installed Orvexa plugins:', error);
        }
    }

    function installStorePlugin(pluginId) {
        const plugin = storeCatalog.find((item) => item.id === pluginId);
        if (!plugin) {
            throw new Error('Plugin is not available in the Orvexa Store.');
        }

        const installed = registerPlugin(plugin);
        saveInstalledPlugins();
        return installed;
    }

    function onPluginsChanged(callback) {
        if (typeof callback !== 'function') {
            return () => { };
        }

        listeners.push(callback);
        return () => {
            const index = listeners.indexOf(callback);
            if (index >= 0) {
                listeners.splice(index, 1);
            }
        };
    }

    function createPluginApp(plugin) {
        return {
            title: plugin.name,
            width: plugin.width || '520px',
            left: plugin.left || 220,
            top: plugin.top || 100,
            content: plugin.content || `<div class="window-content"><h2>${plugin.name}</h2><p>${plugin.description}</p></div>`
        };
    }

    const pluginManager = {
        registerPlugin,
        getPlugins,
        getStorePlugins,
        createPluginApp,
        normalizePlugin,
        install: registerPlugin,
        installStorePlugin,
        onChanged: onPluginsChanged,
        list: getPlugins
    };

    registerPlugin({
        id: 'demo-plugin',
        name: 'Demo Plugin',
        icon: '🧩',
        description: 'Sample plugin loaded into OrvexaOS.',
        version: '1.0.0',
        enabled: true,
        content: pluginContent('demo-plugin')
    });

    try {
        const installedIds = JSON.parse(window.localStorage.getItem(installedStorageKey) || '[]');
        if (Array.isArray(installedIds)) {
            installedIds.forEach((pluginId) => {
                const plugin = storeCatalog.find((item) => item.id === pluginId);
                if (plugin) registerPlugin(plugin);
            });
        }
    } catch (error) {
        console.warn('Unable to restore installed Orvexa plugins:', error);
    }

    window.OrvexaPluginManager = pluginManager;
})();
