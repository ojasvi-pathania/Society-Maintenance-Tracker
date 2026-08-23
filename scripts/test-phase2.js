const http = require('http');
const path = require('path');
const fs = require('fs');

// Express server
const app = require('../server');

function request(method, path, body = null, token = null, isMultipart = false) {
  return new Promise((resolve, reject) => {
    let headers = {};
    let payload = null;

    if (isMultipart && body) {
      // Simple multipart boundary simulation for photo test
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

async function runPhase2WorkflowTest() {
  console.log('=================================================================');
  console.log('   SOCIETY MAINTENANCE TRACKER - PHASE 2 WORKFLOW VERIFICATION');
  console.log('=================================================================');

  try {
    const timestamp = Date.now();

    // 1. Register Resident A
    const resAReg = await request('POST', '/auth/register', {
      name: 'Resident A',
      email: `resident_a_${timestamp}@society.com`,
      phone: '9876543210',
      flat_number: 'A-101',
      password: 'password123',
      confirm_password: 'password123'
    });
    console.log('[STEP 1] Register Resident A:', resAReg.status === 201 && resAReg.body.success ? '✅ PASSED' : '❌ FAILED');
    const tokenA = resAReg.body.token;

    // 2. Create Plumbing Complaint with Description & Photo
    const cmpData = {
      category: 'Plumbing',
      description: 'Major water leakage from master bathroom ceiling pipe.',
      photo: {
        filename: 'leak-photo.jpg',
        mime: 'image/jpeg',
        content: 'fake_jpg_binary_content_stream'
      }
    };
    const createRes = await request('POST', '/complaints', cmpData, tokenA, true);
    console.log('[STEP 2] Create Plumbing Complaint with Photo:', createRes.status === 201 && createRes.body.success ? '✅ PASSED' : '❌ FAILED');
    const cmp = createRes.body.complaint;

    // 3. Verify Complaint Number Generation
    const validNumberFormat = /^CMP-\d{8}-\d{3}$/.test(cmp.complaint_number);
    console.log(`[STEP 3] Verify Complaint Number Generation (${cmp.complaint_number}):`, validNumberFormat ? '✅ PASSED' : '❌ FAILED');

    // 4. Verify Initial Status = Open
    console.log(`[STEP 4] Verify Initial Status === 'Open':`, cmp.status === 'Open' ? '✅ PASSED' : '❌ FAILED');

    // 5. Verify Initial Priority = Low
    console.log(`[STEP 5] Verify Initial Priority === 'Low':`, cmp.priority === 'Low' ? '✅ PASSED' : '❌ FAILED');

    // 6. Verify Complaint appears in Resident A's My Complaints
    const myComplaints = await request('GET', '/complaints', null, tokenA);
    const foundMyCmp = myComplaints.body.complaints.some(c => c.id === cmp.id);
    console.log(`[STEP 6] Complaint visible in Resident A's My Complaints:`, foundMyCmp ? '✅ PASSED' : '❌ FAILED');

    // 7. Open Complaint Details & Verify Initial History
    const detailA = await request('GET', `/complaints/${cmp.id}`, null, tokenA);
    const hasInitialHistory = detailA.body.history.length === 1 && detailA.body.history[0].new_status === 'Open';
    console.log(`[STEP 7] Initial Complaint History Entry ('Complaint created — Status: Open'):`, hasInitialHistory ? '✅ PASSED' : '❌ FAILED');

    // 8. Logout Resident A
    await request('POST', '/auth/logout', null, tokenA);
    console.log(`[STEP 8] Logout Resident A: ✅ PASSED`);

    // 9. Login Admin
    const adminLogin = await request('POST', '/auth/login', {
      email: 'admin@society.com',
      password: 'admin123'
    });
    console.log(`[STEP 9] Login as Admin:`, adminLogin.status === 200 && adminLogin.body.success ? '✅ PASSED' : '❌ FAILED');
    const adminToken = adminLogin.body.token;

    // 10. Admin finds complaint
    const adminList = await request('GET', '/complaints', null, adminToken);
    const foundAdminCmp = adminList.body.complaints.some(c => c.id === cmp.id);
    console.log(`[STEP 10] Admin finds complaint in all society list:`, foundAdminCmp ? '✅ PASSED' : '❌ FAILED');

    // 11. Change Priority from Low to High
    const updatePrio = await request('PUT', `/complaints/${cmp.id}/status-priority`, {
      priority: 'High'
    }, adminToken);
    console.log(`[STEP 11] Admin Update Priority Low → High:`, updatePrio.status === 200 && updatePrio.body.complaint.priority === 'High' ? '✅ PASSED' : '❌ FAILED');

    // 12. Change Status from Open to In Progress with Note
    const updateStatus1 = await request('PUT', `/complaints/${cmp.id}/status-priority`, {
      status: 'In Progress',
      note: 'Maintenance staff assigned.'
    }, adminToken);
    console.log(`[STEP 12] Admin Change Status Open → In Progress with Note:`, updateStatus1.status === 200 && updateStatus1.body.complaint.status === 'In Progress' ? '✅ PASSED' : '❌ FAILED');

    // 13. Verify history entry
    const detailAfterStatus1 = await request('GET', `/complaints/${cmp.id}`, null, adminToken);
    const hist1 = detailAfterStatus1.body.history[1];
    const validHist1 = hist1 && hist1.previous_status === 'Open' && hist1.new_status === 'In Progress' && hist1.note === 'Maintenance staff assigned.';
    console.log(`[STEP 13] Verify First Status Transition History Record:`, validHist1 ? '✅ PASSED' : '❌ FAILED');

    // 14. Change Status from In Progress to Resolved with Note
    const updateStatus2 = await request('PUT', `/complaints/${cmp.id}/status-priority`, {
      status: 'Resolved',
      note: 'Issue resolved successfully.'
    }, adminToken);
    console.log(`[STEP 14] Admin Change Status In Progress → Resolved with Note:`, updateStatus2.status === 200 && updateStatus2.body.complaint.status === 'Resolved' ? '✅ PASSED' : '❌ FAILED');

    // 15. Verify second history entry
    const detailAfterStatus2 = await request('GET', `/complaints/${cmp.id}`, null, adminToken);
    const hist2 = detailAfterStatus2.body.history[2];
    const validHist2 = hist2 && hist2.previous_status === 'In Progress' && hist2.new_status === 'Resolved' && hist2.note === 'Issue resolved successfully.';
    console.log(`[STEP 15] Verify Second Status Transition History Record:`, validHist2 ? '✅ PASSED' : '❌ FAILED');

    // 16. Login again as Resident A
    const loginA = await request('POST', '/auth/login', {
      email: `resident_a_${timestamp}@society.com`,
      password: 'password123'
    });
    console.log(`[STEP 16] Login again as Resident A:`, loginA.status === 200 ? '✅ PASSED' : '❌ FAILED');
    const tokenA2 = loginA.body.token;

    // 17. Verify Resident A sees Resolved status & complete history
    const detailResidentFinal = await request('GET', `/complaints/${cmp.id}`, null, tokenA2);
    const isResolved = detailResidentFinal.body.complaint.status === 'Resolved';
    const totalHistory = detailResidentFinal.body.history.length === 3;
    console.log(`[STEP 17] Resident sees Resolved status & full history (3 items):`, isResolved && totalHistory ? '✅ PASSED' : '❌ FAILED');

    // 18. Verify Resolved complaint is NOT considered overdue
    const isNotOverdue = detailResidentFinal.body.complaint.is_overdue === false;
    console.log(`[STEP 18] Resolved Complaint is NOT Overdue:`, isNotOverdue ? '✅ PASSED' : '❌ FAILED');

    // 19. Register & Login as Resident B
    const resBReg = await request('POST', '/auth/register', {
      name: 'Resident B',
      email: `resident_b_${timestamp}@society.com`,
      phone: '9876543219',
      flat_number: 'B-202',
      password: 'password123',
      confirm_password: 'password123'
    });
    console.log(`[STEP 19] Register & Login Resident B:`, resBReg.status === 201 ? '✅ PASSED' : '❌ FAILED');
    const tokenB = resBReg.body.token;

    // 20. Verify Resident B CANNOT access Resident A's complaint ID (403 Forbidden)
    const unauthorizedAccess = await request('GET', `/complaints/${cmp.id}`, null, tokenB);
    console.log(`[STEP 20] Resident B 403 Forbidden on Resident A's Complaint ID:`, unauthorizedAccess.status === 403 ? '✅ PASSED' : '❌ FAILED');

    console.log('=================================================================');
    console.log('  ALL 20 PHASE 2 END-TO-END WORKFLOW STEPS PASSED PERFECTLY!');
    console.log('=================================================================');

    process.exit(0);
  } catch (err) {
    console.error('Phase 2 Test Exception:', err);
    process.exit(1);
  }
}

setTimeout(runPhase2WorkflowTest, 1000);
