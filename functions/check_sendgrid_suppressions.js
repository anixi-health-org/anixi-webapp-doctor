const { execSync } = require('child_process');
const https = require('https');

function getSendgridKey() {
  const out = execSync('firebase functions:config:get', { encoding: 'utf8' });
  try {
    const cfg = JSON.parse(out);
    return cfg.sendgrid && cfg.sendgrid.key;
  } catch (e) {
    return null;
  }
}

function request(path, key) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'api.sendgrid.com',
      path,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', (err) => resolve({ error: String(err) }));
    req.end();
  });
}

async function run() {
  const key = getSendgridKey();
  if (!key) {
    console.error('No SendGrid key found in functions config');
    process.exit(1);
  }
  const email = encodeURIComponent('tshikamisa22@gmail.com');
  const endpoints = [
    `/v3/suppression/blocks/${email}`,
    `/v3/suppression/bounces/${email}`,
    `/v3/suppression/spam_reports/${email}`,
    `/v3/asm/suppressions/global/${email}`,
    `/v3/suppression/invalid_emails/${email}`,
    `/v3/suppression/unsubscribes/${email}`,
  ];
  for (const p of endpoints) {
    const res = await request(p, key);
    console.log(p, '->', res.status, res.body ? res.body.substring(0, 100) : '');
  }
}

run();
