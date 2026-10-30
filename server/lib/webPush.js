import webpush from 'web-push';
import { supabase } from './db.js';

const publicKey = (process.env.VAPID_PUBLIC_KEY || '').trim();
const privateKey = (process.env.VAPID_PRIVATE_KEY || '').trim();
const vapidEmail = (process.env.VAPID_EMAIL || '').trim();
const enabled = Boolean(publicKey && privateKey && vapidEmail);

if (enabled) {
  webpush.setVapidDetails(
    vapidEmail.startsWith('mailto:') ? vapidEmail : `mailto:${vapidEmail}`,
    publicKey,
    privateKey
  );
}

export function getWebPushPublicKey() {
  return enabled ? publicKey : null;
}

// Push delivery is best-effort: in-app notifications remain the source of
// truth, while subscribed devices receive a native notification when online.
export async function sendWebPushNotifications(notifications) {
  if (!enabled || !Array.isArray(notifications) || notifications.length === 0) return;
  const userIds = [...new Set(notifications.map((notification) => notification.user_id).filter(Boolean))];
  if (userIds.length === 0) return;

  const { data: subscriptions, error } = await supabase
    .from('web_push_subscriptions')
    .select('id, user_id, subscription')
    .in('user_id', userIds);
  if (error) throw error;
  if (!subscriptions?.length) return;

  const byUser = new Map(notifications.map((notification) => [notification.user_id, notification]));
  await Promise.allSettled(subscriptions.map(async ({ id, user_id, subscription }) => {
    const notification = byUser.get(user_id) || notifications.find((item) => item.user_id === user_id) || notifications[0];
    const payload = JSON.stringify({
      title: notification.title,
      body: notification.message,
      url: '/notifications',
      tag: notification.id || notification.type || 'mbscet-update',
    });
    try {
      await webpush.sendNotification(subscription, payload, { TTL: 60 * 60 * 24 });
    } catch (pushError) {
      if (pushError.statusCode === 404 || pushError.statusCode === 410) {
        await supabase.from('web_push_subscriptions').delete().eq('id', id);
      } else {
        console.error('Web push delivery failed:', pushError.message);
      }
    }
  }));
}
