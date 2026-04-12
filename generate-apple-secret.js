const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

// Configuration
const TEAM_ID = 'YY545WKA4Y';
const KEY_ID = '44ZHDY5F4M';
const CLIENT_ID = 'com.ziyouyuan.certamenapp.siwa'; // Services ID
const KEY_FILE = '/Users/cherry/Desktop/AuthKey_44ZHDY5F4M.p8';

// Read the private key
const privateKey = fs.readFileSync(KEY_FILE, 'utf8');

// Generate the secret (valid for 6 months)
const now = Math.floor(Date.now() / 1000);
const payload = {
  iss: TEAM_ID,
  iat: now,
  exp: now + (60 * 60 * 24 * 180), // 180 days (6 months)
  aud: 'https://appleid.apple.com',
  sub: CLIENT_ID,
};

const secret = jwt.sign(payload, privateKey, {
  algorithm: 'ES256',
  keyid: KEY_ID,
});

console.log('\n=== Apple Client Secret ===');
console.log(secret);
console.log('\n=== Copy the secret above and paste it into Supabase ===\n');
