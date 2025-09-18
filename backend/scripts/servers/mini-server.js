console.log('[MINI] mini-server.js load start', new Date().toISOString());
const express = require('express');
const app = express();
const port = 3100;

app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

const server = app.listen(port, () => {
  console.log(`[MINI] Listening on http://localhost:${port}`);
});

setTimeout(()=>console.log('[MINI] 2s tick'),2000);
setTimeout(()=>console.log('[MINI] 5s tick'),5000);
setInterval(()=>console.log('[MINI] heartbeat', new Date().toISOString()), 15000);

process.on('exit', c=>console.log('[MINI] exit code', c));
process.on('SIGINT', ()=>{ console.log('[MINI] SIGINT'); server.close(()=>process.exit(0)); });
process.on('uncaughtException', e=>{ console.log('[MINI] uncaught', e); });
process.on('unhandledRejection', r=>{ console.log('[MINI] unhandledRejection', r); });

console.log('[MINI] mini-server.js load end', new Date().toISOString());