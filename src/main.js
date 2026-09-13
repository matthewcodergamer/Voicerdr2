import { render, attachEvents } from './ui.js';
import { loadRemoteCatalog, autoMatchAll } from './catalog.js';

attachEvents();
render();

loadRemoteCatalog().then((ok) => {
  if (ok) { autoMatchAll(); render(); }
});

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
