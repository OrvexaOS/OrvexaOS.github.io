(function (global) {
  'use strict';

  const SNAPSHOT_KEY = 'orvexa-iframe-snapshots-v1';
  const VERSION = 1;
  let observer = null;
  let interval = null;
  let saveTimer = null;

  function safeReadSnapshots() {
    try {
      const parsed = JSON.parse(global.localStorage.getItem(SNAPSHOT_KEY) || '{}');
      return parsed && parsed.version === VERSION && parsed.frames && typeof parsed.frames === 'object'
        ? parsed : { version: VERSION, updatedAt: null, frames: {} };
    } catch (_) {
      return { version: VERSION, updatedAt: null, frames: {} };
    }
  }

  function frameKey(frame) {
    try {
      const url = new URL(frame.getAttribute('src') || frame.src || '', global.location.href);
      if (url.origin !== global.location.origin) return null;
      return url.pathname + url.search;
    } catch (_) {
      return null;
    }
  }

  function readFrameStorage(frame) {
    try {
      const storage = frame.contentWindow.localStorage;
      const data = {};
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (key && key !== SNAPSHOT_KEY) data[key] = storage.getItem(key);
      }
      return data;
    } catch (_) {
      return null;
    }
  }

  function restoreFrame(frame, key) {
    const snapshot = safeReadSnapshots();
    const saved = snapshot.frames[key];
    if (!saved || typeof saved !== 'object') return;
    try {
      const storage = frame.contentWindow.localStorage;
      Object.keys(saved).forEach((storageKey) => {
        if (storageKey !== SNAPSHOT_KEY && storage.getItem(storageKey) === null && typeof saved[storageKey] === 'string') {
          storage.setItem(storageKey, saved[storageKey]);
        }
      });
    } catch (_) {
      // Cross-origin iframe storage is intentionally inaccessible.
    }
  }

  function saveFrame(frame, state) {
    const key = frameKey(frame);
    if (!key || !state) return false;
    const snapshot = safeReadSnapshots();
    snapshot.frames[key] = state;
    snapshot.updatedAt = new Date().toISOString();
    try {
      global.localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
      return true;
    } catch (_) {
      return false;
    }
  }

  function checkpointFrame(frame) {
    const key = frameKey(frame);
    if (!key) return;
    restoreFrame(frame, key);
    const state = readFrameStorage(frame);
    if (state) saveFrame(frame, state);
  }

  function checkpointAll() {
    document.querySelectorAll('#windowArea iframe').forEach(checkpointFrame);
  }

  function scheduleCheckpoint() {
    if (saveTimer !== null) global.clearTimeout(saveTimer);
    saveTimer = global.setTimeout(() => {
      saveTimer = null;
      checkpointAll();
    }, 180);
  }

  function attach(frame) {
    if (frame.dataset.orvexaPersistenceReady === 'true') return;
    frame.dataset.orvexaPersistenceReady = 'true';
    frame.addEventListener('load', () => {
      const key = frameKey(frame);
      if (key) restoreFrame(frame, key);
      scheduleCheckpoint();
    });
    if (frame.contentDocument && frame.contentDocument.readyState === 'complete') checkpointFrame(frame);
  }

  function start() {
    const area = document.getElementById('windowArea');
    if (!area) return;
    area.querySelectorAll('iframe').forEach(attach);
    observer = new MutationObserver((records) => {
      records.forEach((record) => record.addedNodes.forEach((node) => {
        if (node.nodeType !== 1) return;
        if (node.matches && node.matches('iframe')) attach(node);
        if (node.querySelectorAll) node.querySelectorAll('iframe').forEach(attach);
      }));
    });
    observer.observe(area, { childList: true, subtree: true });
    interval = global.setInterval(checkpointAll, 2500);
    global.addEventListener('pagehide', checkpointAll);
    global.addEventListener('beforeunload', checkpointAll);
    global.addEventListener('storage', (event) => {
      if (event.key === SNAPSHOT_KEY) return;
      scheduleCheckpoint();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') checkpointAll();
    });
    checkpointAll();
  }

  global.OrvexaSystemPersistence = {
    start,
    checkpoint: checkpointAll,
    getSnapshot: safeReadSnapshots,
    snapshotKey: SNAPSHOT_KEY
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})(window);
