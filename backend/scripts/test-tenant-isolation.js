/**
 * Tenant Isolation Test Script
 * Tests that campaigns and leads are properly isolated by tenant
 */

const axios = require('axios');

const API_BASE = process.env.API_BASE || 'http://localhost:3001/api/v1';

const api = axios.create({
  baseURL: API_BASE,
  validateStatus: () => true, // Don't throw on any status
});

// Test results tracker
const results = {
  passed: 0,
  failed: 0,
  tests: [],
};

function logTest(name, passed, message = '') {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status}: ${name}`);
  if (message) console.log(`   ${message}`);

  results.tests.push({ name, passed, message });
  if (passed) results.passed++;
  else results.failed++;
}

async function runTests() {
  console.log('\n🧪 Testing Tenant Isolation for Campaigns and Leads\n');
  console.log('='.repeat(60));

  try {
    // Step 1: Create two tenants
    console.log('\n📋 Step 1: Creating two test tenants...\n');

    const tenant1Res = await api.post('/tenants', {
      name: 'Tenant A - Test Co',
      domain: 'tenant-a-test',
      isActive: true,
    });

    const tenant2Res = await api.post('/tenants', {
      name: 'Tenant B - Demo Inc',
      domain: 'tenant-b-test',
      isActive: true,
    });

    logTest(
      'Create Tenant A',
      tenant1Res.status === 201,
      tenant1Res.status === 201 ? `ID: ${tenant1Res.data.data.id}` : `Status: ${tenant1Res.status}`
    );

    logTest(
      'Create Tenant B',
      tenant2Res.status === 201,
      tenant2Res.status === 201 ? `ID: ${tenant2Res.data.data.id}` : `Status: ${tenant2Res.status}`
    );

    if (!tenant1Res.data?.data?.id || !tenant2Res.data?.data?.id) {
      console.error('❌ Failed to create tenants. Aborting tests.');
      return;
    }

    const tenantA = tenant1Res.data.data.id;
    const tenantB = tenant2Res.data.data.id;

    console.log(`\n   Tenant A ID: ${tenantA}`);
    console.log(`   Tenant B ID: ${tenantB}`);

    // Step 2: Create campaigns for each tenant
    console.log('\n📋 Step 2: Creating campaigns for each tenant...\n');

    const campaignARes = await api.post(
      '/campaigns',
      {
        name: 'Campaign A',
        description: 'Belongs to Tenant A',
        maxConcurrent: 3,
      },
      {
        headers: { 'X-Tenant-ID': tenantA },
      }
    );

    const campaignBRes = await api.post(
      '/campaigns',
      {
        name: 'Campaign B',
        description: 'Belongs to Tenant B',
        maxConcurrent: 5,
      },
      {
        headers: { 'X-Tenant-ID': tenantB },
      }
    );

    logTest(
      'Create Campaign for Tenant A',
      campaignARes.status === 201 && campaignARes.data.data.tenantId === tenantA,
      campaignARes.status === 201
        ? `Campaign ID: ${campaignARes.data.data.id}, tenantId: ${campaignARes.data.data.tenantId}`
        : `Status: ${campaignARes.status}`
    );

    logTest(
      'Create Campaign for Tenant B',
      campaignBRes.status === 201 && campaignBRes.data.data.tenantId === tenantB,
      campaignBRes.status === 201
        ? `Campaign ID: ${campaignBRes.data.data.id}, tenantId: ${campaignBRes.data.data.tenantId}`
        : `Status: ${campaignBRes.status}`
    );

    const campaignAId = campaignARes.data?.data?.id;
    const campaignBId = campaignBRes.data?.data?.id;

    // Step 3: Test campaign isolation
    console.log('\n📋 Step 3: Testing campaign isolation...\n');

    // Tenant A should only see Campaign A
    const tenantACampaignsRes = await api.get('/campaigns', {
      headers: { 'X-Tenant-ID': tenantA },
    });

    const tenantACampaigns = tenantACampaignsRes.data?.data || [];
    const hasOnlyOwnCampaigns = tenantACampaigns.every((c) => c.tenantId === tenantA);
    const doesNotSeeTenantB = !tenantACampaigns.some((c) => c.tenantId === tenantB);

    logTest(
      'Tenant A sees only own campaigns',
      hasOnlyOwnCampaigns && doesNotSeeTenantB,
      `Sees ${tenantACampaigns.length} campaign(s), all belong to Tenant A`
    );

    // Tenant B should only see Campaign B
    const tenantBCampaignsRes = await api.get('/campaigns', {
      headers: { 'X-Tenant-ID': tenantB },
    });

    const tenantBCampaigns = tenantBCampaignsRes.data?.data || [];
    const tenantBHasOnlyOwn = tenantBCampaigns.every((c) => c.tenantId === tenantB);
    const tenantBDoesNotSeeA = !tenantBCampaigns.some((c) => c.tenantId === tenantA);

    logTest(
      'Tenant B sees only own campaigns',
      tenantBHasOnlyOwn && tenantBDoesNotSeeA,
      `Sees ${tenantBCampaigns.length} campaign(s), all belong to Tenant B`
    );

    // Tenant A should NOT be able to access Tenant B's campaign
    const unauthorizedAccessRes = await api.get(`/campaigns/${campaignBId}`, {
      headers: { 'X-Tenant-ID': tenantA },
    });

    logTest(
      'Tenant A cannot access Tenant B campaign',
      unauthorizedAccessRes.status === 404,
      `Status: ${unauthorizedAccessRes.status} (expected 404)`
    );

    // Step 4: Add leads to campaigns
    console.log('\n📋 Step 4: Adding leads to campaigns...\n');

    const leadARes = await api.post(
      `/campaigns/${campaignAId}/leads/bulk`,
      {
        leads: [
          { phoneNumber: '+1111111111', name: 'Lead A1' },
          { phoneNumber: '+1111111112', name: 'Lead A2' },
        ],
      },
      {
        headers: { 'X-Tenant-ID': tenantA },
      }
    );

    const leadBRes = await api.post(
      `/campaigns/${campaignBId}/leads/bulk`,
      {
        leads: [
          { phoneNumber: '+2222222221', name: 'Lead B1' },
          { phoneNumber: '+2222222222', name: 'Lead B2' },
        ],
      },
      {
        headers: { 'X-Tenant-ID': tenantB },
      }
    );

    logTest(
      'Add leads to Campaign A',
      leadARes.status === 201 && leadARes.data.data.created === 2,
      `Created ${leadARes.data?.data?.created || 0} leads`
    );

    logTest(
      'Add leads to Campaign B',
      leadBRes.status === 201 && leadBRes.data.data.created === 2,
      `Created ${leadBRes.data?.data?.created || 0} leads`
    );

    // Step 5: Test lead isolation
    console.log('\n📋 Step 5: Testing lead isolation...\n');

    // Tenant A should only see own leads
    const tenantALeadsRes = await api.get('/leads', {
      headers: { 'X-Tenant-ID': tenantA },
    });

    const tenantALeads = tenantALeadsRes.data?.data || [];
    const leadsAreIsolated = tenantALeads.every((l) => l.tenantId === tenantA);

    logTest(
      'Tenant A sees only own leads',
      leadsAreIsolated,
      `Sees ${tenantALeads.length} lead(s), all belong to Tenant A`
    );

    // Tenant B should only see own leads
    const tenantBLeadsRes = await api.get('/leads', {
      headers: { 'X-Tenant-ID': tenantB },
    });

    const tenantBLeads = tenantBLeadsRes.data?.data || [];
    const leadsBIsolated = tenantBLeads.every((l) => l.tenantId === tenantB);

    logTest(
      'Tenant B sees only own leads',
      leadsBIsolated,
      `Sees ${tenantBLeads.length} lead(s), all belong to Tenant B`
    );

    // Tenant A should NOT be able to add lead to Tenant B's campaign
    const unauthorizedLeadRes = await api.post(
      `/campaigns/${campaignBId}/leads`,
      {
        phoneNumber: '+9999999999',
        name: 'Unauthorized Lead',
      },
      {
        headers: { 'X-Tenant-ID': tenantA },
      }
    );

    logTest(
      'Tenant A cannot add lead to Tenant B campaign',
      unauthorizedLeadRes.status === 404,
      `Status: ${unauthorizedLeadRes.status} (expected 404)`
    );

    // Step 6: Test lead stats isolation
    console.log('\n📋 Step 6: Testing lead stats isolation...\n');

    const statsARes = await api.get('/leads/stats', {
      headers: { 'X-Tenant-ID': tenantA },
    });

    const statsBRes = await api.get('/leads/stats', {
      headers: { 'X-Tenant-ID': tenantB },
    });

    logTest(
      'Tenant A stats are isolated',
      statsARes.data?.data?.total === 2,
      `Total: ${statsARes.data?.data?.total || 0} (expected 2)`
    );

    logTest(
      'Tenant B stats are isolated',
      statsBRes.data?.data?.total === 2,
      `Total: ${statsBRes.data?.data?.total || 0} (expected 2)`
    );

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('\n📊 Test Summary\n');
    console.log(`   ✅ Passed: ${results.passed}`);
    console.log(`   ❌ Failed: ${results.failed}`);
    console.log(`   Total:  ${results.tests.length}`);

    if (results.failed === 0) {
      console.log('\n🎉 All tests passed! Tenant isolation is working correctly.\n');
    } else {
      console.log('\n⚠️  Some tests failed. Please review the results above.\n');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Test execution error:', error.message);
    if (error.response) {
      console.error('   Response:', error.response.data);
    }
    process.exit(1);
  }
}

// Run tests
runTests().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
