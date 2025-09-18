#!/usr/bin/env node

// Quick debug script to check environment variables
console.log('=== Environment Variables Debug ===');
console.log('ADMIN_KEY:', process.env.ADMIN_KEY || 'NOT SET');
console.log('ADMIN_REFRESH_MIN_INTERVAL:', process.env.ADMIN_REFRESH_MIN_INTERVAL || 'NOT SET');
console.log('USE_REAL_DATA:', process.env.USE_REAL_DATA || 'NOT SET');

// Load dotenv and check again
require('dotenv').config();
console.log('\n=== After dotenv.config() ===');
console.log('ADMIN_KEY:', process.env.ADMIN_KEY || 'NOT SET');
console.log('ADMIN_REFRESH_MIN_INTERVAL:', process.env.ADMIN_REFRESH_MIN_INTERVAL || 'NOT SET');
console.log('USE_REAL_DATA:', process.env.USE_REAL_DATA || 'NOT SET');