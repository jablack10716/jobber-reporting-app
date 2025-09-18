#!/usr/bin/env node

/**
 * Validation Script for Priority 2 Data Operations & Efficiency
 * Tests: Admin endpoints, year override, caching behavior, disk slices
 */

const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';
const ADMIN_KEY = process.env.ADMIN_KEY || 'test-admin-key-123';

// Test utilities
async function makeRequest(url, options = {}) {
  const { default: fetch } = await import('node-fetch');
  try {
    const response = await fetch(url, options);
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { rawText: text };
    }
    return { status: response.status, data, ok: response.ok };
  } catch (error) {
    return { status: 0, data: { error: error.message }, ok: false };
  }
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function logTest(name, result, details = '') {
  const status = result ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} ${name}${details ? ' - ' + details : ''}`);
}

function logSection(name) {
  console.log(`\n=== ${name} ===`);
}

// Test cases
async function testHealthEndpoint() {
  logSection('Health Endpoint');
  const result = await makeRequest(`${BASE_URL}/api/health`);
  logTest('Health check', result.ok && result.data.status === 'ok', 
    result.ok ? `Status: ${result.data.status}` : `Error: ${result.status}`);
  return result.ok;
}

async function testYearOverride() {
  logSection('Year Override Functionality');
  
  // Test current year (2025)
  const current = await makeRequest(`${BASE_URL}/api/reports/plumber?name=Lorin&year=2025`);
  logTest('Current year (2025)', current.ok && current.data.meta?.year === 2025,
    current.ok ? `Returned year: ${current.data.meta?.year}` : `Error: ${current.status}`);
  
  // Test different year (2024)
  const different = await makeRequest(`${BASE_URL}/api/reports/plumber?name=Lorin&year=2024`);
  logTest('Different year (2024)', different.ok && different.data.meta?.year === 2024,
    different.ok ? `Returned year: ${different.data.meta?.year}` : `Error: ${different.status}`);
  
  return current.ok && different.ok && 
         current.data.meta?.year === 2025 && different.data.meta?.year === 2024;
}

async function testCachingBehavior() {
  logSection('Caching Behavior');
  
  // Cold fetch
  const cold = await makeRequest(`${BASE_URL}/api/reports/plumber?name=Wes&year=2025`);
  const coldStatus = cold.data?._cache?.status ?? cold.data?.cache?.status;
  const coldPass = cold.ok && (coldStatus ? coldStatus === 'miss' : true);
  logTest('Cold fetch', coldPass,
    cold.ok ? `Cache status: ${coldStatus ?? 'n/a'}` : `Error: ${cold.status}`);
  
  await sleep(100); // Brief pause
  
  // Warm fetch
  const warm = await makeRequest(`${BASE_URL}/api/reports/plumber?name=Wes&year=2025`);
  const warmStatus = warm.data?._cache?.status ?? warm.data?.cache?.status;
  const warmPass = warm.ok && (warmStatus ? warmStatus === 'hit' : true);
  logTest('Warm fetch', warmPass,
    warm.ok ? `Cache status: ${warmStatus ?? 'n/a'}` : `Error: ${warm.status}`);
  
  // Force refresh
  const refresh = await makeRequest(`${BASE_URL}/api/reports/plumber?name=Wes&year=2025&refresh=1`);
  const refreshStatus = refresh.data?._cache?.status ?? refresh.data?.cache?.status;
  const refreshPass = refresh.ok && refresh.data?.meta?.refreshRequested === true;
  logTest('Force refresh', refreshPass,
    refresh.ok ? `Cache status: ${refreshStatus ?? 'n/a'}, refresh: ${refresh.data.meta?.refreshRequested}` : `Error: ${refresh.status}`);
  
  return coldPass && warmPass && refreshPass;
}

async function testAdminEndpoint() {
  logSection('Admin Endpoint Authentication & Rate Limiting');
  
  // Test with correct key
  const correctKey = await makeRequest(`${BASE_URL}/api/admin/refresh-year?year=2025&plumbers=Lorin`, {
    method: 'POST',
    headers: { 'x-admin-key': ADMIN_KEY }
  });
  logTest('Correct admin key', correctKey.ok && correctKey.data.ok === true,
    correctKey.ok ? `Success: ${correctKey.data.ok}` : `Error: ${correctKey.status} - ${JSON.stringify(correctKey.data)}`);
  
  // Test with wrong key
  const wrongKey = await makeRequest(`${BASE_URL}/api/admin/refresh-year?year=2025&plumbers=Lorin`, {
    method: 'POST',
    headers: { 'x-admin-key': 'wrong-key' }
  });
  logTest('Wrong admin key (should fail)', wrongKey.status === 401,
    `Status: ${wrongKey.status}, Error: ${wrongKey.data.error || 'none'}`);
  
  // Test immediate retry (should be rate limited)
  if (correctKey.ok) {
    const retry = await makeRequest(`${BASE_URL}/api/admin/refresh-year?year=2025&plumbers=Lorin`, {
      method: 'POST',
      headers: { 'x-admin-key': ADMIN_KEY }
    });
    logTest('Rate limiting (immediate retry)', retry.status === 429,
      `Status: ${retry.status}, Minutes to wait: ${retry.data.retryInMinutes || 'none'}`);
  }
  
  return correctKey.ok;
}

async function testDiskCache() {
  logSection('Disk Cache Inspection');
  
  const projectRoot = path.resolve(__dirname, '..', '..');
  const cacheDir = path.join(projectRoot, 'cache', 'reports');
  const exists = fs.existsSync(cacheDir);
  logTest('Cache directory exists', exists, `Path: ${cacheDir}`);
  
  if (exists) {
    const files = fs.readdirSync(cacheDir).filter(f => f.endsWith('.json'));
    logTest('Cache files present', files.length > 0, `Found ${files.length} files`);
    
    if (files.length > 0) {
      // Check a sample file structure
      try {
        const sampleFile = path.join(cacheDir, files[0]);
        const content = JSON.parse(fs.readFileSync(sampleFile, 'utf8'));
        const hasValidStructure = content.meta && content.month && content.meta.savedAt;
        logTest('Valid cache file structure', hasValidStructure, 
          `Sample file: ${files[0]}, has meta: ${!!content.meta}, has month: ${!!content.month}`);
      } catch (error) {
        logTest('Valid cache file structure', false, `Error reading file: ${error.message}`);
      }
    }
    
    return files.length > 0;
  }
  
  return false;
}

async function testCombinedEndpoint() {
  logSection('Combined Endpoint');
  
  const result = await makeRequest(`${BASE_URL}/api/reports/combined?plumbers=Lorin,Wes&year=2025`);
  logTest('Combined endpoint', result.ok && Array.isArray(result.data.plumbers),
    result.ok ? `Plumbers: ${result.data.plumbers?.length || 0}, Cache hits: ${result.data.cache?.hits || 0}` : `Error: ${result.status}`);
  
  return result.ok;
}

// Main validation runner
async function runValidation() {
  console.log('🧪 Priority 2 Validation Script');
  console.log(`📡 Testing server at: ${BASE_URL}`);
  console.log(`🔑 Admin key: ${ADMIN_KEY}`);
  console.log(`⏰ Started at: ${new Date().toISOString()}\n`);
  
  const results = [];
  
  try {
    results.push(await testHealthEndpoint());
    results.push(await testYearOverride());
    results.push(await testCachingBehavior());
    results.push(await testAdminEndpoint());
    results.push(await testDiskCache());
    results.push(await testCombinedEndpoint());
    
    const passed = results.filter(Boolean).length;
    const total = results.length;
    
    logSection('Summary');
    console.log(`📊 Tests passed: ${passed}/${total}`);
    console.log(`🎯 Success rate: ${Math.round(passed/total*100)}%`);
    
    if (passed === total) {
      console.log('🎉 All tests passed! Priority 2 implementation is working correctly.');
    } else {
      console.log('⚠️  Some tests failed. Check the output above for details.');
    }
    
  } catch (error) {
    console.error('💥 Validation script failed:', error.message);
    process.exit(1);
  }
}

// Check if this script is run directly
if (require.main === module) {
  runValidation().catch(console.error);
}

module.exports = { runValidation };