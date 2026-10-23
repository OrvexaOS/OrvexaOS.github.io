(function () {
  'use strict';
  if (!('serviceWorker' in navigator)) return;
  const controlCenter = document.getElementById('controlCenter');
  let installPrompt = null;
  let waitingWorker = null;
  let refreshing = false;
  const wasControlled = Boolean(navigator.serviceWorker.controller);

  const panel = document.createElement('section');
  panel.className = 'pwa-panel';
  panel.setAttribute('aria-label', 'App installation and connection');
  panel.innerHTML = '<div class="pwa-panel-heading"><strong>OrvexaOS app</strong><span data-pwa-status>Checking availability…</span></div><div class="pwa-panel-actions"><button type="button" data-pwa-install>Install / Add to Home Screen</button><button type="button" data-pwa-update hidden>Apply update</button></div><p data-pwa-help>Install OrvexaOS for an app-like window. The app shell can be available offline after the first successful load.</p>';
  if (controlCenter) controlCenter.appendChild(panel);
  const status = panel.querySelector('[data-pwa-status]');
  const installButton = panel.querySelector('[data-pwa-install]');
  const updateButton = panel.querySelector('[data-pwa-update]');
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
    await installPrompt.userChoice;
    installPrompt = null;
    installButton.hidden = true;
  });
  updateButton.addEventListener('click', () => {
    if (waitingWorker) waitingWorker.postMessage({ type: 'SKIP_WAITING' });
  });

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (wasControlled && !refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });
  navigator.serviceWorker.register('./sw.js', { scope: './' }).then(registration => {
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