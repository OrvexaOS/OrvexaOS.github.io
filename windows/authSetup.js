(function (global) {
    'use strict';

    const PROFILE_KEY = 'orvexa-local-profile-v1';
    let overlay;
    let currentMode = 'setup';

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
                <div class="orvexa-auth-brand"><span class="orvexa-auth-mark">O</span><span>ORVEXAOS</span></div>
                <div class="orvexa-auth-orb" aria-hidden="true"><span>✦</span></div>
                <p class="orvexa-auth-kicker" data-auth-kicker>FIRST-TIME SETUP</p>
                <h1 id="orvexa-auth-title" data-auth-title>Make this desktop yours.</h1>
                <p class="orvexa-auth-description" data-auth-description>Set up your local profile before entering your workspace.</p>
                <form data-auth-setup-form class="orvexa-auth-form">
                    <label data-auth-name-wrap>Display name<input name="displayName" type="text" maxlength="32" minlength="1" autocomplete="nickname" placeholder="What should we call you?" required></label>
                    <label data-auth-pin-wrap>Local PIN <span class="orvexa-auth-optional">(optional)</span><input name="pin" type="password" inputmode="numeric" pattern="[0-9]{4,8}" minlength="4" maxlength="8" autocomplete="new-password" placeholder="4–8 digits"></label>
                    <label data-auth-confirm-wrap>Confirm PIN<input name="confirmPin" type="password" inputmode="numeric" pattern="[0-9]{4,8}" minlength="4" maxlength="8" autocomplete="new-password" placeholder="Enter PIN again"></label>
                    <label data-auth-login-pin-wrap hidden>Enter your PIN<input name="loginPin" type="password" inputmode="numeric" pattern="[0-9]{4,8}" minlength="4" maxlength="8" autocomplete="current-password" placeholder="Your local PIN"></label>
                    <p class="orvexa-auth-note" data-auth-note>Everything stays in this browser. A PIN is a convenience lock, not secure account authentication.</p>
                    <p class="orvexa-auth-status" data-auth-status role="status" aria-live="polite"></p>
                    <button class="orvexa-auth-submit" type="submit" data-auth-submit>Set up OrvexaOS <span aria-hidden="true">→</span></button>
                </form>
                <div class="orvexa-auth-footer"><span>LOCAL PROFILE · NO ACCOUNT REQUIRED</span><button type="button" data-auth-reset hidden>Reset local profile</button></div>
            </div>`;
        document.body.appendChild(overlay);

        overlay.querySelector('[data-auth-setup-form]').addEventListener('submit', submitForm);
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
        overlay.querySelector('[data-auth-kicker]').textContent = setup ? 'FIRST-TIME SETUP' : 'WELCOME BACK';
        overlay.querySelector('[data-auth-title]').textContent = setup ? 'Make this desktop yours.' : 'Your workspace awaits.';
        overlay.querySelector('[data-auth-description]').textContent = setup
            ? 'Create a local profile to personalize your OrvexaOS experience.'
            : 'Sign in to continue to your OrvexaOS desktop.';
        overlay.querySelector('[data-auth-name-wrap]').hidden = !setup;
        overlay.querySelector('[data-auth-pin-wrap]').hidden = !setup;
        overlay.querySelector('[data-auth-confirm-wrap]').hidden = !setup;
        overlay.querySelector('[data-auth-login-pin-wrap]').hidden = setup || !profile.pinHash;
        overlay.querySelector('[data-auth-note]').textContent = setup
            ? 'Your profile is stored on this device only. A PIN is a convenience lock, not secure account authentication.'
            : (profile.pinHash ? 'This PIN only protects this local browser profile. It is not a secure online account.' : 'No PIN is set for this profile. Continue to open your desktop.');
        overlay.querySelector('[data-auth-submit]').innerHTML = setup
            ? 'Set up OrvexaOS <span aria-hidden="true">→</span>'
            : (profile.pinHash ? 'Unlock desktop <span aria-hidden="true">→</span>' : 'Continue <span aria-hidden="true">→</span>');
        overlay.querySelector('[data-auth-reset]').hidden = setup;
        overlay.querySelector('[data-auth-name-wrap] input').value = setup ? '' : profile.name;
        overlay.querySelector('[name="pin"]').value = '';
        overlay.querySelector('[name="confirmPin"]').value = '';
        overlay.querySelector('[name="loginPin"]').value = '';
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
                const profile = { version: 1, setupComplete: true, name: name.slice(0, 32), salt, pinHash, createdAt: Date.now() };
                if (!writeProfile(profile)) throw new Error('Browser storage is unavailable. Enable site storage and try again.');
                unlock(profile);
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
