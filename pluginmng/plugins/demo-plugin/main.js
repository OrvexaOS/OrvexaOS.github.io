(function () {
    'use strict';

    const plugin = {
        id: 'demo-plugin',
        name: 'Demo Plugin',
        icon: '🧩',
        description: 'Sample plugin loaded into OrvexaOS.',
        version: '1.0.0',
        enabled: true,
        content: `
            <div class="window-content">
                <h2>Demo Plugin</h2>
                <p>This plugin is installed and running correctly in the OS shell.</p>
                <div class="app-grid">
                    <button class="app-tile" type="button"><span>⚙️</span><strong>Settings</strong></button>
                    <button class="app-tile" type="button"><span>📦</span><strong>Plugin</strong></button>
                    <button class="app-tile" type="button"><span>✅</span><strong>Status</strong></button>
                    <button class="app-tile" type="button"><span>💡</span><strong>Info</strong></button>
                </div>
            </div>
        `
    };

    if (window.OrvexaPluginManager) {
        window.OrvexaPluginManager.registerPlugin(plugin);
    }
})();
