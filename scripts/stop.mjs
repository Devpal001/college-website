// Stops the college-website dev stack by terminating whatever process is
// listening on the API port (3001) or the Vite dev ports (5173 / 5174).
// Usage:  npm run stop
import { execSync } from 'child_process';

const PORTS = '(3001|5173|5174)';

let output = '';
try {
  output = execSync('netstat -ano -p tcp', { encoding: 'utf8' });
} catch (err) {
  console.error('Could not read the TCP connection table:', err.message);
  process.exit(1);
}

const pids = new Set();
for (const line of output.split('\n')) {
  const m = line.trim().match(new RegExp(`^TCP\\s+\\S+:${PORTS}\\s+\\S+\\s+LISTENING\\s+(\\d+)$`, 'i'));
  if (m) pids.add(Number(m[1]));
}

if (pids.size === 0) {
  console.log('Nothing is running on ports 3001 / 5173 / 5174.');
} else {
  for (const pid of pids) {
    try {
      process.kill(pid);
      console.log(`Stopped process ${pid}.`);
    } catch {
      console.log(`Could not stop process ${pid} (may have already exited).`);
    }
  }
  console.log('Dev stack stopped. Start it again with: npm run dev');
}
