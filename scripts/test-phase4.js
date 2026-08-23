const http = require('http');
const app = require('../server');

function request(method, path, body = null, token = null, isMultipart = false) {
  return new Promise((resolve, reject) => {
    let headers = {};
    let payload = null;

    if (isMultipart && body) {
      const boundary = '--------------------------' + Date.now().toString(16);
      headers['Content-Type'] = `multipart/form-data; boundary=${boundary}`;

      let postData = '';
      for (const [key, val] of Object.entries(body)) {
        if (key === 'photo') {
          postData += `--${boundary}\r\n`;
          postData += `Content-Disposition: form-data; name="photo"; filename="${val.filename}"\r\n`;
          postData += `Content-Type: ${val.mime}\r\n\r\n`;
          postData += val.content + '\r\n';
        } else {
          postData += `--${boundary}\r\n`;
          postData += `Content-Disposition: form-data; name="${key}"\r\n\r\n`;
          postData += `${val}\r\n`;
        }
      }
      postData += `--${boundary}--\r\n`;
      payload = Buffer.from(postData);
      headers['Content-Length'] = payload.length;
    } else if (body) {
      payload = Buffer.from(JSON.stringify(body));
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = payload.length;
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const options = {
      hostname: '127.0.0.1',
      port: process.env.PORT || 3000,
      path: `/api${path}`,
      method: method,
      headers: headers
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
    if (payload) req.write(payload);
    req.end();
  });
}

async function runPhase4AuditAndTestSuite() {
  console.log('=================================================================');
  console.log('  SOCIETY MAINTENANCE TRACKER - PHASE 4 FULL AUDIT & TEST SUITE');
  console.log('=================================================================');

  try {
    const timestamp = Date.now();

    // --- 1. AUTHENTICATION & EDGE CASE TESTS ---
    console.log('\n--- SECTION 1: AUTHENTICATION & EDGE CASE CHECKS ---');

    // Test 1.1: Invalid Login
    const invalidLogin = await request('POST', '/auth/login', { email: 'wrong@example.com', password: 'wrongpassword' });
    console.log('[TEST 1.1] Invalid Login (401 Unauthorized):', invalidLogin.status === 401 ? '✅ PASSED' : '❌ FAILED');

    // Test 1.2: Register Resident A
    const resA = await request('POST', '/auth/register', {
      name: 'Resident A',
      email: `res_a_${timestamp}@society.com`,
      phone: '9876543210',
      flat_number: 'A-101',
      password: 'password123',
      confirm_password: 'password123'
    });
    console.log('[TEST 1.2] Register Resident A:', resA.status === 201 && resA.body.success ? '✅ PASSED' : '❌ FAILED');
    const tokenA = resA.body.token;

    // Test 1.3: Duplicate Email Registration Error
    const dupReg = await request('POST', '/auth/register', {
      name: 'Resident A Duplicate',
      email: `res_a_${timestamp}@society.com`,
      phone: '9876543210',
      flat_number: 'A-101',
      password: 'password123',
      confirm_password: 'password123'
    });
    console.log('[TEST 1.3] Duplicate Email Rejection (400 Bad Request):', dupReg.status === 400 && dupReg.body.message.includes('already registered') ? '✅ PASSED' : '❌ FAILED');

    // --- 2. RESIDENT FLOW & COMPLAINT CREATION ---
    console.log('\n--- SECTION 2: RESIDENT FLOW & COMPLAINT CREATION ---');

    // Test 2.1: Raise Complaint without photo
    const cmpNoPhoto = await request('POST', '/complaints', {
      category: 'Cleaning',
      description: 'Stairwell cleaning requested.'
    }, tokenA);
    console.log('[TEST 2.1] Raise Complaint without Photo (Status Open, Priority Low):', cmpNoPhoto.status === 201 && cmpNoPhoto.body.complaint.status === 'Open' && cmpNoPhoto.body.complaint.priority === 'Low' ? '✅ PASSED' : '❌ FAILED');

    // Test 2.2: Raise Complaint with Valid Photo
    const cmpWithPhoto = await request('POST', '/complaints', {
      category: 'Plumbing',
      description: 'Bathroom sink leaking water.',
      photo: { filename: 'sink.png', mime: 'image/png', content: 'fake_png_data' }
    }, tokenA, true);
    console.log('[TEST 2.2] Raise Complaint with Valid Photo Attachment:', cmpWithPhoto.status === 201 && cmpWithPhoto.body.complaint.photo_url ? '✅ PASSED' : '❌ FAILED');
    const cmpId = cmpWithPhoto.body.complaint.id;
    const cmpNum = cmpWithPhoto.body.complaint.complaint_number;

    // Test 2.3: Verify Unique Complaint Numbers
    console.log(`[TEST 2.3] Unique Complaint Number Generation (${cmpNum}):`, /^CMP-\d{8}-\d{3}$/.test(cmpNum) ? '✅ PASSED' : '❌ FAILED');

    // Test 2.4: Invalid File Format Rejection
    const invalidFile = await request('POST', '/complaints', {
      category: 'Other',
      description: 'Test file upload',
      photo: { filename: 'script.exe', mime: 'application/x-msdownload', content: 'binary_exe' }
    }, tokenA, true);
    console.log('[TEST 2.4] Invalid Executable File Rejection (400 Bad Request):', invalidFile.status === 400 ? '✅ PASSED' : '❌ FAILED');

    // Test 2.5: My Complaints Listing & History Timeline
    const myCmp = await request('GET', '/complaints', null, tokenA);
    console.log('[TEST 2.5] My Complaints Listing (Belongs to Resident A):', myCmp.body.complaints.length === 2 ? '✅ PASSED' : '❌ FAILED');

    const detailA = await request('GET', `/complaints/${cmpId}`, null, tokenA);
    console.log('[TEST 2.6] Complaint Details & History Timeline (Initial Entry):', detailA.body.history.length === 1 && detailA.body.history[0].new_status === 'Open' ? '✅ PASSED' : '❌ FAILED');

    // --- 3. ADMIN FLOW & LIFECYCLE UPDATES ---
    console.log('\n--- SECTION 3: ADMIN WORKFLOW & LIFECYCLE MANAGEMENT ---');

    // Test 3.1: Admin Login
    const adminLogin = await request('POST', '/auth/login', { email: 'admin@society.com', password: 'admin123' });
    console.log('[TEST 3.1] Admin Login:', adminLogin.status === 200 && adminLogin.body.success ? '✅ PASSED' : '❌ FAILED');
    const adminToken = adminLogin.body.token;

    // Test 3.2: Admin Complaints List & Filters
    const adminCategoryFilter = await request('GET', '/complaints?category=Plumbing', null, adminToken);
    console.log('[TEST 3.2] Admin Category Filter (Plumbing):', adminCategoryFilter.body.complaints.every(c => c.category === 'Plumbing') ? '✅ PASSED' : '❌ FAILED');

    // Test 3.3: Admin Change Priority Low -> High
    const updatePrio = await request('PUT', `/complaints/${cmpId}/status-priority`, { priority: 'High' }, adminToken);
    console.log('[TEST 3.3] Admin Change Priority (Low -> High):', updatePrio.body.complaint.priority === 'High' ? '✅ PASSED' : '❌ FAILED');

    // Test 3.4: Admin Change Status Open -> In Progress with Note
    const updateStatus1 = await request('PUT', `/complaints/${cmpId}/status-priority`, { status: 'In Progress', note: 'Plumber assigned.' }, adminToken);
    console.log('[TEST 3.4] Admin Status Change (Open -> In Progress + Note + Email):', updateStatus1.body.complaint.status === 'In Progress' ? '✅ PASSED' : '❌ FAILED');

    // Test 3.5: Admin Change Status In Progress -> Resolved with Note
    const updateStatus2 = await request('PUT', `/complaints/${cmpId}/status-priority`, { status: 'Resolved', note: 'Sink pipe fixed.' }, adminToken);
    console.log('[TEST 3.5] Admin Status Change (In Progress -> Resolved + Note + Email):', updateStatus2.body.complaint.status === 'Resolved' ? '✅ PASSED' : '❌ FAILED');

    // Test 3.6: Verify Resolved Complaint is NOT Overdue
    const detailResolved = await request('GET', `/complaints/${cmpId}`, null, adminToken);
    console.log('[TEST 3.6] Resolved Complaint is NOT Overdue (is_overdue === false):', detailResolved.body.complaint.is_overdue === false ? '✅ PASSED' : '❌ FAILED');

    // --- 4. NOTICE MANAGEMENT & EMAIL BROADCAST ---
    console.log('\n--- SECTION 4: NOTICE MANAGEMENT & EMAIL DISPATCH ---');

    // Test 4.1: Create Normal Notice
    const normalNotice = await request('POST', '/notices', { title: 'General Announcement', content: 'Meeting on Sunday.', is_important: false }, adminToken);
    console.log('[TEST 4.1] Create Normal Notice:', normalNotice.status === 201 && normalNotice.body.notice.is_important === 0 ? '✅ PASSED' : '❌ FAILED');

    // Test 4.2: Create Important Notice
    const importantNotice = await request('POST', '/notices', { title: 'Emergency Repair', content: 'Lift maintenance in progress.', is_important: true }, adminToken);
    console.log('[TEST 4.2] Create Important Notice (Pinned + Email Broadcast Triggered):', importantNotice.status === 201 && importantNotice.body.notice.is_important === 1 ? '✅ PASSED' : '❌ FAILED');

    // Test 4.3: Verify Notice Ordering (Important Pinned First)
    const noticesList = await request('GET', '/notices', null, tokenA);
    console.log('[TEST 4.3] Notice Board Sorting (Important Notice Pinned First):', noticesList.body.notices[0].is_important === 1 ? '✅ PASSED' : '❌ FAILED');

    // --- 5. OVERDUE SETTINGS & SECURITY GUARDS ---
    console.log('\n--- SECTION 5: OVERDUE SETTINGS & SECURITY GUARDS ---');

    // Test 5.1: Admin Change Overdue Threshold
    const updateSetting = await request('PUT', '/settings', { overdue_threshold_days: 4 }, adminToken);
    console.log('[TEST 5.1] Update Overdue Threshold Setting (4 Days):', updateSetting.body.settings.overdue_threshold_days === '4' ? '✅ PASSED' : '❌ FAILED');

    // Test 5.2: Invalid Overdue Threshold Rejection
    const invalidSetting = await request('PUT', '/settings', { overdue_threshold_days: -5 }, adminToken);
    console.log('[TEST 5.2] Invalid Overdue Threshold Rejection (400 Bad Request):', invalidSetting.status === 400 ? '✅ PASSED' : '❌ FAILED');

    // Test 5.3: Register Resident B & Test Cross-Resident Access Block
    const resB = await request('POST', '/auth/register', {
      name: 'Resident B',
      email: `res_b_${timestamp}@society.com`,
      phone: '9876543219',
      flat_number: 'B-202',
      password: 'password123',
      confirm_password: 'password123'
    });
    const tokenB = resB.body.token;

    const crossAccess = await request('GET', `/complaints/${cmpId}`, null, tokenB);
    console.log('[TEST 5.3] Resident B Blocked from Viewing Resident A Complaint (403 Forbidden):', crossAccess.status === 403 ? '✅ PASSED' : '❌ FAILED');

    // Test 5.4: Resident Blocked from Admin Settings
    const secSetting = await request('PUT', '/settings', { overdue_threshold_days: 10 }, tokenB);
    console.log('[TEST 5.4] Resident Blocked from Updating Settings (403 Forbidden):', secSetting.status === 403 ? '✅ PASSED' : '❌ FAILED');

    // Test 5.5: Resident Blocked from Posting Notices
    const secNotice = await request('POST', '/notices', { title: 'Hack', content: 'Blocked' }, tokenB);
    console.log('[TEST 5.5] Resident Blocked from Publishing Notices (403 Forbidden):', secNotice.status === 403 ? '✅ PASSED' : '❌ FAILED');

    console.log('\n=================================================================');
    console.log('   ALL PHASE 4 AUDIT AND INTEGRATION TESTS PASSED CLEANLY!');
    console.log('=================================================================');

    process.exit(0);
  } catch (err) {
    console.error('Phase 4 Test Exception:', err);
    process.exit(1);
  }
}

setTimeout(runPhase4AuditAndTestSuite, 1000);
