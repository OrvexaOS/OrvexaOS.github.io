(function () {
    'use strict';

    const plugins = [];
    const listeners = [];
    const installedStorageKey = 'orvexa-installed-plugins';
    const permissionsStorageKey = 'orvexa-plugin-permissions';
    const pluginContent = (id) => window.OrvexaPluginRuntime
        ? window.OrvexaPluginRuntime.createContent(id)
        : `<div class="window-content"><h2>${id}</h2><p>Plugin runtime unavailable.</p></div>`;
    const utilityPluginContent = (id, name, description) => `
        <div class="window-content" data-plugin-root="${id}" data-utility-app="${id}">
            <h2>${name}</h2>
            <p>${description}</p>
            <label>Workspace
                <textarea data-utility-value rows="8" maxlength="20000" placeholder="Write, plan, or save information here…"></textarea>
            </label>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
                <button type="button" data-plugin-action="utility-save">Save locally</button>
                <button type="button" data-plugin-action="utility-clear">Clear</button>
                <button type="button" data-plugin-action="utility-export">Export .txt</button>
            </div>
            <p data-utility-status role="status" aria-live="polite">Your workspace is stored in this browser only.</p>
        </div>`;

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
        { id: 'json-studio', name: 'JSON Studio', icon: '🧰', description: 'Validate, format, and minify JSON locally.', content: pluginContent('json-studio') },
        { id: 'theme-studio', name: 'Theme Studio', icon: '🎨', description: 'Customize accent colors, transparency, and glow effects.', content: pluginContent('theme-studio') },
        { id: 'desktop-effects', name: 'Desktop Effects', icon: '✨', description: 'Tune glass surfaces, reduced motion, and compact spacing.', content: pluginContent('desktop-effects') },
        { id: 'taskbar-lab', name: 'Taskbar Lab', icon: '▰', description: 'Personalize taskbar placement, dock size, and labels.', content: pluginContent('taskbar-lab') },
        { id: 'widget-board', name: 'Widget Board', icon: '▦', description: 'Choose helpful clock, date, and focus widget preferences.', content: pluginContent('widget-board') },
        { id: 'icon-packs', name: 'Icon Packs', icon: '◈', description: 'Switch between emoji, minimal, and monochrome taskbar icons.', content: pluginContent('icon-packs') }
        ,
        { id: 'unit-planner', name: 'Unit Planner', icon: '🧩', description: 'Plan lessons, study sessions, and personal projects.', content: utilityPluginContent('unit-planner', 'Unit Planner', 'Plan lessons, study sessions, and personal projects.') },
        { id: 'daily-notes', name: 'Daily Notes', icon: '🧩', description: 'Keep a simple dated note workspace.', content: utilityPluginContent('daily-notes', 'Daily Notes', 'Keep a simple dated note workspace.') },
        { id: 'meeting-minutes', name: 'Meeting Minutes', icon: '🧩', description: 'Capture discussion points and decisions.', content: utilityPluginContent('meeting-minutes', 'Meeting Minutes', 'Capture discussion points and decisions.') },
        { id: 'idea-board', name: 'Idea Board', icon: '🧩', description: 'Collect ideas and develop concepts.', content: utilityPluginContent('idea-board', 'Idea Board', 'Collect ideas and develop concepts.') },
        { id: 'goal-tracker', name: 'Goal Tracker', icon: '🧩', description: 'Write goals, milestones, and next steps.', content: utilityPluginContent('goal-tracker', 'Goal Tracker', 'Write goals, milestones, and next steps.') },
        { id: 'habit-planner', name: 'Habit Planner', icon: '🧩', description: 'Plan habits and reflect on your progress.', content: utilityPluginContent('habit-planner', 'Habit Planner', 'Plan habits and reflect on your progress.') },
        { id: 'study-planner', name: 'Study Planner', icon: '🧩', description: 'Organize topics and study sessions.', content: utilityPluginContent('study-planner', 'Study Planner', 'Organize topics and study sessions.') },
        { id: 'flash-note', name: 'Flash Notes', icon: '🧩', description: 'Create compact revision notes.', content: utilityPluginContent('flash-note', 'Flash Notes', 'Create compact revision notes.') },
        { id: 'reading-notes', name: 'Reading Notes', icon: '🧩', description: 'Save book notes, quotes, and reflections.', content: utilityPluginContent('reading-notes', 'Reading Notes', 'Save book notes, quotes, and reflections.') },
        { id: 'writing-desk', name: 'Writing Desk', icon: '🧩', description: 'Draft stories, articles, and other writing.', content: utilityPluginContent('writing-desk', 'Writing Desk', 'Draft stories, articles, and other writing.') },
        { id: 'text-cleaner', name: 'Text Cleaner', icon: '🧩', description: 'Paste text and keep a cleaned-up version.', content: utilityPluginContent('text-cleaner', 'Text Cleaner', 'Paste text and keep a cleaned-up version.') },
        { id: 'word-counter', name: 'Word Counter', icon: '🧩', description: 'Draft text and review it in your own workspace.', content: utilityPluginContent('word-counter', 'Word Counter', 'Draft text and review it in your own workspace.') },
        { id: 'checklist-maker', name: 'Checklist Maker', icon: '🧩', description: 'Build reusable checklists.', content: utilityPluginContent('checklist-maker', 'Checklist Maker', 'Build reusable checklists.') },
        { id: 'project-brief', name: 'Project Brief', icon: '🧩', description: 'Outline project scope, goals, and requirements.', content: utilityPluginContent('project-brief', 'Project Brief', 'Outline project scope, goals, and requirements.') },
        { id: 'kanban-notes', name: 'Kanban Notes', icon: '🧩', description: 'Plan work items and capture board notes.', content: utilityPluginContent('kanban-notes', 'Kanban Notes', 'Plan work items and capture board notes.') },
        { id: 'expense-notes', name: 'Expense Notes', icon: '🧩', description: 'Record spending notes and budget ideas.', content: utilityPluginContent('expense-notes', 'Expense Notes', 'Record spending notes and budget ideas.') },
        { id: 'shopping-list', name: 'Shopping List', icon: '🧩', description: 'Keep a reusable shopping list.', content: utilityPluginContent('shopping-list', 'Shopping List', 'Keep a reusable shopping list.') },
        { id: 'meal-planner', name: 'Meal Planner', icon: '🧩', description: 'Plan meals and collect recipe ideas.', content: utilityPluginContent('meal-planner', 'Meal Planner', 'Plan meals and collect recipe ideas.') },
        { id: 'travel-planner', name: 'Travel Planner', icon: '🧩', description: 'Organize destinations, packing, and itinerary notes.', content: utilityPluginContent('travel-planner', 'Travel Planner', 'Organize destinations, packing, and itinerary notes.') },
        { id: 'packing-list', name: 'Packing List', icon: '🧩', description: 'Prepare packing checklists for trips.', content: utilityPluginContent('packing-list', 'Packing List', 'Prepare packing checklists for trips.') },
        { id: 'fitness-log', name: 'Fitness Log', icon: '🧩', description: 'Record workouts and training notes.', content: utilityPluginContent('fitness-log', 'Fitness Log', 'Record workouts and training notes.') },
        { id: 'water-log', name: 'Water Log', icon: '🧩', description: 'Track hydration notes and daily targets.', content: utilityPluginContent('water-log', 'Water Log', 'Track hydration notes and daily targets.') },
        { id: 'sleep-journal', name: 'Sleep Journal', icon: '🧩', description: 'Record sleep routines and reflections.', content: utilityPluginContent('sleep-journal', 'Sleep Journal', 'Record sleep routines and reflections.') },
        { id: 'mood-journal', name: 'Mood Journal', icon: '🧩', description: 'Write private daily reflections locally.', content: utilityPluginContent('mood-journal', 'Mood Journal', 'Write private daily reflections locally.') },
        { id: 'gratitude-journal', name: 'Gratitude Journal', icon: '🧩', description: 'Keep a personal gratitude journal.', content: utilityPluginContent('gratitude-journal', 'Gratitude Journal', 'Keep a personal gratitude journal.') },
        { id: 'recipe-box', name: 'Recipe Box', icon: '🧩', description: 'Store recipes and cooking notes.', content: utilityPluginContent('recipe-box', 'Recipe Box', 'Store recipes and cooking notes.') },
        { id: 'garden-planner', name: 'Garden Planner', icon: '🧩', description: 'Plan plants, watering, and garden tasks.', content: utilityPluginContent('garden-planner', 'Garden Planner', 'Plan plants, watering, and garden tasks.') },
        { id: 'pet-care', name: 'Pet Care Notes', icon: '🧩', description: 'Keep pet-care notes and reminders.', content: utilityPluginContent('pet-care', 'Pet Care Notes', 'Keep pet-care notes and reminders.') },
        { id: 'home-maintenance', name: 'Home Maintenance', icon: '🧩', description: 'Record household maintenance tasks.', content: utilityPluginContent('home-maintenance', 'Home Maintenance', 'Record household maintenance tasks.') },
        { id: 'event-planner', name: 'Event Planner', icon: '🧩', description: 'Organize event plans and preparation notes.', content: utilityPluginContent('event-planner', 'Event Planner', 'Organize event plans and preparation notes.') },
        { id: 'birthday-planner', name: 'Birthday Planner', icon: '🧩', description: 'Keep birthday ideas and gift notes.', content: utilityPluginContent('birthday-planner', 'Birthday Planner', 'Keep birthday ideas and gift notes.') },
        { id: 'gift-ideas', name: 'Gift Ideas', icon: '🧩', description: 'Collect gift ideas for different occasions.', content: utilityPluginContent('gift-ideas', 'Gift Ideas', 'Collect gift ideas for different occasions.') },
        { id: 'contact-notes', name: 'Contact Notes', icon: '🧩', description: 'Keep non-sensitive contact follow-up notes.', content: utilityPluginContent('contact-notes', 'Contact Notes', 'Keep non-sensitive contact follow-up notes.') },
        { id: 'decision-matrix', name: 'Decision Matrix', icon: '🧩', description: 'Compare options and document decisions.', content: utilityPluginContent('decision-matrix', 'Decision Matrix', 'Compare options and document decisions.') },
        { id: 'pros-cons', name: 'Pros & Cons', icon: '🧩', description: 'Think through choices in a structured note.', content: utilityPluginContent('pros-cons', 'Pros & Cons', 'Think through choices in a structured note.') },
        { id: 'brain-dump', name: 'Brain Dump', icon: '🧩', description: 'Quickly capture thoughts and tasks.', content: utilityPluginContent('brain-dump', 'Brain Dump', 'Quickly capture thoughts and tasks.') },
        { id: 'project-log', name: 'Project Log', icon: '🧩', description: 'Keep a running project progress log.', content: utilityPluginContent('project-log', 'Project Log', 'Keep a running project progress log.') },
        { id: 'bug-notebook', name: 'Bug Notebook', icon: '🧩', description: 'Document bugs, reproduction steps, and fixes.', content: utilityPluginContent('bug-notebook', 'Bug Notebook', 'Document bugs, reproduction steps, and fixes.') },
        { id: 'code-snippets', name: 'Code Snippets', icon: '🧩', description: 'Save reusable code snippets as text.', content: utilityPluginContent('code-snippets', 'Code Snippets', 'Save reusable code snippets as text.') },
        { id: 'html-playground-notes', name: 'HTML Playground Notes', icon: '🧩', description: 'Draft HTML ideas and interface notes.', content: utilityPluginContent('html-playground-notes', 'HTML Playground Notes', 'Draft HTML ideas and interface notes.') },
        { id: 'css-notebook', name: 'CSS Notebook', icon: '🧩', description: 'Save CSS patterns and styling ideas.', content: utilityPluginContent('css-notebook', 'CSS Notebook', 'Save CSS patterns and styling ideas.') },
        { id: 'javascript-notes', name: 'JavaScript Notes', icon: '🧩', description: 'Collect JavaScript examples and reminders.', content: utilityPluginContent('javascript-notes', 'JavaScript Notes', 'Collect JavaScript examples and reminders.') },
        { id: 'json-notes', name: 'JSON Notes', icon: '🧩', description: 'Keep JSON examples and schema notes.', content: utilityPluginContent('json-notes', 'JSON Notes', 'Keep JSON examples and schema notes.') },
        { id: 'regex-notes', name: 'Regex Notes', icon: '🧩', description: 'Collect regular-expression examples.', content: utilityPluginContent('regex-notes', 'Regex Notes', 'Collect regular-expression examples.') },
        { id: 'language-vocab', name: 'Language Vocabulary', icon: '🧩', description: 'Build a personal vocabulary list.', content: utilityPluginContent('language-vocab', 'Language Vocabulary', 'Build a personal vocabulary list.') },
        { id: 'translation-notes', name: 'Translation Notes', icon: '🧩', description: 'Collect translation drafts and terminology.', content: utilityPluginContent('translation-notes', 'Translation Notes', 'Collect translation drafts and terminology.') },
        { id: 'presentation-planner', name: 'Presentation Planner', icon: '🧩', description: 'Outline slides and presentation talking points.', content: utilityPluginContent('presentation-planner', 'Presentation Planner', 'Outline slides and presentation talking points.') },
        { id: 'resume-notes', name: 'Resume Notes', icon: '🧩', description: 'Draft resume content and experience notes.', content: utilityPluginContent('resume-notes', 'Resume Notes', 'Draft resume content and experience notes.') },
        { id: 'job-application', name: 'Job Application Tracker', icon: '🧩', description: 'Keep application notes and next steps.', content: utilityPluginContent('job-application', 'Job Application Tracker', 'Keep application notes and next steps.') },
        { id: 'decision-log', name: 'Decision Log', icon: '🧩', description: 'Record decisions, context, and outcomes.', content: utilityPluginContent('decision-log', 'Decision Log', 'Record decisions, context, and outcomes.') }
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

    function uninstallStorePlugin(pluginId) {
        const catalogPlugin = storeCatalog.find((item) => item.id === pluginId);
        if (!catalogPlugin) throw new Error('Only Store apps can be uninstalled here.');
        const index = plugins.findIndex((item) => item.id === pluginId);
        if (index >= 0) plugins.splice(index, 1);
        saveInstalledPlugins();
        try {
            const permissions = JSON.parse(window.localStorage.getItem(permissionsStorageKey) || '{}');
            delete permissions[pluginId];
            window.localStorage.setItem(permissionsStorageKey, JSON.stringify(permissions));
        } catch (error) { console.warn('Unable to clean app permissions:', error); }
        notifyPluginListeners();
        return catalogPlugin;
    }

    function getPermissions(pluginId) {
        try {
            const all = JSON.parse(window.localStorage.getItem(permissionsStorageKey) || '{}');
            const saved = all && all[pluginId] && typeof all[pluginId] === 'object' ? all[pluginId] : {};
            return { storage: saved.storage !== false, notifications: saved.notifications === true, network: saved.network === true, deviceInfo: saved.deviceInfo === true };
        } catch (error) { return { storage: true, notifications: false, network: false, deviceInfo: false }; }
    }

    function setPermission(pluginId, permission, granted) {
        const allowed = ['storage', 'notifications', 'network', 'deviceInfo'];
        if (!storeCatalog.some((item) => item.id === pluginId)) throw new Error('Unknown Store app.');
        if (!allowed.includes(permission)) throw new Error('Unknown permission.');
        let all = {};
        try { all = JSON.parse(window.localStorage.getItem(permissionsStorageKey) || '{}') || {}; } catch (error) { all = {}; }
        all[pluginId] = Object.assign({}, getPermissions(pluginId), { [permission]: Boolean(granted) });
        window.localStorage.setItem(permissionsStorageKey, JSON.stringify(all));
        notifyPluginListeners();
        return all[pluginId];
    }

    function hasPermission(pluginId, permission) { return getPermissions(pluginId)[permission] === true; }
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
        uninstallStorePlugin,
        getPermissions,
        setPermission,
        hasPermission,
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
