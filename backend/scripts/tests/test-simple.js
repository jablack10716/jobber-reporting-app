// Simple test server to isolate the issue
const express = require('express');
require('dotenv').config();

const app = express();
const port = 3000;

console.log('🔍 Testing simple server startup...');
console.log('USE_REAL_DATA:', process.env.USE_REAL_DATA);

// Simple health check
app.get('/api/health', (req, res) => {
  console.log('Health check requested');
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`✅ Simple server running on http://0.0.0.0:${port}`);
  
  setTimeout(() => {
    console.log('✅ 3-second check - server still alive');
  }, 3000);
});

// Keep alive
setInterval(() => {
  console.log('💓 Heartbeat');
}, 10000);