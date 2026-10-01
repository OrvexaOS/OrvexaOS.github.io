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
                            <button type="button" class="settings-secondary" data-open-app="browser">Open Store</button>
                        </section>
                    </div>
                </div>
            </div>`;
    }

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
                        <button class="app-tile" type="button" data-open-app="notes" data-app-kind="builtin"><span>📝</span><strong>Notes</strong></button>
                        <button class="app-tile" type="button" data-open-app="calendar" data-app-kind="builtin"><span>📅</span><strong>Calendar</strong></button>
                        <button class="app-tile" type="button" data-open-app="system-monitor" data-app-kind="builtin"><span>▤</span><strong>System Monitor</strong></button>
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

    function createWindow(id, config) {
        const element = document.createElement('section');
        element.className = 'window';
        element.id = id;
        element.dataset.window = id;
        element.style.left = `${config.left || 120}px`;
        element.style.top = `${config.top || 80}px`;
        element.style.width = config.width || '560px';
        element.innerHTML = `
            <div class="window-header" data-window-drag>
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
        return true;
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
            hour12: false
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
                accent: ['fern', 'copper', 'ocean'].includes(saved.accent) ? saved.accent : 'fern',
                wallpaper: ['meadow', 'tide', 'ember'].includes(saved.wallpaper) ? saved.wallpaper : 'meadow',
                doNotDisturb: saved.doNotDisturb === true,
                browserAlerts: saved.browserAlerts === true
            };
        } catch (error) {
            return { lightTheme: false, nightLight: false, brightness: 100, accent: 'fern', wallpaper: 'meadow', doNotDisturb: false, browserAlerts: false };
        }
    }

    const displaySettings = readDisplaySettings();

    function applyDisplaySettings() {
        const themeLabel = document.querySelector('[data-theme-label]');
        const settingsThemeLabel = document.querySelector('[data-settings-theme-label]');

        desktop.classList.toggle('light-theme', displaySettings.lightTheme);
        desktop.classList.toggle('night-light', displaySettings.nightLight);
        desktop.dataset.accent = displaySettings.accent;
        desktop.dataset.wallpaper = displaySettings.wallpaper;
        desktop.style.setProperty('--desktop-brightness', `${displaySettings.brightness}%`);
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

    function updateSystemStatus() {
        const wifiStatus = document.getElementById('wifiStatus');
        const batteryStatus = document.getElementById('batteryStatus');
        const batteryLevel = document.getElementById('batteryLevel');

        if (wifiStatus) {
            const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
            const quality = connection && connection.effectiveType ? connection.effectiveType : '4g';
            const qualityMap = {
                'slow-2g': '📶',
                '2g': '📶',
                '3g': '📶',
                '4g': '📶',
                default: '📶'
            };
            wifiStatus.textContent = qualityMap[quality] || qualityMap.default;
        }

        if (batteryStatus && batteryLevel) {
            const batteryApi = navigator.getBattery ? navigator.getBattery() : null;
            if (batteryApi && typeof batteryApi.then === 'function') {
                batteryApi.then((battery) => {
                    const percentage = Math.round(battery.level * 100);
                    batteryLevel.textContent = `${percentage}%`;
                    batteryStatus.textContent = battery.charging ? '🔋' : '🔋';
                }).catch(() => {
                    batteryLevel.textContent = '82%';
                    batteryStatus.textContent = '🔋';
                });
            } else {
                batteryLevel.textContent = '82%';
                batteryStatus.textContent = '🔋';
            }
        }
    }

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
        const brightness = event.target.closest('[data-display-brightness]');
        if (brightness) {
            displaySettings.brightness = Number(brightness.value);
            saveDisplaySettings();
            return;
        }

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

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            setControlCenterOpen(false);
            setNotificationCenterOpen(false);
        }
        if (event.altKey && event.key.toLowerCase() === 'c') {
            event.preventDefault();
            setControlCenterOpen(controlCenter.hidden);
        }
    });

    document.addEventListener('click', (event) => {
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

        const fileRoot = event.target.closest('[data-files-root]');
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

        if (event.target.closest('[data-settings-reset]')) {
            Object.assign(displaySettings, { lightTheme: false, nightLight: false, brightness: 100, accent: 'fern', wallpaper: 'meadow' });
            saveDisplaySettings();
            return;
        }

        const settingsRoot = event.target.closest('[data-settings-root]');
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

    if (window.loadingHelper) {
        window.loadingHelper.showLoading('Starting OrvexaOS', {
            subtitle: 'Loading desktop apps…',
            showProgress: true
        });
        window.loadingHelper.setLoadingProgress(18);
    }

    window.addEventListener('load', () => {
        renderNotificationCenter();
        applyDisplaySettings();
        updateClock();
        updateSystemStatus();
        setInterval(updateClock, 1000);
        setInterval(updateSystemStatus, 15000);
        setInterval(updateSystemUptime, 1000);

        setTimeout(() => {
            if (loadingScreen) {
                loadingScreen.classList.add('hidden');
            }
            if (desktop) {
                desktop.classList.remove('hidden');
            }
            if (window.loadingHelper) {
                window.loadingHelper.setLoadingProgress(100);
                window.loadingHelper.hideLoading();
            }
            updateTaskbarState('home');
            openApp('home');
        }, 1200);
    });
})();
