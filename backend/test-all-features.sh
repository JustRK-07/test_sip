#!/bin/bash

# Comprehensive Feature Test Script
# Tests: Tenants, Campaigns, Leads, Phone Numbers, Agents, SIP Trunking, Inbound/Outbound

set -e  # Exit on error

BASE_URL="http://localhost:3001/api/v1"
COLOR_GREEN="\033[0;32m"
COLOR_RED="\033[0;31m"
COLOR_YELLOW="\033[1;33m"
COLOR_BLUE="\033[0;34m"
COLOR_RESET="\033[0m"

# Test results tracking
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Store created resource IDs
TENANT_ID=""
AGENT_ID=""
CAMPAIGN_ID=""
LEAD_ID=""
PHONE_NUMBER_ID=""
JWT_TOKEN=""

echo -e "${COLOR_BLUE}========================================${COLOR_RESET}"
echo -e "${COLOR_BLUE}  Comprehensive Feature Test Suite${COLOR_RESET}"
echo -e "${COLOR_BLUE}========================================${COLOR_RESET}"
echo ""

# Helper function to run test
run_test() {
    local test_name="$1"
    local http_method="$2"
    local endpoint="$3"
    local data="$4"
    local expected_status="$5"
    local auth_header="$6"

    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo -e "${COLOR_YELLOW}Test #${TOTAL_TESTS}: ${test_name}${COLOR_RESET}"

    if [ -z "$auth_header" ]; then
        response=$(curl -s -w "\n%{http_code}" -X "$http_method" \
            -H "Content-Type: application/json" \
            ${data:+-d "$data"} \
            "$BASE_URL$endpoint")
    else
        response=$(curl -s -w "\n%{http_code}" -X "$http_method" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $auth_header" \
            ${data:+-d "$data"} \
            "$BASE_URL$endpoint")
    fi

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)

    if [ "$http_code" == "$expected_status" ]; then
        echo -e "${COLOR_GREEN}✓ PASS${COLOR_RESET} - Status: $http_code"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
    else
        echo -e "${COLOR_RED}✗ FAIL${COLOR_RESET} - Expected: $expected_status, Got: $http_code"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
    fi

    echo ""
    echo "$body"  # Return body for extraction
}

# ========================================
# PHASE 1: AUTHENTICATION & TENANT SETUP
# ========================================
echo -e "${COLOR_BLUE}=== PHASE 1: Authentication & Tenant Setup ===${COLOR_RESET}"
echo ""

# Test 1: Health Check
run_test "Health Check" "GET" "/health" "" "200"

# Test 2: Create Admin Account (for JWT generation)
# Note: We need a valid JWT token. Let's check if we can get one from the system
echo -e "${COLOR_YELLOW}Checking authentication system...${COLOR_RESET}"

# First, let's try to create a tenant without auth to see the error
TENANT_RESPONSE=$(run_test "Create Tenant (should fail without auth)" "POST" "/tenants" \
    '{"name":"Test Corp","domain":"testcorp.com","contactEmail":"admin@testcorp.com"}' \
    "401")

# For testing, we'll need to generate a valid JWT token
# Let's check if there's an auth endpoint or create a test token
echo -e "${COLOR_YELLOW}Note: Authentication required. Checking for existing test credentials...${COLOR_RESET}"

# Check .env for test credentials
if [ -f .env ]; then
    TEST_JWT=$(grep "TEST_JWT_TOKEN" .env | cut -d '=' -f2)
    if [ ! -z "$TEST_JWT" ]; then
        JWT_TOKEN="$TEST_JWT"
        echo -e "${COLOR_GREEN}Found test JWT token in .env${COLOR_RESET}"
    fi
fi

# If no JWT found, we need to create one or use a login endpoint
if [ -z "$JWT_TOKEN" ]; then
    echo -e "${COLOR_YELLOW}No JWT token found. Checking for auth/login endpoint...${COLOR_RESET}"

    # Try to login or register
    LOGIN_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
        -H "Content-Type: application/json" \
        -d '{"email":"admin@testcorp.com","password":"admin123"}' \
        "$BASE_URL/auth/login" 2>/dev/null || echo -e "\n404")

    LOGIN_CODE=$(echo "$LOGIN_RESPONSE" | tail -n1)

    if [ "$LOGIN_CODE" == "200" ] || [ "$LOGIN_CODE" == "201" ]; then
        JWT_TOKEN=$(echo "$LOGIN_RESPONSE" | head -n-1 | jq -r '.token // .access_token // .data.token')
        echo -e "${COLOR_GREEN}Successfully logged in${COLOR_RESET}"
    else
        echo -e "${COLOR_RED}Warning: No authentication available. Some tests will be skipped.${COLOR_RESET}"
        echo -e "${COLOR_YELLOW}To enable full testing, please provide a valid JWT token${COLOR_RESET}"
    fi
fi

# ========================================
# PHASE 2: TENANT MANAGEMENT
# ========================================
echo -e "${COLOR_BLUE}=== PHASE 2: Tenant Management ===${COLOR_RESET}"
echo ""

if [ ! -z "$JWT_TOKEN" ]; then
    # Test 3: Create Tenant
    TENANT_RESPONSE=$(run_test "Create Tenant" "POST" "/tenants" \
        '{"name":"Test Corp","domain":"testcorp.com","contactEmail":"admin@testcorp.com","maxUsers":100}' \
        "201" "$JWT_TOKEN")

    TENANT_ID=$(echo "$TENANT_RESPONSE" | jq -r '.data.id' 2>/dev/null)

    if [ ! -z "$TENANT_ID" ] && [ "$TENANT_ID" != "null" ]; then
        echo -e "${COLOR_GREEN}Created Tenant ID: $TENANT_ID${COLOR_RESET}"

        # Test 4: Get Tenant by ID
        run_test "Get Tenant by ID" "GET" "/tenants/$TENANT_ID" "" "200" "$JWT_TOKEN"

        # Test 5: List All Tenants
        run_test "List All Tenants" "GET" "/tenants?page=1&limit=10" "" "200" "$JWT_TOKEN"

        # Test 6: Update Tenant
        run_test "Update Tenant" "PUT" "/tenants/$TENANT_ID" \
            '{"description":"Updated test corporation"}' \
            "200" "$JWT_TOKEN"
    else
        echo -e "${COLOR_RED}Failed to create tenant. Skipping tenant-dependent tests.${COLOR_RESET}"
    fi
else
    echo -e "${COLOR_YELLOW}Skipping tenant tests (no authentication)${COLOR_RESET}"
fi

# ========================================
# PHASE 3: AGENT MANAGEMENT
# ========================================
echo -e "${COLOR_BLUE}=== PHASE 3: Agent Management ===${COLOR_RESET}"
echo ""

if [ ! -z "$TENANT_ID" ] && [ ! -z "$JWT_TOKEN" ]; then
    # Test 7: Create Agent
    AGENT_RESPONSE=$(run_test "Create Agent" "POST" "/agents" \
        '{"name":"Sales Agent","description":"AI sales agent","voiceId":"voice-001","personality":"friendly","systemPrompt":"You are a helpful sales agent"}' \
        "201" "$JWT_TOKEN")

    AGENT_ID=$(echo "$AGENT_RESPONSE" | jq -r '.data.id' 2>/dev/null)

    if [ ! -z "$AGENT_ID" ] && [ "$AGENT_ID" != "null" ]; then
        echo -e "${COLOR_GREEN}Created Agent ID: $AGENT_ID${COLOR_RESET}"

        # Test 8: Get Agent by ID
        run_test "Get Agent by ID" "GET" "/agents/$AGENT_ID" "" "200" "$JWT_TOKEN"

        # Test 9: List All Agents
        run_test "List All Agents" "GET" "/agents?page=1&limit=10" "" "200" "$JWT_TOKEN"

        # Test 10: Get Agent Load Stats
        run_test "Get Agent Load Stats" "GET" "/agents/load-stats" "" "200" "$JWT_TOKEN"
    fi
else
    echo -e "${COLOR_YELLOW}Skipping agent tests (missing tenant or auth)${COLOR_RESET}"
fi

# ========================================
# PHASE 4: CAMPAIGN MANAGEMENT
# ========================================
echo -e "${COLOR_BLUE}=== PHASE 4: Campaign Management ===${COLOR_RESET}"
echo ""

if [ ! -z "$TENANT_ID" ] && [ ! -z "$JWT_TOKEN" ]; then
    # Test 11: Create Campaign
    CAMPAIGN_RESPONSE=$(run_test "Create Campaign (Outbound)" "POST" "/tenants/$TENANT_ID/campaigns" \
        '{"name":"Sales Campaign Q4","description":"Quarterly sales outreach","campaignType":"OUTBOUND","agentName":"Sales Agent","maxConcurrentCalls":10}' \
        "201" "$JWT_TOKEN")

    CAMPAIGN_ID=$(echo "$CAMPAIGN_RESPONSE" | jq -r '.data.id' 2>/dev/null)

    if [ ! -z "$CAMPAIGN_ID" ] && [ "$CAMPAIGN_ID" != "null" ]; then
        echo -e "${COLOR_GREEN}Created Campaign ID: $CAMPAIGN_ID${COLOR_RESET}"

        # Test 12: Get Campaign by ID
        run_test "Get Campaign by ID" "GET" "/tenants/$TENANT_ID/campaigns/$CAMPAIGN_ID" "" "200" "$JWT_TOKEN"

        # Test 13: List All Campaigns
        run_test "List All Campaigns" "GET" "/tenants/$TENANT_ID/campaigns?page=1&limit=10" "" "200" "$JWT_TOKEN"

        # Test 14: Update Campaign
        run_test "Update Campaign" "PUT" "/tenants/$TENANT_ID/campaigns/$CAMPAIGN_ID" \
            '{"description":"Updated Q4 sales campaign"}' \
            "200" "$JWT_TOKEN"

        # Test 15: Assign Agent to Campaign
        if [ ! -z "$AGENT_ID" ]; then
            run_test "Assign Agent to Campaign" "POST" "/campaigns/$CAMPAIGN_ID/agents" \
                "{\"agentId\":\"$AGENT_ID\",\"isPrimary\":true}" \
                "201" "$JWT_TOKEN"

            # Test 16: Get Campaign Agents
            run_test "Get Campaign Agents" "GET" "/campaigns/$CAMPAIGN_ID/agents" "" "200" "$JWT_TOKEN"
        fi

        # Test 17: Get Campaign Stats
        run_test "Get Campaign Stats" "GET" "/tenants/$TENANT_ID/campaigns/$CAMPAIGN_ID/stats" "" "200" "$JWT_TOKEN"
    fi
else
    echo -e "${COLOR_YELLOW}Skipping campaign tests (missing tenant or auth)${COLOR_RESET}"
fi

# ========================================
# PHASE 5: LEAD MANAGEMENT
# ========================================
echo -e "${COLOR_BLUE}=== PHASE 5: Lead Management ===${COLOR_RESET}"
echo ""

if [ ! -z "$TENANT_ID" ] && [ ! -z "$CAMPAIGN_ID" ] && [ ! -z "$JWT_TOKEN" ]; then
    # Test 18: Add Single Lead
    LEAD_RESPONSE=$(run_test "Add Single Lead" "POST" "/tenants/$TENANT_ID/campaigns/$CAMPAIGN_ID/leads" \
        '{"phoneNumber":"+15551234567","name":"John Doe","priority":1}' \
        "201" "$JWT_TOKEN")

    LEAD_ID=$(echo "$LEAD_RESPONSE" | jq -r '.data.id' 2>/dev/null)

    if [ ! -z "$LEAD_ID" ] && [ "$LEAD_ID" != "null" ]; then
        echo -e "${COLOR_GREEN}Created Lead ID: $LEAD_ID${COLOR_RESET}"

        # Test 19: Add Bulk Leads
        run_test "Add Bulk Leads" "POST" "/tenants/$TENANT_ID/campaigns/$CAMPAIGN_ID/leads/bulk" \
            '{"leads":[{"phoneNumber":"+15551234568","name":"Jane Smith"},{"phoneNumber":"+15551234569","name":"Bob Johnson"}]}' \
            "201" "$JWT_TOKEN"

        # Test 20: Get Campaign Leads
        run_test "Get Campaign Leads" "GET" "/tenants/$TENANT_ID/campaigns/$CAMPAIGN_ID/leads?page=1&limit=10" "" "200" "$JWT_TOKEN"

        # Test 21: Get Single Lead
        run_test "Get Single Lead" "GET" "/tenants/$TENANT_ID/campaigns/$CAMPAIGN_ID/leads/$LEAD_ID" "" "200" "$JWT_TOKEN"

        # Test 22: Update Lead
        run_test "Update Lead" "PUT" "/tenants/$TENANT_ID/campaigns/$CAMPAIGN_ID/leads/$LEAD_ID" \
            '{"name":"John Doe Updated","priority":2}' \
            "200" "$JWT_TOKEN"

        # Test 23: Get All Leads (Independent)
        run_test "Get All Leads (Global)" "GET" "/tenants/$TENANT_ID/leads?page=1&limit=10" "" "200" "$JWT_TOKEN"

        # Test 24: Search Leads
        run_test "Search Leads" "GET" "/tenants/$TENANT_ID/leads/search?q=John" "" "200" "$JWT_TOKEN"

        # Test 25: Get Lead Stats
        run_test "Get Lead Stats" "GET" "/tenants/$TENANT_ID/leads/stats" "" "200" "$JWT_TOKEN"

        # Test 26: Import Leads
        run_test "Import Leads" "POST" "/tenants/$TENANT_ID/leads/import" \
            "{\"leads\":[{\"phoneNumber\":\"+15551234570\",\"name\":\"Alice Brown\"}],\"campaignId\":\"$CAMPAIGN_ID\"}" \
            "201" "$JWT_TOKEN"
    fi
else
    echo -e "${COLOR_YELLOW}Skipping lead tests (missing dependencies)${COLOR_RESET}"
fi

# ========================================
# PHASE 6: PHONE NUMBER MANAGEMENT
# ========================================
echo -e "${COLOR_BLUE}=== PHASE 6: Phone Number Management ===${COLOR_RESET}"
echo ""

if [ ! -z "$TENANT_ID" ] && [ ! -z "$JWT_TOKEN" ]; then
    # Test 27: Search Available Phone Numbers
    echo -e "${COLOR_YELLOW}Note: This test requires Twilio configuration${COLOR_RESET}"
    run_test "Search Available Phone Numbers" "GET" "/tenants/$TENANT_ID/phone-numbers/available?areaCode=415&limit=5" "" "200" "$JWT_TOKEN"

    # Test 28: List Phone Numbers
    run_test "List Phone Numbers" "GET" "/tenants/$TENANT_ID/phone-numbers" "" "200" "$JWT_TOKEN"

    # Note: Purchase phone number test skipped to avoid actual Twilio charges
    echo -e "${COLOR_YELLOW}Skipping phone number purchase test (requires Twilio credits)${COLOR_RESET}"
fi

# ========================================
# PHASE 7: SIP TRUNKING
# ========================================
echo -e "${COLOR_BLUE}=== PHASE 7: SIP Trunking ===${COLOR_RESET}"
echo ""

if [ ! -z "$TENANT_ID" ] && [ ! -z "$JWT_TOKEN" ]; then
    # Test 29: List Platform Trunks
    run_test "List Platform Trunks" "GET" "/platform-trunks" "" "200" "$JWT_TOKEN"

    # Test 30: List LiveKit Trunks
    run_test "List LiveKit Trunks (Tenant)" "GET" "/tenants/$TENANT_ID/livekit-trunks" "" "200" "$JWT_TOKEN"
fi

# ========================================
# PHASE 8: CAMPAIGN OPERATIONS
# ========================================
echo -e "${COLOR_BLUE}=== PHASE 8: Campaign Operations ===${COLOR_RESET}"
echo ""

if [ ! -z "$TENANT_ID" ] && [ ! -z "$CAMPAIGN_ID" ] && [ ! -z "$JWT_TOKEN" ]; then
    # Test 31: Start Campaign
    echo -e "${COLOR_YELLOW}Note: This will attempt to start actual calls${COLOR_RESET}"
    # run_test "Start Campaign" "POST" "/tenants/$TENANT_ID/campaigns/$CAMPAIGN_ID/start" "" "200" "$JWT_TOKEN"
    echo -e "${COLOR_YELLOW}Skipped: Campaign start (to avoid actual call initiation)${COLOR_RESET}"

    # Test 32: Pause Campaign
    # run_test "Pause Campaign" "POST" "/tenants/$TENANT_ID/campaigns/$CAMPAIGN_ID/pause" "" "200" "$JWT_TOKEN"

    # Test 33: Resume Campaign
    # run_test "Resume Campaign" "POST" "/tenants/$TENANT_ID/campaigns/$CAMPAIGN_ID/resume" "" "200" "$JWT_TOKEN"

    # Test 34: Stop Campaign
    # run_test "Stop Campaign" "POST" "/tenants/$TENANT_ID/campaigns/$CAMPAIGN_ID/stop" "" "200" "$JWT_TOKEN"
fi

# ========================================
# PHASE 9: INBOUND/OUTBOUND SIMULATION
# ========================================
echo -e "${COLOR_BLUE}=== PHASE 9: Inbound/Outbound Testing ===${COLOR_RESET}"
echo ""

echo -e "${COLOR_YELLOW}Inbound/Outbound call testing requires LiveKit webhook simulation${COLOR_RESET}"
echo -e "${COLOR_YELLOW}These tests are handled separately via LiveKit integration${COLOR_RESET}"

# ========================================
# TEST SUMMARY
# ========================================
echo ""
echo -e "${COLOR_BLUE}========================================${COLOR_RESET}"
echo -e "${COLOR_BLUE}  Test Summary${COLOR_RESET}"
echo -e "${COLOR_BLUE}========================================${COLOR_RESET}"
echo -e "Total Tests: ${COLOR_BLUE}$TOTAL_TESTS${COLOR_RESET}"
echo -e "Passed: ${COLOR_GREEN}$PASSED_TESTS${COLOR_RESET}"
echo -e "Failed: ${COLOR_RED}$FAILED_TESTS${COLOR_RESET}"

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${COLOR_GREEN}All tests passed!${COLOR_RESET}"
    exit 0
else
    echo -e "${COLOR_RED}Some tests failed. Please review the output above.${COLOR_RESET}"
    exit 1
fi
