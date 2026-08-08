import { asyncHandler } from '../../shared/utils/asyncHandler.js';

// Must stay in sync with frontend/app.json ("scheme" and "android.package") — no shared
// source of truth exists across the two repos, so these are duplicated deliberately.
const APP_SCHEME = 'samriva';
const ANDROID_PACKAGE = 'com.samriva.frontend';

const escapeHtml = (str) =>
  String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Public, unauthenticated landing page for the "Or web:" link in the in-app sponsor-share
// message (see frontend/src/components/sponsor-share.tsx) — deliberately no `protect` here:
// a logged-out visitor lands on this before the app is even installed on their device, so
// there is no user session to authenticate. Not a data-mutating action, just a redirect page.
export const inviteLanding = asyncHandler(async (req, res) => {
  const sponsorRaw = typeof req.query.sponsor === 'string' ? req.query.sponsor.trim() : '';
  const sponsor = sponsorRaw.slice(0, 40); // this only ever holds a referralCode — sane upper bound
  const sponsorSafe = escapeHtml(sponsor);
  const deepLink = `${APP_SCHEME}://signup${sponsor ? `?sponsor=${encodeURIComponent(sponsor)}` : ''}`;
  // The `referrer` param is what Google Play hands back to the app after install via
  // expo-application's getInstallReferrerAsync() — see frontend/src/lib/installReferrer.ts.
  // This is how the sponsor ID survives a fresh install where no query param can reach the app.
  const playStoreUrl = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}${
    sponsor ? `&referrer=${encodeURIComponent(`sponsor=${sponsor}`)}` : ''
  }`;

  res.status(200).type('html').send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Join Samriva International</title>
<style>
  body { font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif; background:#FDFBF7; color:#0f172a; margin:0; padding:48px 20px; text-align:center; }
  .card { max-width:420px; margin:0 auto; background:#fff; border-radius:16px; padding:28px 24px; box-shadow:0 4px 20px rgba(0,0,0,0.06); }
  h1 { font-size:20px; margin:0 0 8px 0; color:#065f46; }
  p { font-size:14px; color:#475569; line-height:1.5; }
  .code { display:inline-block; margin:16px 0; padding:10px 18px; border-radius:10px; background:#ecfdf5; color:#047857; font-weight:700; letter-spacing:1px; font-size:16px; }
  .btn { display:block; margin:10px 0; padding:14px; border-radius:12px; background:#059669; color:#fff; text-decoration:none; font-weight:700; }
  .btn.secondary { background:#fff; color:#059669; border:1.5px solid #059669; }
  .hint { margin-top:18px; font-size:12px; color:#94a3b8; }
</style>
</head>
<body>
  <div class="card">
    <h1>Join Samriva International</h1>
    <p>Invest in Agriculture, Dairy &amp; Wealth Growth.</p>
    ${sponsor ? `<div class="code">Sponsor ID: ${sponsorSafe}</div>` : ''}
    <a class="btn" href="${deepLink}">Open in App</a>
    <a class="btn secondary" href="${playStoreUrl}">Get it on Google Play</a>
    <p class="hint">
      Already have the app? Tap "Open in App".<br/>
      New here? Install from Google Play — your sponsor ID carries over automatically.
      ${sponsor ? "If it doesn't, just enter it on the signup screen." : ''}
    </p>
  </div>
</body>
</html>`);
});
