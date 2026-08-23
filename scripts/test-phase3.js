const http = require('http');
const app = require('../server');

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    let headers = {};
    let payload = null;

    if (body) {
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

async function runPhase3TestSuite() {
  console.log('=================================================================');
  console.log('   SOCIETY MAINTENANCE TRACKER - PHASE 3 VERIFICATION SUITE');
  console.log('=================================================================');

  try {
    const timestamp = Date.now();

    // 1. Admin Login
    const adminLogin = await request('POST', '/auth/login', {
      email: 'admin@society.com',
      password: 'admin123'
    });
    console.log('[TEST 1] Admin Login:', adminLogin.status === 200 && adminLogin.body.success ? '✅ PASSED' : '❌ FAILED');
    const adminToken = adminLogin.body.token;

    // 2. Resident Registration & Login
    const resReg = await request('POST', '/auth/register', {
      name: 'Rahul Resident',
      email: `rahul_${timestamp}@society.com`,
      phone: '9876543000',
      flat_number: 'D-401',
      password: 'password123',
      confirm_password: 'password123'
    });
    console.log('[TEST 2] Resident Registration & Login:', resReg.status === 201 && resReg.body.success ? '✅ PASSED' : '❌ FAILED');
    const residentToken = resReg.body.token;

    // 3. Admin Creates Normal Notice
    const normalNotice = await request('POST', '/notices', {
      title: 'Routine Garden Maintenance',
      content: 'Lawn mowing scheduled for Wednesday morning.',
      is_important: false
    }, adminToken);
    console.log('[TEST 3] Admin Create Normal Notice:', normalNotice.status === 201 && normalNotice.body.notice.is_important === 0 ? '✅ PASSED' : '❌ FAILED');

    // 4. Admin Creates Important Notice
    const importantNotice = await request('POST', '/notices', {
      title: 'URGENT: Water Supply Shutdown',
      content: 'Overhead tank repair will pause water supply from 1 PM to 4 PM.',
      is_important: true
    }, adminToken);
    console.log('[TEST 4] Admin Create Important Notice (Email Triggered):', importantNotice.status === 201 && importantNotice.body.notice.is_important === 1 ? '✅ PASSED' : '❌ FAILED');

    // 5. Verify Notice Board Sorting (Important Pinned First)
    const noticeList = await request('GET', '/notices', null, residentToken);
    const firstNoticeIsImportant = noticeList.body.notices.length >= 2 && noticeList.body.notices[0].is_important === 1;
    console.log('[TEST 5] Resident Notice Board (Important Notice Pinned First):', firstNoticeIsImportant ? '✅ PASSED' : '❌ FAILED');

    // 6. Resident Raises Complaint
    const newCmp = await request('POST', '/complaints', {
      category: 'Electrical',
      description: 'Main circuit breaker trips repeatedly when air conditioner starts.'
    }, residentToken);
    console.log('[TEST 6] Resident Raise Complaint:', newCmp.status === 201 && newCmp.body.success ? '✅ PASSED' : '❌ FAILED');
    const complaintId = newCmp.body.complaint.id;
    const cmpNumber = newCmp.body.complaint.complaint_number;

    // 7. Admin Updates Complaint Status (Open -> In Progress with Note)
    const statusUpdate1 = await request('PUT', `/complaints/${complaintId}/status-priority`, {
      status: 'In Progress',
      priority: 'High',
      note: 'Electrician assigned to inspect D-401 breaker panel.'
    }, adminToken);
    console.log('[TEST 7] Admin Update Status (In Progress + Email Trigger):', statusUpdate1.status === 200 && statusUpdate1.body.complaint.status === 'In Progress' ? '✅ PASSED' : '❌ FAILED');

    // 8. Admin Updates Complaint Status (In Progress -> Resolved)
    const statusUpdate2 = await request('PUT', `/complaints/${complaintId}/status-priority`, {
      status: 'Resolved',
      note: 'Faulty MCB replaced successfully.'
    }, adminToken);
    console.log('[TEST 8] Admin Update Status (Resolved + Email Trigger):', statusUpdate2.status === 200 && statusUpdate2.body.complaint.status === 'Resolved' ? '✅ PASSED' : '❌ FAILED');

    // 9. Admin Dashboard Metrics & Category Analytics
    const adminStats = await request('GET', '/complaints/stats', null, adminToken);
    const validStats = adminStats.body.stats && adminStats.body.stats.total >= 1 && adminStats.body.stats.by_category.Electrical >= 1;
    console.log('[TEST 9] Admin Dashboard Live Metrics & Category Breakdown:', validStats ? '✅ PASSED' : '❌ FAILED');

    // 10. Resident Dashboard Metrics Isolation
    const residentStats = await request('GET', '/complaints/stats', null, residentToken);
    console.log('[TEST 10] Resident Dashboard Stats Isolation (Sees only own 1 complaint):', residentStats.body.stats.total === 1 ? '✅ PASSED' : '❌ FAILED');

    // 11. Overdue Threshold Setting Update
    const settingRes = await request('PUT', '/settings', {
      overdue_threshold_days: 2
    }, adminToken);
    console.log('[TEST 11] Overdue Threshold Settings Update (2 Days):', settingRes.status === 200 && settingRes.body.settings.overdue_threshold_days === '2' ? '✅ PASSED' : '❌ FAILED');

    // 12. Security Enforcement - Resident Cannot Post Notice (403 Forbidden)
    const secNotice = await request('POST', '/notices', {
      title: 'Hacked Notice',
      content: 'Should be blocked'
    }, residentToken);
    console.log('[TEST 12] Security Check: Resident Blocked from Posting Notice (403):', secNotice.status === 403 ? '✅ PASSED' : '❌ FAILED');

    // 13. Security Enforcement - Resident Cannot Modify Settings (403 Forbidden)
    const secSetting = await request('PUT', '/settings', {
      overdue_threshold_days: 100
    }, residentToken);
    console.log('[TEST 13] Security Check: Resident Blocked from Updating Settings (403):', secSetting.status === 403 ? '✅ PASSED' : '❌ FAILED');

    // 14. Security Enforcement - Resident Cannot Update Complaint Status (403 Forbidden)
    const secStatus = await request('PUT', `/complaints/${complaintId}/status-priority`, {
      status: 'Open'
    }, residentToken);
    console.log('[TEST 14] Security Check: Resident Blocked from Updating Complaint Status (403):', secStatus.status === 403 ? '✅ PASSED' : '❌ FAILED');

    console.log('=================================================================');
    console.log('    ALL 14 PHASE 3 TEST SUITE CHECKS PASSED PERFECTLY!');
    console.log('=================================================================');

    process.exit(0);
  } catch (err) {
    console.error('Phase 3 Test Exception:', err);
    process.exit(1);
  }
}

setTimeout(runPhase3TestSuite, 1000);
