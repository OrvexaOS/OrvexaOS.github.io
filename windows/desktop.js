(function () {
    'use strict';

    const desktop = document.querySelector('.desktop');
    const loadingScreen = document.querySelector('.loadingscreen');
    const windowArea = document.getElementById('windowArea');
    const taskbarButtons = document.querySelectorAll('[data-app]');
    const pluginManager = window.OrvexaPluginManager || { getPlugins: () => [] };
    const controlCenter = document.getElementById('controlCenter');
    const controlCenterToggle = document.getElementById('controlCenterToggle');
    const controlCenterClose = document.getElementById('controlCenterClose');
    const displaySettingsKey = 'orvexa-display-settings';
    const systemStartedAt = Date.now();
    const systemActivity = [{ message: 'OrvexaOS session started', time: new Date() }];
    const appDataPrefix = 'orvexa-app-data:';
    const seenIncomingMessageIds = new Set();

    function buildFilesContent() {
        return `
            <div class="window-content" data-files-root>
                <div class="files-heading">
                    <div><span class="control-kicker">LOCAL WORKSPACE</span><h2>Files</h2></div>
                    <div class="files-toolbar">
                        <button type="button" data-file-new>New file</button>
                        <button type="button" class="settings-secondary" data-file-open-window>Open with window</button>
                        <label class="file-import-button">Import text<input type="file" data-file-import accept="text/*,.md,.txt"></label>
                    </div>
                </div>
                <div class="files-layout">
                    <nav class="files-list" data-files-list aria-label="Saved files"></nav>
                    <section class="file-editor" aria-label="File editor">
                        <input type="text" data-file-name maxlength="80" aria-label="File name" placeholder="Untitled.txt">
                        <textarea data-file-content aria-label="File contents" placeholder="Write something..."></textarea>
                        <div class="file-footer">
                            <span data-file-status aria-live="polite">Stored in this browser</span>
                            <div><button type="button" class="settings-secondary" data-file-export>Export</button><button type="button" class="settings-secondary" data-file-delete>Delete</button></div>
                        </div>
                    </section>
                </div>
            </div>`;
    }

    function buildNotesContent() {
        return `
            <div class="window-content" data-notes-root>
                <div class="notes-heading"><div><span class="control-kicker">LOCAL DOCUMENTS</span><h2>Notes</h2></div><button type="button" data-note-new>New note</button></div>
                <div class="notes-layout">
                    <nav class="notes-list" aria-label="Saved notes" data-notes-list></nav>
                    <section class="note-editor" aria-label="Note editor">
                        <input type="text" data-note-field="title" maxlength="80" aria-label="Note title" placeholder="Untitled note">
                        <textarea data-note-field="body" aria-label="Note contents" placeholder="Start writing..."></textarea>
                        <div class="note-footer"><span data-note-status aria-live="polite">Saved on this device</span><button type="button" class="settings-secondary" data-note-delete>Delete note</button></div>
                    </section>
                </div>
            </div>`;
    }

    function buildCalendarContent() {
        return `
            <div class="window-content" data-calendar-root>
                <div class="calendar-heading">
                    <div><span class="control-kicker">YOUR SCHEDULE</span><h2>Calendar</h2></div>
                    <div class="calendar-nav"><button type="button" data-calendar-shift="-1" aria-label="Previous month">‹</button><strong data-calendar-month></strong><button type="button" data-calendar-shift="1" aria-label="Next month">›</button></div>
                </div>
                <div class="calendar-grid" data-calendar-grid aria-label="Month view"></div>
                <section class="calendar-day-events">
                    <h3 data-calendar-selected-label></h3>
                    <form data-calendar-form><input name="event" type="text" maxlength="100" required placeholder="Add an event"><button type="submit">Add event</button></form>
                    <ul data-calendar-events></ul>
                </section>
            </div>`;
    }

    function readAppData(key, fallback) {
        try {
            const value = window.localStorage.getItem(appDataPrefix + key);
            return value ? JSON.parse(value) : fallback;
        } catch (error) {
            return fallback;
        }

    }

    function writeAppData(key, value) {
        try {
            window.localStorage.setItem(appDataPrefix + key, JSON.stringify(value));
            return true;
        } catch (error) {
            return false;
        }
    }

    function renderNotificationCenter() {
        const list = document.querySelector('[data-notification-list]');
        const countNode = document.getElementById('notificationCount');
        if (!list || !countNode) return;
        const stored = readAppData('notifications', []);
        const notifications = Array.isArray(stored) ? stored : [];
        const unread = displaySettings.doNotDisturb ? 0 : notifications.filter((notification) => !notification.read).length;
        countNode.textContent = String(unread);
        countNode.hidden = unread === 0;
        list.replaceChildren();
        if (!notifications.length) {
            const empty = document.createElement('li');
            empty.className = 'notification-empty';
            empty.textContent = 'You are all caught up.';
            list.appendChild(empty);
            return;
        }
        notifications.slice(0, 30).forEach((notification) => {
            const item = document.createElement('li');
            item.classList.toggle('unread', !notification.read);
            const title = document.createElement('strong');
            title.textContent = notification.title;
            const detail = document.createElement('span');
            detail.textContent = notification.detail;
            const time = document.createElement('time');
            time.dateTime = new Date(notification.createdAt).toISOString();
            time.textContent = new Date(notification.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            item.append(title, detail, time);
            list.appendChild(item);
        });
    }

    function notifyUser(title, detail) {
        const stored = readAppData('notifications', []);
        const notifications = Array.isArray(stored) ? stored : [];
        notifications.unshift({ id: newLocalId(), title, detail, createdAt: Date.now(), read: false });
        writeAppData('notifications', notifications.slice(0, 30));
        renderNotificationCenter();
        if (displaySettings.browserAlerts && 'Notification' in window && Notification.permission === 'granted') {
            try {
                new Notification(title, { body: detail, tag: title });
            } catch (error) {
                console.warn('Browser notification could not be shown:', error);
            }
        }
    }

    function notifyIncomingMessage(message) {
        if (!message || typeof message.id !== 'string' || seenIncomingMessageIds.has(message.id)) return;
        seenIncomingMessageIds.add(message.id);
        const sender = String(message.senderName || 'New message').slice(0, 100);
        const preview = String(message.text || 'Sent you a message').trim().slice(0, 500);
        notifyUser(`Message from ${sender}`, preview || 'Sent you a message');
    }

    function setNotificationCenterOpen(isOpen) {
        const panel = document.getElementById('notificationCenter');
        const toggle = document.getElementById('notificationToggle');
        if (!panel || !toggle) return;
        panel.hidden = !isOpen;
        toggle.setAttribute('aria-expanded', String(isOpen));
        if (isOpen) {
            const stored = readAppData('notifications', []);
            if (Array.isArray(stored)) {
                stored.forEach((notification) => { notification.read = true; });
                writeAppData('notifications', stored);
            }
            renderNotificationCenter();
        }
    }

    function clearNotifications() {
        writeAppData('notifications', []);
        renderNotificationCenter();
    }

    function loadFiles() {
        const stored = readAppData('files', { activeId: '', files: [] });
        return stored && Array.isArray(stored.files) ? stored : { activeId: '', files: [] };
    }

    function renderFiles(root) {
        const data = loadFiles();
        if (!data.files.length) {
            data.files.push({
                id: newLocalId(),
                name: 'Welcome.txt',
                content: 'Welcome to your local OrvexaOS workspace.\n\nCreate or import text files here; they stay in this browser until exported.',
                updatedAt: Date.now()
            });
            data.activeId = data.files[0].id;
            writeAppData('files', data);
        }
        if (!data.files.some((file) => file.id === data.activeId)) data.activeId = data.files[0].id;
        root.dataset.activeFile = data.activeId;
        const list = root.querySelector('[data-files-list]');
        list.replaceChildren();
        data.files.slice().sort((left, right) => right.updatedAt - left.updatedAt).forEach((file) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.dataset.fileSelect = file.id;
            button.setAttribute('aria-current', String(file.id === data.activeId));
            button.textContent = file.name || 'Untitled.txt';
            list.appendChild(button);
        });
        const activeFile = data.files.find((file) => file.id === data.activeId);
        root.querySelector('[data-file-name]').value = activeFile.name;
        root.querySelector('[data-file-content]').value = activeFile.content;
        root.querySelector('[data-file-status]').textContent = `${data.files.length} local file${data.files.length === 1 ? '' : 's'}`;
    }

    function saveFileField(input) {
        const root = input.closest('[data-files-root]');
        const data = loadFiles();
        const file = data.files.find((item) => item.id === root.dataset.activeFile);
        if (!file) return;
        const field = input.matches('[data-file-name]') ? 'name' : 'content';
        file[field] = input.value;
        file.updatedAt = Date.now();
        const saved = writeAppData('files', data);
        const button = root.querySelector(`[data-file-select="${file.id}"]`);
        if (button && field === 'name') button.textContent = input.value.trim() || 'Untitled.txt';
        root.querySelector('[data-file-status]').textContent = saved ? 'Saved locally' : 'Browser storage is unavailable.';
    }

    function createFile(root, name = 'Untitled.txt', content = '') {
        const data = loadFiles();
        const file = { id: newLocalId(), name, content, updatedAt: Date.now() };
        data.files.push(file);
        data.activeId = file.id;
        writeAppData('files', data);
        renderFiles(root);
        root.querySelector('[data-file-name]').focus();
        notifyUser('File created', file.name);
    }

    function deleteActiveFile(root) {
        const data = loadFiles();
        const removed = data.files.find((file) => file.id === root.dataset.activeFile);
        data.files = data.files.filter((file) => file.id !== root.dataset.activeFile);
        if (!data.files.length) data.files.push({ id: newLocalId(), name: 'Untitled.txt', content: '', updatedAt: Date.now() });
        data.activeId = data.files[0].id;
        writeAppData('files', data);
        renderFiles(root);
        if (removed) notifyUser('File deleted', removed.name);
    }

    async function importTextFile(input) {
        const root = input.closest('[data-files-root]');
        const file = input.files && input.files[0];
        if (!file) return;
        if (file.size > 1024 * 1024) {
            root.querySelector('[data-file-status]').textContent = 'Text imports are limited to 1 MB.';
            input.value = '';
            return;
        }
        try {
            createFile(root, file.name, await file.text());
            root.querySelector('[data-file-status]').textContent = `Imported ${file.name}`;
        } catch (error) {
            root.querySelector('[data-file-status]').textContent = 'Could not read that file.';
        }
        input.value = '';
    }

    function exportActiveFile(root) {
        const file = loadFiles().files.find((item) => item.id === root.dataset.activeFile);
        if (!file) return;
        const blob = new Blob([file.content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = (file.name.trim() || 'Untitled.txt').replace(/[\\/:*?"<>|]/g, '_');
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        root.querySelector('[data-file-status]').textContent = `Exported ${link.download}`;
    }

    function newLocalId() {
        return window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    }

    function loadNotes() {
        const saved = readAppData('notes', { activeId: '', notes: [] });
        if (!saved || !Array.isArray(saved.notes)) return { activeId: '', notes: [] };
        return saved;
    }

    function renderNotes(root) {
        const data = loadNotes();
        if (!data.notes.length) {
            data.notes.push({ id: newLocalId(), title: '', body: '', updatedAt: Date.now() });
            data.activeId = data.notes[0].id;
            writeAppData('notes', data);
        }
        if (!data.notes.some((note) => note.id === data.activeId)) data.activeId = data.notes[0].id;
        root.dataset.activeNote = data.activeId;

        const list = root.querySelector('[data-notes-list]');
        list.replaceChildren();
        data.notes.slice().sort((left, right) => right.updatedAt - left.updatedAt).forEach((note) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.dataset.noteSelect = note.id;
            button.setAttribute('aria-current', String(note.id === data.activeId));
            button.textContent = note.title.trim() || 'Untitled note';
            list.appendChild(button);
        });

        const activeNote = data.notes.find((note) => note.id === data.activeId);
        root.querySelector('[data-note-field="title"]').value = activeNote.title;
        root.querySelector('[data-note-field="body"]').value = activeNote.body;
        root.querySelector('[data-note-status]').textContent = `Saved locally · ${data.notes.length} note${data.notes.length === 1 ? '' : 's'}`;
    }

    function createNote(root) {
        const data = loadNotes();
        const note = { id: newLocalId(), title: '', body: '', updatedAt: Date.now() };
        data.notes.push(note);
        data.activeId = note.id;
        writeAppData('notes', data);
        renderNotes(root);
        root.querySelector('[data-note-field="title"]').focus();
    }

    function deleteActiveNote(root) {
        const data = loadNotes();
        data.notes = data.notes.filter((note) => note.id !== root.dataset.activeNote);
        if (!data.notes.length) {
            data.notes.push({ id: newLocalId(), title: '', body: '', updatedAt: Date.now() });
        }
        data.activeId = data.notes[0].id;
        writeAppData('notes', data);
        renderNotes(root);
    }

    function saveNoteField(input) {
        const root = input.closest('[data-notes-root]');
        const data = loadNotes();
        const activeNote = data.notes.find((note) => note.id === root.dataset.activeNote);
        if (!activeNote) return;
        activeNote[input.dataset.noteField] = input.value;
        activeNote.updatedAt = Date.now();
        data.activeId = activeNote.id;
        const saved = writeAppData('notes', data);
        const item = root.querySelector(`[data-note-select="${activeNote.id}"]`);
        if (item && input.dataset.noteField === 'title') item.textContent = input.value.trim() || 'Untitled note';
        root.querySelector('[data-note-status]').textContent = saved ? 'Saved locally' : 'Could not save; browser storage is unavailable.';
    }

    function localDateKey(date) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }

    function renderCalendar(root) {
        const today = new Date();
        const initialMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
        if (!root.dataset.calendarMonth) root.dataset.calendarMonth = initialMonth;
        if (!root.dataset.calendarDate) root.dataset.calendarDate = localDateKey(today);
        const [year, month] = root.dataset.calendarMonth.split('-').map(Number);
        const monthDate = new Date(year, month - 1, 1);
        root.querySelector('[data-calendar-month]').textContent = monthDate.toLocaleDateString([], { month: 'long', year: 'numeric' });
        const grid = root.querySelector('[data-calendar-grid]');
        grid.replaceChildren();

        ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach((day) => {
            const label = document.createElement('span');
            label.className = 'calendar-weekday';
            label.textContent = day;
            grid.appendChild(label);
        });

        const savedEvents = readAppData('calendar', []);
        const events = Array.isArray(savedEvents) ? savedEvents : [];
        const offset = (monthDate.getDay() + 6) % 7;
        const daysInMonth = new Date(year, month, 0).getDate();
        for (let index = 0; index < offset; index += 1) {
            const blank = document.createElement('span');
            blank.className = 'calendar-blank';
            grid.appendChild(blank);
        }
        for (let day = 1; day <= daysInMonth; day += 1) {
            const date = new Date(year, month - 1, day);
            const dateKey = localDateKey(date);
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'calendar-day';
            button.dataset.calendarDay = dateKey;
            button.textContent = String(day);
            button.setAttribute('aria-pressed', String(root.dataset.calendarDate === dateKey));
            if (dateKey === localDateKey(today)) button.classList.add('today');
            if (events.some((item) => item.date === dateKey)) button.classList.add('has-event');
            grid.appendChild(button);
        }

        const selectedDate = root.dataset.calendarDate;
        const dateObject = new Date(`${selectedDate}T12:00:00`);
        root.querySelector('[data-calendar-selected-label]').textContent = dateObject.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
        const eventList = root.querySelector('[data-calendar-events]');
        eventList.replaceChildren();
        const selectedEvents = events.filter((item) => item.date === selectedDate);
        if (!selectedEvents.length) {
            const empty = document.createElement('li');
            empty.textContent = 'Nothing scheduled';
            eventList.appendChild(empty);
        }
        selectedEvents.forEach((item) => {
            const eventItem = document.createElement('li');
            const title = document.createElement('span');
            title.textContent = item.title;
            const remove = document.createElement('button');
            remove.type = 'button';
            remove.textContent = 'Remove';
            remove.dataset.calendarRemove = item.id;
            eventItem.append(title, remove);
            eventList.appendChild(eventItem);
        });
    }

    function shiftCalendarMonth(root, amount) {
        const [year, month] = root.dataset.calendarMonth.split('-').map(Number);
        const nextMonth = new Date(year, month - 1 + amount, 1);
        root.dataset.calendarMonth = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}`;
        root.dataset.calendarDate = localDateKey(nextMonth);
        renderCalendar(root);
    }

    function buildSettingsContent() {
        return `
            <div class="window-content" data-settings-root>
                <div class="settings-heading">
                    <span class="control-kicker">PREFERENCES</span>
                    <h2>Settings</h2>
                    <p>Make OrvexaOS feel like yours.</p>
                </div>
                <label class="settings-search"><span aria-hidden="true">⌕</span><input type="search" data-settings-search placeholder="Search this section…" aria-label="Search settings"></label>
                <p class="settings-search-status" data-settings-search-status aria-live="polite" hidden></p>
                <div class="settings-layout">
                    <nav class="settings-nav" role="tablist" aria-label="Settings sections">
                        <button type="button" role="tab" data-settings-tab="appearance" aria-controls="settings-appearance" aria-selected="true">Display</button>
                        <button type="button" role="tab" data-settings-tab="notifications" aria-controls="settings-notifications" aria-selected="false">Notifications</button>
                        <button type="button" role="tab" data-settings-tab="privacy" aria-controls="settings-privacy" aria-selected="false">Privacy</button>
                        <button type="button" role="tab" data-settings-tab="system" aria-controls="settings-system" aria-selected="false">System</button>
                    </nav>
                    <div class="settings-panels">
                        <section id="settings-appearance" class="settings-panel" role="tabpanel" data-settings-panel="appearance">
                            <h3>Appearance</h3>
                            <div class="settings-row">
                                <div><strong>Theme</strong><span data-settings-theme-label>Dark</span></div>
                                <button type="button" data-display-theme aria-pressed="false">Switch to Light</button>
                            </div>
                            <label class="settings-row">
                                <div><strong>Brightness</strong><output>100%</output></div>
                                <input type="range" data-display-brightness min="65" max="110" value="100">
                            </label>
                            <label class="settings-row settings-switch-row">
                                <div><strong>Night light</strong><span>Warm the desktop colors</span></div>
                                <input type="checkbox" data-display-night-light role="switch">
                            </label>
                            <div class="settings-row accent-row">
                                <div><strong>Accent color</strong><span>Used for active controls</span></div>
                                <div class="accent-options" role="group" aria-label="Accent color">
                                    <button type="button" class="accent-swatch fern" data-display-accent="fern" aria-label="Fern accent" title="Fern"></button>
                                    <button type="button" class="accent-swatch copper" data-display-accent="copper" aria-label="Copper accent" title="Copper"></button>
                                    <button type="button" class="accent-swatch ocean" data-display-accent="ocean" aria-label="Ocean accent" title="Ocean"></button>
                                </div>
                            </div>
                            <div class="settings-row wallpaper-row">
                                <div><strong>Wallpaper</strong><span>Choose a desktop atmosphere</span></div>
                                <div class="wallpaper-options" role="group" aria-label="Desktop wallpaper">
                                    <button type="button" class="wallpaper-swatch meadow" data-display-wallpaper="meadow" aria-label="Meadow wallpaper" title="Meadow"></button>
                                    <button type="button" class="wallpaper-swatch tide" data-display-wallpaper="tide" aria-label="Tide wallpaper" title="Tide"></button>
                                    <button type="button" class="wallpaper-swatch ember" data-display-wallpaper="ember" aria-label="Ember wallpaper" title="Ember"></button>
                                </div>
                            </div>
                            <div class="settings-row theme-preset-row">
                                <div><strong>Quick themes</strong><span>Apply a coordinated look</span></div>
                                <div class="theme-presets" role="group" aria-label="Quick theme presets">
                                    <button type="button" data-display-preset="forest">Forest</button>
                                    <button type="button" data-display-preset="ocean">Ocean</button>
                                    <button type="button" data-display-preset="ember">Ember</button>
                                    <button type="button" data-display-preset="frost">Frost</button>
                                </div>
                            </div>
                            <div class="settings-row">
                                <div><strong>Custom accent</strong><span>Choose any color</span></div>
                                <input type="color" data-display-custom-accent aria-label="Custom accent color" value="#a9c49e">
                            </div>
                            <label class="settings-row">
                                <div><strong>Interface scale</strong><span>Make controls smaller or larger</span><output data-display-scale-output>100%</output></div>
                                <input type="range" data-display-scale min="85" max="120" value="100">
                            </label>
                            <label class="settings-row">
                                <div><strong>Window transparency</strong><span>Adjust glass opacity</span><output data-display-opacity-output>94%</output></div>
                                <input type="range" data-display-opacity min="65" max="100" value="94">
                            </label>
                            <label class="settings-row">
                                <div><strong>Window corners</strong><span>Round or sharpen window edges</span><output data-display-radius-output>14 px</output></div>
                                <input type="range" data-display-radius min="6" max="28" value="14">
                            </label>
                            <label class="settings-row">
                                <div><strong>Taskbar alignment</strong><span>Choose where the dock sits</span></div>
                                <select data-display-taskbar-position aria-label="Taskbar alignment"><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select>
                            </label>
                            <label class="settings-row settings-switch-row">
                                <div><strong>Compact layout</strong><span>Reduce spacing in app windows</span></div>
                                <input type="checkbox" data-display-compact role="switch">
                            </label>
                            <label class="settings-row">
                                <div><strong>Interface font</strong><span>Choose a system, rounded, or mono look</span></div>
                                <select data-display-font aria-label="Interface font"><option value="system">System</option><option value="rounded">Rounded</option><option value="mono">Monospace</option></select>
                            </label>
                            <label class="settings-row settings-switch-row">
                                <div><strong>Reduce motion</strong><span>Disable most interface transitions</span></div>
                                <input type="checkbox" data-display-motion role="switch">
                            </label>
                            <label class="settings-row">
                                <div><strong>Glass blur</strong><span>Adjust background blur strength</span><output>18 px</output></div>
                                <input type="range" data-display-glass-blur min="0" max="32" value="18">
                            </label>
                            <label class="settings-row settings-switch-row">
                                <div><strong>Window shadows</strong><span>Show depth around app windows</span></div>
                                <input type="checkbox" data-display-shadows role="switch" checked>
                            </label>
                            <label class="settings-row">
                                <div><strong>Taskbar icon size</strong><span>Adjust the dock button size</span><output>52 px</output></div>
                                <input type="range" data-display-taskbar-size min="40" max="68" value="52">
                            </label>
                            <label class="settings-row settings-switch-row">
                                <div><strong>Taskbar labels</strong><span>Show app names on hover</span></div>
                                <input type="checkbox" data-display-taskbar-labels role="switch">
                            </label>
                            <label class="settings-row">
                                <div><strong>Wallpaper scaling</strong><span>Choose how wallpaper fills the desktop</span></div>
                                <select data-display-wallpaper-fit aria-label="Wallpaper scaling"><option value="cover">Fill desktop</option><option value="contain">Fit entire image</option></select>
                            </label>
                            <h3>Desktop & device behavior</h3>
                            <label class="settings-row">
                                <div><strong>Desktop icon size</strong><span>Scale desktop app shortcuts</span></div>
                                <select data-display-icon-size aria-label="Desktop icon size"><option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option></select>
                            </label>
                            <label class="settings-row settings-switch-row">
                                <div><strong>Show desktop apps</strong><span>Show shortcuts on the desktop</span></div>
                                <input type="checkbox" data-display-show-icons role="switch" checked>
                            </label>
                            <label class="settings-row settings-switch-row">
                                <div><strong>Double-click to launch</strong><span>Use a Windows-style double-click gesture</span></div>
                                <input type="checkbox" data-display-double-click role="switch" checked>
                            </label>
                            <label class="settings-row settings-switch-row">
                                <div><strong>Touch-friendly controls</strong><span>Increase hit areas on touch devices</span></div>
                                <input type="checkbox" data-display-touch-friendly role="switch" checked>
                            </label>
                            <label class="settings-row settings-switch-row">
                                <div><strong>Auto-hide taskbar</strong><span>Reveal it when you move to the screen edge</span></div>
                                <input type="checkbox" data-display-taskbar-auto-hide role="switch">
                            </label>
                            <label class="settings-row settings-switch-row">
                                <div><strong>24-hour clock</strong><span>Use 24-hour time in the system tray</span></div>
                                <input type="checkbox" data-display-clock-24 role="switch" checked>
                            </label>
                            <div class="settings-row custom-wallpaper-row">
                                <div><strong>Custom wallpaper</strong><span>Use an image from your device (max 2 MB)</span></div>
                                <div><input type="file" data-display-custom-wallpaper accept="image/*" aria-label="Upload custom wallpaper"><button type="button" class="settings-secondary" data-display-clear-wallpaper>Clear custom wallpaper</button></div>
                            </div>
                            <button type="button" class="settings-secondary" data-settings-reset>Restore display defaults</button>
                        </section>
                        <section id="settings-notifications" class="settings-panel" role="tabpanel" data-settings-panel="notifications" hidden>
                            <h3>Notifications</h3>
                            <label class="settings-row settings-switch-row">
                                <div><strong>Do Not Disturb</strong><span>Keep alerts in history without unread badges</span></div>
                                <input type="checkbox" data-setting-dnd role="switch">
                            </label>
                            <label class="settings-row settings-switch-row">
                                <div><strong>Browser alerts</strong><span>Show alerts when OrvexaOS is in the background</span></div>
                                <input type="checkbox" data-setting-browser-notifications role="switch">
                            </label>
                            <p data-notification-settings-status aria-live="polite">Browser alerts require permission and may not be available for local files.</p>
                            <button type="button" class="settings-secondary" data-notification-clear>Clear notification history</button>
                        </section>
                        <section id="settings-privacy" class="settings-panel" role="tabpanel" data-settings-panel="privacy" hidden>
                            <h3>Privacy</h3>
                            <p>These are browser permission states. OrvexaOS does not request access from this page.</p>
                            <button type="button" data-settings-refresh-privacy>Refresh permission status</button>
                            <p data-settings-privacy-status aria-live="polite">Checking browser permissions...</p>
                            <ul data-settings-permissions></ul>
                        </section>
                        <section id="settings-system" class="settings-panel" role="tabpanel" data-settings-panel="system" hidden>
                            <h3>System</h3>
                            <dl class="settings-facts">
                                <div><dt>Environment</dt><dd>OrvexaOS web desktop</dd></div>
                                <div><dt>Platform</dt><dd data-settings-platform>Checking...</dd></div>
                                <div><dt>Installed plugins</dt><dd data-settings-plugin-count>0</dd></div>
                                <div><dt>Local storage</dt><dd data-settings-storage>Checking...</dd></div>
                            </dl>
                            <button type="button" data-settings-refresh-system>Refresh system details</button>
                            <div class="settings-row cache-reset-row"><div><strong>Offline app cache</strong><span>Clear cached OrvexaOS files and reload. Your saved files, notes, and settings are kept.</span></div><button type="button" class="settings-secondary" data-cache-reset>Reset cache</button></div>
                            <p data-cache-reset-status aria-live="polite"></p>
                            <button type="button" class="settings-secondary" data-open-app="browser">Open Store</button>
                        </section>
                    </div>
                </div>
            </div>`;
    }

    function buildFocusContent() { return "<div class=\"window-content focus-app\" data-focus-root data-remaining=\"1500\" data-running=\"false\"><div class=\"focus-hero\"><span class=\"control-kicker\">FOCUS MODE</span><h2>Make space for deep work.</h2><p>One task at a time. Your timer stays in this window while you work.</p></div><label class=\"focus-task-label\">What are you working on?<input type=\"text\" data-focus-task maxlength=\"100\" placeholder=\"e.g. Finish my project\"></label><div class=\"focus-clock\" data-focus-clock role=\"timer\" aria-live=\"off\">25:00</div><div class=\"focus-presets\" role=\"group\" aria-label=\"Timer duration\"><button type=\"button\" data-focus-preset=\"900\">15 min</button><button type=\"button\" data-focus-preset=\"1500\" aria-pressed=\"true\">25 min</button><button type=\"button\" data-focus-preset=\"3000\">50 min</button></div><div class=\"focus-actions\"><button type=\"button\" data-focus-start>Start focus</button><button type=\"button\" data-focus-reset>Reset</button></div><p class=\"focus-status\" data-focus-status aria-live=\"polite\">Ready when you are.</p><p class=\"focus-tip\">Tip: Pick one small, specific goal and silence distractions until the timer ends.</p></div>"; }

    const baseAppMap = {
        home: {
            title: 'Home',
            width: '720px',
            left: 90,
            top: 70,
            content: `
                <div class="window-content">
                    <h2>Welcome to OrvexaOS</h2>
                    <p>Your desktop is ready. Launch apps from the taskbar or the shortcuts below.</p>
                    <div class="app-grid">
                        <button class="app-tile" type="button" data-open-app="home"><span>⌂</span><strong>Home</strong></button>
                        <button class="app-tile" type="button" data-open-app="files"><span>📁</span><strong>Files</strong></button>
                        <button class="app-tile" type="button" data-open-app="browser"><span>🌐</span><strong>Browser</strong></button>
                        <button class="app-tile" type="button" data-open-app="messages"><span>💬</span><strong>Messages</strong></button>
                        <button class="app-tile" type="button" data-open-app="settings"><span>⚙</span><strong>Settings</strong></button>
                        <button class="app-tile" type="button" data-open-app="calc"><span>🧮</span><strong>Calculator</strong></button>
                    </div>
                </div>
            `
        },
        files: {
            title: 'Files',
            width: '760px',
            left: 170,
            top: 75,
            content: buildFilesContent()
        },
        browser: {
            title: 'Browser',
            width: '860px',
            left: 150,
            top: 70,
            content: '<iframe src="apps/Store/index.html" title="Store" style="width:100%;height:630px;border:0;border-radius:12px;background:#fff;"></iframe>'
        },
        messages: {
            title: 'Messages',
            width: '760px',
            left: 180,
            top: 80,
            content: '<iframe src="apps/chatAPP/index.html" title="Messages" style="width:100%;height:620px;border:0;border-radius:12px;background:#fff;"></iframe>'
        },
        settings: {
            title: 'Settings',
            width: '680px',
            left: 210,
            top: 80,
            content: buildSettingsContent()
        },
        notes: {
            title: 'Notes',
            width: '760px',
            left: 150,
            top: 75,
            content: buildNotesContent()
        },
        calendar: {
            title: 'Calendar',
            width: '720px',
            left: 230,
            top: 85,
            content: buildCalendarContent()
        },
        'system-monitor': {
            title: 'System Monitor',
            width: '760px',
            left: 170,
            top: 70,
            content: `
                <div class="window-content" data-system-monitor>
                    <div class="system-monitor-heading">
                        <div><span class="control-kicker">LIVE OVERVIEW</span><h2>System Monitor</h2></div>
                        <button type="button" data-system-refresh>Refresh</button>
                    </div>
                    <div class="system-metrics">
                        <div><span>Open windows</span><strong data-system-running>0</strong></div>
                        <div><span>Installed plugins</span><strong data-system-plugins>0</strong></div>
                        <div><span>Session uptime</span><strong data-system-uptime>0s</strong></div>
                        <div><span>Network</span><strong data-system-network>Online</strong></div>
                        <div><span>Browser memory</span><strong data-system-memory>Unavailable</strong></div>
                    </div>
                    <h3>App processes</h3>
                    <div class="system-table-wrap">
                        <table class="system-process-table">
                            <thead><tr><th>Application</th><th>State</th><th>Actions</th></tr></thead>
                            <tbody data-system-processes></tbody>
                        </table>
                    </div>
                    <h3>Recent activity</h3>
                    <ol class="system-activity" data-system-activity aria-live="polite"></ol>
                </div>
            `
        },
        focus: { title: 'Focus Timer', width: '520px', left: 270, top: 95, content: buildFocusContent() },
        calc: {
            title: 'Calculator',
            width: '360px',
            left: 320,
            top: 120,
            content: '<iframe src="apps/calc/index.html" title="Calculator" style="width:100%;height:560px;border:0;border-radius:12px;background:#181818;"></iframe>'
        }
    };

    function buildPluginAppMap() {
        return pluginManager.getPlugins().reduce((accumulator, plugin) => {
            accumulator[plugin.id] = pluginManager.createPluginApp(plugin);
            return accumulator;
        }, {});
    }

    function buildHomeContent() {
        const pluginHomeTiles = pluginManager.getPlugins().map((plugin) => `
            <button class="app-tile" type="button" data-open-app="${plugin.id}" data-app-kind="plugin">
                <span>${plugin.icon}</span>
                <strong>${plugin.name}</strong>
            </button>
        `).join('');

        return `
                <div class="window-content">
                    <div class="launcher-heading">
                        <div>
                            <span class="control-kicker">YOUR WORKSPACE</span>
                            <h2>Welcome to OrvexaOS</h2>
                            <p>Your apps, ready when you are.</p>
                        </div>
                        <label class="launcher-search">
                            <span>Find an app</span>
                            <input type="search" data-home-search placeholder="Search apps..." autocomplete="off">
                        </label>
                    </div>
                    <div class="launcher-filters" role="group" aria-label="Filter apps">
                        <button type="button" data-home-filter="all" aria-pressed="true">All</button>
                        <button type="button" data-home-filter="builtin" aria-pressed="false">Built-in</button>
                        <button type="button" data-home-filter="plugin" aria-pressed="false">Plugins</button>
                    </div>
                    <div class="app-grid">
                        <button class="app-tile" type="button" data-open-app="home" data-app-kind="builtin"><span>⌂</span><strong>Home</strong></button>
                        <button class="app-tile" type="button" data-open-app="files" data-app-kind="builtin"><span>📁</span><strong>Files</strong></button>
                        <button class="app-tile" type="button" data-open-app="browser" data-app-kind="builtin"><span>🌐</span><strong>Browser</strong></button>
                        <button class="app-tile" type="button" data-open-app="messages" data-app-kind="builtin"><span>💬</span><strong>Messages</strong></button>
                        <button class="app-tile" type="button" data-open-app="settings" data-app-kind="builtin"><span>⚙</span><strong>Settings</strong></button>
                        <button class="app-tile" type="button" data-open-app="calc" data-app-kind="builtin"><span>🧮</span><strong>Calculator</strong></button>
                        <button class="app-tile" type="button" data-open-app="focus" data-app-kind="builtin"><span>⏱️</span><strong>Focus Timer</strong></button>
                        <button class="app-tile" type="button" data-open-app="notes" data-app-kind="builtin"><span>📝</span><strong>Notes</strong></button>
                        <button class="app-tile" type="button" data-open-app="calendar" data-app-kind="builtin"><span>📅</span><strong>Calendar</strong></button>
                        <button class="app-tile" type="button" data-open-app="system-monitor" data-app-kind="builtin"><span>▤</span><strong>System Monitor</strong></button>
                        <button class="app-tile" type="button" data-open-app="app-store" data-app-kind="builtin"><span>🛍️</span><strong>App Store</strong></button>
                        ${pluginHomeTiles}
                    </div>
                    <p class="launcher-empty" data-home-empty hidden>No apps match that search.</p>
                </div>
            `;
    }

    function refreshPluginState() {
        if (baseAppMap.home) {
            baseAppMap.home.content = buildHomeContent();
        }

        appMap = { ...baseAppMap, ...buildPluginAppMap() };

        const homeWindow = document.getElementById('home');
        if (homeWindow) {
            const contentNode = homeWindow.querySelector('.window-content');
            if (contentNode) {
                contentNode.outerHTML = buildHomeContent();
            }
        }
    }

    Object.assign(baseAppMap, window.OrvexaAdvancedApps || {});
    let appMap = { ...baseAppMap, ...buildPluginAppMap() };

    if (baseAppMap.home) {
        baseAppMap.home.content = buildHomeContent();
    }

    if (appMap.home) {
        appMap.home.content = baseAppMap.home.content;
    }

    if (pluginManager.onChanged) {
        pluginManager.onChanged(() => {
            refreshPluginState();
        });
    }

    window.addEventListener('message', (event) => {
        const messagesFrame = document.querySelector('#messages iframe');
        if (messagesFrame && event.source === messagesFrame.contentWindow && event.data?.type === 'orvexa:messages:new') {
            notifyIncomingMessage(event.data.message);
            return;
        }

        const storeFrame = Array.from(document.querySelectorAll('iframe')).find((frame) =>
            frame.contentWindow === event.source && frame.src.includes('/apps/Store/')
        );
        if (!storeFrame || !event.data || typeof event.data.type !== 'string') return;

        if (event.data.type === 'orvexa:plugins:list') {
            storeFrame.contentWindow.postMessage({
                type: 'orvexa:plugins:list-result',
                installedIds: pluginManager.getPlugins().map((plugin) => plugin.id)
            }, '*');
            return;
        }

        if (event.data.type === 'orvexa:apps:open' && typeof event.data.id === 'string') {
            const opened = openApp(event.data.id);
            if (opened) updateTaskbarState(event.data.id);
            storeFrame.contentWindow.postMessage({
                type: 'orvexa:apps:open-result',
                id: event.data.id,
                success: opened
            }, '*');
            return;
        }

        if (event.data.type !== 'orvexa:plugins:install' || typeof event.data.id !== 'string') return;

        try {
            const plugin = pluginManager.installStorePlugin(event.data.id);
            notifyUser('Plugin installed', plugin.name);
            storeFrame.contentWindow.postMessage({
                type: 'orvexa:plugins:install-result',
                id: plugin.id,
                success: true
            }, '*');
        } catch (error) {
            storeFrame.contentWindow.postMessage({
                type: 'orvexa:plugins:install-result',
                id: event.data.id,
                success: false,
                error: error.message
            }, '*');
        }
    });

    function openFileInWindow(root) {
        const data = loadFiles();
        const file = data.files.find((item) => item.id === root.dataset.activeFile);
        if (!file) {
            root.querySelector('[data-file-status]').textContent = 'Select a file first.';
            return;
        }

        const safeId = String(file.id).replace(/[^a-zA-Z0-9_-]/g, '-');
        const windowId = 'file-window-' + safeId;
        const existing = document.getElementById(windowId);
        if (existing) {
            windowHandler.open(windowId);
            existing.querySelector('[data-file-window-name]')?.focus();
            return;
        }

        const element = document.createElement('section');
        element.className = 'window file-document-window';
        element.id = windowId;
        element.dataset.window = windowId;
        element.dataset.fileId = file.id;
        element.style.left = 'calc(50% - 260px)';
        element.style.top = 'calc(50% - 210px)';
        element.style.width = '520px';

        const header = document.createElement('div');
        header.className = 'window-header';
        header.dataset.windowDrag = '';
        const title = document.createElement('div');
        title.className = 'window-title';
        title.textContent = file.name || 'Untitled.txt';
        const controls = document.createElement('div');
        controls.className = 'window-controls';
        [['—', 'Minimize', 'window-minimize'], ['□', 'Maximize', 'window-maximize'], ['×', 'Close', 'window-close close']].forEach(([label, aria, className]) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = className;
            button.setAttribute('aria-label', aria);
            button.textContent = label;
            controls.appendChild(button);
        });
        header.append(title, controls);

        const content = document.createElement('div');
        content.className = 'window-content';
        content.dataset.fileWindowRoot = '';
        const kicker = document.createElement('span');
        kicker.className = 'control-kicker';
        kicker.textContent = 'FILE WINDOW';
        const heading = document.createElement('h2');
        heading.textContent = file.name || 'Untitled.txt';
        const name = document.createElement('input');
        name.type = 'text';
        name.maxLength = 80;
        name.value = file.name || 'Untitled.txt';
        name.setAttribute('aria-label', 'File name');
        name.dataset.fileWindowName = '';
        const editor = document.createElement('textarea');
        editor.value = file.content || '';
        editor.setAttribute('aria-label', 'File contents');
        editor.dataset.fileWindowContent = '';
        editor.rows = 14;
        const footer = document.createElement('div');
        footer.className = 'file-footer';
        const status = document.createElement('span');
        status.setAttribute('aria-live', 'polite');
        status.dataset.fileWindowStatus = '';
        status.textContent = 'Changes are saved when you select Save.';
        const save = document.createElement('button');
        save.type = 'button';
        save.className = 'settings-secondary';
        save.dataset.fileWindowSave = '';
        save.textContent = 'Save changes';
        footer.append(status, save);
        content.append(kicker, heading, name, editor, footer);
        element.append(header, content);
        windowArea.appendChild(element);
        windowHandler.register(element, windowId);
        windowHandler.open(windowId);
        name.focus();
        root.querySelector('[data-file-status]').textContent = 'Opened "' + (file.name || 'Untitled.txt') + '" in its own window.';
    }

    function saveFileWindow(element) {
        const fileId = element.closest('.window')?.dataset.fileId;
        if (!fileId) return;
        const data = loadFiles();
        const file = data.files.find((item) => item.id === fileId);
        if (!file) {
            element.querySelector('[data-file-window-status]').textContent = 'This file no longer exists.';
            return;
        }
        const name = element.querySelector('[data-file-window-name]').value.trim().slice(0, 80) || 'Untitled.txt';
        file.name = name;
        file.content = element.querySelector('[data-file-window-content]').value;
        file.updatedAt = Date.now();
        if (!writeAppData('files', data)) {
            element.querySelector('[data-file-window-status]').textContent = 'Could not save to browser storage.';
            return;
        }
        element.querySelector('.window-title').textContent = name;
        element.querySelector('h2').textContent = name;
        element.querySelector('[data-file-window-status]').textContent = 'Saved locally.';
        const filesRoot = document.querySelector('#files [data-files-root]');
        if (filesRoot) renderFiles(filesRoot);
        if (window.OrvexaSystemPersistence) window.OrvexaSystemPersistence.checkpoint();
    }

    function createWindow(id, config) {
        const element = document.createElement('section');
        element.className = 'window';
        element.id = id;
        element.dataset.window = id;
        element.style.left = `${config.left || 120}px`;
        element.style.top = `${config.top || 80}px`;
        element.style.width = config.width || '560px';
        element.innerHTML = `
            <div class="window-header" data-window-drag ${id === 'settings' ? 'data-no-drag' : ''}>
                <div class="window-title">${config.title}</div>
                <div class="window-controls">
                    <button type="button" aria-label="Minimize" class="window-minimize">—</button>
                    <button type="button" aria-label="Maximize" class="window-maximize">□</button>
                    <button type="button" aria-label="Close" class="window-close close">×</button>
                </div>
            </div>
            ${config.content}
        `;
        element.style.display = 'block';
        element.hidden = false;
        windowArea.appendChild(element);
        if (window.OrvexaPluginRuntime) {
            window.OrvexaPluginRuntime.mount(element, id);
        }
        if (id === 'settings') {
            initializeSettings(element);
        }
        if (id === 'notes') renderNotes(element.querySelector('[data-notes-root]'));
        if (id === 'calendar') renderCalendar(element.querySelector('[data-calendar-root]'));
        if (id === 'files') renderFiles(element.querySelector('[data-files-root]'));
        return element;
    }

    if (!window.WindowHandler) {
        throw new Error('WindowHandler is required.');
    }

    const windowHandler = new window.WindowHandler({
        windowSelector: '.window',
        dragHandleSelector: '.window-header',
        closeSelector: '.window-close',
        minimizeSelector: '.window-minimize',
        maximizeSelector: '.window-maximize',
        startZIndex: 120
    });

    function updateSystemMonitor() {
        const root = document.querySelector('#system-monitor [data-system-monitor]');
        if (!root) return;

        const windows = Array.from(windowArea.querySelectorAll('.window'));
        const visibleWindows = windows.filter((element) => !element.hidden && element.style.display !== 'none');
        const activeWindow = visibleWindows.reduce((active, element) => {
            if (!active) return element;
            return Number(element.style.zIndex || 0) > Number(active.style.zIndex || 0) ? element : active;
        }, null);
        const runningCount = root.querySelector('[data-system-running]');
        const pluginCount = root.querySelector('[data-system-plugins]');
        const uptime = root.querySelector('[data-system-uptime]');
        const network = root.querySelector('[data-system-network]');
        const memory = root.querySelector('[data-system-memory]');
        const processList = root.querySelector('[data-system-processes]');
        const activityList = root.querySelector('[data-system-activity]');

        runningCount.textContent = String(visibleWindows.length);
        pluginCount.textContent = String(pluginManager.getPlugins().length);
        updateSystemUptime();
        network.textContent = navigator.onLine ? 'Online' : 'Offline';
        const memoryBytes = performance.memory && performance.memory.usedJSHeapSize;
        memory.textContent = memoryBytes ? `${(memoryBytes / (1024 * 1024)).toFixed(1)} MB` : 'Unavailable';

        processList.replaceChildren();
        windows.forEach((element) => {
            const isVisible = visibleWindows.includes(element);
            const state = !isVisible
                ? element.dataset.minimized === 'true' ? 'Minimized' : 'Closed'
                : element === activeWindow ? 'Active' : 'Running';
            const row = document.createElement('tr');
            const appCell = document.createElement('td');
            appCell.textContent = element.querySelector('.window-title')?.textContent || element.id;
            const stateCell = document.createElement('td');
            stateCell.textContent = state;
            stateCell.dataset.processState = state.toLowerCase();
            const actionCell = document.createElement('td');
            [['Focus', 'open'], ['Minimize', 'minimize'], ['Close', 'close']].forEach(([label, action]) => {
                const button = document.createElement('button');
                button.type = 'button';
                button.textContent = label;
                button.dataset.systemWindowAction = action;
                button.dataset.systemTarget = element.id;
                button.disabled = action === 'minimize' && !isVisible;
                actionCell.appendChild(button);
            });
            row.append(appCell, stateCell, actionCell);
            processList.appendChild(row);
        });

        activityList.replaceChildren();
        systemActivity.slice(0, 8).forEach((entry) => {
            const item = document.createElement('li');
            const time = document.createElement('time');
            time.dateTime = entry.time.toISOString();
            time.textContent = entry.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const message = document.createElement('span');
            message.textContent = entry.message;
            item.append(time, message);
            activityList.appendChild(item);
        });
    }

    function updateSystemUptime() {
        const uptime = document.querySelector('#system-monitor [data-system-uptime]');
        if (!uptime) return;
        const elapsedSeconds = Math.floor((Date.now() - systemStartedAt) / 1000);
        const elapsedMinutes = Math.floor(elapsedSeconds / 60);
        uptime.textContent = elapsedMinutes ? `${elapsedMinutes}m ${elapsedSeconds % 60}s` : `${elapsedSeconds}s`;
    }

    function recordSystemActivity(event) {
        const id = event.detail && event.detail.id;
        const element = id && document.getElementById(id);
        const title = element?.querySelector('.window-title')?.textContent || id || 'Application';
        const verb = {
            'window:open': 'opened',
            'window:close': 'closed',
            'window:minimize': 'minimized',
            'window:focus': 'focused',
            'window:maximize': 'maximized',
            'window:restore': 'restored'
        }[event.type] || 'updated';

        // Keep the taskbar highlight aligned with the window that actually has focus.
        // This also covers focusing a window by clicking its title bar, not just launching it.
        if (id && (event.type === 'window:open' || event.type === 'window:focus' || event.type === 'window:restore')) {
            updateTaskbarState(id);
        } else if (id && (event.type === 'window:close' || event.type === 'window:minimize')) {
            const visibleWindows = Array.from(windowArea.querySelectorAll('.window'))
                .filter((item) => !item.hidden && item.style.display !== 'none')
                .sort((left, right) => Number(right.style.zIndex || 0) - Number(left.style.zIndex || 0));
            updateTaskbarState(visibleWindows[0]?.id || '');
        }

        systemActivity.unshift({ message: `${title} ${verb}`, time: new Date() });
        systemActivity.splice(16);
        updateSystemMonitor();
    }

    ['window:open', 'window:close', 'window:minimize', 'window:focus', 'window:maximize', 'window:restore']
        .forEach((eventName) => windowArea.addEventListener(eventName, recordSystemActivity));

    function openApp(appId) {
        const key = String(appId || 'home');
        const config = appMap[key];
        if (!config) return false;

        let element = document.getElementById(key);
        if (!element) {
            element = createWindow(key, config);
            windowHandler.register(element, key);
        }

        windowHandler.open(key);
        if (window.OrvexaPluginRuntime) {
            window.OrvexaPluginRuntime.recordLaunch(key);
        }
        closeStartMenu();
        return true;
    }

    const desktopAppShortcuts = [
        ['files', 'Files', '📁'], ['browser', 'Browser', '🌐'], ['messages', 'Messages', '💬'],
        ['settings', 'Settings', '⚙️'], ['calc', 'Calculator', '🧮'], ['notes', 'Notes', '📝'],
        ['calendar', 'Calendar', '📅'], ['app-store', 'App Store', '🛍️'], ['terminal', 'Terminal', '⌘'],
        ['system-monitor', 'System Monitor', '▤'], ['backup', 'Backup & Restore', '💾'], ['colors', 'Color Studio', '🎨'],
        ['widgets', 'Desktop Widgets', '▧'], ['kanban', 'Kanban Board', '🗂'], ['focus', 'Focus Timer', '⏱️']
    ];
    const desktopShortcutsRoot = document.getElementById('desktopShortcuts');
    const startMenu = document.getElementById('startMenu');
    const startMenuToggle = document.querySelector('[data-start-menu-toggle]');
    const startMenuApps = document.querySelector('[data-start-menu-apps]');
    const startMenuSearch = document.querySelector('[data-start-menu-search]');

    function appIconFor(id, fallback = '🧩') {
        const known = desktopAppShortcuts.find((item) => item[0] === id);
        if (known) return known[2];
        const icons = { home: '⌂', 'unit-converter': '⇄', 'json-studio': '{ }', markdown: '✍️', habits: '✓', expenses: '💸', 'password-generator': '🔑', stopwatch: '⏱', pomodoro: '🍅', countdown: '⌛', checklist: '☑', bookmarks: '🔖', 'reading-list': '📚', journal: '📓', flashcards: '🃏', 'csv-viewer': '📊', 'random-picker': '🎲' };
        return icons[id] || fallback;
    }

    function closeStartMenu() {
        if (!startMenu) return;
        startMenu.hidden = true;
        if (startMenuToggle) startMenuToggle.setAttribute('aria-expanded', 'false');
    }

    function toggleStartMenu(force) {
        if (!startMenu) return;
        const opening = typeof force === 'boolean' ? force : startMenu.hidden;
        startMenu.hidden = !opening;
        if (startMenuToggle) startMenuToggle.setAttribute('aria-expanded', String(opening));
        if (opening && startMenuSearch) {
            startMenuSearch.value = '';
            renderStartMenuApps('');
            startMenuSearch.focus();
        }
    }

    function renderStartMenuApps(query = '') {
        if (!startMenuApps) return;
        const term = query.trim().toLowerCase();
        startMenuApps.replaceChildren();
        Object.entries(appMap).filter(([id, config]) => {
            const title = String(config.title || id).replace(/-/g, ' ');
            return !term || (title + ' ' + id).toLowerCase().includes(term);
        }).sort((a, b) => String(a[1].title || a[0]).localeCompare(String(b[1].title || b[0]))).forEach(([id, config]) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'start-menu-app';
            button.dataset.menuApp = id;
            const icon = document.createElement('span');
            icon.className = 'start-menu-app-icon';
            icon.textContent = appIconFor(id);
            const title = document.createElement('span');
            title.textContent = String(config.title || id).replace(/-/g, ' ');
            button.append(icon, title);
            startMenuApps.appendChild(button);
        });
        if (!startMenuApps.children.length) {
            const empty = document.createElement('p');
            empty.className = 'start-menu-empty';
            empty.textContent = 'No apps match your search.';
            startMenuApps.appendChild(empty);
        }
    }

    function renderDesktopShortcuts() {
        if (!desktopShortcutsRoot) return;
        desktopShortcutsRoot.replaceChildren();
        desktopAppShortcuts.filter(([id]) => appMap[id]).forEach(([id, title, icon]) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'desktop-shortcut';
            button.dataset.desktopShortcut = id;
            button.title = (displaySettings.desktopDoubleClick ? 'Double-click to open ' : 'Click to open ') + title;
            button.setAttribute('aria-label', title);
            const glyph = document.createElement('span');
            glyph.className = 'desktop-shortcut-icon';
            glyph.textContent = icon;
            const label = document.createElement('span');
            label.className = 'desktop-shortcut-label';
            label.textContent = title;
            button.append(glyph, label);
            desktopShortcutsRoot.appendChild(button);
        });
    }
    const displaySettings = readDisplaySettings();

    renderDesktopShortcuts();
    renderStartMenuApps();

    // Desktop shortcut positions are saved per browser and can be rearranged with mouse or touch.
    const shortcutPositionsKey = 'orvexa-desktop-shortcut-positions';
    let shortcutPositions = {};
    try {
        const savedPositions = JSON.parse(window.localStorage.getItem(shortcutPositionsKey) || '{}');
        if (savedPositions && typeof savedPositions === 'object' && !Array.isArray(savedPositions)) {
            shortcutPositions = savedPositions;
        }
    } catch (_) { shortcutPositions = {}; }

    function saveShortcutPositions() {
        try {
            window.localStorage.setItem(shortcutPositionsKey, JSON.stringify(shortcutPositions));
        } catch (error) {
            console.warn('[OrvexaOS] Desktop shortcut positions could not be saved.', error);
        }
    }

    function positionDesktopShortcuts() {
        if (!desktopShortcutsRoot) return;
        const buttons = Array.from(desktopShortcutsRoot.querySelectorAll('[data-desktop-shortcut]'));
        const rootWidth = desktopShortcutsRoot.clientWidth || Math.max(240, window.innerWidth - 36);
        const rootHeight = desktopShortcutsRoot.clientHeight || Math.max(240, window.innerHeight - 114);
        const columnWidth = desktop?.dataset.desktopIconSize === 'small' ? 78 : 94;
        const rowHeight = desktop?.dataset.desktopIconSize === 'small' ? 72 : 90;
        buttons.forEach((button, index) => {
            const id = button.dataset.desktopShortcut;
            const saved = shortcutPositions[id];
            const defaultPosition = { x: Math.floor(index / 5) * columnWidth, y: (index % 5) * rowHeight };
            const x = Number.isFinite(saved?.x) ? saved.x : defaultPosition.x;
            const y = Number.isFinite(saved?.y) ? saved.y : defaultPosition.y;
            button.style.position = 'absolute';
            button.style.left = Math.max(0, Math.min(x, Math.max(0, rootWidth - button.offsetWidth))) + 'px';
            button.style.top = Math.max(0, Math.min(y, Math.max(0, rootHeight - button.offsetHeight))) + 'px';
        });
    }

    positionDesktopShortcuts();
    window.addEventListener('resize', positionDesktopShortcuts);

    let shortcutDrag = null;
    let draggedShortcutClick = null;
    if (desktopShortcutsRoot) {
        desktopShortcutsRoot.addEventListener('pointerdown', (event) => {
            const shortcut = event.target.closest('[data-desktop-shortcut]');
            if (!shortcut || (event.pointerType === 'mouse' && event.button !== 0)) return;
            if (event.target.closest('a, input, textarea, select')) return;
            const rect = shortcut.getBoundingClientRect();
            shortcutDrag = {
                element: shortcut,
                pointerId: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                offsetX: event.clientX - rect.left,
                offsetY: event.clientY - rect.top,
                startLeft: shortcut.offsetLeft,
                startTop: shortcut.offsetTop,
                moved: false
            };
            try { shortcut.setPointerCapture(event.pointerId); } catch (_) {}
        });

        desktopShortcutsRoot.addEventListener('pointermove', (event) => {
            if (!shortcutDrag || event.pointerId !== shortcutDrag.pointerId) return;
            const dx = event.clientX - shortcutDrag.startX;
            const dy = event.clientY - shortcutDrag.startY;
            if (!shortcutDrag.moved && Math.hypot(dx, dy) < 5) return;
            shortcutDrag.moved = true;
            const rootRect = desktopShortcutsRoot.getBoundingClientRect();
            const button = shortcutDrag.element;
            const maxX = Math.max(0, desktopShortcutsRoot.clientWidth - button.offsetWidth);
            const maxY = Math.max(0, desktopShortcutsRoot.clientHeight - button.offsetHeight);
            const left = Math.max(0, Math.min(event.clientX - rootRect.left - shortcutDrag.offsetX, maxX));
            const top = Math.max(0, Math.min(event.clientY - rootRect.top - shortcutDrag.offsetY, maxY));
            button.style.left = left + 'px';
            button.style.top = top + 'px';
            button.classList.add('is-dragging');
        });

        function finishShortcutDrag(event) {
            if (!shortcutDrag || (event && event.pointerId !== shortcutDrag.pointerId)) return;
            const drag = shortcutDrag;
            shortcutDrag = null;
            drag.element.classList.remove('is-dragging');
            if (drag.moved) {
                shortcutPositions[drag.element.dataset.desktopShortcut] = {
                    x: drag.element.offsetLeft,
                    y: drag.element.offsetTop
                };
                saveShortcutPositions();
                draggedShortcutClick = drag.element.dataset.desktopShortcut;
                window.setTimeout(() => { draggedShortcutClick = null; }, 0);
                if (event) event.preventDefault();
            }
        }

        desktopShortcutsRoot.addEventListener('pointerup', finishShortcutDrag);
        desktopShortcutsRoot.addEventListener('pointercancel', finishShortcutDrag);
    }

    const commandPalette = document.getElementById('commandPalette');
    const commandPaletteInput = document.getElementById('commandPaletteInput');
    const commandPaletteResults = document.getElementById('commandPaletteResults');
    let paletteCommands = [];
    let paletteActiveIndex = 0;
    let palettePreviousFocus = null;

    function getPaletteCommands() {
        const appCommands = Object.entries(appMap).map(([id, config]) => ({
            id,
            title: String(config.title || id).replace(/-/g, ' '),
            subtitle: id === 'browser' ? 'Open the app store' : id === 'system-monitor' ? 'View running apps and system activity' : 'Launch application',
            icon: ({ home: '⌂', files: '📁', browser: '▧', messages: '💬', settings: '⚙', calc: '🧮', focus: '⏱️', notes: '📝', calendar: '📅', 'system-monitor': '▤', 'app-store': '🛍️', 'unit-converter': '⇄', 'json-studio': '{ }', markdown: '✍️', habits: '✓', expenses: '💸', 'password-generator': '🔑', stopwatch: '⏱', pomodoro: '🍅', countdown: '⌛', checklist: '☑', kanban: '🗂', bookmarks: '🔖', 'reading-list': '📚', journal: '📓', flashcards: '🃏', 'random-picker': '🎲', 'csv-viewer': '📊', 'base64-tool': '🔐', 'url-tool': '🔗', 'timestamp-tool': '🕰', 'regex-tester': '🧪', 'text-diff': '↔', 'contrast-checker': '◐', 'gradient-studio': '🌈', 'invoice-maker': '🧾', 'tip-splitter': '🍽', 'loan-calculator': '🏦', 'bmi-calculator': '📏', 'world-clock': '🌍', 'daily-planner': '🗓' })[id] || (pluginManager.getPlugins().find((plugin) => plugin.id === id)?.icon || '🧩'),
            kind: 'app'
        }));
        const actions = [
            { id: 'action-settings', title: 'Open Settings', subtitle: 'Personalize appearance and privacy', icon: '⚙', kind: 'action', action: 'settings' },
            { id: 'action-control-center', title: 'Toggle Control Center', subtitle: 'Quick display controls · Alt+C', icon: '☼', kind: 'action', action: 'control-center' },
            { id: 'action-notifications', title: 'Open Notifications', subtitle: 'Review recent system alerts', icon: '♧', kind: 'action', action: 'notifications' },
            { id: 'action-theme', title: 'Switch Light / Dark Theme', subtitle: 'Change the desktop appearance', icon: '◐', kind: 'action', action: 'theme' }
        ];
        return [...actions, ...appCommands];
    }

    function renderCommandPalette(query = '') {
        if (!commandPaletteResults) return;
        const normalized = query.trim().toLocaleLowerCase();
        paletteCommands = getPaletteCommands().filter((item) =>
            !normalized || `${item.title} ${item.subtitle} ${item.id}`.toLocaleLowerCase().includes(normalized)
        );
        paletteActiveIndex = Math.min(paletteActiveIndex, Math.max(0, paletteCommands.length - 1));
        commandPaletteResults.replaceChildren();
        if (!paletteCommands.length) {
            const empty = document.createElement('p');
            empty.className = 'command-palette-empty';
            empty.textContent = 'No matching apps or actions.';
            commandPaletteResults.appendChild(empty);
            return;
        }
        paletteCommands.forEach((item, index) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'command-palette-item';
            button.dataset.paletteIndex = String(index);
            button.setAttribute('role', 'option');
            button.setAttribute('aria-selected', String(index === paletteActiveIndex));
            const icon = document.createElement('span');
            icon.className = 'command-palette-icon';
            icon.textContent = item.icon;
            const copy = document.createElement('span');
            copy.className = 'command-palette-copy';
            const title = document.createElement('strong');
            title.textContent = item.title;
            const subtitle = document.createElement('small');
            subtitle.textContent = item.subtitle;
            copy.append(title, subtitle);
            const hint = document.createElement('span');
            hint.className = 'command-palette-hint';
            hint.textContent = item.kind === 'app' ? 'Open ↵' : 'Run ↵';
            button.append(icon, copy, hint);
            commandPaletteResults.appendChild(button);
        });
    }

    function openCommandPalette() {
        if (!commandPalette || !commandPaletteInput) return;
        palettePreviousFocus = document.activeElement;
        setControlCenterOpen(false);
        setNotificationCenterOpen(false);
        commandPalette.hidden = false;
        commandPaletteInput.value = '';
        paletteActiveIndex = 0;
        renderCommandPalette('');
        window.requestAnimationFrame(() => commandPaletteInput.focus());
    }

    function closeCommandPalette() {
        if (!commandPalette || commandPalette.hidden) return;
        commandPalette.hidden = true;
        if (palettePreviousFocus && typeof palettePreviousFocus.focus === 'function') palettePreviousFocus.focus();
    }

    function runPaletteCommand(item) {
        if (!item) return;
        closeCommandPalette();
        if (item.kind === 'app') {
            if (openApp(item.id)) updateTaskbarState(item.id);
            return;
        }
        if (item.action === 'settings') {
            openApp('settings');
            updateTaskbarState('settings');
        } else if (item.action === 'control-center') {
            setControlCenterOpen(controlCenter.hidden);
        } else if (item.action === 'notifications') {
            setNotificationCenterOpen(true);
        } else if (item.action === 'theme') {
            displaySettings.lightTheme = !displaySettings.lightTheme;
            saveDisplaySettings();
        }
    }

    const paletteTaskbarButton = document.querySelector('[data-command-palette]');
    if (paletteTaskbarButton) paletteTaskbarButton.addEventListener('click', openCommandPalette);

    if (commandPaletteInput) {
        commandPaletteInput.addEventListener('input', () => {
            paletteActiveIndex = 0;
            renderCommandPalette(commandPaletteInput.value);
        });
    }

    if (commandPaletteResults) {
        commandPaletteResults.addEventListener('click', (event) => {
            const button = event.target.closest('[data-palette-index]');
            if (button) runPaletteCommand(paletteCommands[Number(button.dataset.paletteIndex)]);
        });
        commandPaletteResults.addEventListener('mousemove', (event) => {
            const button = event.target.closest('[data-palette-index]');
            if (!button) return;
            paletteActiveIndex = Number(button.dataset.paletteIndex);
            commandPaletteResults.querySelectorAll('[data-palette-index]').forEach((item) => {
                item.setAttribute('aria-selected', String(item === button));
            });
        });
    }

    document.addEventListener('keydown', (event) => {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
            event.preventDefault();
            if (commandPalette && !commandPalette.hidden) closeCommandPalette();
            else openCommandPalette();
            return;
        }
        if (!commandPalette || commandPalette.hidden) return;
        if (event.key === 'Escape') {
            event.preventDefault();
            closeCommandPalette();
        } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            if (!paletteCommands.length) return;
            const direction = event.key === 'ArrowDown' ? 1 : -1;
            paletteActiveIndex = (paletteActiveIndex + direction + paletteCommands.length) % paletteCommands.length;
            renderCommandPalette(commandPaletteInput.value);
            const active = commandPaletteResults.querySelector(`[data-palette-index="${paletteActiveIndex}"]`);
            if (active) active.scrollIntoView({ block: 'nearest' });
        } else if (event.key === 'Enter') {
            event.preventDefault();
            runPaletteCommand(paletteCommands[paletteActiveIndex]);
        }
    });

    if (commandPalette) {
        commandPalette.addEventListener('click', (event) => {
            if (event.target === commandPalette) closeCommandPalette();
        });
    }

    function updateClock() {
        const clockNode = document.getElementById('systemClock');
        if (!clockNode) return;

        const now = new Date();
        const dateNode = document.getElementById('systemDate');
        if (dateNode) {
            dateNode.textContent = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
        }
        const time = now.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: !displaySettings.clock24Hour
        });
        clockNode.textContent = time;
    }

    function readDisplaySettings() {
        try {
            const saved = JSON.parse(window.localStorage.getItem(displaySettingsKey) || '{}');
            return {
                lightTheme: saved.lightTheme === true,
                nightLight: saved.nightLight === true,
                brightness: Math.min(110, Math.max(65, Number(saved.brightness) || 100)),
                accent: ['fern', 'copper', 'ocean', 'custom'].includes(saved.accent) ? saved.accent : 'fern',
                wallpaper: ['meadow', 'tide', 'ember'].includes(saved.wallpaper) ? saved.wallpaper : 'meadow',
                doNotDisturb: saved.doNotDisturb === true,
                browserAlerts: saved.browserAlerts === true,
                customAccent: /^#[0-9a-f]{6}$/i.test(saved.customAccent || '') ? saved.customAccent : '#a9c49e',
                fontScale: Math.min(1.2, Math.max(0.85, Number(saved.fontScale) || 1)),
                windowOpacity: Math.min(1, Math.max(0.65, Number(saved.windowOpacity) || 0.94)),
                windowRadius: Math.min(28, Math.max(6, Number(saved.windowRadius) || 14)),
                taskbarPosition: ['center', 'left', 'right'].includes(saved.taskbarPosition) ? saved.taskbarPosition : 'center',
                compactMode: saved.compactMode === true,
                fontFamily: ['system', 'rounded', 'mono'].includes(saved.fontFamily) ? saved.fontFamily : 'system',
                reducedMotion: saved.reducedMotion === true,
                glassBlur: Math.min(32, Math.max(0, Number.isFinite(Number(saved.glassBlur)) ? Number(saved.glassBlur) : 18)),
                windowShadows: saved.windowShadows !== false,
                taskbarSize: Math.min(68, Math.max(40, Number(saved.taskbarSize) || 52)),
                taskbarLabels: saved.taskbarLabels === true,
                wallpaperFit: ['cover', 'contain'].includes(saved.wallpaperFit) ? saved.wallpaperFit : 'cover',
                desktopIconSize: ['small', 'medium', 'large'].includes(saved.desktopIconSize) ? saved.desktopIconSize : 'medium',
                showDesktopIcons: saved.showDesktopIcons !== false,
                desktopDoubleClick: saved.desktopDoubleClick !== false,
                touchFriendly: saved.touchFriendly !== false,
                taskbarAutoHide: saved.taskbarAutoHide === true,
                clock24Hour: saved.clock24Hour !== false,
                customWallpaper: typeof saved.customWallpaper === 'string' && saved.customWallpaper.startsWith('data:image/') && saved.customWallpaper.length < 2800000 ? saved.customWallpaper : ''
            };
        } catch (error) {
            return { lightTheme: false, nightLight: false, brightness: 100, accent: 'fern', wallpaper: 'meadow', doNotDisturb: false, browserAlerts: false, customAccent: '#a9c49e', fontScale: 1, windowOpacity: 0.94, windowRadius: 14, taskbarPosition: 'center', compactMode: false, fontFamily: 'system', reducedMotion: false, glassBlur: 18, windowShadows: true, taskbarSize: 52, taskbarLabels: false, wallpaperFit: 'cover', customWallpaper: '' };
        }
    }


    function applyDisplaySettings() {
        const themeLabel = document.querySelector('[data-theme-label]');
        const settingsThemeLabel = document.querySelector('[data-settings-theme-label]');

        desktop.classList.toggle('light-theme', displaySettings.lightTheme);
        desktop.classList.toggle('night-light', displaySettings.nightLight);
        desktop.dataset.accent = displaySettings.accent === 'custom' ? 'custom' : displaySettings.accent;
        desktop.dataset.wallpaper = displaySettings.wallpaper;
        desktop.style.setProperty('--desktop-brightness', `${displaySettings.brightness}%`);
        desktop.style.setProperty('--custom-accent-color', displaySettings.customAccent);
        desktop.style.setProperty('--ui-scale', String(displaySettings.fontScale));
        desktop.style.setProperty('--window-opacity', String(displaySettings.windowOpacity));
        desktop.style.setProperty('--window-radius', `${displaySettings.windowRadius}px`);
        desktop.dataset.taskbarPosition = displaySettings.taskbarPosition;
        desktop.classList.toggle('compact-layout', displaySettings.compactMode);
        desktop.classList.toggle('reduced-motion', displaySettings.reducedMotion);
        desktop.classList.toggle('no-window-shadows', !displaySettings.windowShadows);
        desktop.dataset.fontFamily = displaySettings.fontFamily;
        desktop.style.setProperty('--window-blur', displaySettings.glassBlur + 'px');
        desktop.style.setProperty('--taskbar-size', displaySettings.taskbarSize + 'px');
        desktop.dataset.wallpaperFit = displaySettings.wallpaperFit;
        desktop.classList.toggle('taskbar-labels', displaySettings.taskbarLabels);
        desktop.dataset.desktopIconSize = displaySettings.desktopIconSize;
        desktop.classList.toggle('hide-desktop-icons', !displaySettings.showDesktopIcons);
        desktop.classList.toggle('taskbar-auto-hide', displaySettings.taskbarAutoHide);
        desktop.classList.toggle('touch-friendly', displaySettings.touchFriendly);
        document.querySelectorAll('[data-display-icon-size]').forEach((input) => { input.value = displaySettings.desktopIconSize; });
        document.querySelectorAll('[data-display-show-icons]').forEach((input) => { input.checked = displaySettings.showDesktopIcons; });
        document.querySelectorAll('[data-display-double-click]').forEach((input) => { input.checked = displaySettings.desktopDoubleClick; });
        document.querySelectorAll('[data-display-touch-friendly]').forEach((input) => { input.checked = displaySettings.touchFriendly; });
        document.querySelectorAll('[data-display-taskbar-auto-hide]').forEach((input) => { input.checked = displaySettings.taskbarAutoHide; });
        document.querySelectorAll('[data-display-clock-24]').forEach((input) => { input.checked = displaySettings.clock24Hour; });
        document.querySelectorAll('[data-display-font]').forEach((input) => { input.value = displaySettings.fontFamily; });
        document.querySelectorAll('[data-display-motion]').forEach((input) => { input.checked = displaySettings.reducedMotion; });
        document.querySelectorAll('[data-display-glass-blur]').forEach((input) => { input.value = String(displaySettings.glassBlur); const out = input.closest('.settings-row')?.querySelector('output'); if (out) out.textContent = displaySettings.glassBlur + ' px'; });
        document.querySelectorAll('[data-display-shadows]').forEach((input) => { input.checked = displaySettings.windowShadows; });
        document.querySelectorAll('[data-display-taskbar-size]').forEach((input) => { input.value = String(displaySettings.taskbarSize); const out = input.closest('.settings-row')?.querySelector('output'); if (out) out.textContent = displaySettings.taskbarSize + ' px'; });
        document.querySelectorAll('[data-display-taskbar-labels]').forEach((input) => { input.checked = displaySettings.taskbarLabels; });
        document.querySelectorAll('[data-display-wallpaper-fit]').forEach((input) => { input.value = displaySettings.wallpaperFit; });
        desktop.style.setProperty('--custom-wallpaper-image', displaySettings.customWallpaper ? `url("${displaySettings.customWallpaper}")` : 'none');
        desktop.classList.toggle('has-custom-wallpaper', Boolean(displaySettings.customWallpaper));
        document.querySelectorAll('[data-display-custom-accent]').forEach((input) => { input.value = displaySettings.customAccent; });
        document.querySelectorAll('[data-display-scale]').forEach((input) => { input.value = String(Math.round(displaySettings.fontScale * 100)); const out = input.closest('.settings-row')?.querySelector('output'); if (out) out.textContent = `${input.value}%`; });
        document.querySelectorAll('[data-display-opacity]').forEach((input) => { input.value = String(Math.round(displaySettings.windowOpacity * 100)); const out = input.closest('.settings-row')?.querySelector('output'); if (out) out.textContent = `${input.value}%`; });
        document.querySelectorAll('[data-display-radius]').forEach((input) => { input.value = String(displaySettings.windowRadius); const out = input.closest('.settings-row')?.querySelector('output'); if (out) out.textContent = `${input.value} px`; });
        document.querySelectorAll('[data-display-taskbar-position]').forEach((input) => { input.value = displaySettings.taskbarPosition; });
        document.querySelectorAll('[data-display-compact]').forEach((input) => { input.checked = displaySettings.compactMode; });
        document.querySelectorAll('[data-display-theme]').forEach((button) => {
            button.setAttribute('aria-pressed', String(displaySettings.lightTheme));
            button.textContent = displaySettings.lightTheme ? 'Switch to Dark' : 'Switch to Light';
        });
        if (themeLabel) themeLabel.textContent = displaySettings.lightTheme ? 'Light' : 'Dark';
        if (settingsThemeLabel) settingsThemeLabel.textContent = displaySettings.lightTheme ? 'Light' : 'Dark';
        document.querySelectorAll('[data-display-brightness]').forEach((input) => {
            input.value = String(displaySettings.brightness);
            const output = input.closest('.control-setting, .settings-row')?.querySelector('output');
            if (output) output.textContent = `${displaySettings.brightness}%`;
        });
        document.querySelectorAll('[data-display-night-light]').forEach((input) => {
            input.checked = displaySettings.nightLight;
        });
        document.querySelectorAll('[data-display-accent-select]').forEach((select) => {
            select.value = displaySettings.accent;
        });
        document.querySelectorAll('[data-display-accent]').forEach((button) => {
            button.setAttribute('aria-pressed', String(button.dataset.displayAccent === displaySettings.accent));
        });
        document.querySelectorAll('[data-display-wallpaper]').forEach((button) => {
            button.setAttribute('aria-pressed', String(button.dataset.displayWallpaper === displaySettings.wallpaper));
        });
        document.querySelectorAll('[data-setting-dnd]').forEach((input) => {
            input.checked = displaySettings.doNotDisturb;
        });
        document.querySelectorAll('[data-setting-browser-notifications]').forEach((input) => {
            input.checked = displaySettings.browserAlerts;
        });
        renderNotificationCenter();
    }

    function saveDisplaySettings() {
        try {
            window.localStorage.setItem(displaySettingsKey, JSON.stringify(displaySettings));
        } catch (error) {
            // Display settings still apply for this session when storage is unavailable.
        }
        applyDisplaySettings();
    }

    function setControlCenterOpen(isOpen) {
        if (!controlCenter || !controlCenterToggle) return;
        controlCenter.hidden = !isOpen;
        controlCenterToggle.setAttribute('aria-expanded', String(isOpen));
        controlCenterToggle.setAttribute('aria-label', isOpen ? 'Close Control Center' : 'Open Control Center');
    }

    async function updateSettingsPermissions(root) {
        const list = root.querySelector('[data-settings-permissions]');
        const status = root.querySelector('[data-settings-privacy-status]');
        if (!list || !status) return;
        status.textContent = 'Reading browser permissions...';
        list.replaceChildren();
        const names = ['geolocation', 'camera', 'microphone', 'notifications'];
        const states = await Promise.all(names.map(async (name) => {
            try {
                if (!navigator.permissions?.query) return [name, 'Not supported'];
                const permission = await navigator.permissions.query({ name });
                return [name, permission.state];
            } catch (error) {
                return [name, 'Not available'];
            }
        }));
        states.forEach(([name, state]) => {
            const item = document.createElement('li');
            item.textContent = `${name}: ${state}`;
            list.appendChild(item);
        });
        status.textContent = 'Permission status updated. No access was requested.';
    }

    async function resetOfflineCache(root) {
        const button = root.querySelector('[data-cache-reset]');
        const status = root.querySelector('[data-cache-reset-status]');
        if (button && button.disabled) return;
        const confirmed = window.confirm('Reset the OrvexaOS offline cache and reload? Your saved files, notes, and settings will not be deleted.');
        if (!confirmed) return;

        if (button) {
            button.disabled = true;
            button.textContent = 'Resetting…';
        }
        if (status) status.textContent = 'Clearing cached app files…';

        try {
            if ('caches' in window) {
                const keys = await window.caches.keys();
                await Promise.all(keys.filter((key) => key.startsWith('orvexa-shell-')).map((key) => window.caches.delete(key)));
            }

            if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                const pagePath = new URL('./', window.location.href).pathname;
                await Promise.all(registrations
                    .filter((registration) => new URL(registration.scope).origin === window.location.origin &&
                        new URL(registration.scope).pathname.startsWith(pagePath))
                    .map((registration) => registration.unregister()));
            }

            if (status) status.textContent = 'Cache cleared. Reloading OrvexaOS…';
            window.setTimeout(() => window.location.reload(), 350);
        } catch (error) {
            console.error('[OrvexaOS] Cache reset failed:', error);
            if (status) status.textContent = 'Could not fully reset the offline cache. Check browser permissions and try again.';
            if (button) {
                button.disabled = false;
                button.textContent = 'Retry cache reset';
            }
        }
    }

    async function updateSettingsSystem(root) {
        const platform = root.querySelector('[data-settings-platform]');
        const pluginCount = root.querySelector('[data-settings-plugin-count]');
        const storage = root.querySelector('[data-settings-storage]');
        if (platform) platform.textContent = navigator.userAgentData?.platform || navigator.platform || 'Unavailable';
        if (pluginCount) pluginCount.textContent = String(pluginManager.getPlugins().length);
        if (!storage) return;

        try {
            const estimate = await navigator.storage?.estimate();
            if (!estimate || typeof estimate.usage !== 'number') {
                storage.textContent = 'Unavailable';
                return;
            }
            const used = estimate.usage < 1024 * 1024
                ? `${Math.round(estimate.usage / 1024)} KB used`
                : `${(estimate.usage / (1024 * 1024)).toFixed(1)} MB used`;
            storage.textContent = used;
        } catch (error) {
            storage.textContent = 'Unavailable';
        }
    }

    function initializeSettings(element) {
        const root = element.querySelector('[data-settings-root]');
        if (!root) return;
        applyDisplaySettings();
        updateSettingsPermissions(root);
        updateSettingsSystem(root);
    }

    function activateSettingsTab(button) {
        const root = button.closest('[data-settings-root]');
        if (!root) return;
        const search = root.querySelector('[data-settings-search]');
        const searchStatus = root.querySelector('[data-settings-search-status]');
        if (search) search.value = '';
        if (searchStatus) { searchStatus.hidden = true; searchStatus.textContent = ''; }
        root.querySelectorAll('.settings-row, .settings-facts > div').forEach((row) => { row.hidden = false; });
        root.querySelectorAll('[data-settings-tab]').forEach((tab) => {
            const selected = tab === button;
            tab.setAttribute('aria-selected', String(selected));
            tab.tabIndex = selected ? 0 : -1;
        });
        root.querySelectorAll('[data-settings-panel]').forEach((panel) => {
            panel.hidden = panel.dataset.settingsPanel !== button.dataset.settingsTab;
        });
        if (button.dataset.settingsTab === 'system') updateSettingsSystem(root);
        if (button.dataset.settingsTab === 'privacy') updateSettingsPermissions(root);
    }

    async function enableBrowserNotifications(root, input) {
        const status = root.querySelector('[data-notification-settings-status]');
        if (!('Notification' in window)) {
            displaySettings.browserAlerts = false;
            input.checked = false;
            status.textContent = 'Browser notifications are not supported here.';
            saveDisplaySettings();
            return;
        }
        if (Notification.permission === 'granted') {
            displaySettings.browserAlerts = true;
            status.textContent = 'Browser alerts are enabled.';
            saveDisplaySettings();
            return;
        }
        if (Notification.permission === 'denied') {
            displaySettings.browserAlerts = false;
            input.checked = false;
            status.textContent = 'Permission is blocked in browser settings.';
            saveDisplaySettings();
            return;
        }
        status.textContent = 'Waiting for browser permission...';
        try {
            const permission = await Notification.requestPermission();
            displaySettings.browserAlerts = permission === 'granted';
            input.checked = displaySettings.browserAlerts;
            status.textContent = displaySettings.browserAlerts
                ? 'Browser alerts are enabled.'
                : 'Permission was not granted; OrvexaOS notifications remain in the tray.';
        } catch (error) {
            displaySettings.browserAlerts = false;
            input.checked = false;
            status.textContent = 'Could not request browser notification permission.';
        }
        saveDisplaySettings();
    }

    function updateTaskbarState(appId) {
        const activeApp = String(appId || 'home');
        taskbarButtons.forEach((button) => {
            const isActive = button.dataset.app === activeApp;
            button.classList.toggle('active', isActive);
            button.setAttribute('aria-pressed', String(isActive));
        });
    }

    let cachedBattery = null;
    let batteryListenersAttached = false;

    function updateSystemStatus() {
        const wifiStatus = document.getElementById('wifiStatus');
        const batteryStatus = document.getElementById('batteryStatus');
        const batteryLevel = document.getElementById('batteryLevel');

        if (wifiStatus) {
            const online = navigator.onLine;
            const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
            const quality = connection && connection.effectiveType ? connection.effectiveType : '';
            wifiStatus.textContent = online ? '📶' : '⚠️';
            wifiStatus.title = online ? (quality ? 'Online · ' + quality.toUpperCase() : 'Online') : 'Offline';
            wifiStatus.setAttribute('aria-label', wifiStatus.title);
            wifiStatus.dataset.connection = online ? 'online' : 'offline';
        }

        if (!batteryStatus || !batteryLevel) return;
        if (!navigator.getBattery) {
            batteryLevel.textContent = '—';
            batteryStatus.textContent = '🔋';
            batteryStatus.title = 'Battery status is not supported by this browser';
            batteryStatus.setAttribute('aria-label', batteryStatus.title);
            return;
        }
        if (cachedBattery) {
            renderBatteryStatus(cachedBattery);
            return;
        }
        navigator.getBattery().then((battery) => {
            cachedBattery = battery;
            renderBatteryStatus(battery);
            if (!batteryListenersAttached) {
                batteryListenersAttached = true;
                battery.addEventListener('levelchange', () => renderBatteryStatus(battery));
                battery.addEventListener('chargingchange', () => renderBatteryStatus(battery));
            }
        }).catch(() => {
            batteryLevel.textContent = '—';
            batteryStatus.textContent = '🔋';
            batteryStatus.title = 'Battery status is unavailable';
            batteryStatus.setAttribute('aria-label', batteryStatus.title);
        });
    }

    function renderBatteryStatus(battery) {
        const batteryStatus = document.getElementById('batteryStatus');
        const batteryLevel = document.getElementById('batteryLevel');
        if (!batteryStatus || !batteryLevel || !battery) return;
        const percentage = Math.round(battery.level * 100);
        batteryLevel.textContent = percentage + '%';
        batteryStatus.textContent = battery.charging ? '⚡' : '🔋';
        batteryStatus.title = (battery.charging ? 'Charging · ' : 'Battery · ') + percentage + '%';
        batteryStatus.setAttribute('aria-label', batteryStatus.title);
    }

    window.addEventListener('online', updateSystemStatus);
    window.addEventListener('offline', updateSystemStatus);

    taskbarButtons.forEach((button) => {
        button.addEventListener('click', () => {
            openApp(button.dataset.app);
            updateTaskbarState(button.dataset.app);
        });
    });

    if (controlCenterToggle) {
        controlCenterToggle.addEventListener('click', () => {
            if (controlCenter.hidden) setNotificationCenterOpen(false);
            setControlCenterOpen(controlCenter.hidden);
        });
    }

    if (controlCenterClose) {
        controlCenterClose.addEventListener('click', () => setControlCenterOpen(false));
    }

    document.querySelectorAll('[data-quick-app]').forEach((button) => {
        button.addEventListener('click', () => {
            openApp(button.dataset.quickApp);
            updateTaskbarState(button.dataset.quickApp);
            setControlCenterOpen(false);
        });
    });

    document.addEventListener('input', (event) => {
        const settingsSearch = event.target.closest('[data-settings-search]');
        if (settingsSearch) {
            const root = settingsSearch.closest('[data-settings-root]');
            const panel = root && root.querySelector('[data-settings-panel]:not([hidden])');
            const status = root && root.querySelector('[data-settings-search-status]');
            const query = settingsSearch.value.trim().toLowerCase();
            const rows = Array.from((panel || root || document).querySelectorAll('.settings-row, .settings-facts > div'));
            let matches = 0;
            rows.forEach((row) => { const match = !query || row.textContent.toLowerCase().includes(query); row.hidden = !match; if (match) matches += 1; });
            if (status) { status.hidden = !query; status.textContent = query ? (matches ? matches + ' matching setting(s)' : 'No settings found in this section') : ''; }
            return;
        }
        const glassBlur = event.target.closest('[data-display-glass-blur]');
        if (glassBlur) { displaySettings.glassBlur = Number(glassBlur.value); saveDisplaySettings(); return; }
        const taskbarSize = event.target.closest('[data-display-taskbar-size]');
        if (taskbarSize) { displaySettings.taskbarSize = Number(taskbarSize.value); saveDisplaySettings(); return; }
        const brightness = event.target.closest('[data-display-brightness]');
        if (brightness) {
            displaySettings.brightness = Number(brightness.value);
            saveDisplaySettings();
            return;
        }
        const scale = event.target.closest('[data-display-scale]');
        if (scale) { displaySettings.fontScale = Number(scale.value) / 100; saveDisplaySettings(); return; }
        const opacity = event.target.closest('[data-display-opacity]');
        if (opacity) { displaySettings.windowOpacity = Number(opacity.value) / 100; saveDisplaySettings(); return; }
        const radius = event.target.closest('[data-display-radius]');
        if (radius) { displaySettings.windowRadius = Number(radius.value); saveDisplaySettings(); return; }

        const noteField = event.target.closest('[data-note-field]');
        if (noteField) {
            saveNoteField(noteField);
            return;
        }

        const fileField = event.target.closest('[data-file-name], [data-file-content]');
        if (fileField) {
            saveFileField(fileField);
            return;
        }

        const search = event.target.closest('[data-home-search]');
        if (!search) return;
        const content = search.closest('.window-content');
        const term = search.value.trim().toLowerCase();
        const filter = content.dataset.appFilter || 'all';
        const tiles = Array.from(content.querySelectorAll('.app-tile'));
        let visibleCount = 0;
        tiles.forEach((tile) => {
            const name = tile.querySelector('strong')?.textContent.toLowerCase() || tile.textContent.toLowerCase();
            const categoryMatches = filter === 'all' || tile.dataset.appKind === filter;
            const matches = categoryMatches && name.includes(term);
            tile.classList.toggle('hidden', !matches);
            if (matches) visibleCount += 1;
        });
        const emptyState = content.querySelector('[data-home-empty]');
        if (emptyState) emptyState.hidden = visibleCount > 0;
    });

    document.addEventListener('change', (event) => {
        const iconSize = event.target.closest('[data-display-icon-size]');
        if (iconSize) { displaySettings.desktopIconSize = ['small', 'medium', 'large'].includes(iconSize.value) ? iconSize.value : 'medium'; saveDisplaySettings(); return; }
        const showIcons = event.target.closest('[data-display-show-icons]');
        if (showIcons) { displaySettings.showDesktopIcons = showIcons.checked; saveDisplaySettings(); return; }
        const doubleClick = event.target.closest('[data-display-double-click]');
        if (doubleClick) { displaySettings.desktopDoubleClick = doubleClick.checked; saveDisplaySettings(); return; }
        const touchFriendly = event.target.closest('[data-display-touch-friendly]');
        if (touchFriendly) { displaySettings.touchFriendly = touchFriendly.checked; saveDisplaySettings(); return; }
        const autoHide = event.target.closest('[data-display-taskbar-auto-hide]');
        if (autoHide) { displaySettings.taskbarAutoHide = autoHide.checked; saveDisplaySettings(); return; }
        const clock24 = event.target.closest('[data-display-clock-24]');
        if (clock24) { displaySettings.clock24Hour = clock24.checked; updateClock(); saveDisplaySettings(); return; }
        const fontFamily = event.target.closest('[data-display-font]');
        if (fontFamily) { displaySettings.fontFamily = ['system', 'rounded', 'mono'].includes(fontFamily.value) ? fontFamily.value : 'system'; saveDisplaySettings(); return; }
        const reducedMotion = event.target.closest('[data-display-motion]');
        if (reducedMotion) { displaySettings.reducedMotion = reducedMotion.checked; saveDisplaySettings(); return; }
        const shadows = event.target.closest('[data-display-shadows]');
        if (shadows) { displaySettings.windowShadows = shadows.checked; saveDisplaySettings(); return; }
        const taskbarLabels = event.target.closest('[data-display-taskbar-labels]');
        if (taskbarLabels) { displaySettings.taskbarLabels = taskbarLabels.checked; saveDisplaySettings(); return; }
        const wallpaperFit = event.target.closest('[data-display-wallpaper-fit]');
        if (wallpaperFit) { displaySettings.wallpaperFit = wallpaperFit.value === 'contain' ? 'contain' : 'cover'; saveDisplaySettings(); return; }
        const customAccent = event.target.closest('[data-display-custom-accent]');
        if (customAccent) { displaySettings.customAccent = /^#[0-9a-f]{6}$/i.test(customAccent.value) ? customAccent.value : '#a9c49e'; displaySettings.accent = 'custom'; saveDisplaySettings(); return; }
        const taskbarPosition = event.target.closest('[data-display-taskbar-position]');
        if (taskbarPosition) { displaySettings.taskbarPosition = ['left','center','right'].includes(taskbarPosition.value) ? taskbarPosition.value : 'center'; saveDisplaySettings(); return; }
        const compact = event.target.closest('[data-display-compact]');
        if (compact) { displaySettings.compactMode = compact.checked; saveDisplaySettings(); return; }
        const customWallpaper = event.target.closest('[data-display-custom-wallpaper]');
        if (customWallpaper && customWallpaper.files?.[0]) {
            const file = customWallpaper.files[0];
            if (!file.type.startsWith('image/') || file.size > 2 * 1024 * 1024) { notifyUser('Wallpaper not applied', 'Choose an image smaller than 2 MB.'); customWallpaper.value = ''; return; }
            const reader = new FileReader();
            reader.onload = () => { if (typeof reader.result === 'string' && reader.result.startsWith('data:image/')) { displaySettings.customWallpaper = reader.result; saveDisplaySettings(); } };
            reader.readAsDataURL(file); customWallpaper.value = ''; return;
        }
        const nightLight = event.target.closest('[data-display-night-light]');
        if (nightLight) {
            displaySettings.nightLight = nightLight.checked;
            saveDisplaySettings();
            return;
        }
        const doNotDisturb = event.target.closest('[data-setting-dnd]');
        if (doNotDisturb) {
            displaySettings.doNotDisturb = doNotDisturb.checked;
            saveDisplaySettings();
            return;
        }
        const browserAlerts = event.target.closest('[data-setting-browser-notifications]');
        if (browserAlerts) {
            const root = browserAlerts.closest('[data-settings-root]');
            if (browserAlerts.checked) {
                enableBrowserNotifications(root, browserAlerts);
            } else {
                displaySettings.browserAlerts = false;
                const status = root.querySelector('[data-notification-settings-status]');
                if (status) status.textContent = 'Browser alerts are off; notifications remain in the tray.';
                saveDisplaySettings();
            }
            return;
        }
        const fileImport = event.target.closest('[data-file-import]');
        if (fileImport) importTextFile(fileImport);
    });

    document.addEventListener('submit', (event) => {
        const form = event.target.closest('[data-calendar-form]');
        if (!form) return;
        event.preventDefault();
        const root = form.closest('[data-calendar-root]');
        const input = form.elements.event;
        const title = input.value.trim();
        if (!title) return;
        const savedEvents = readAppData('calendar', []);
        const events = Array.isArray(savedEvents) ? savedEvents : [];
        events.push({ id: newLocalId(), date: root.dataset.calendarDate, title });
        writeAppData('calendar', events);
        input.value = '';
        renderCalendar(root);
        notifyUser('Calendar event added', title);
    });

    if (startMenuSearch) startMenuSearch.addEventListener('input', () => renderStartMenuApps(startMenuSearch.value));
    if (desktop) {
        windowArea.addEventListener('dblclick', (event) => {
            if (event.target === windowArea) toggleStartMenu();
        });
        desktop.addEventListener('dblclick', (event) => {
            const shortcut = event.target.closest('[data-desktop-shortcut]');
            if (shortcut && displaySettings.desktopDoubleClick) {
                openApp(shortcut.dataset.desktopShortcut);
                updateTaskbarState(shortcut.dataset.desktopShortcut);
                return;
            }
            if (event.target === desktop || event.target === desktopShortcutsRoot) toggleStartMenu();
        });
        desktop.addEventListener('click', (event) => {
            if (!event.target.closest('#startMenu, [data-start-menu-toggle], [data-desktop-shortcut]') && startMenu && !startMenu.hidden) closeStartMenu();
        });
    }

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeStartMenu();
            if (commandPalette && !commandPalette.hidden) return;
            setControlCenterOpen(false);
            setNotificationCenterOpen(false);
        }
        if (event.altKey && event.key.toLowerCase() === 'c') {
            event.preventDefault();
            setControlCenterOpen(controlCenter.hidden);
        }
    });

    let focusInterval = null;
    function stopFocusTimer(root) { if (focusInterval !== null) { clearInterval(focusInterval); focusInterval = null; } if (root) root.dataset.running = 'false'; }
    function renderFocusTimer(root) {
        const remaining = Math.max(0, Number(root.dataset.remaining) || 0);
        const clock = root.querySelector('[data-focus-clock]');
        if (clock) clock.textContent = String(Math.floor(remaining / 60)).padStart(2, '0') + ':' + String(remaining % 60).padStart(2, '0');
        const start = root.querySelector('[data-focus-start]'); if (start) start.textContent = root.dataset.running === 'true' ? 'Pause timer' : 'Start focus';
        if (remaining === 0) { stopFocusTimer(root); const status = root.querySelector('[data-focus-status]'); if (status) status.textContent = 'Session complete — take a short break.'; if (root.dataset.completed !== 'true') { root.dataset.completed = 'true'; notifyUser('Focus session complete', (root.querySelector('[data-focus-task]')?.value || 'Your focus session') + ' — well done!'); } }
    }
    function setFocusDuration(root, seconds) { stopFocusTimer(root); root.dataset.remaining = String(seconds); root.dataset.completed = 'false'; root.querySelectorAll('[data-focus-preset]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.focusPreset) === seconds))); const status = root.querySelector('[data-focus-status]'); if (status) status.textContent = 'Timer updated. Ready when you are.'; renderFocusTimer(root); }
    function toggleFocusTimer(root) {
        if (root.dataset.running === 'true') { stopFocusTimer(root); const status = root.querySelector('[data-focus-status]'); if (status) status.textContent = 'Paused. Resume whenever you are ready.'; renderFocusTimer(root); return; }
        if (Number(root.dataset.remaining) <= 0) setFocusDuration(root, 1500); root.dataset.running = 'true'; root.dataset.completed = 'false'; const status = root.querySelector('[data-focus-status]'); if (status) status.textContent = 'Focus session in progress.'; renderFocusTimer(root);
        focusInterval = setInterval(() => { if (!root.isConnected || root.dataset.running !== 'true') { stopFocusTimer(root); return; } root.dataset.remaining = String(Math.max(0, Number(root.dataset.remaining) - 1)); renderFocusTimer(root); }, 1000);
    }

    document.addEventListener('click', (event) => {
        if (event.target.closest('[data-fullscreen-toggle]')) { toggleSystemFullscreen(); return; }
        if (event.target.closest('[data-start-menu-toggle]')) { toggleStartMenu(); return; }
        if (event.target.closest('[data-start-menu-close]')) { closeStartMenu(); return; }
        const menuApp = event.target.closest('[data-menu-app]');
        if (menuApp) { openApp(menuApp.dataset.menuApp); updateTaskbarState(menuApp.dataset.menuApp); return; }
        const desktopShortcut = event.target.closest('[data-desktop-shortcut]');
        if (desktopShortcut) {
            if (draggedShortcutClick === desktopShortcut.dataset.desktopShortcut) {
                event.preventDefault();
                return;
            }
            document.querySelectorAll('.desktop-shortcut.is-selected').forEach((node) => node.classList.remove('is-selected'));
            desktopShortcut.classList.add('is-selected');
            const touch = window.matchMedia('(pointer: coarse)').matches || (navigator.maxTouchPoints || 0) > 0;
            if (!displaySettings.desktopDoubleClick || touch) {
                openApp(desktopShortcut.dataset.desktopShortcut);
                updateTaskbarState(desktopShortcut.dataset.desktopShortcut);
            }
            return;
        }
        const focusRoot = event.target.closest('[data-focus-root]');
        const focusPreset = event.target.closest('[data-focus-preset]');
        if (focusRoot && focusPreset) { setFocusDuration(focusRoot, Number(focusPreset.dataset.focusPreset)); return; }
        if (focusRoot && event.target.closest('[data-focus-start]')) { toggleFocusTimer(focusRoot); return; }
        if (focusRoot && event.target.closest('[data-focus-reset]')) { const selected = focusRoot.querySelector('[aria-pressed="true"][data-focus-preset]'); setFocusDuration(focusRoot, Number(selected?.dataset.focusPreset) || 1500); const status = focusRoot.querySelector('[data-focus-status]'); if (status) status.textContent = 'Timer reset.'; return; }
        if (event.target.closest('#notificationToggle')) {
            const panel = document.getElementById('notificationCenter');
            if (panel.hidden) setControlCenterOpen(false);
            setNotificationCenterOpen(panel.hidden);
            return;
        }
        if (event.target.closest('[data-notification-close]')) {
            setNotificationCenterOpen(false);
            return;
        }
        if (event.target.closest('[data-notification-clear]')) {
            clearNotifications();
            return;
        }

        const fileWindowSave = event.target.closest('[data-file-window-save]');
        if (fileWindowSave) {
            saveFileWindow(fileWindowSave.closest('[data-file-window-root]'));
            return;
        }

        const fileRoot = event.target.closest('[data-files-root]');
        if (fileRoot && event.target.closest('[data-file-open-window]')) {
            openFileInWindow(fileRoot);
            return;
        }
        if (fileRoot && event.target.closest('[data-file-new]')) {
            createFile(fileRoot);
            return;
        }
        if (fileRoot && event.target.closest('[data-file-delete]')) {
            deleteActiveFile(fileRoot);
            return;
        }
        if (fileRoot && event.target.closest('[data-file-export]')) {
            exportActiveFile(fileRoot);
            return;
        }
        const fileChoice = event.target.closest('[data-file-select]');
        if (fileChoice && fileRoot) {
            const data = loadFiles();
            data.activeId = fileChoice.dataset.fileSelect;
            writeAppData('files', data);
            renderFiles(fileRoot);
            return;
        }

        const homeFilter = event.target.closest('[data-home-filter]');
        if (homeFilter) {
            const content = homeFilter.closest('.window-content');
            content.dataset.appFilter = homeFilter.dataset.homeFilter;
            content.querySelectorAll('[data-home-filter]').forEach((button) => {
                button.setAttribute('aria-pressed', String(button === homeFilter));
            });
            content.querySelector('[data-home-search]').dispatchEvent(new Event('input', { bubbles: true }));
            return;
        }

        const noteRoot = event.target.closest('[data-notes-root]');
        if (noteRoot && event.target.closest('[data-note-new]')) {
            createNote(noteRoot);
            return;
        }
        if (noteRoot && event.target.closest('[data-note-delete]')) {
            deleteActiveNote(noteRoot);
            return;
        }
        const noteChoice = event.target.closest('[data-note-select]');
        if (noteChoice && noteRoot) {
            const data = loadNotes();
            data.activeId = noteChoice.dataset.noteSelect;
            writeAppData('notes', data);
            renderNotes(noteRoot);
            return;
        }

        const calendarRoot = event.target.closest('[data-calendar-root]');
        const calendarShift = event.target.closest('[data-calendar-shift]');
        if (calendarRoot && calendarShift) {
            shiftCalendarMonth(calendarRoot, Number(calendarShift.dataset.calendarShift));
            return;
        }
        const calendarDay = event.target.closest('[data-calendar-day]');
        if (calendarRoot && calendarDay) {
            calendarRoot.dataset.calendarDate = calendarDay.dataset.calendarDay;
            renderCalendar(calendarRoot);
            return;
        }
        const calendarRemove = event.target.closest('[data-calendar-remove]');
        if (calendarRoot && calendarRemove) {
            const savedEvents = readAppData('calendar', []);
            const events = Array.isArray(savedEvents) ? savedEvents : [];
            writeAppData('calendar', events.filter((item) => item.id !== calendarRemove.dataset.calendarRemove));
            renderCalendar(calendarRoot);
            return;
        }

        const settingsTab = event.target.closest('[data-settings-tab]');
        if (settingsTab) {
            activateSettingsTab(settingsTab);
            return;
        }

        const themeButton = event.target.closest('[data-display-theme]');
        if (themeButton) {
            displaySettings.lightTheme = !displaySettings.lightTheme;
            saveDisplaySettings();
            return;
        }

        const presetButton = event.target.closest('[data-display-preset]');
        if (presetButton) {
            const presets = {
                forest: { lightTheme: false, accent: 'fern', wallpaper: 'meadow', customAccent: '#a9c49e', windowOpacity: 0.94, windowRadius: 14, fontScale: 1, compactMode: false },
                ocean: { lightTheme: false, accent: 'ocean', wallpaper: 'tide', customAccent: '#7cb8d9', windowOpacity: 0.92, windowRadius: 18, fontScale: 1, compactMode: false },
                ember: { lightTheme: false, accent: 'copper', wallpaper: 'ember', customAccent: '#e9a16b', windowOpacity: 0.96, windowRadius: 12, fontScale: 1, compactMode: true },
                frost: { lightTheme: true, accent: 'ocean', wallpaper: 'tide', customAccent: '#5c89d5', windowOpacity: 0.98, windowRadius: 20, fontScale: 1.04, compactMode: false }
            };
            const preset = presets[presetButton.dataset.displayPreset];
            if (preset) {
                Object.assign(displaySettings, preset);
                displaySettings.customWallpaper = '';
                saveDisplaySettings();
            }
            return;
        }

        const accentButton = event.target.closest('[data-display-accent]');
        if (accentButton) {
            displaySettings.accent = accentButton.dataset.displayAccent;
            saveDisplaySettings();
            return;
        }

        const wallpaperButton = event.target.closest('[data-display-wallpaper]');
        if (wallpaperButton) {
            displaySettings.wallpaper = wallpaperButton.dataset.displayWallpaper;
            saveDisplaySettings();
            return;
        }

        if (event.target.closest('[data-display-clear-wallpaper]')) {
            displaySettings.customWallpaper = '';
            saveDisplaySettings();
            const wallpaperInput = document.querySelector('[data-display-custom-wallpaper]');
            if (wallpaperInput) wallpaperInput.value = '';
            return;
        }

        if (event.target.closest('[data-settings-reset]')) {
            Object.assign(displaySettings, { lightTheme: false, nightLight: false, brightness: 100, accent: 'fern', wallpaper: 'meadow', customAccent: '#a9c49e', fontScale: 1, windowOpacity: 0.94, windowRadius: 14, taskbarPosition: 'center', compactMode: false, fontFamily: 'system', reducedMotion: false, glassBlur: 18, windowShadows: true, taskbarSize: 52, taskbarLabels: false, wallpaperFit: 'cover', desktopIconSize: 'medium', showDesktopIcons: true, desktopDoubleClick: true, touchFriendly: true, taskbarAutoHide: false, clock24Hour: true, customWallpaper: '' });
            saveDisplaySettings();
            return;
        }

        const settingsRoot = event.target.closest('[data-settings-root]');
        if (settingsRoot && event.target.closest('[data-cache-reset]')) {
            resetOfflineCache(settingsRoot);
            return;
        }
        if (settingsRoot && event.target.closest('[data-settings-refresh-privacy]')) {
            updateSettingsPermissions(settingsRoot);
            return;
        }
        if (settingsRoot && event.target.closest('[data-settings-refresh-system]')) {
            updateSettingsSystem(settingsRoot);
            return;
        }

        if (event.target.closest('[data-system-refresh]')) {
            updateSystemMonitor();
            return;
        }

        const systemAction = event.target.closest('[data-system-window-action]');
        if (systemAction) {
            const id = systemAction.dataset.systemTarget;
            if (systemAction.dataset.systemWindowAction === 'open') {
                windowHandler.open(id);
                updateTaskbarState(id);
            } else if (systemAction.dataset.systemWindowAction === 'minimize') {
                windowHandler.minimize(id);
            } else if (systemAction.dataset.systemWindowAction === 'close') {
                windowHandler.close(id);
            }
            updateSystemMonitor();
            return;
        }

        const tile = event.target.closest('[data-open-app]');
        if (!tile) return;
        openApp(tile.dataset.openApp);
        updateTaskbarState(tile.dataset.openApp);
    });


    async function toggleSystemFullscreen() {
        const target = document.documentElement;
        try {
            if (document.fullscreenElement || document.webkitFullscreenElement) {
                if (document.exitFullscreen) await document.exitFullscreen();
                else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
                return;
            }
            if (target.requestFullscreen) await target.requestFullscreen({ navigationUI: 'hide' });
            else if (target.webkitRequestFullscreen) target.webkitRequestFullscreen();
            else notifyUser('Full screen unavailable', 'Use your browser menu to enter full-screen mode.');
        } catch (_) {
            notifyUser('Full screen needs permission', 'Use the full-screen button again or choose Full Screen from your browser menu.');
        }
    }

    function syncFullscreenButton() {
        const button = document.querySelector('[data-fullscreen-toggle]');
        if (!button) return;
        const active = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
        button.setAttribute('aria-label', active ? 'Exit full screen' : 'Enter full screen');
        button.title = active ? 'Exit full screen (Esc)' : 'Enter full screen';
        button.classList.toggle('is-fullscreen', active);
    }

    document.addEventListener('fullscreenchange', syncFullscreenButton);
    document.addEventListener('webkitfullscreenchange', syncFullscreenButton);

    function setBootPhase(progress, message) {
        const screen = loadingScreen;
        if (!screen) return;
        const status = screen.querySelector('[data-boot-status]');
        const bar = screen.querySelector('[data-boot-progress-bar]');
        const track = screen.querySelector('[data-boot-progress]');
        if (status) status.textContent = message;
        if (bar) bar.style.width = Math.max(0, Math.min(100, progress)) + '%';
        if (track) track.setAttribute('aria-valuenow', String(Math.max(0, Math.min(100, progress))));
    }

    setBootPhase(12, 'Preparing desktop services…');

    window.addEventListener('orvexa:profile-unlocked', () => {
        updateTaskbarState('home');
        openApp('home');
    });

    let bootStarted = false;

    function safelyRunStartup(label, callback) {
        try {
            callback();
        } catch (error) {
            console.error('[OrvexaOS] Startup step failed: ' + label, error);
        }
    }

    function finishBoot() {
        setBootPhase(100, 'Workspace ready.');
        const auth = window.OrvexaAuthSetup;

        if (auth && !auth.isUnlocked && typeof auth.start === 'function') {
            if (loadingScreen) loadingScreen.classList.add('hidden');
            if (desktop) desktop.classList.add('hidden');
            try {
                auth.start();
                return;
            } catch (error) {
                console.error('[OrvexaOS] Profile setup could not start; opening desktop instead.', error);
                setBootPhase(100, 'Profile setup unavailable. Opening workspace…');
            }
        }

        if (loadingScreen) loadingScreen.classList.add('hidden');
        if (desktop) desktop.classList.remove('hidden');
        safelyRunStartup('open home', () => {
            updateTaskbarState('home');
            openApp('home');
        });
    }

    function initializeBoot() {
        if (bootStarted) return;
        bootStarted = true;

        // Full-screen requests are optional; browsers usually require a user gesture.
        try {
            if (document.documentElement.requestFullscreen &&
                sessionStorage.getItem('orvexa-fullscreen-requested') !== '1') {
                sessionStorage.setItem('orvexa-fullscreen-requested', '1');
                const request = document.documentElement.requestFullscreen({ navigationUI: 'hide' });
                if (request && typeof request.catch === 'function') request.catch(() => {});
            }
        } catch (_) { /* Full-screen must never block startup. */ }

        setBootPhase(24, 'Restoring local workspace…');
        safelyRunStartup('restore notifications', renderNotificationCenter);
        setBootPhase(42, 'Applying saved preferences…');
        safelyRunStartup('apply display settings', applyDisplaySettings);
        safelyRunStartup('update clock', updateClock);
        safelyRunStartup('update system status', updateSystemStatus);

        setBootPhase(68, 'Starting desktop services…');
        safelyRunStartup('start system persistence', () => {
            if (window.OrvexaSystemPersistence) window.OrvexaSystemPersistence.start();
        });
        window.setInterval(() => safelyRunStartup('update clock', updateClock), 1000);
        window.setInterval(() => safelyRunStartup('update system status', updateSystemStatus), 15000);
        window.setInterval(() => safelyRunStartup('update system uptime', updateSystemUptime), 1000);

        // Even if a non-critical service fails, never leave users on an endless boot screen.
        window.setTimeout(finishBoot, 350);
    }

    if (document.readyState === 'complete') {
        initializeBoot();
    } else {
        window.addEventListener('load', initializeBoot, { once: true });
        // Fallback for browser/webview cases where the load event was missed or delayed.
        window.setTimeout(() => {
            if (!bootStarted) initializeBoot();
        }, 5000);
    }
})();
