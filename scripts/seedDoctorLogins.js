/**
 * Registers the local seed doctor against Django.
 *
 *   npm run seed:doctors
 */

const path = require('path');
const fs = require('fs');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

const root = path.resolve(__dirname, '..');
loadEnvFile(path.join(root, '.env'));
loadEnvFile(path.join(root, '.env.local'));

const API_BASE = (process.env.REACT_APP_ANIXI_API_URL || 'http://127.0.0.1:8000').replace(
  /\/$/,
  ''
);

const SEED_USER = {
  email: 'doctor@test.com',
  password: 'Test12345!!',
  displayName: 'Test Doctor',
  role: 'doctor',
};

async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function pingApi() {
  try {
    await fetchWithTimeout(API_BASE, { method: 'GET' }, 5000);
    return true;
  } catch {
    return false;
  }
}

async function registerUser() {
  const res = await fetchWithTimeout(`${API_BASE}/api/v1/auth/register/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Client': 'doctor-web-seed',
    },
    body: JSON.stringify({
      email: SEED_USER.email,
      password: SEED_USER.password,
      display_name: SEED_USER.displayName,
      role: SEED_USER.role,
      phone_number: '',
    }),
  });

  let json = null;
  try {
    json = await res.json();
  } catch {
    // ignore
  }

  if (res.ok && json?.success) {
    return { status: 'created' };
  }

  const errText = JSON.stringify(json?.error ?? json ?? res.statusText);
  const lower = errText.toLowerCase();
  if (
    res.status === 400 ||
    res.status === 409 ||
    lower.includes('already') ||
    lower.includes('exist') ||
    lower.includes('unique')
  ) {
    return { status: 'exists' };
  }

  return { status: 'error', detail: errText };
}

async function main() {
  console.log(`\nAnixi seed doctor → ${API_BASE}\n`);

  if (!(await pingApi())) {
    console.error(
      `Could not reach ${API_BASE}.\n` +
        'Start Django (python manage.py runserver) and set REACT_APP_ANIXI_API_URL in .env.\n'
    );
    process.exit(1);
  }

  const result = await registerUser();
  if (result.status === 'created') {
    console.log(`  ✓ created  ${SEED_USER.email}`);
  } else if (result.status === 'exists') {
    console.log(`  · exists   ${SEED_USER.email}`);
  } else {
    console.error(`  ✗ failed   ${result.detail}`);
    process.exit(1);
  }

  console.log(`\nLogin:`);
  console.log(`  Email:    ${SEED_USER.email}`);
  console.log(`  Password: ${SEED_USER.password}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
