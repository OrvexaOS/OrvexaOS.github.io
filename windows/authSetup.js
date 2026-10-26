(function (global) {
    'use strict';

    const PROFILE_KEY = 'orvexa-local-profile-v1';
    let overlay;
    let currentMode = 'setup';
    let setupStep = 0;
    let pendingProfile = null;

    function readProfile() {
        try {
            const value = JSON.parse(global.localStorage.getItem(PROFILE_KEY) || 'null');
            return value && value.version === 1 && typeof value.name === 'string' ? value : null;
        } catch (_) {
            return null;
        }
    }

    function writeProfile(profile) {
        try {
            global.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
            return true;
        } catch (_) {
            return false;
        }
    }

    function bytesToHex(bytes) {
        return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
    }

    async function hashPin(pin, salt) {
        if (!global.crypto || !global.crypto.subtle) throw new Error('Secure PIN hashing is unavailable in this browser.');
        const encoder = new TextEncoder();
        const key = await global.crypto.subtle.importKey('raw', encoder.encode(pin), 'PBKDF2', false, ['deriveBits']);
        const bits = await global.crypto.subtle.deriveBits({
            name: 'PBKDF2',
            salt: encoder.encode(salt),
            iterations: 120000,
            hash: 'SHA-256'
        }, key, 256);
        return bytesToHex(bits);
    }

    function makeOverlay() {
        overlay = document.createElement('section');
        overlay.className = 'orvexa-auth-screen';
        overlay.hidden = true;
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-labelledby', 'orvexa-auth-title');
        overlay.innerHTML = `
            <div class="orvexa-auth-card">
                <aside class="orvexa-auth-aside" aria-label="OrvexaOS welcome">
                    <div class="orvexa-auth-aside-top"><span class="orvexa-auth-aside-symbol">O</span><span>ORVEXA<span>OS</span></span></div>
                    <div class="orvexa-auth-art" aria-hidden="true"><div class="orvexa-auth-art-ring"></div><div class="orvexa-auth-art-core">O</div><span class="orvexa-auth-art-dot dot-one"></span><span class="orvexa-auth-art-dot dot-two"></span><span class="orvexa-auth-art-dot dot-three"></span></div>
                    <p class="orvexa-auth-aside-kicker">YOUR SPACE. YOUR RULES.</p>
                    <h2>A desktop that feels like yours.</h2>
                    <p class="orvexa-auth-aside-copy">A thoughtful workspace for your apps, ideas, and everyday flow.</p>
                    <div class="orvexa-auth-benefits"><span><i>✓</i> Preferences saved on this device</span><span><i>✓</i> Personalize your desktop</span><span><i>✓</i> No online account required</span></div>
                    <div class="orvexa-auth-aside-foot"><span class="orvexa-auth-status-dot"></span> LOCAL WORKSPACE <span>•</span> READY WHEN YOU ARE</div>
                </aside>
                <div class="orvexa-auth-main">
                <div class="orvexa-auth-brand"><span class="orvexa-auth-mark">O</span><span>ORVEXAOS</span></div>
                <div class="orvexa-auth-orb" aria-hidden="true"><span>✦</span></div>
                <p class="orvexa-auth-kicker" data-auth-kicker>FIRST-TIME SETUP</p>
                <h1 id="orvexa-auth-title" data-auth-title>Make this desktop yours.</h1>
                <p class="orvexa-auth-description" data-auth-description>Set up your local profile before entering your workspace.</p>
                <form data-auth-setup-form class="orvexa-auth-form">
                    <div data-auth-step="0">
                        <label data-auth-name-wrap>Display name<input name="displayName" type="text" maxlength="32" minlength="1" autocomplete="nickname" placeholder="What should we call you?" required></label>
                        <label data-auth-pin-wrap>Local PIN <span class="orvexa-auth-optional">(optional)</span><input name="pin" type="password" inputmode="numeric" pattern="[0-9]{4,8}" minlength="4" maxlength="8" autocomplete="new-password" placeholder="4–8 digits"></label>
                        <label data-auth-confirm-wrap>Confirm PIN<input name="confirmPin" type="password" inputmode="numeric" pattern="[0-9]{4,8}" minlength="4" maxlength="8" autocomplete="new-password" placeholder="Enter PIN again"></label>
                    </div>
                    <div data-auth-step="1" hidden>
                        <p class="orvexa-auth-step-intro">Choose how your desktop should look. You can change these options any time in Settings.</p>
                        <fieldset class="orvexa-setup-fieldset"><legend>Appearance</legend>
                            <label class="orvexa-setup-choice"><input type="radio" name="setupTheme" value="dark" checked><span><strong>Midnight</strong><small>Dark glass with a calm green accent</small></span></label>
                            <label class="orvexa-setup-choice"><input type="radio" name="setupTheme" value="light"><span><strong>Daylight</strong><small>A brighter, light desktop</small></span></label>
                        </fieldset>
                        <fieldset class="orvexa-setup-fieldset"><legend>Wallpaper</legend>
                            <label class="orvexa-setup-choice"><input type="radio" name="setupWallpaper" value="meadow" checked><span><strong>Meadow</strong><small>Fresh green atmosphere</small></span></label>
                            <label class="orvexa-setup-choice"><input type="radio" name="setupWallpaper" value="tide"><span><strong>Tide</strong><small>Cool ocean tones</small></span></label>
                            <label class="orvexa-setup-choice"><input type="radio" name="setupWallpaper" value="ember"><span><strong>Ember</strong><small>Warm sunset tones</small></span></label>
                        </fieldset>
                        <label class="orvexa-setup-toggle"><input type="checkbox" name="compactMode"><span><strong>Compact layout</strong><small>Use tighter spacing in app windows</small></span></label>
                        <label class="orvexa-setup-toggle"><input type="checkbox" name="reducedMotion"><span><strong>Reduce motion</strong><small>Reduce interface animations where supported</small></span></label>
                    </div>
                    <div data-auth-step="2" hidden>
                        <div class="orvexa-setup-summary"><span class="orvexa-setup-summary-icon">✓</span><h2>You're all set.</h2><p data-auth-finish-summary>Your local profile is ready. Your preferences will be saved in this browser.</p></div>
                        <div class="orvexa-setup-checklist"><p><span>✓</span> Profile saved on this device</p><p><span>✓</span> Desktop preferences applied</p><p><span>✓</span> Existing apps and local files preserved</p></div>
                        <p class="orvexa-auth-note">You can revisit appearance settings any time. This setup does not create an online account or sync data to other devices.</p>
                    </div>
                    <label data-auth-login-pin-wrap hidden>Enter your PIN<input name="loginPin" type="password" inputmode="numeric" pattern="[0-9]{4,8}" minlength="4" maxlength="8" autocomplete="current-password" placeholder="Your local PIN"></label>
                    <p class="orvexa-auth-note" data-auth-note>Everything stays in this browser. A PIN is a convenience lock, not secure account authentication.</p>
                    <p class="orvexa-auth-status" data-auth-status role="status" aria-live="polite"></p>
                    <div class="orvexa-auth-actions"><button type="button" class="orvexa-auth-back" data-auth-back hidden>Back</button><button class="orvexa-auth-submit" type="submit" data-auth-submit>Continue <span aria-hidden="true">→</span></button></div>
                </form>
                <div class="orvexa-auth-footer"><span>LOCAL PROFILE · NO ACCOUNT REQUIRED</span><button type="button" data-auth-reset hidden>Reset local profile</button></div>
                </div>
            </div>`;
        document.body.appendChild(overlay);

        overlay.querySelector('[data-auth-setup-form]').addEventListener('submit', submitForm);
        overlay.querySelector('[data-auth-back]').addEventListener('click', () => {
            if (currentMode !== 'setup' || setupStep === 0) return;
            setupStep = Math.max(0, setupStep - 1);
            overlay.querySelectorAll('[data-auth-step]').forEach(panel => { panel.hidden = Number(panel.dataset.authStep) !== setupStep; });
            overlay.querySelector('[data-auth-kicker]').textContent = 'FIRST-TIME SETUP · STEP ' + (setupStep + 1) + ' OF 3';
            overlay.querySelector('[data-auth-title]').textContent = ['Create your profile.', 'Personalize your desktop.', 'Ready to launch.'][setupStep];
            overlay.querySelector('[data-auth-description]').textContent = ['Choose a display name and optional local PIN.', 'Pick a theme and a few comfort settings.', 'Check what will be saved before opening your desktop.'][setupStep];
            overlay.querySelector('[data-auth-back]').hidden = setupStep === 0;
            overlay.querySelector('[data-auth-submit]').innerHTML = setupStep === 0 ? 'Continue <span aria-hidden="true">→</span>' : 'Review setup <span aria-hidden="true">→</span>';
            setStatus('', false);
        });
        overlay.querySelector('[data-auth-reset]').addEventListener('click', () => {
            const ok = global.confirm('Reset this browser’s OrvexaOS profile? Your apps, notes, files, and display settings will be kept.');
            if (!ok) return;
            try { global.localStorage.removeItem(PROFILE_KEY); } catch (_) {}
            show();
        });
    }

    function setStatus(message, isError) {
        const status = overlay.querySelector('[data-auth-status]');
        status.textContent = message || '';
        status.classList.toggle('is-error', Boolean(isError));
    }

    function show() {
        if (!overlay) makeOverlay();
        const profile = readProfile();
        currentMode = profile && profile.setupComplete ? 'login' : 'setup';
        const setup = currentMode === 'setup';
        if (setup) setupStep = 0;
        overlay.querySelector('[data-auth-kicker]').textContent = setup ? 'FIRST-TIME SETUP · STEP 1 OF 3' : 'WELCOME BACK';
        overlay.querySelector('[data-auth-title]').textContent = setup ? 'Make this desktop yours.' : 'Your workspace awaits.';
        overlay.querySelector('[data-auth-description]').textContent = setup
            ? 'Start with your profile, then personalize your workspace.'
            : 'Sign in to continue to your OrvexaOS desktop.';
        overlay.querySelectorAll('[data-auth-step]').forEach(panel => { panel.hidden = !setup || Number(panel.dataset.authStep) !== setupStep; });
        overlay.querySelector('[data-auth-name-wrap]').hidden = !setup || setupStep !== 0;
        overlay.querySelector('[name="displayName"]').required = setup && setupStep === 0;
        overlay.querySelector('[data-auth-pin-wrap]').hidden = !setup || setupStep !== 0;
        overlay.querySelector('[data-auth-confirm-wrap]').hidden = !setup || setupStep !== 0;
        overlay.querySelector('[data-auth-login-pin-wrap]').hidden = setup || !profile.pinHash;
        overlay.querySelector('[data-auth-back]').hidden = !setup || setupStep === 0;
        overlay.querySelector('[data-auth-note]').textContent = setup
            ? 'Your profile is stored on this device only. A PIN is a convenience lock, not secure account authentication.'
            : (profile.pinHash ? 'This PIN only protects this local browser profile. It is not a secure online account.' : 'No PIN is set for this profile. Continue to open your desktop.');
        overlay.querySelector('[data-auth-submit]').innerHTML = setup
            ? (setupStep === 0 ? 'Continue <span aria-hidden="true">→</span>' : setupStep === 1 ? 'Review setup <span aria-hidden="true">→</span>' : 'Finish setup <span aria-hidden="true">✓</span>')
            : (profile.pinHash ? 'Unlock desktop <span aria-hidden="true">→</span>' : 'Continue <span aria-hidden="true">→</span>');
        if (setup) {
            overlay.querySelector('[data-auth-title]').textContent = ['Create your profile.', 'Personalize your desktop.', 'Ready to launch.'][setupStep];
            overlay.querySelector('[data-auth-description]').textContent = ['Choose a display name and optional local PIN.', 'Pick a theme and a few comfort settings.', 'Check what will be saved before opening your desktop.'][setupStep];
            overlay.querySelector('[data-auth-kicker]').textContent = 'FIRST-TIME SETUP · STEP ' + (setupStep + 1) + ' OF 3';
        }
        overlay.querySelector('[data-auth-reset]').hidden = setup;
        overlay.querySelector('[data-auth-name-wrap] input').value = setup ? '' : profile.name;
        overlay.querySelector('[name="pin"]').value = '';
        overlay.querySelector('[name="confirmPin"]').value = '';
        overlay.querySelector('[name="loginPin"]').value = '';
        pendingProfile = null;
        setStatus('', false);
        overlay.hidden = false;
        document.body.classList.add('orvexa-auth-active');
        const focusTarget = setup ? overlay.querySelector('[name="displayName"]') : (profile.pinHash ? overlay.querySelector('[name="loginPin"]') : overlay.querySelector('[data-auth-submit]'));
        global.setTimeout(() => focusTarget && focusTarget.focus(), 30);
    }

    function unlock(profile) {
        overlay.hidden = true;
        document.body.classList.remove('orvexa-auth-active');
        const desktop = document.querySelector('.desktop');
        const loading = document.querySelector('.loadingscreen');
        if (loading) loading.classList.add('hidden');
        if (desktop) desktop.classList.remove('hidden');
        try {
            const accessibility = JSON.parse(global.localStorage.getItem('orvexa-accessibility-settings') || '{}');
            document.body.classList.toggle('orvexa-reduced-motion', Boolean(accessibility.reducedMotion));
        } catch (_) { document.body.classList.remove('orvexa-reduced-motion'); }
        if (global.OrvexaAuthSetup) global.OrvexaAuthSetup.currentProfile = profile || readProfile();
        global.dispatchEvent(new CustomEvent('orvexa:profile-unlocked', { detail: { name: (profile || readProfile() || {}).name || 'User' } }));
        if (global.OrvexaDesktop && typeof global.OrvexaDesktop.openHome === 'function') global.OrvexaDesktop.openHome();
    }

    async function submitForm(event) {
        event.preventDefault();
        const form = event.currentTarget;
        const submit = overlay.querySelector('[data-auth-submit]');
        submit.disabled = true;
        setStatus(currentMode === 'setup' ? 'Creating your local profile…' : 'Checking your profile…', false);
        try {
            if (currentMode === 'setup') {
                if (setupStep === 0) {
                    const name = form.elements.displayName.value.trim();
                    const pin = form.elements.pin.value;
                    const confirmPin = form.elements.confirmPin.value;
                    if (!name) throw new Error('Enter a display name to continue.');
                    if (pin && !/^[0-9]{4,8}$/.test(pin)) throw new Error('Your PIN must be 4–8 digits, or leave it blank.');
                    if (pin !== confirmPin) throw new Error('The PIN entries do not match.');
                    const salt = global.crypto && global.crypto.getRandomValues
                        ? bytesToHex(global.crypto.getRandomValues(new Uint8Array(16)))
                        : `${Date.now()}-${Math.random()}`;
                    const pinHash = pin ? await hashPin(pin, salt) : '';
                    pendingProfile = { version: 1, setupComplete: true, name: name.slice(0, 32), salt, pinHash, createdAt: Date.now() };
                    setupStep = 1;
                } else if (setupStep === 1) {
                    const theme = form.elements.setupTheme.value;
                    const wallpaper = form.elements.setupWallpaper.value;
                    const compactMode = form.elements.compactMode.checked;
                    const reducedMotion = form.elements.reducedMotion.checked;
                    const displaySettings = {
                        lightTheme: theme === 'light', nightLight: false, brightness: 100,
                        accent: 'fern', wallpaper, customAccent: '#a9c49e', fontScale: 1,
                        windowOpacity: 0.94, windowRadius: 14, taskbarPosition: 'center',
                        compactMode, customWallpaper: ''
                    };
                    try {
                        global.localStorage.setItem('orvexa-display-settings', JSON.stringify(displaySettings));
                        global.localStorage.setItem('orvexa-accessibility-settings', JSON.stringify({ reducedMotion }));
                    } catch (_) { throw new Error('Browser storage is unavailable. Enable site storage and try again.'); }
                    setupStep = 2;
                    overlay.querySelector('[data-auth-finish-summary]').textContent =
                        (pendingProfile ? pendingProfile.name : 'Your profile') + ', your ' +
                        (theme === 'light' ? 'Daylight' : 'Midnight') + ' theme and ' +
                        wallpaper.charAt(0).toUpperCase() + wallpaper.slice(1) + ' wallpaper are ready.';
                } else {
                    if (!pendingProfile) { show(); return; }
                    if (!writeProfile(pendingProfile)) throw new Error('Browser storage is unavailable. Enable site storage and try again.');
                    unlock(pendingProfile);
                    return;
                }
                overlay.querySelectorAll('[data-auth-step]').forEach(panel => { panel.hidden = Number(panel.dataset.authStep) !== setupStep; });
                overlay.querySelector('[data-auth-back]').hidden = setupStep === 0;
                overlay.querySelector('[data-auth-kicker]').textContent = 'FIRST-TIME SETUP · STEP ' + (setupStep + 1) + ' OF 3';
                overlay.querySelector('[data-auth-title]').textContent = ['Create your profile.', 'Personalize your desktop.', 'Ready to launch.'][setupStep];
                overlay.querySelector('[data-auth-description]').textContent = ['Choose a display name and optional local PIN.', 'Pick a theme and a few comfort settings.', 'Check what will be saved before opening your desktop.'][setupStep];
                overlay.querySelector('[data-auth-submit]').innerHTML = setupStep === 1 ? 'Review setup <span aria-hidden="true">→</span>' : setupStep === 2 ? 'Finish setup <span aria-hidden="true">✓</span>' : 'Continue <span aria-hidden="true">→</span>';
                setStatus('', false);
            } else {
                const profile = readProfile();
                if (!profile || !profile.setupComplete) { show(); return; }
                if (profile.pinHash) {
                    const pin = form.elements.loginPin.value;
                    if (!/^[0-9]{4,8}$/.test(pin)) throw new Error('Enter your 4–8 digit PIN.');
                    const attempt = await hashPin(pin, profile.salt);
                    if (attempt !== profile.pinHash) throw new Error('That PIN did not match. Try again.');
                }
                unlock(profile);
            }
        } catch (error) {
            setStatus(error && error.message ? error.message : 'Could not complete this step. Please try again.', true);
        } finally {
            submit.disabled = false;
        }
    }

    function lock() {
        global.OrvexaAuthSetup.isUnlocked = false;
        const desktop = document.querySelector('.desktop');
        if (desktop) desktop.classList.add('hidden');
        show();
    }

    global.OrvexaAuthSetup = {
        currentProfile: readProfile(),
        isUnlocked: false,
        start: function () {
            if (!overlay) makeOverlay();
            this.isUnlocked = false;
            show();
        },
        unlock,
        lock,
        readProfile,
        isSetupComplete: function () { const p = readProfile(); return Boolean(p && p.setupComplete); }
    };

    global.addEventListener('orvexa:profile-unlocked', () => {
        global.OrvexaAuthSetup.isUnlocked = true;
        global.OrvexaAuthSetup.currentProfile = readProfile();
    });

    document.addEventListener('click', event => {
        if (event.target.closest('[data-auth-lock]')) {
            event.preventDefault();
            lock();
        }
    });
})(window);
