import { useEffect, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';

export default function PWAUpdatePrompt() {
  const [waitingWorker, setWaitingWorker] = useState(null);

  useEffect(() => {
    const showUpdate = () => {
      navigator.serviceWorker?.getRegistration().then((registration) => {
        if (registration?.waiting) setWaitingWorker(registration.waiting);
      });
    };
    showUpdate();
    window.addEventListener('mbscet:pwa-update-ready', showUpdate);
    return () => window.removeEventListener('mbscet:pwa-update-ready', showUpdate);
  }, []);

  if (!waitingWorker) return null;

  const updateNow = () => {
    sessionStorage.setItem('mbscet-pwa-update', '1');
    waitingWorker.postMessage({ type: 'SKIP_WAITING' });
  };

  return (
    <div className="fixed bottom-24 left-4 right-4 z-[70] mx-auto flex max-w-md items-center gap-3 rounded-soft-lg bg-surface p-4 shadow-soft-lg sm:bottom-6">
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-text-main">MBSCET app update ready</p>
        <p className="mt-1 text-sm text-text-muted">Refresh to get the latest college updates and improvements.</p>
      </div>
      <button type="button" onClick={updateNow} className="inline-flex shrink-0 items-center gap-2 rounded-soft bg-primary px-3 py-2 text-sm font-semibold text-white">
        <RefreshCw size={15} /> Update
      </button>
      <button type="button" onClick={() => setWaitingWorker(null)} aria-label="Dismiss app update" className="shrink-0 rounded-soft p-2 text-text-muted hover:bg-bg-soft">
        <X size={16} />
      </button>
    </div>
  );
}
