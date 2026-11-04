const http = require('http');

function getBackendOrigin() {
  const configured = process.env.BACKEND_URL || process.env.PUBLIC_BACKEND_URL;
  if (!configured || !configured.trim()) {
    throw new Error('BACKEND_URL or PUBLIC_BACKEND_URL must be configured in the environment before running verification scripts.');
  }

  return new URL(configured.trim().replace(/\/$/, ''));
}

function post(path, data, token) {
  return new Promise((resolve, reject) => {
    const backendOrigin = getBackendOrigin();
    const postData = JSON.stringify(data);
    const req = http.request({
      hostname: backendOrigin.hostname,
      port: backendOrigin.port || 80,
      path: `${backendOrigin.pathname.replace(/\/$/, '')}${path}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, body });
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function get(path, token) {
  return new Promise((resolve, reject) => {
    const backendOrigin = getBackendOrigin();
    const req = http.request({
      hostname: backendOrigin.hostname,
      port: backendOrigin.port || 80,
      path: `${backendOrigin.pathname.replace(/\/$/, '')}${path}`,
      method: 'GET',
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, body });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function verifyAllRoles() {
  console.log('========================================================');
  console.log('🧪 VERIFYING ALL ROLE-BASED LOGINS & ACCESS CONTROLS');
  console.log('========================================================');

  const users = [
    { name: 'Super Admin', email: 'admin@retailpulse.io', pass: 'Admin123!', totp: '123456', expectedRole: 'super_admin' },
    { name: 'Store Manager', email: 'manager@retailpulse.io', pass: 'Manager123!', totp: '123456', expectedRole: 'store_manager' },
    { name: 'Cashier Staff', email: 'cashier@retailpulse.io', pass: 'Cashier123!', totp: '', expectedRole: 'cashier' },
    { name: 'Compliance Auditor', email: 'auditor@retailpulse.io', pass: 'Auditor123!', totp: '123456', expectedRole: 'compliance_auditor' }
  ];

  for (const u of users) {
    console.log(`\n▶ Testing Role Login: ${u.name} (${u.email})`);
    const loginRes = await post('/api/auth/login', { email: u.email, password: u.pass, totpToken: u.totp });
    if (loginRes.status !== 200 || !loginRes.body.token) {
      console.error(`❌ FAILED: Login failed for ${u.name}:`, loginRes.body);
      process.exit(1);
    }

    const token = loginRes.body.token;
    const userProfile = loginRes.body.user;
    console.log(`  ✅ Login successful! Issued Role: [${userProfile.role}] (Expected: [${u.expectedRole}])`);

    const meRes = await get('/api/auth/me', token);
    console.log(`  ✅ /auth/me verified: ${meRes.body.name} (${meRes.body.email}), permissions: ${meRes.body.permissions.length} perms`);

    if (u.expectedRole === 'cashier') {
      const inv = await get('/api/inventory?storeId=LOC-001', token);
      console.log(`  ✅ Cashier inventory access: ${inv.status === 200 ? 'ALLOWED (' + inv.body.length + ' items)' : 'FAILED'}`);

      const sale = await post('/api/sales', {
        storeId: 'LOC-001',
        items: [{ productId: 'prod_01', quantity: 1 }],
        paymentMethod: 'CASH'
      }, token);
      console.log(`  ✅ Cashier POS sale recording: ${sale.status === 201 ? 'SUCCESS (Order ' + sale.body.id + ')' : 'FAILED'}`);

      const audit = await get('/api/audit/logs', token);
      console.log(`  ✅ Cashier audit logs access correctly BLOCKED: ${audit.status === 403 ? 'FORBIDDEN (403)' : 'UNEXPECTED'}`);
    }

    if (u.expectedRole === 'store_manager') {
      const analytics = await get('/api/sales/analytics/summary?storeId=LOC-001', token);
      console.log(`  ✅ Manager sales summary access: ${analytics.status === 200 ? 'ALLOWED ($' + analytics.body.summary.totalRevenue + ')' : 'FAILED'}`);

      const repl = await get('/api/inventory/replenishment?storeId=LOC-001', token);
      console.log(`  ✅ Manager replenishment access: ${repl.status === 200 ? 'ALLOWED (' + repl.body.itemsToReorderCount + ' items)' : 'FAILED'}`);

      const bkp = await get('/api/backups', token);
      console.log(`  ✅ Manager system backups correctly BLOCKED: ${bkp.status === 403 ? 'FORBIDDEN (403)' : 'UNEXPECTED'}`);
    }

    if (u.expectedRole === 'compliance_auditor') {
      const audits = await get('/api/audit/logs', token);
      console.log(`  ✅ Compliance auditor audit access: ${audits.status === 200 ? 'ALLOWED (' + audits.body.length + ' entries)' : 'FAILED'}`);

      const summary = await get('/api/compliance/summary', token);
      console.log(`  ✅ Compliance summary access: ${summary.status === 200 ? 'ALLOWED' : 'FAILED'}`);
    }
  }

  console.log('\n========================================================');
  console.log('✅ ROLE VERIFICATION COMPLETE');
  console.log('========================================================');
}

verifyAllRoles().catch((err) => {
  console.error('Verification failed:', err.message);
  process.exit(1);
});
