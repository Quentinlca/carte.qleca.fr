const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const rootDir = path.join(__dirname, '..');
const dataDir = path.join(rootDir, 'data');
const usersFile = path.join(dataDir, 'users.json');

function normalizeUsername(value) {
  return String(value || '').trim().toLowerCase();
}

function printUsage() {
  console.log('Usage: npm run create-user -- <username> <password> <admin|editor|viewer>');
}

async function main() {
  const [usernameArg, password, roleArg] = process.argv.slice(2);
  const username = normalizeUsername(usernameArg);
  const role = roleArg === 'admin'
    ? 'admin'
    : roleArg === 'editor'
      ? 'editor'
      : roleArg === 'viewer'
        ? 'viewer'
        : null;

  if (!/^[a-z0-9_.-]{3,40}$/.test(username) || !password || !role) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  if (password.length < 8) {
    console.error('Password must be at least 8 characters.');
    process.exitCode = 1;
    return;
  }

  fs.mkdirSync(dataDir, { recursive: true });

  let store = {};
  if (fs.existsSync(usersFile)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
      if (parsed && typeof parsed === 'object') {
        store = parsed;
      }
    } catch (_err) {
      store = {};
    }
  }

  if (store[username]) {
    console.error(`User "${username}" already exists.`);
    process.exitCode = 1;
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  store[username] = {
    username,
    passwordHash,
    role,
    createdAt: new Date().toISOString()
  };

  fs.writeFileSync(usersFile, JSON.stringify(store, null, 2), 'utf8');
  console.log(`User created: ${username} (${role})`);
}

main().catch(err => {
  console.error('Failed to create user:', err.message);
  process.exitCode = 1;
});
