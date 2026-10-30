import { useEffect, useState } from 'react';
import { Download, Smartphone } from 'lucide-react';

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}

export default function InstallAppPrompt() {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installed, setInstalled] = useState(isStandalone);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const onBeforeInstall = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed) return null;

  const install = async () => {
    if (!installPrompt) {
      setShowHelp((visible) => !visible);
      return;
    }
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice?.outcome === 'accepted') setInstalled(true);
    setInstallPrompt(null);
  };

  return (
    <section className="mt-5 flex flex-col gap-3 rounded-soft-lg border border-primary/15 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-primary/10 p-2 text-primary">
          <Smartphone size={20} />
        </div>
        <div>
          <h2 className="font-semibold text-text-main">Get the MBSCET Student app</h2>
          <p className="mt-1 text-sm text-text-muted">
            Add it to your home screen for quick access to attendance, marks, timetable, and updates.
          </p>
          {showHelp && (
            <p className="mt-2 text-sm text-text-muted" role="status">
              {/iphone|ipad|ipod/i.test(navigator.userAgent)
                ? 'In Safari, tap Share, then Add to Home Screen.'
                : 'Open your browser menu and choose Install app or Add to Home screen.'}
            </p>
          )}
        </div>
      </div>
      <button type="button" onClick={install} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-soft bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark">
        <Download size={16} /> Install app
      </button>
    </section>
  );
}
