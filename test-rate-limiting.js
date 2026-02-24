const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api';

// Test 1: Login Rate Limiting (5 attempts per 15 minutes)
async function testLoginRateLimit() {
  console.log('\n🧪 Test 1: Login Rate Limiting (5 attempts max)');
  console.log('='.repeat(50));
  
  const testEmail = 'test@example.com';
  let blockedAt = null;

  for (let i = 1; i <= 7; i++) {
    try {
      const response = await axios.post(`${BASE_URL}/login`, {
        email: testEmail,
        password: 'wrongpassword'
      });
      console.log(`Attempt ${i}: ✅ Status ${response.status}`);
    } catch (error) {
      if (error.response?.status === 429) {
        blockedAt = i;
        console.log(`Attempt ${i}: 🚫 BLOCKED (429) - Rate limit hit!`);
        console.log(`   Retry-After: ${error.response.headers['retry-after']}s`);
        console.log(`   Message: ${error.response.data.message}`);
        break;
      } else {
        console.log(`Attempt ${i}: ❌ Status ${error.response?.status || 'Error'}`);
      }
    }
    await sleep(100);
  }

  if (blockedAt && blockedAt <= 6) {
    console.log('\n✅ Login rate limiting WORKING - Blocked at attempt', blockedAt);
  } else {
    console.log('\n❌ Login rate limiting NOT WORKING - Should block after 5 attempts');
  }
}

// Test 2: Unauthenticated API Rate Limiting (20 req/min)
async function testUnauthenticatedRateLimit() {
  console.log('\n🧪 Test 2: Unauthenticated Rate Limiting (20 req/min)');
  console.log('='.repeat(50));
  
  let blockedAt = null;

  for (let i = 1; i <= 25; i++) {
    try {
      const response = await axios.get(`${BASE_URL}/patient/profile/1`);
      if (i % 5 === 0) console.log(`Request ${i}: ✅ Status ${response.status}`);
    } catch (error) {
      if (error.response?.status === 429) {
        blockedAt = i;
        console.log(`Request ${i}: 🚫 BLOCKED (429) - Rate limit hit!`);
        console.log(`   Retry-After: ${error.response.headers['retry-after']}s`);
        break;
      } else {
        if (i % 5 === 0) console.log(`Request ${i}: Status ${error.response?.status}`);
      }
    }
    await sleep(50);
  }

  if (blockedAt && blockedAt <= 22) {
    console.log('\n✅ Unauthenticated rate limiting WORKING - Blocked at request', blockedAt);
  } else {
    console.log('\n❌ Unauthenticated rate limiting NOT WORKING - Should block around 20 requests');
  }
}

// Test 3: Check Redis Connection
async function testRedisConnection() {
  console.log('\n🧪 Test 3: Redis Connection Status');
  console.log('='.repeat(50));
  
  try {
    const response = await axios.get(`${BASE_URL}/patient/profile/1`);
    console.log('✅ Server is running');
    console.log('ℹ️  Check server logs for Redis connection status');
    console.log('   - If you see "Redis Client Connected" → Redis is working');
    console.log('   - If you see "Redis Client Error" → Using memory fallback');
  } catch (error) {
    console.log('❌ Server not responding. Make sure server is running on port 3000');
  }
}

// Test 4: Verify Response Headers
async function testResponseHeaders() {
  console.log('\n🧪 Test 4: Rate Limit Headers');
  console.log('='.repeat(50));
  
  try {
    const response = await axios.get(`${BASE_URL}/patient/profile/1`);
    const headers = response.headers;
    
    console.log('Response Headers:');
    console.log(`   RateLimit-Limit: ${headers['ratelimit-limit'] || 'Not set'}`);
    console.log(`   RateLimit-Remaining: ${headers['ratelimit-remaining'] || 'Not set'}`);
    console.log(`   RateLimit-Reset: ${headers['ratelimit-reset'] || 'Not set'}`);
    
    if (headers['ratelimit-limit']) {
      console.log('\n✅ Rate limit headers are present');
    } else {
      console.log('\n⚠️  Rate limit headers not found (may be normal)');
    }
  } catch (error) {
    console.log('❌ Could not fetch headers');
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run all tests
async function runAllTests() {
  console.log('\n🚀 Starting Rate Limiting Tests');
  console.log('='.repeat(50));
  console.log('Make sure the server is running on http://localhost:3000');
  console.log('='.repeat(50));

  await sleep(1000);
  
  await testRedisConnection();
  await sleep(2000);
  
  await testResponseHeaders();
  await sleep(2000);
  
  await testLoginRateLimit();
  await sleep(2000);
  
  await testUnauthenticatedRateLimit();
  
  console.log('\n' + '='.repeat(50));
  console.log('✅ All tests completed!');
  console.log('='.repeat(50));
}

runAllTests().catch(console.error);
