const { networkInterfaces } = require('os');
const { spawn } = require('child_process');

const nets = networkInterfaces();
let wifiIp = null;

// Try to find the Wi-Fi interface first
for (const name of Object.keys(nets)) {
  if (name.toLowerCase().includes('wi-fi') || name.toLowerCase().includes('wireless')) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        wifiIp = net.address;
        break;
      }
    }
  }
}

// Fallback: search for any non-virtual IPv4 interface
if (!wifiIp) {
  for (const name of Object.keys(nets)) {
    if (name.toLowerCase().includes('virtual') || name.toLowerCase().includes('vethernet') || name.toLowerCase().includes('wsl')) {
      continue;
    }
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        wifiIp = net.address;
        break;
      }
    }
    if (wifiIp) break;
  }
}

const args = [...process.argv.slice(2)];
const isTunnel = args.includes('--tunnel');

if (wifiIp) {
  console.log(`\x1b[32m[Expo] Detected Wi-Fi IP: ${wifiIp}\x1b[0m`);
  // In tunnel mode Expo serves the bundle through ngrok, so we must NOT
  // pin the packager hostname to the LAN IP (it would break the tunnel URL).
  if (!isTunnel) {
    process.env.REACT_NATIVE_PACKAGER_HOSTNAME = wifiIp;
  }
  // The backend still runs locally, so the API URL stays on the LAN IP.
  process.env.EXPO_PUBLIC_API_BASE_URL = `http://${wifiIp}:5001`;
} else {
  console.log('\x1b[33m[Expo] Could not find active Wi-Fi IP interface. Using default configuration.\x1b[0m');
}

// Default to LAN mode (fast; requires phone on same Wi-Fi + open firewall ports)
if (!args.includes('--lan') && !args.includes('--localhost') && !args.includes('--tunnel')) {
  args.push('--lan');
}

if (args.includes('--tunnel')) {
  console.log('\x1b[36m[Expo] Starting in TUNNEL mode — works on any network.\x1b[0m');
}

// Start Expo with the custom environment variable set
const child = spawn('npx', ['expo', 'start', ...args], {
  stdio: 'inherit',
  shell: true
});

child.on('close', (code) => {
  process.exit(code);
});
