# MBSCET Student App

The student app is an installable Progressive Web App using the existing React site and student portal. It opens directly to the student dashboard, keeps attendance, marks, timetable, and notifications behind the existing sign-in, and fetches private academic data from the API rather than storing it in the offline cache. New site builds are checked when students reopen the app or bring it back into view; the app offers a refresh prompt when an update is ready.

## Install

- **Android:** Open the site in Chrome, sign in, and use **Install app** on the student dashboard. If Chrome does not show the install prompt, use the browser menu and choose **Install app** or **Add to Home screen**.
- **iPhone/iPad:** Open the site in Safari, sign in, tap **Share**, then **Add to Home Screen**. Web push is available to Home Screen web apps on iOS/iPadOS 16.4 and later.

## Enable push notifications

Push is opt-in per device. Before students can enable it, apply `supabase/migrations/2026_10_30_web_push_subscriptions.sql` and set these server environment variables on the API host:

- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_EMAIL` (an email address or `mailto:` subject)

Generate a key pair from the `server` directory with `npx web-push generate-vapid-keys`. Keep the private key only in the API host's secret environment settings; never place it in frontend variables or commit it. Once configured, students can turn on **College notifications** from their dashboard. Attendance alerts, published marks, college announcements, and verified news can then reach subscribed devices. The regular in-app notification center continues to work without push setup.
