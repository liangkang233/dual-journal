#!/usr/bin/env node
/**
 * Test script to verify the accept invite fix for solo pairs.
 * Tests that users can leave a 1-person solo pair to join a 2-person pair.
 */

const http = require('http');

const BASE_URL = 'http://localhost:8787';
const OPENID_A = 'test_user_A';
const OPENID_B = 'test_user_B';

let testsPassed = 0;
let testsFailed = 0;

function request(method, path, openid, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 8787,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'x-openid': openid,
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve({ status: res.statusCode, data: result });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function test(name, fn) {
  try {
    console.log(`\n🧪 ${name}`);
    await fn();
    console.log(`✅ PASS: ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`❌ FAIL: ${name}`);
    console.error(`   ${err.message}`);
    testsFailed++;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('Testing Pair Accept with Solo Pair Migration');
  console.log('='.repeat(60));

  let inviteCodeA = null;
  let pairIdA = null;
  let pairIdB = null;

  await test('User A creates solo pair', async () => {
    const res = await request('POST', '/api/pairs/ensure-solo', OPENID_A);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data._id, 'Should have pair ID');
    assert(res.data.memberOpenids.length === 1, 'Solo pair should have 1 member');
    pairIdA = res.data._id;
  });

  await test('User B creates solo pair', async () => {
    const res = await request('POST', '/api/pairs/ensure-solo', OPENID_B);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data._id, 'Should have pair ID');
    assert(res.data.memberOpenids.length === 1, 'Solo pair should have 1 member');
    pairIdB = res.data._id;
  });

  await test('User A generates invite code', async () => {
    const res = await request('POST', '/api/pairs/invite', OPENID_A);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.inviteCode, 'Should have invite code');
    assert(res.data.inviteCode.length === 6, 'Invite code should be 6 characters');
    assert(/^[A-HJ-NP-Z2-9]{6}$/.test(res.data.inviteCode), 'Invite code should not contain 0O1IL');
    inviteCodeA = res.data.inviteCode;
    console.log(`   Invite code: ${inviteCodeA}`);
  });

  await test('User B accepts invite (leaving solo pair)', async () => {
    const res = await request('POST', '/api/pairs/accept', OPENID_B, { inviteCode: inviteCodeA });
    assert(res.status === 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.data)}`);
    assert(res.data.pairId, 'Should return pair ID');
    assert(res.data.pairId === pairIdA, 'Should join A\'s pair');
  });

  await test('User A\'s pair now has 2 members', async () => {
    const res = await request('GET', '/api/pairs/me', OPENID_A);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data._id === pairIdA, 'Should still be A\'s original pair');
    assert(res.data.memberOpenids.length === 2, 'Pair should have 2 members');
    assert(res.data.memberOpenids.includes(OPENID_A), 'Should include user A');
    assert(res.data.memberOpenids.includes(OPENID_B), 'Should include user B');
    assert(res.data.inviteActive === false, 'Invite should be inactive when full');
  });

  await test('User B\'s pair is now the same as A', async () => {
    const res = await request('GET', '/api/pairs/me', OPENID_B);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data._id === pairIdA, 'Should be in A\'s pair');
    assert(res.data.memberOpenids.length === 2, 'Pair should have 2 members');
  });

  await test('User B can create entry in shared pair', async () => {
    const res = await request('POST', '/api/entries', OPENID_B, {
      pairId: pairIdA,
      title: 'Test Entry from B',
      content: 'This is a test entry',
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data._id, 'Should have entry ID');
    assert(res.data.pairId === pairIdA, 'Entry should be in shared pair');
  });

  await test('User A can see B\'s entry', async () => {
    const res = await request('GET', `/api/entries?pairId=${pairIdA}`, OPENID_A);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(Array.isArray(res.data), 'Should return array');
    const entry = res.data.find(e => e.authorOpenid === OPENID_B);
    assert(entry, 'Should find entry from user B');
    assert(entry.title === 'Test Entry from B', 'Entry title should match');
  });

  console.log('\n' + '='.repeat(60));
  console.log(`Tests Complete: ${testsPassed} passed, ${testsFailed} failed`);
  console.log('='.repeat(60));

  if (testsFailed > 0) {
    process.exit(1);
  }
}

// Check if server is running
http.get(BASE_URL + '/health', (res) => {
  if (res.statusCode === 200) {
    console.log('✓ Server is running');
    runTests().catch((err) => {
      console.error('Test suite error:', err);
      process.exit(1);
    });
  } else {
    console.error('❌ Server health check failed');
    process.exit(1);
  }
}).on('error', (err) => {
  console.error('❌ Cannot connect to server. Please start the server first:');
  console.error('   cd server && npm start');
  process.exit(1);
});
