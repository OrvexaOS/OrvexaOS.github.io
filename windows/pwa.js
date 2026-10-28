(function () {
  'use strict';
  if (!('serviceWorker' in navigator)) return;
  const controlCenter = document.getElementById('controlCenter');
  let installPrompt = null;
  let waitingWorker = null;
  let swRegistration = null;
  let refreshing = false;
  const wasControlled = Boolean(navigator.serviceWorker.controller);

  const panel = document.createElement('section');
  panel.className = 'pwa-panel';
  panel.setAttribute('aria-label', 'App installation and connection');
  panel.innerHTML = '<div class="pwa-panel-heading"><strong>OrvexaOS app</strong><span data-pwa-status>Checking availability…</span></div><div class="pwa-panel-actions"><button type="button" data-pwa-install>Install / Add to Home Screen</button><button type="button" data-pwa-update hidden>Apply update</button><button type="button" data-pwa-check>Check for updates</button><button type="button" data-pwa-reset>Reset offline cache</button></div><p data-pwa-help>Install OrvexaOS for an app-like window. The app shell can be available offline after the first successful load.</p>';
  if (controlCenter) controlCenter.appendChild(panel);
  const status = panel.querySelector('[data-pwa-status]');
  const installButton = panel.querySelector('[data-pwa-install]');
  const updateButton = panel.querySelector('[data-pwa-update]');
  const checkButton = panel.querySelector('[data-pwa-check]');
  const resetButton = panel.querySelector('[data-pwa-reset]');
  const help = panel.querySelector('[data-pwa-help]');

  function connectionStatus() {
    if (status) status.textContent = navigator.onLine ? 'Online' : 'Offline';
    panel.classList.toggle('is-offline', !navigator.onLine);
    if (!navigator.onLine && help) help.textContent = 'You are offline. Previously cached app files may still open; live websites and network features need a connection.';
    else if (help && !installPrompt && !waitingWorker) help.textContent = 'Install OrvexaOS for an app-like window. The app shell can be available offline after the first successful load.';
  }
  window.addEventListener('online', connectionStatus);
  window.addEventListener('offline', connectionStatus);
  connectionStatus();

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event;
    installButton.hidden = false;
    installButton.textContent = 'Install app';
    if (help) help.textContent = 'Install OrvexaOS as an app on this device.';
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    installButton.hidden = true;
    if (status) status.textContent = 'Installed';
    if (help) help.textContent = 'OrvexaOS is installed on this device.';
  });
  installButton.addEventListener('click', async () => {
    if (!installPrompt) {
      if (help) help.textContent = 'If install is not offered automatically, use your browser menu: “Install app” or “Add to Home Screen” (wording varies by browser).';
      return;
    }
    installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    installPrompt = null;
    installButton.hidden = choice && choice.outcome === 'accepted';
    if (!installButton.hidden && help) help.textContent = 'Install was dismissed. You can try again or use your browser menu to add OrvexaOS to the Home Screen.';
  });
  checkButton.addEventListener('click', async () => {
    if (!swRegistration) {
      if (help) help.textContent = 'Update checks are not available yet. Try again in a moment.';
      return;
    }
    checkButton.disabled = true;
    try {
      await swRegistration.update();
      if (help && !waitingWorker) help.textContent = 'Update check complete. You are using the latest cached app shell if no update was found.';
    } catch (_) {
      if (help) help.textContent = 'Could not check for updates. Check your internet connection and retry.';
    } finally {
      checkButton.disabled = false;
    }
  });
  updateButton.addEventListener('click', () => {
    if (waitingWorker) waitingWorker.postMessage({ type: 'SKIP_WAITING' });
  });

  // Recovery control for stale/corrupted app-shell caches. Never remove the
  // offline shell while disconnected, because that could make recovery harder.
  resetButton.addEventListener('click', async () => {
    if (!navigator.onLine) {
      if (help) help.textContent = 'Reconnect to the internet before resetting the offline cache.';
      return;
    }
    if (!window.confirm('Reset OrvexaOS offline cache? The page will reload and download the latest files.')) return;
    resetButton.disabled = true;
    if (help) help.textContent = 'Resetting offline cache…';
    try {
      const keys = await caches.keys();
      await Promise.all(keys.filter(key => key.startsWith('orvexa-shell-')).map(key => caches.delete(key)));
      if (swRegistration) await swRegistration.unregister();
      window.location.reload();
    } catch (error) {
      if (help) help.textContent = 'Cache reset failed. Try the browser reload menu or check site storage permissions.';
      resetButton.disabled = false;
      console.error('[OrvexaOS PWA] Cache reset failed:', error);
    }
  });

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (wasControlled && !refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });
  navigator.serviceWorker.register('./sw.js', { scope: './' }).then(registration => {
    swRegistration = registration;
    if (status && navigator.onLine) status.textContent = 'Online · offline cache enabled';
    const offerUpdate = worker => {
      if (!worker || worker.state !== 'installed' || !navigator.serviceWorker.controller) return;
      waitingWorker = worker;
      updateButton.hidden = false;
      if (help) help.textContent = 'A new version is ready. Apply it to reload OrvexaOS with the latest files.';
    };
    if (registration.waiting) offerUpdate(registration.waiting);
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      if (worker) worker.addEventListener('statechange', () => offerUpdate(worker));
    });
    window.addEventListener('online', () => registration.update().catch(() => {}));
  }).catch(() => {
    if (status) status.textContent = navigator.onLine ? 'Offline cache unavailable' : 'Offline';
    if (help) help.textContent = 'This browser could not enable offline caching. OrvexaOS still works online.';
  });
})();