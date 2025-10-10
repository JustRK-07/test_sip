/**
 * Comprehensive Feature Test Script (Node.js)
 * Tests all major features: Tenants, Campaigns, Leads, Phone Numbers, Agents, SIP, Inbound/Outbound
 */

const axios = require('axios');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3001/api/v1';

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

// Test results
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const testResults = [];

// Store created resource IDs
let tenantId = null;
let agentId = null;
let campaignId = null;
let leadId = null;
let phoneNumberId = null;
let jwtToken = null;

// Helper to generate test JWT token
function generateTestJWT() {
    // For testing, we'll create a simple JWT
    // In production, this would come from your auth service
    const payload = {
        sub: '00000000-0000-0000-0000-00000000b40d', // System admin account
        acct: '00000000-0000-0000-0000-00000000b40d', // Account ID for tenant access
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1 hour expiry
    };

    // Read private key if available, otherwise use a test secret
    try {
        const privateKey = process.env.JWT_PRIVATE_KEY || 'test-secret-key';
        if (privateKey.includes('BEGIN RSA PRIVATE KEY')) {
            return jwt.sign(payload, privateKey, { algorithm: 'RS256' });
        } else {
            return jwt.sign(payload, privateKey, { algorithm: 'HS256' });
        }
    } catch (error) {
        console.log(`${colors.yellow}Warning: Using test secret for JWT${colors.reset}`);
        return jwt.sign(payload, 'test-secret-key', { algorithm: 'HS256' });
    }
}

// Helper function to run a test
async function runTest(testName, method, endpoint, data = null, expectedStatus = 200, useAuth = true) {
    totalTests++;
    const testNum = totalTests;

    console.log(`\n${colors.yellow}Test #${testNum}: ${testName}${colors.reset}`);

    const config = {
        method,
        url: `${BASE_URL}${endpoint}`,
        headers: {
            'Content-Type': 'application/json'
        }
    };

    if (useAuth && jwtToken) {
        config.headers['Authorization'] = `Bearer ${jwtToken}`;
    }

    if (data) {
        config.data = data;
    }

    try {
        const response = await axios(config);

        if (response.status === expectedStatus) {
            console.log(`${colors.green}✓ PASS${colors.reset} - Status: ${response.status}`);
            passedTests++;
            testResults.push({ test: testName, status: 'PASS', code: response.status });

            // Pretty print response
            if (response.data) {
                console.log(JSON.stringify(response.data, null, 2).substring(0, 500));
            }

            return response.data;
        } else {
            console.log(`${colors.red}✗ FAIL${colors.reset} - Expected: ${expectedStatus}, Got: ${response.status}`);
            failedTests++;
            testResults.push({ test: testName, status: 'FAIL', code: response.status, expected: expectedStatus });
            return null;
        }
    } catch (error) {
        const actualStatus = error.response?.status || 'ERROR';

        if (actualStatus === expectedStatus) {
            console.log(`${colors.green}✓ PASS${colors.reset} - Status: ${actualStatus} (expected error)`);
            passedTests++;
            testResults.push({ test: testName, status: 'PASS', code: actualStatus });
            return error.response?.data || null;
        } else {
            console.log(`${colors.red}✗ FAIL${colors.reset} - Expected: ${expectedStatus}, Got: ${actualStatus}`);
            console.log(`Error: ${error.response?.data?.error?.message || error.message}`);
            failedTests++;
            testResults.push({
                test: testName,
                status: 'FAIL',
                code: actualStatus,
                expected: expectedStatus,
                error: error.response?.data?.error?.message || error.message
            });
            return null;
        }
    }
}

// Main test runner
async function runAllTests() {
    console.log(`${colors.blue}========================================${colors.reset}`);
    console.log(`${colors.blue}  Comprehensive Feature Test Suite${colors.reset}`);
    console.log(`${colors.blue}========================================${colors.reset}`);

    // Generate JWT token
    jwtToken = generateTestJWT();
    console.log(`\n${colors.cyan}Generated test JWT token${colors.reset}`);

    // PHASE 1: BASIC HEALTH & TENANT
    console.log(`\n${colors.blue}=== PHASE 1: Health Check & Tenant Setup ===${colors.reset}`);

    await runTest('Health Check', 'GET', '/health', null, 200, false);

    const tenantData = await runTest(
        'Create Tenant',
        'POST',
        '/tenants',
        {
            name: 'Test Corp',
            domain: 'testcorp-' + Date.now() + '.com',
            contactEmail: 'admin@testcorp.com',
            maxUsers: 100
        },
        201
    );

    if (tenantData?.data?.id) {
        tenantId = tenantData.data.id;
        console.log(`${colors.green}Created Tenant ID: ${tenantId}${colors.reset}`);

        await runTest('Get Tenant by ID', 'GET', `/tenants/${tenantId}`, null, 200);
        await runTest('List All Tenants', 'GET', '/tenants?page=1&limit=10', null, 200);
    }

    // PHASE 2: AGENT MANAGEMENT
    console.log(`\n${colors.blue}=== PHASE 2: Agent Management ===${colors.reset}`);

    const agentData = await runTest(
        'Create Agent',
        'POST',
        '/agents',
        {
            name: 'Test Sales Agent',
            description: 'AI sales agent for testing',
            voiceId: 'voice-001',
            personality: 'friendly',
            systemPrompt: 'You are a helpful sales agent',
            maxConcurrentCalls: 5
        },
        201
    );

    if (agentData?.data?.id) {
        agentId = agentData.data.id;
        console.log(`${colors.green}Created Agent ID: ${agentId}${colors.reset}`);

        await runTest('Get Agent by ID', 'GET', `/agents/${agentId}`, null, 200);
        await runTest('List All Agents', 'GET', '/agents?isActive=true', null, 200);
        await runTest('Get Agent Load Stats', 'GET', '/agents/load-stats', null, 200);
    }

    // PHASE 3: CAMPAIGN MANAGEMENT
    if (tenantId) {
        console.log(`\n${colors.blue}=== PHASE 3: Campaign Management ===${colors.reset}`);

        const campaignData = await runTest(
            'Create Campaign',
            'POST',
            `/tenants/${tenantId}/campaigns`,
            {
                name: 'Test Sales Campaign Q4',
                description: 'Test quarterly sales outreach',
                campaignType: 'OUTBOUND',
                agentName: 'Test Sales Agent',
                maxConcurrentCalls: 10
            },
            201
        );

        if (campaignData?.data?.id) {
            campaignId = campaignData.data.id;
            console.log(`${colors.green}Created Campaign ID: ${campaignId}${colors.reset}`);

            await runTest('Get Campaign by ID', 'GET', `/tenants/${tenantId}/campaigns/${campaignId}`, null, 200);
            await runTest('List All Campaigns', 'GET', `/tenants/${tenantId}/campaigns`, null, 200);
            await runTest(
                'Update Campaign',
                'PUT',
                `/tenants/${tenantId}/campaigns/${campaignId}`,
                { description: 'Updated test campaign' },
                200
            );
            await runTest('Get Campaign Stats', 'GET', `/tenants/${tenantId}/campaigns/${campaignId}/stats`, null, 200);

            // Assign agent to campaign
            if (agentId) {
                await runTest(
                    'Assign Agent to Campaign',
                    'POST',
                    `/campaigns/${campaignId}/agents`,
                    { agentId, isPrimary: true },
                    201
                );
                await runTest('Get Campaign Agents', 'GET', `/campaigns/${campaignId}/agents`, null, 200);
            }
        }
    }

    // PHASE 4: LEAD MANAGEMENT
    if (tenantId && campaignId) {
        console.log(`\n${colors.blue}=== PHASE 4: Lead Management ===${colors.reset}`);

        const leadData = await runTest(
            'Add Single Lead',
            'POST',
            `/tenants/${tenantId}/campaigns/${campaignId}/leads`,
            {
                phoneNumber: '+15551234567',
                name: 'John Doe',
                priority: 1
            },
            201
        );

        if (leadData?.data?.id) {
            leadId = leadData.data.id;
            console.log(`${colors.green}Created Lead ID: ${leadId}${colors.reset}`);

            await runTest(
                'Add Bulk Leads',
                'POST',
                `/tenants/${tenantId}/campaigns/${campaignId}/leads/bulk`,
                {
                    leads: [
                        { phoneNumber: '+15551234568', name: 'Jane Smith' },
                        { phoneNumber: '+15551234569', name: 'Bob Johnson' }
                    ]
                },
                201
            );

            await runTest('Get Campaign Leads', 'GET', `/tenants/${tenantId}/campaigns/${campaignId}/leads`, null, 200);
            await runTest('Get Single Lead', 'GET', `/tenants/${tenantId}/campaigns/${campaignId}/leads/${leadId}`, null, 200);
            await runTest(
                'Update Lead',
                'PUT',
                `/tenants/${tenantId}/campaigns/${campaignId}/leads/${leadId}`,
                { name: 'John Doe Updated', priority: 2 },
                200
            );

            // Global lead operations
            await runTest('Get All Leads (Global)', 'GET', `/tenants/${tenantId}/leads`, null, 200);
            await runTest('Search Leads', 'GET', `/tenants/${tenantId}/leads/search?q=John`, null, 200);
            await runTest('Get Lead Stats', 'GET', `/tenants/${tenantId}/leads/stats`, null, 200);
        }
    }

    // PHASE 5: PHONE NUMBER MANAGEMENT
    if (tenantId) {
        console.log(`\n${colors.blue}=== PHASE 5: Phone Number Management ===${colors.reset}`);

        console.log(`${colors.yellow}Note: Phone number tests require Twilio configuration${colors.reset}`);

        await runTest('List Phone Numbers', 'GET', `/tenants/${tenantId}/phone-numbers`, null, 200);

        // Skipping purchase and available number search to avoid Twilio API calls
    }

    // PHASE 6: SIP TRUNKING
    console.log(`\n${colors.blue}=== PHASE 6: SIP Trunking ===${colors.reset}`);

    await runTest('List Platform Trunks', 'GET', '/platform-trunks', null, 200);

    if (tenantId) {
        await runTest('List LiveKit Trunks', 'GET', `/tenants/${tenantId}/livekit-trunks`, null, 200);
    }

    // TEST SUMMARY
    console.log(`\n${colors.blue}========================================${colors.reset}`);
    console.log(`${colors.blue}  Test Summary${colors.reset}`);
    console.log(`${colors.blue}========================================${colors.reset}`);
    console.log(`Total Tests: ${colors.cyan}${totalTests}${colors.reset}`);
    console.log(`Passed: ${colors.green}${passedTests}${colors.reset}`);
    console.log(`Failed: ${colors.red}${failedTests}${colors.reset}`);
    console.log(`Success Rate: ${colors.cyan}${((passedTests / totalTests) * 100).toFixed(1)}%${colors.reset}`);

    console.log(`\n${colors.blue}Detailed Results:${colors.reset}`);
    testResults.forEach((result, index) => {
        const statusColor = result.status === 'PASS' ? colors.green : colors.red;
        console.log(`${index + 1}. ${statusColor}${result.status}${colors.reset} - ${result.test} (${result.code})`);
        if (result.error) {
            console.log(`   Error: ${result.error}`);
        }
    });

    if (failedTests === 0) {
        console.log(`\n${colors.green}✓ All tests passed!${colors.reset}`);
        process.exit(0);
    } else {
        console.log(`\n${colors.red}✗ Some tests failed. Please review the output above.${colors.reset}`);
        process.exit(1);
    }
}

// Run tests
runAllTests().catch(error => {
    console.error(`${colors.red}Fatal error:${colors.reset}`, error);
    process.exit(1);
});
