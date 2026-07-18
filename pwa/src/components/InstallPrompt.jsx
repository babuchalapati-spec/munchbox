import {useEffect, useState} from 'react';

const DISMISSED_KEY = 'munchbox_install_dismissed';

function isIos() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

// Chrome/Edge/Android fire `beforeinstallprompt` so we can show a one-tap install
// banner immediately instead of waiting for the browser's own install heuristics.
// iOS Safari never fires that event (Apple has no equivalent API), so there we show
// manual "Share -> Add to Home Screen" instructions instead — that's the only path
// to installing a PWA on iOS.
export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISSED_KEY) === '1');

  useEffect(() => {
    if (isStandalone()) return;

    function onBeforeInstallPrompt(e) {
      e.preventDefault();
      setDeferredPrompt(e);
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);

    if (isIos()) setShowIosHint(true);

    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
  }, []);

  if (dismissed || isStandalone() || (!deferredPrompt && !showIosHint)) return null;

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, '1');
    setDismissed(true);
  }

  async function install() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    dismiss();
  }

  return (
    <div className="install-banner">
      {deferredPrompt ? (
        <>
          <span className="install-banner-text">📲 Install the Munchbox app for a faster experience</span>
          <button type="button" className="install-banner-btn" onClick={install}>Install</button>
        </>
      ) : (
        <span className="install-banner-text">
          📲 Install Munchbox: tap <strong>Share</strong> then <strong>Add to Home Screen</strong>
        </span>
      )}
      <button type="button" className="install-banner-close" onClick={dismiss} aria-label="Dismiss">✕</button>
    </div>
  );
}
