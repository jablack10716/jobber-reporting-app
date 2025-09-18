console.log('Starting test server...');

const express = require('express');
const app = express();
const port = 3001;

// Basic middleware
app.use(express.json());

// Test health endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Test GraphQL query import
app.get('/api/test-query', (req, res) => {
  try {
    const queries = require('./jobber-queries.js');
    const query = queries.getInvoicesQuery(new Date('2025-09-01'), new Date('2025-09-15'));
    const hasProblems = ['selectedOption', 'numberValue', 'booleanValue'].some(field => query.includes(field));
    res.json({ 
      status: hasProblems ? 'bad-query' : 'good-query',
      hasProblems,
      queryLength: query.length 
    });
  } catch (error) {
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

app.listen(port, () => {
  console.log(`Test server running on http://localhost:${port}`);
});
app.get('/api/health', (req, res) => {
  console.log('Health check requested');
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Catch all errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start server
app.listen(port, '0.0.0.0', () => {
  console.log(`Test server running on port ${port}`);
  
  setInterval(() => {
    console.log('Server is still alive at', new Date().toISOString());
  }, 5000);
});