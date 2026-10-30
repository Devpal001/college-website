import { useEffect, useState } from 'react';
import { Bell, BellRing } from 'lucide-react';
import { api } from '../lib/api';

function decodeVapidKey(value) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

export default function PushNotificationPrompt() {
  const [publicKey, setPublicKey] = useState(null);
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [needsHomeScreen, setNeedsHomeScreen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const canPush = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    setSupported(canPush);
    if (!canPush) return;
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    if (isIOS && !isStandalone) {
      setNeedsHomeScreen(true);
      setMessage('On iPhone or iPad, add MBSCET Student to your Home Screen before enabling push alerts.');
    }

    let active = true;
    Promise.all([
      api.get('/notifications/push/public-key'),
      navigator.serviceWorker.ready,
    ]).then(async ([config, registration]) => {
      const subscription = await registration.pushManager.getSubscription();
      if (!active) return;
      setPublicKey(config?.publicKey || null);
      setSubscribed(Boolean(subscription));
      if (!config?.enabled) setMessage('Push alerts need server setup before they can be enabled.');
    }).catch(() => {
      if (active) setMessage('Push notifications are not available right now.');
    });
    return () => { active = false; };
  }, []);

  if (!supported) return null;

  const toggleSubscription = async () => {
    if (needsHomeScreen) return;
    setBusy(true);
    setMessage('');
    try {
      if (!subscribed && !publicKey) {
        setMessage('Push notifications are not configured yet.');
        return;
      }
      // Ask for permission directly from the button gesture. Safari/iOS
      // requires this request to be user initiated.
      if (!subscribed) {
        const permission = Notification.permission === 'default'
          ? await Notification.requestPermission()
          : Notification.permission;
        if (permission !== 'granted') {
          setMessage('Allow notifications in your device settings to receive college updates.');
          return;
        }
      }

      const registration = await navigator.serviceWorker.ready;
      const current = await registration.pushManager.getSubscription();
      if (current) {
        await api.delete(`/notifications/push/subscription?endpoint=${encodeURIComponent(current.endpoint)}`);
        await current.unsubscribe();
        setSubscribed(false);
        setMessage('Push notifications are turned off for this device.');
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeVapidKey(publicKey),
      });
      await api.post('/notifications/push/subscription', subscription.toJSON());
      setSubscribed(true);
      setMessage('You’ll receive college updates on this device.');
    } catch (error) {
      console.error('Push notification setup failed:', error);
      setMessage('Could not update notification settings. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-4 flex flex-col gap-3 rounded-soft-lg border border-primary/15 bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-primary/10 p-2 text-primary">
          {subscribed ? <BellRing size={20} /> : <Bell size={20} />}
        </div>
        <div>
          <h2 className="font-semibold text-text-main">College notifications</h2>
          <p className="mt-1 text-sm text-text-muted">
            Get important attendance, marks, timetable, and announcement updates on this device.
          </p>
          {message && <p className="mt-2 text-xs text-text-muted" role="status">{message}</p>}
        </div>
      </div>
      <button
        type="button"
        onClick={toggleSubscription}
        disabled={busy || needsHomeScreen || (!publicKey && !subscribed)}
        className="shrink-0 rounded-soft border border-primary/20 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-55"
      >
        {busy ? 'Saving…' : needsHomeScreen ? 'Add to Home Screen first' : subscribed ? 'Turn off alerts' : 'Enable alerts'}
      </button>
    </section>
  );
}
