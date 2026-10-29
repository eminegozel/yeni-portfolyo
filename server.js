'use strict';
const express = require('express');
const path = require('node:path');

const app = express();
app.disable('x-powered-by');
// Only the local Nginx proxy is trusted.
app.set('trust proxy', 'loopback');

app.get(['/health', '/api/status'], (_req, res) => {
  res.set('Cache-Control', 'no-store').json({
    status: 'ok',
    service: 'my-site',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});
app.use(express.static(path.join(__dirname, 'public')));
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }
  // The application is reachable through Nginx; port 3000 stays local.
  const server = app.listen(port, '127.0.0.1', () => {
    console.log(`my-site listening on http://127.0.0.1:${port}`);
  });
  server.on('error', error => { console.error(error); process.exitCode = 1; });
  for (const signal of ['SIGTERM', 'SIGINT']) {
    process.once(signal, () => {
      server.close(() => process.exit(0));
      setTimeout(() => process.exit(1), 10000).unref();
    });
  }
}
module.exports = app;
