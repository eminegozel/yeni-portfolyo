const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../server');
let server, base;
before(async () => {
  server = await new Promise(resolve => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise(resolve => {
  server.close(resolve);
  server.closeAllConnections();
}));
test('health and API status return JSON', async () => {
  for (const endpoint of ['/health', '/api/status']) {
    const res = await fetch(base + endpoint);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /application\/json/);
    assert.equal((await res.json()).status, 'ok');
  }
});
test('portfolio and local assets are served from public', async () => {
  const page = await fetch(base);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Emine/);
  for (const asset of ['/style.css', '/app.js', '/assets/avatar-float.png', '/assets/yemekhane-screen.png', '/assets/yemekhane-logo.png', '/assets/nocturne-logo.png']) {
    assert.equal((await fetch(base + asset)).status, 200, asset);
  }
});
test('missing files and private project files are not exposed', async () => {
  for (const url of ['/missing', '/server.js', '/package.json', '/.git/config', '/deploy/my-site.service']) {
    assert.equal((await fetch(base + url)).status, 404, url);
  }
});
