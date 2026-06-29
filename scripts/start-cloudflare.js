'use strict';

/**
 * start-cloudflare.js
 * ---------------------------------------------------------------------------
 * مُشغّل تطوير بأمر واحد لشبكة تعزل أجهزة الواي‑فاي عن بعضها (AP isolation)
 * أو تحجب بعض المنافذ، فلا يصل الهاتف للـ PC مباشرة.
 *
 * يفتح نفقَي Cloudflare سريعين (يعملان حتى على هذه الشبكات):
 *   1. نفق -> 8081 (Metro): يُمرَّر رابطه إلى Expo عبر EXPO_PACKAGER_PROXY_URL
 *      حتى يحمّل الهاتف كود التطبيق وحزمة Metro عبر Cloudflare بدل LAN.
 *   2. نفق -> 5001 (API): يُكتب رابطه في .env كـ EXPO_PUBLIC_API_BASE_URL
 *      حتى تمر طلبات التطبيق وSocket.IO عبر Cloudflare.
 *
 * الرابطان جديدان كل تشغيل — بلا تعديل يدوي. نشغّل Expo بـ -c لمسح الذاكرة
 * المؤقتة فيلتقط الروابط الجديدة.
 *
 * التشغيل (من مجلد MedicalBookingApp):
 *   npm run start:cf
 *
 * شغّل الـ backend أولاً (cd ../medi-care-backend && npm run dev) وابقِ هذا
 * التيرمنال مفتوحاً — إغلاقه يُغلق النفقين.
 * ---------------------------------------------------------------------------
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { bin, install } = require('cloudflared');

const API_PORT = process.env.BACKEND_PORT || 5001;
const METRO_PORT = 8081;
const URL_RE = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/i;
const ENV_PATH = path.resolve(__dirname, '..', '.env');
const ENV_KEY = 'EXPO_PUBLIC_API_BASE_URL';
const TUNNEL_TIMEOUT_MS = 45000;

/** إدراج أو استبدال سطر KEY=value في ملف .env مع الحفاظ على الباقي. */
function upsertEnv(filePath, key, value) {
  let lines = [];
  if (fs.existsSync(filePath)) {
    lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  }
  const line = `${key}=${value}`;
  const idx = lines.findIndex((l) => l.trim().startsWith(`${key}=`));
  if (idx >= 0) lines[idx] = line;
  else {
    while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
    lines.push(line);
  }
  fs.writeFileSync(filePath, lines.join('\n') + '\n', 'utf8');
}

const procs = []; // كل عملية فرعية نشغّلها، للتنظيف عند الإغلاق.

function cleanup() {
  for (const p of procs) {
    try { p.kill(); } catch { /* تجاهل */ }
  }
}
process.on('SIGINT', () => { cleanup(); process.exit(0); });
process.on('SIGTERM', () => { cleanup(); process.exit(0); });

/** فتح نفق Cloudflare سريع لمنفذ محلي؛ يُحَل بمجرد ظهور رابطه. */
function openTunnel(port, label) {
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, ['tunnel', '--url', `http://localhost:${port}`, '--no-autoupdate'], {
      windowsHide: true,
    });
    procs.push(proc);

    let handled = false;
    const onData = (buf) => {
      if (handled) return;
      const m = buf.toString().match(URL_RE);
      if (!m) return;
      handled = true;
      clearTimeout(timer);
      resolve(m[0]);
    };
    proc.stdout.on('data', onData);
    proc.stderr.on('data', onData);
    proc.on('exit', (code) => {
      if (!handled) reject(new Error(`${label}: أُغلق cloudflared (رمز ${code}) قبل توفّر الرابط`));
    });
    const timer = setTimeout(() => {
      if (!handled) reject(new Error(`${label}: انتهت المهلة بانتظار رابط النفق`));
    }, TUNNEL_TIMEOUT_MS);
  });
}

function startExpo(metroProxyUrl) {
  const extraArgs = process.argv.slice(2); // تمرير مثل --android
  console.log('\n[dev] تشغيل Expo (مع مسح الذاكرة المؤقتة لالتقاط الروابط الجديدة)…\n');
  // shell:true ضروري على ويندوز + Node الحديث لتشغيل npx (وهو ملف .cmd).
  const expo = spawn('npx', ['expo', 'start', '-c', ...extraArgs], {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
      // إخبار Expo أن خادم التطوير متاح على رابط Cloudflare، فيُمرَّر الـ QR
      // وطلبات الحزمة عبر النفق بدل IP الشبكة المحلية.
      EXPO_PACKAGER_PROXY_URL: metroProxyUrl,
    },
  });
  procs.push(expo);
  expo.on('exit', (code) => {
    cleanup();
    process.exit(code ?? 0);
  });
}

async function main() {
  if (!fs.existsSync(bin)) {
    console.log('[dev] تنزيل ملف cloudflared (أول مرة فقط)…');
    await install(bin);
  }

  console.log('[dev] فتح نفقَي Cloudflare (Metro + API)…');
  // نفق Metro أولاً — cloudflared يتصل بالحافة الآن، وMetro يربط 8081 بعد لحظة
  // عند تشغيل Expo، والنفق يوجّه إليه.
  const metroUrl = await openTunnel(METRO_PORT, 'Metro');
  const apiUrl = await openTunnel(API_PORT, 'API');

  upsertEnv(ENV_PATH, ENV_KEY, apiUrl);

  console.log('\n──────────────────────────────────────────────');
  console.log(`[dev] Metro (التطبيق): ${metroUrl}`);
  console.log(`[dev] API (الخادم)   : ${apiUrl}`);
  console.log(`[dev] كُتب ${ENV_KEY} في .env`);
  console.log('──────────────────────────────────────────────');

  startExpo(metroUrl);
}

main().catch((err) => {
  console.error('[dev] فشل:', err.message);
  cleanup();
  process.exit(1);
});
