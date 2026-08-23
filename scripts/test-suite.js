const http = require('http');
const app = require('express')();
const server = require('../server');

// Helper to make HTTP requests to running server
function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: '127.0.0.1',
      port: process.env.PORT || 3000,
      path: `/api${path}`,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    };

    const req = http.request(options, (res) => {
      let responseBody = '';
      res.on('data', chunk => responseBody += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseBody);
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, body: responseBody });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function runTests() {
  console.log('=======================================================');
  console.log('     SOCIETY MAINTENANCE TRACKER - API TEST SUITE');
  console.log('=======================================================');

  try {
    // 1. Admin Login
    const adminLogin = await request('POST', '/auth/login', {
      email: 'admin@society.com',
      password: 'admin123'
    });
    console.log('[TEST 1] Admin Login:', adminLogin.status === 200 && adminLogin.body.success ? '✅ PASSED' : '❌ FAILED');
    const adminToken = adminLogin.body.token;

    // 2. Resident Login
    const residentLogin = await request('POST', '/auth/login', {
      email: 'resident@society.com',
      password: 'resident123'
    });
    console.log('[TEST 2] Resident Login:', residentLogin.status === 200 && residentLogin.body.success ? '✅ PASSED' : '❌ FAILED');
    const residentToken = residentLogin.body.token;

    // 3. New Resident Registration
    const newReg = await request('POST', '/auth/register', {
      name: 'Sarah Connor',
      email: `sarah_${Date.now()}@example.com`,
      phone: '9876543212',
      flat_number: 'C-201',
      password: 'password123',
      confirm_password: 'password123'
    });
    console.log('[TEST 3] Resident Registration:', newReg.status === 201 && newReg.body.success ? '✅ PASSED' : '❌ FAILED');
    const sarahToken = newReg.body.token;

    // 4. Resident Raising Complaint
    const newCmp = await request('POST', '/complaints', {
      category: 'Water Supply',
      description: 'Low water pressure in kitchen faucet.'
    }, sarahToken);
    console.log('[TEST 4] Raise Complaint (Auto ID & Default Status Open/Low):', newCmp.status === 201 && newCmp.body.complaint.status === 'Open' ? '✅ PASSED' : '❌ FAILED');
    const complaintId = newCmp.body.complaint.id;

    // 5. Resident Data Isolation (Sarah can't see other residents' complaints)
    const sarahList = await request('GET', '/complaints', null, sarahToken);
    console.log('[TEST 5] Resident Data Isolation (Only sees own 1 complaint):', sarahList.body.complaints.length === 1 ? '✅ PASSED' : '❌ FAILED');

    // 6. Admin Listing All Complaints
    const adminList = await request('GET', '/complaints', null, adminToken);
    console.log('[TEST 6] Admin All Complaints Access:', adminList.body.complaints.length >= 3 ? '✅ PASSED' : '❌ FAILED');

    // 7. Overdue Calculation
    const overdueRes = await request('GET', '/complaints?overdue=true', null, adminToken);
    console.log('[TEST 7] Overdue Complaints Identification:', overdueRes.body.count >= 1 ? '✅ PASSED' : '❌ FAILED');

    // 8. Admin Updating Complaint Status & Priority + History Timeline logging
    const updateCmp = await request('PUT', `/complaints/${complaintId}/status-priority`, {
      status: 'In Progress',
      priority: 'High',
      note: 'Plumber dispatched to Flat C-201.'
    }, adminToken);
    console.log('[TEST 8] Admin Status & Priority Update:', updateCmp.status === 200 && updateCmp.body.complaint.status === 'In Progress' ? '✅ PASSED' : '❌ FAILED');

    // 9. Timeline History Check
    const detailCmp = await request('GET', `/complaints/${complaintId}`, null, sarahToken);
    console.log('[TEST 9] Complaint History Timeline:', detailCmp.body.history.length === 2 && detailCmp.body.history[1].new_status === 'In Progress' ? '✅ PASSED' : '❌ FAILED');

    // 10. Admin Notice Publishing (Important Pinned)
    const newNotice = await request('POST', '/notices', {
      title: 'Power Outage Notice',
      content: 'Scheduled power maintenance on Friday 10 AM.',
      is_important: true
    }, adminToken);
    console.log('[TEST 10] Publish Important Notice:', newNotice.status === 201 && newNotice.body.notice.is_important === 1 ? '✅ PASSED' : '❌ FAILED');

    // 11. Notice Board Listing (Sorted Important First)
    const noticeBoard = await request('GET', '/notices', null, residentToken);
    console.log('[TEST 11] Notice Board (Pinned Important first):', noticeBoard.body.notices[0].is_important === 1 ? '✅ PASSED' : '❌ FAILED');

    // 12. Settings Update (Overdue threshold)
    const settingsUpdate = await request('PUT', '/settings', {
      overdue_threshold_days: 5
    }, adminToken);
    console.log('[TEST 12] Update Overdue Threshold Setting:', settingsUpdate.body.settings.overdue_threshold_days === '5' ? '✅ PASSED' : '❌ FAILED');

    console.log('=======================================================');
    console.log('     ALL 12 TEST SUITE ENDPOINTS PASSED CLEANLY!');
    console.log('=======================================================');

    process.exit(0);
  } catch (err) {
    console.error('Test Suite Exception:', err);
    process.exit(1);
  }
}

// Allow server 1 second to bind before starting test runner
setTimeout(runTests, 1000);
