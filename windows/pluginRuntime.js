(function () {
    'use strict';

    const storagePrefix = 'orvexa-plugin-data:';
    const timers = new Map();

    function readData(key, fallback) {
        try {
            const value = window.localStorage.getItem(storagePrefix + key);
            return value ? JSON.parse(value) : fallback;
        } catch (error) {
            return fallback;
        }
    }

    function writeData(key, value) {
        try {
            window.localStorage.setItem(storagePrefix + key, JSON.stringify(value));
            return true;
        } catch (error) {
            return false;
        }
    }

    function escapeHtml(value) {
        return String(value).replace(/[&<>"']/g, (character) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        })[character]);
    }

    function createContent(pluginId) {
        const templates = {
            'smart-task': `
                <div class="window-content" data-plugin-root="smart-task">
                    <h2>Smart Task App</h2>
                    <p>Add tasks, mark them complete, and keep your list between sessions.</p>
                    <form data-plugin-form="smart-task">
                        <label>New task <input name="task" type="text" maxlength="160" required placeholder="What needs doing?"></label>
                        <button type="submit">Add task</button>
                    </form>
                    <p data-task-summary aria-live="polite"></p>
                    <ul data-task-list></ul>
                </div>`,
            'security-shield': `
                <div class="window-content" data-plugin-root="security-shield">
                    <h2>Security Shield</h2>
                    <p>Check browser permission states. Checks do not request access.</p>
                    <button type="button" data-plugin-action="refresh-permissions">Check permissions</button>
                    <p data-security-status aria-live="polite">Checking browser permissions...</p>
                    <ul data-permission-list></ul>
                </div>`,
            'focus-mode': `
                <div class="window-content" data-plugin-root="focus-mode">
                    <h2>Focus Mode</h2>
                    <p>A local focus timer. It does not silence browser or system notifications.</p>
                    <label>Duration
                        <select data-focus-duration>
                            <option value="5">5 minutes</option>
                            <option value="15">15 minutes</option>
                            <option value="25" selected>25 minutes</option>
                            <option value="50">50 minutes</option>
                        </select>
                    </label>
                    <p data-focus-clock role="timer" aria-live="polite">25:00</p>
                    <button type="button" data-plugin-action="focus-start">Start</button>
                    <button type="button" data-plugin-action="focus-reset">Reset</button>
                    <p data-focus-status aria-live="polite">Ready when you are.</p>
                </div>`,
            'terminal-commander': `
                <div class="window-content" data-plugin-root="terminal-commander">
                    <h2>Terminal Commander</h2>
                    <p>Run built-in Orvexa preview commands. This does not execute system commands.</p>
                    <pre data-terminal-output aria-live="polite">OrvexaOS preview terminal. Type help to see commands.</pre>
                    <form data-plugin-form="terminal-commander">
                        <label>Command <input name="command" type="text" autocomplete="off" required placeholder="help"></label>
                        <button type="submit">Run</button>
                    </form>
                </div>`,
            'ai-assistant': `
                <div class="window-content" data-plugin-root="ai-assistant">
                    <h2>AI Assistant</h2>
                    <p>Local writing helpers run in your browser; text is not sent to an AI service.</p>
                    <form data-plugin-form="ai-assistant">
                        <label>Text <textarea name="text" rows="5" required placeholder="Paste a note or draft here"></textarea></label>
                        <label>Action
                            <select name="action">
                                <option value="summarize">Summarize</option>
                                <option value="actions">Extract action sentences</option>
                                <option value="reply">Draft a reply</option>
                            </select>
                        </label>
                        <button type="submit">Generate</button>
                    </form>
                    <div data-assistant-result aria-live="polite"></div>
                </div>`,
            'cloud-sync': `
                <div class="window-content" data-plugin-root="cloud-sync">
                    <h2>Cloud Sync</h2>
                    <p>Create or restore a local backup of OrvexaOS data. No cloud account is required.</p>
                    <button type="button" data-plugin-action="backup-export">Download backup</button>
                    <label>Restore backup <input type="file" accept="application/json,.json" data-backup-file></label>
                    <p data-backup-status aria-live="polite">Local backup ready.</p>
                </div>`,
            'device-manager': `
                <div class="window-content" data-plugin-root="device-manager">
                    <h2>Device Manager</h2>
                    <p>Inspect information exposed by this browser. Device labels may require prior permission.</p>
                    <button type="button" data-plugin-action="refresh-devices">Refresh details</button>
                    <ul data-device-list></ul>
                    <p data-device-status aria-live="polite"></p>
                </div>`,
            'analytics-insight': `
                <div class="window-content" data-plugin-root="analytics-insight">
                    <h2>Analytics Insight</h2>
                    <p>App launches are counted locally on this device.</p>
                    <p>Total launches: <strong data-analytics-total>0</strong></p>
                    <ul data-analytics-list></ul>
                    <button type="button" data-plugin-action="reset-analytics">Reset launch history</button>
                    <p data-analytics-status aria-live="polite"></p>
                </div>`,
            'unit-converter': `
                <div class="window-content" data-plugin-root="unit-converter">
                    <h2>Unit Converter</h2>
                    <p>Convert values locally between common units.</p>
                    <label>Category
                        <select data-converter-category>
                            <option value="length">Length</option>
                            <option value="mass">Mass</option>
                            <option value="temperature">Temperature</option>
                        </select>
                    </label>
                    <label>Value <input type="number" data-converter-control data-converter-value value="1" step="any"></label>
                    <div class="converter-pair">
                        <label>From <select data-converter-control data-converter-from></select></label>
                        <span aria-hidden="true">to</span>
                        <label>To <select data-converter-control data-converter-to></select></label>
                    </div>
                    <p class="converter-result" data-converter-result aria-live="polite"></p>
                </div>`,
            'color-studio': `
                <div class="window-content" data-plugin-root="color-studio">
                    <h2>Color Studio</h2>
                    <p>Pick a color, copy its hex value, or save it to your local palette.</p>
                    <div class="color-studio-controls">
                        <input type="color" data-color-picker value="#6f9f79" aria-label="Choose a color">
                        <label>Hex value <input type="text" data-color-hex value="#6F9F79" maxlength="7" spellcheck="false"></label>
                        <div class="color-preview" data-color-preview aria-label="Color preview"></div>
                    </div>
                    <p><strong data-color-value>#6F9F79</strong></p>
                    <button type="button" data-plugin-action="color-copy">Copy hex</button>
                    <button type="button" data-plugin-action="color-save">Save swatch</button>
                    <p data-color-status aria-live="polite"></p>
                    <h3>Saved palette</h3>
                    <div class="saved-colors" data-color-list></div>
                </div>`,
            'password-generator': `
                <div class="window-content" data-plugin-root="password-generator">
                    <h2>Password Generator</h2>
                    <p>Passwords are generated on this device and are never saved by this tool.</p>
                    <label>Length <output data-password-length>20</output><input type="range" min="8" max="64" value="20" data-password-size></label>
                    <fieldset class="password-options">
                        <legend>Include characters</legend>
                        <label><input type="checkbox" data-password-set="lower" checked> Lowercase</label>
                        <label><input type="checkbox" data-password-set="upper" checked> Uppercase</label>
                        <label><input type="checkbox" data-password-set="numbers" checked> Numbers</label>
                        <label><input type="checkbox" data-password-set="symbols"> Symbols</label>
                    </fieldset>
                    <div class="password-output"><input type="text" data-password-output readonly aria-label="Generated password"><button type="button" data-plugin-action="password-copy">Copy</button></div>
                    <button type="button" data-plugin-action="password-generate">Generate password</button>
                    <p data-password-status aria-live="polite"></p>
                </div>`,
            'json-studio': `
                <div class="window-content" data-plugin-root="json-studio">
                    <h2>JSON Studio</h2>
                    <p>Validate, format, or minify JSON in your browser. Input stays local.</p>
                    <label>JSON input <textarea data-json-input rows="9" spellcheck="false" placeholder="{\n  &quot;name&quot;: &quot;Orvexa&quot;\n}"></textarea></label>
                    <div class="json-actions">
                        <button type="button" data-plugin-action="json-format">Format</button>
                        <button type="button" data-plugin-action="json-minify">Minify</button>
                        <button type="button" data-plugin-action="json-validate">Validate</button>
                    </div>
                    <p data-json-status aria-live="polite">Ready.</p>
                    <pre data-json-result aria-label="JSON result"></pre>
                </div>`,
            'demo-plugin': `
                <div class="window-content" data-plugin-root="demo-plugin">
                    <h2>Demo Plugin</h2>
                    <p>Plugin runtime status: <strong data-demo-status>Ready</strong></p>
                    <p>Registered plugins: <strong data-demo-count>0</strong></p>
                    <button type="button" data-plugin-action="refresh-demo">Refresh status</button>
                </div>`
        };

        return templates[pluginId] || `<div class="window-content"><h2>Plugin</h2><p>No runtime is available for this plugin.</p></div>`;
    }

    function renderTasks(root) {
        const list = root.querySelector('[data-task-list]');
        const summary = root.querySelector('[data-task-summary]');
        if (!list) return;

        const tasks = readData('smart-task', []);
        list.replaceChildren();
        tasks.forEach((task) => {
            const item = document.createElement('li');
            const label = document.createElement('label');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = task.done;
            checkbox.dataset.taskToggle = task.id;
            const text = document.createElement('span');
            text.textContent = task.text;
            text.style.textDecoration = task.done ? 'line-through' : 'none';
            const remove = document.createElement('button');
            remove.type = 'button';
            remove.textContent = 'Remove';
            remove.dataset.taskRemove = task.id;
            label.append(checkbox, text);
            item.append(label, remove);
            list.appendChild(item);
        });

        if (summary) {
            const remaining = tasks.filter((task) => !task.done).length;
            summary.textContent = `${remaining} remaining · ${tasks.length} total`;
        }
    }

    async function renderPermissions(root) {
        const list = root.querySelector('[data-permission-list]');
        const status = root.querySelector('[data-security-status]');
        if (!list || !status) return;
        status.textContent = 'Checking browser permissions...';
        list.replaceChildren();
        const permissions = ['geolocation', 'camera', 'microphone', 'notifications'];
        const rows = await Promise.all(permissions.map(async (name) => {
            try {
                if (!navigator.permissions || !navigator.permissions.query) return [name, 'Not supported'];
                const permission = await navigator.permissions.query({ name });
                return [name, permission.state];
            } catch (error) {
                return [name, 'Not available in this browser'];
            }
        }));
        rows.forEach(([name, value]) => {
            const item = document.createElement('li');
            item.textContent = `${name}: ${value}`;
            list.appendChild(item);
        });
        status.textContent = 'Permission states read. No access was requested.';
    }

    function updateFocusClock(root, seconds) {
        const clock = root.querySelector('[data-focus-clock]');
        if (clock) {
            clock.textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
        }
    }

    async function renderDevices(root) {
        const list = root.querySelector('[data-device-list]');
        const status = root.querySelector('[data-device-status]');
        if (!list || !status) return;
        list.replaceChildren();
        const addRow = (label, value) => {
            const item = document.createElement('li');
            item.textContent = `${label}: ${value}`;
            list.appendChild(item);
        };

        addRow('Screen', `${window.screen.width} × ${window.screen.height}`);
        addRow('Viewport', `${window.innerWidth} × ${window.innerHeight}`);
        addRow('Platform', navigator.userAgentData?.platform || navigator.platform || 'Unavailable');
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        addRow('Network type', connection?.effectiveType || 'Unavailable');

        if (navigator.getBattery) {
            try {
                const battery = await navigator.getBattery();
                addRow('Battery', `${Math.round(battery.level * 100)}%${battery.charging ? ' · charging' : ''}`);
            } catch (error) {
                addRow('Battery', 'Unavailable');
            }
        } else {
            addRow('Battery', 'Not supported');
        }

        if (navigator.mediaDevices?.enumerateDevices) {
            try {
                const devices = await navigator.mediaDevices.enumerateDevices();
                const counts = devices.reduce((result, device) => {
                    result[device.kind] = (result[device.kind] || 0) + 1;
                    return result;
                }, {});
                Object.entries(counts).forEach(([kind, count]) => addRow(kind, `${count} detected`));
            } catch (error) {
                addRow('Media devices', 'Unavailable');
            }
        }
        status.textContent = 'Details provided by the browser; hardware access is limited by browser permissions.';
    }

    function renderAnalytics(root) {
        const totalNode = root.querySelector('[data-analytics-total]');
        const list = root.querySelector('[data-analytics-list]');
        if (!totalNode || !list) return;
        const counts = readData('analytics', {});
        const entries = Object.entries(counts).sort((left, right) => right[1] - left[1]);
        totalNode.textContent = String(entries.reduce((total, [, count]) => total + count, 0));
        list.replaceChildren();
        entries.forEach(([appId, count]) => {
            const item = document.createElement('li');
            item.textContent = `${appId}: ${count}`;
            list.appendChild(item);
        });
    }

    function converterUnits(category) {
        const units = {
            length: [
                { value: 'm', label: 'Meters', factor: 1 },
                { value: 'km', label: 'Kilometers', factor: 1000 },
                { value: 'cm', label: 'Centimeters', factor: 0.01 },
                { value: 'mi', label: 'Miles', factor: 1609.344 },
                { value: 'ft', label: 'Feet', factor: 0.3048 }
            ],
            mass: [
                { value: 'kg', label: 'Kilograms', factor: 1 },
                { value: 'g', label: 'Grams', factor: 0.001 },
                { value: 'lb', label: 'Pounds', factor: 0.45359237 },
                { value: 'oz', label: 'Ounces', factor: 0.028349523125 }
            ],
            temperature: [
                { value: 'c', label: 'Celsius' },
                { value: 'f', label: 'Fahrenheit' },
                { value: 'k', label: 'Kelvin' }
            ]
        };
        return units[category] || units.length;
    }

    function renderConverterUnits(root) {
        const category = root.querySelector('[data-converter-category]').value;
        const units = converterUnits(category);
        ['[data-converter-from]', '[data-converter-to]'].forEach((selector) => {
            const select = root.querySelector(selector);
            const currentValue = select.value;
            select.replaceChildren();
            units.forEach((unit) => {
                const option = document.createElement('option');
                option.value = unit.value;
                option.textContent = unit.label;
                select.appendChild(option);
            });
            select.value = units.some((unit) => unit.value === currentValue) ? currentValue : units[0].value;
        });
        if (root.querySelector('[data-converter-from]').value === root.querySelector('[data-converter-to]').value && units.length > 1) {
            root.querySelector('[data-converter-to]').value = units[1].value;
        }
        calculateConversion(root);
    }

    function calculateConversion(root) {
        const category = root.querySelector('[data-converter-category]').value;
        const value = Number(root.querySelector('[data-converter-value]').value);
        const from = root.querySelector('[data-converter-from]').value;
        const to = root.querySelector('[data-converter-to]').value;
        const result = root.querySelector('[data-converter-result]');
        if (!Number.isFinite(value)) {
            result.textContent = 'Enter a number to convert.';
            return;
        }

        let converted;
        if (category === 'temperature') {
            const celsius = from === 'f' ? (value - 32) * (5 / 9) : from === 'k' ? value - 273.15 : value;
            converted = to === 'f' ? celsius * (9 / 5) + 32 : to === 'k' ? celsius + 273.15 : celsius;
        } else {
            const units = converterUnits(category);
            const source = units.find((unit) => unit.value === from);
            const target = units.find((unit) => unit.value === to);
            converted = value * source.factor / target.factor;
        }
        const formatted = Number(converted.toPrecision(8)).toString();
        result.textContent = `${value} ${from} = ${formatted} ${to}`;
    }

    function setStudioColor(root, value) {
        if (!/^#[\da-f]{6}$/i.test(value)) return false;
        const color = value.toUpperCase();
        root.querySelector('[data-color-picker]').value = color;
        root.querySelector('[data-color-hex]').value = color;
        root.querySelector('[data-color-value]').textContent = color;
        root.querySelector('[data-color-preview]').style.backgroundColor = color;
        return true;
    }

    function renderSavedColors(root) {
        const list = root.querySelector('[data-color-list]');
        const colors = readData('color-studio', []);
        list.replaceChildren();
        colors.forEach((color) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'saved-color-swatch';
            button.dataset.colorSwatch = color;
            button.style.backgroundColor = color;
            button.setAttribute('aria-label', `Use ${color}`);
            button.title = color;
            list.appendChild(button);
        });
    }

    function initializeColorStudio(root) {
        setStudioColor(root, root.querySelector('[data-color-picker]').value);
        renderSavedColors(root);
    }

    function randomIndex(length) {
        if (!window.crypto?.getRandomValues || length < 1) {
            throw new Error('Secure random number generation is not available.');
        }
        const limit = Math.floor(0x100000000 / length) * length;
        const sample = new Uint32Array(1);
        do {
            window.crypto.getRandomValues(sample);
        } while (sample[0] >= limit);
        return sample[0] % length;
    }

    function generatePassword(root) {
        const sets = {
            lower: 'abcdefghijklmnopqrstuvwxyz',
            upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
            numbers: '0123456789',
            symbols: '!@#$%^&*()-_=+[]{}:,.?'
        };
        const selected = [...root.querySelectorAll('[data-password-set]:checked')]
            .map((input) => sets[input.dataset.passwordSet])
            .filter(Boolean);
        const status = root.querySelector('[data-password-status]');
        if (!selected.length) {
            status.textContent = 'Select at least one character set.';
            return;
        }

        try {
            const length = Number(root.querySelector('[data-password-size]').value);
            const pool = selected.join('');
            const chars = selected.map((set) => set[randomIndex(set.length)]);
            while (chars.length < length) chars.push(pool[randomIndex(pool.length)]);
            for (let index = chars.length - 1; index > 0; index -= 1) {
                const other = randomIndex(index + 1);
                [chars[index], chars[other]] = [chars[other], chars[index]];
            }
            root.querySelector('[data-password-output]').value = chars.join('');
            status.textContent = `${length}-character password generated. It is not stored.`;
        } catch (error) {
            status.textContent = error.message;
        }
    }

    function processJson(root, mode) {
        const status = root.querySelector('[data-json-status]');
        const result = root.querySelector('[data-json-result]');
        try {
            const parsed = JSON.parse(root.querySelector('[data-json-input]').value);
            if (mode === 'validate') {
                result.textContent = '';
                status.textContent = 'Valid JSON.';
                return;
            }
            result.textContent = JSON.stringify(parsed, null, mode === 'format' ? 2 : 0);
            status.textContent = mode === 'format' ? 'JSON formatted.' : 'JSON minified.';
        } catch (error) {
            result.textContent = '';
            status.textContent = `Invalid JSON: ${error.message}`;
        }
    }

    function mount(element, pluginId) {
        const root = element.querySelector(`[data-plugin-root="${pluginId}"]`);
        if (!root) return;
        if (pluginId === 'smart-task') renderTasks(root);
        if (pluginId === 'security-shield') renderPermissions(root);
        if (pluginId === 'device-manager') renderDevices(root);
        if (pluginId === 'analytics-insight') renderAnalytics(root);
        if (pluginId === 'unit-converter') renderConverterUnits(root);
        if (pluginId === 'color-studio') initializeColorStudio(root);
        if (pluginId === 'demo-plugin') refreshDemo(root);
    }

    function refreshDemo(root) {
        const count = root.querySelector('[data-demo-count]');
        if (count && window.OrvexaPluginManager) {
            count.textContent = String(window.OrvexaPluginManager.getPlugins().length);
        }
    }

    function handleClick(event) {
        const actionButton = event.target.closest('[data-plugin-action]');
        const colorSwatch = event.target.closest('[data-color-swatch]');
        const taskRemove = event.target.closest('[data-task-remove]');
        const root = event.target.closest('[data-plugin-root]');

        if (colorSwatch && root) {
            setStudioColor(root, colorSwatch.dataset.colorSwatch);
            return;
        }

        if (taskRemove) {
            writeData('smart-task', readData('smart-task', []).filter((item) => item.id !== taskRemove.dataset.taskRemove));
            renderTasks(root);
            return;
        }

        if (!actionButton || !root) return;
        const action = actionButton.dataset.pluginAction;

        if (action === 'refresh-permissions') renderPermissions(root);
        if (action === 'refresh-devices') renderDevices(root);
        if (action === 'refresh-demo') refreshDemo(root);

        if (action === 'focus-start') {
            let timer = timers.get(root);
            if (timer?.interval) {
                clearInterval(timer.interval);
                timer.interval = null;
                root.querySelector('[data-focus-status]').textContent = 'Paused.';
                actionButton.textContent = 'Resume';
                return;
            }
            if (!timer || timer.seconds <= 0) {
                const duration = Number(root.querySelector('[data-focus-duration]').value) || 25;
                timer = { seconds: duration * 60, interval: null };
                timers.set(root, timer);
            }
            root.querySelector('[data-focus-duration]').disabled = true;
            root.querySelector('[data-focus-status]').textContent = 'Focus session running.';
            actionButton.textContent = 'Pause';
            updateFocusClock(root, timer.seconds);
            timer.interval = window.setInterval(() => {
                timer.seconds -= 1;
                updateFocusClock(root, timer.seconds);
                if (timer.seconds <= 0) {
                    clearInterval(timer.interval);
                    timer.interval = null;
                    actionButton.textContent = 'Start';
                    root.querySelector('[data-focus-duration]').disabled = false;
                    root.querySelector('[data-focus-status]').textContent = 'Session complete.';
                }
            }, 1000);
        }

        if (action === 'focus-reset') {
            const timer = timers.get(root);
            if (timer?.interval) clearInterval(timer.interval);
            const duration = Number(root.querySelector('[data-focus-duration]').value) || 25;
            timers.set(root, { seconds: duration * 60, interval: null });
            updateFocusClock(root, duration * 60);
            root.querySelector('[data-focus-duration]').disabled = false;
            root.querySelector('[data-focus-status]').textContent = 'Timer reset.';
            root.querySelector('[data-plugin-action="focus-start"]').textContent = 'Start';
        }

        if (action === 'backup-export') exportBackup(root);

        if (action === 'color-save') {
            const color = root.querySelector('[data-color-hex]').value.toUpperCase();
            if (!/^#[\da-f]{6}$/i.test(color)) {
                root.querySelector('[data-color-status]').textContent = 'Enter a valid six-digit hex color.';
                return;
            }
            const colors = readData('color-studio', []);
            if (!colors.includes(color)) colors.unshift(color);
            writeData('color-studio', colors.slice(0, 16));
            renderSavedColors(root);
            root.querySelector('[data-color-status]').textContent = 'Swatch saved locally.';
        }

        if (action === 'color-copy') {
            const color = root.querySelector('[data-color-hex]').value.toUpperCase();
            if (navigator.clipboard?.writeText) {
                navigator.clipboard.writeText(color)
                    .then(() => { root.querySelector('[data-color-status]').textContent = `${color} copied.`; })
                    .catch(() => { root.querySelector('[data-color-status]').textContent = 'Clipboard access was blocked by the browser.'; });
            } else {
                root.querySelector('[data-color-status]').textContent = 'Clipboard access is not available in this browser.';
            }
        }

        if (action === 'password-generate') generatePassword(root);

        if (action === 'password-copy') {
            const output = root.querySelector('[data-password-output]');
            if (!output.value) {
                root.querySelector('[data-password-status]').textContent = 'Generate a password first.';
            } else if (navigator.clipboard?.writeText) {
                navigator.clipboard.writeText(output.value)
                    .then(() => { root.querySelector('[data-password-status]').textContent = 'Password copied to clipboard.'; })
                    .catch(() => { root.querySelector('[data-password-status]').textContent = 'Clipboard access was blocked by the browser.'; });
            } else {
                root.querySelector('[data-password-status]').textContent = 'Clipboard access is not available in this browser.';
            }
        }

        if (action === 'json-format' || action === 'json-minify' || action === 'json-validate') {
            processJson(root, action.slice('json-'.length));
        }

        if (action === 'reset-analytics') {
            writeData('analytics', {});
            renderAnalytics(root);
            root.querySelector('[data-analytics-status]').textContent = 'Launch history cleared.';
        }
    }

    function handleSubmit(event) {
        const form = event.target.closest('[data-plugin-form]');
        if (!form) return;
        event.preventDefault();
        const root = form.closest('[data-plugin-root]');

        if (form.dataset.pluginForm === 'smart-task') {
            const input = form.elements.task;
            const text = input.value.trim();
            if (!text) return;
            const tasks = readData('smart-task', []);
            tasks.push({ id: window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`, text, done: false });
            writeData('smart-task', tasks);
            input.value = '';
            renderTasks(root);
        }

        if (form.dataset.pluginForm === 'terminal-commander') runTerminalCommand(root, form.elements.command);
        if (form.dataset.pluginForm === 'ai-assistant') runWritingHelper(root, form.elements.text.value, form.elements.action.value);
    }

    function runTerminalCommand(root, input) {
        const output = root.querySelector('[data-terminal-output]');
        const command = input.value.trim();
        input.value = '';
        if (!command) return;
        const [name, ...args] = command.split(/\s+/);
        let result;
        if (name === 'help') result = 'Commands: help, status, apps, time, echo <text>, clear';
        else if (name === 'status') result = `OrvexaOS browser shell · ${navigator.onLine ? 'Online' : 'Offline'} · ${window.innerWidth}×${window.innerHeight}`;
        else if (name === 'apps') result = (window.OrvexaPluginManager?.getPlugins() || []).map((plugin) => plugin.name).join('\n') || 'No plugins installed.';
        else if (name === 'time') result = new Date().toLocaleString();
        else if (name === 'echo') result = args.join(' ');
        else if (name === 'clear') result = '';
        else result = `Unknown preview command: ${name}. Type help.`;
        output.textContent = result;
    }

    function runWritingHelper(root, text, action) {
        const result = root.querySelector('[data-assistant-result]');
        const sentences = text.split(/(?<=[.!?])\s+/).map((sentence) => sentence.trim()).filter(Boolean);
        let answer;
        if (action === 'summarize') {
            answer = sentences.length > 3 ? `${sentences.slice(0, 3).join(' ')}${sentences.length > 3 ? ' ...' : ''}` : text.trim();
        } else if (action === 'actions') {
            const actionSentences = sentences.filter((sentence) => /\b(need|must|should|will|please|todo|action|complete|send|review|create|update|finish)\b/i.test(sentence));
            answer = actionSentences.length ? actionSentences.map((sentence) => `• ${sentence}`).join('\n') : 'No likely action sentences found.';
        } else {
            answer = `Thanks for sharing. I’ll review this and follow up on the key points: ${sentences.slice(0, 2).join(' ')}`;
        }
        result.textContent = answer;
    }

    function backupData() {
        const data = {};
        for (let index = 0; index < localStorage.length; index += 1) {
            const key = localStorage.key(index);
            if (key && key.startsWith('orvexa-')) data[key] = localStorage.getItem(key);
        }
        return data;
    }

    function exportBackup(root) {
        const status = root.querySelector('[data-backup-status]');
        try {
            const blob = new Blob([JSON.stringify({ format: 'orvexa-backup-v1', createdAt: new Date().toISOString(), data: backupData() }, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'orvexa-backup.json';
            link.click();
            URL.revokeObjectURL(url);
            status.textContent = 'Backup downloaded.';
        } catch (error) {
            status.textContent = `Backup failed: ${error.message}`;
        }
    }

    async function importBackup(input) {
        const root = input.closest('[data-plugin-root]');
        const status = root.querySelector('[data-backup-status]');
        const file = input.files && input.files[0];
        if (!file) return;
        try {
            const backup = JSON.parse(await file.text());
            if (backup.format !== 'orvexa-backup-v1' || !backup.data || typeof backup.data !== 'object' || Array.isArray(backup.data)) {
                throw new Error('This file is not an OrvexaOS backup.');
            }
            Object.entries(backup.data).forEach(([key, value]) => {
                if (key.startsWith('orvexa-') && typeof value === 'string') localStorage.setItem(key, value);
            });
            status.textContent = 'Backup restored. Reload OrvexaOS to apply installed plugin changes.';
        } catch (error) {
            status.textContent = `Restore failed: ${error.message}`;
        } finally {
            input.value = '';
        }
    }

    function handleChange(event) {
        const passwordSize = event.target.closest('[data-password-size]');
        if (passwordSize) {
            passwordSize.closest('[data-plugin-root]').querySelector('[data-password-length]').textContent = passwordSize.value;
            return;
        }

        const converterControl = event.target.closest('[data-converter-control]');
        if (converterControl) {
            calculateConversion(converterControl.closest('[data-plugin-root]'));
            return;
        }
        const converterCategory = event.target.closest('[data-converter-category]');
        if (converterCategory) {
            renderConverterUnits(converterCategory.closest('[data-plugin-root]'));
            return;
        }

        const input = event.target.closest('[data-task-toggle]');
        if (input) {
            const tasks = readData('smart-task', []);
            const task = tasks.find((item) => item.id === input.dataset.taskToggle);
            if (task) {
                task.done = input.checked;
                writeData('smart-task', tasks);
                renderTasks(input.closest('[data-plugin-root]'));
            }
            return;
        }
        const fileInput = event.target.closest('[data-backup-file]');
        if (fileInput) importBackup(fileInput);
    }

    function handleInput(event) {
        const picker = event.target.closest('[data-color-picker]');
        const hexInput = event.target.closest('[data-color-hex]');
        const root = event.target.closest('[data-plugin-root="color-studio"]');
        if (!root) return;
        if (picker) setStudioColor(root, picker.value);
        if (hexInput && !setStudioColor(root, hexInput.value)) {
            root.querySelector('[data-color-status]').textContent = 'Use a hex value such as #6F9F79.';
        } else if (picker || hexInput) {
            root.querySelector('[data-color-status]').textContent = '';
        }
    }

    function recordLaunch(appId) {
        const counts = readData('analytics', {});
        counts[appId] = (counts[appId] || 0) + 1;
        writeData('analytics', counts);
        const root = document.querySelector('#analytics-insight [data-plugin-root="analytics-insight"]');
        if (root) renderAnalytics(root);
    }

    document.addEventListener('click', handleClick);
    document.addEventListener('input', handleInput);
    document.addEventListener('submit', handleSubmit);
    document.addEventListener('change', handleChange);

    window.OrvexaPluginRuntime = { createContent, mount, recordLaunch };
})();
