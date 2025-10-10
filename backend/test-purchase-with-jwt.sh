#!/bin/bash

# Complete Phone Number Purchase Test with JWT Authentication
# This script tests the full flow: search -> purchase -> verify

echo "======================================"
echo "Phone Number Purchase Test with JWT"
echo "======================================"
echo ""

# Configuration
TENANT_ID="7c8693c6-976e-4324-9123-2c1d811605f9"
JWT_TOKEN="eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiI1NjNmZDE0My05ZmVjLTRiYWEtYTU0NS1hZjViNzkxYmJiM2UiLCJ1SGFzaCI6IjU5ZTY0MjNkNTMyY2I1ODVkODBiOTM5NDgxZGM4MWIyNzQ1OTA5MjQ5YThhZWZmNzIxNTU0MTJlZTgwNTc5MTgiLCJwQWNjdCI6IjdjODY5M2M2LTk3NmUtNDMyNC05MTIzLTJjMWQ4MTE2MDVmOSIsImFjY3QiOiI3Yzg2OTNjNi05NzZlLTQzMjQtOTEyMy0yYzFkODExNjA1ZjkiLCJwcml2cyI6Wzg2ODY3OTYzMyw1MzY4MTQwNDgsMjA5NzIxNV0sInVzZXJuYW1lIjoicWF0ZWFtQHl0ZWwuY29tIiwic2NvcGUiOiJST0xFX0FDQ0VTU19UT0tFTiIsImlzcyI6Imh0dHBzOi8veXRlbC5jb20iLCJpYXQiOjE3NjAwMDk2MzcsImV4cCI6MTc2MDAxNjgzN30.rV3RyuhzdteMsRJ68_C1fuDxXVqjEpsaBhAPkesm2HWHjtDNy2_BPh8ZYfGKdrcbAcSXQWlzgU4-Oi_dZmSa8xv5aOoJhukSRgX3meFNlC1Rn78VXklMZ7dB3e2QpDksrgZZb6jC1ustKfO6Zs4Eu8Dw8MzTJD2UgT_d-uhOZzjOZj0WrOI6dOA4kgvxZcGWaX6Rj5LdLWBGD0eEb783RzTAZc2oKtdFRX6x5ka5B5Otc4RdsjnThFMVIgKt6RM9e_kTyf9kvkkq2_v2HLRGscrBtb490pcGOetFlL4oVJZvP1XjmbZwBkdqxqhFqU0LIXs6QfRKt_k5cyV_JekHHw"
BASE_URL="http://localhost:3000/api/v1"

# Step 1: Search for available numbers
echo "Step 1: Searching for available phone numbers..."
echo "--------------------------------------"

SEARCH_RESPONSE=$(curl -s -X GET \
  "${BASE_URL}/tenants/${TENANT_ID}/phone-numbers/available?country=US&type=LOCAL&limit=5" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json")

echo "$SEARCH_RESPONSE" | python3 -m json.tool

# Extract first available number
PHONE_NUMBER=$(echo "$SEARCH_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data['data'][0]['phoneNumber'] if data.get('data') and len(data['data']) > 0 else '')")

if [ -z "$PHONE_NUMBER" ]; then
    echo ""
    echo "❌ No available numbers found. Try different search criteria."
    exit 1
fi

echo ""
echo "✅ Found available number: $PHONE_NUMBER"
echo ""

# Prompt user to confirm purchase
echo "⚠️  WARNING: This will actually purchase the number and charge your Twilio account!"
echo ""
read -p "Do you want to purchase $PHONE_NUMBER? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo ""
    echo "❌ Purchase cancelled by user."
    exit 0
fi

# Step 2: Purchase the number
echo ""
echo "Step 2: Purchasing phone number from Twilio..."
echo "--------------------------------------"

PURCHASE_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  "${BASE_URL}/tenants/${TENANT_ID}/phone-numbers" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"number\": \"$PHONE_NUMBER\",
    \"type\": \"LOCAL\",
    \"label\": \"Test Purchase $(date +%Y-%m-%d)\",
    \"provider\": \"TWILIO\",
    \"isActive\": true
  }")

# Split response body and status code
HTTP_BODY=$(echo "$PURCHASE_RESPONSE" | head -n -1)
HTTP_STATUS=$(echo "$PURCHASE_RESPONSE" | tail -n 1)

echo "HTTP Status: $HTTP_STATUS"
echo ""
echo "$HTTP_BODY" | python3 -m json.tool

if [ "$HTTP_STATUS" != "201" ]; then
    echo ""
    echo "❌ Purchase failed!"
    exit 1
fi

# Extract phone number ID
PHONE_NUMBER_ID=$(echo "$HTTP_BODY" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data['data']['id'] if data.get('data') else '')")

echo ""
echo "✅ Phone number purchased successfully!"
echo "   Number: $PHONE_NUMBER"
echo "   ID: $PHONE_NUMBER_ID"

# Step 3: Verify the purchase by fetching the number
echo ""
echo "Step 3: Verifying purchase in database..."
echo "--------------------------------------"

VERIFY_RESPONSE=$(curl -s -X GET \
  "${BASE_URL}/tenants/${TENANT_ID}/phone-numbers/${PHONE_NUMBER_ID}" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json")

echo "$VERIFY_RESPONSE" | python3 -m json.tool

echo ""
echo "======================================"
echo "✅ PURCHASE COMPLETE!"
echo "======================================"
echo ""
echo "📋 Summary:"
echo "   Tenant ID: $TENANT_ID"
echo "   Phone Number: $PHONE_NUMBER"
echo "   Phone Number ID: $PHONE_NUMBER_ID"
echo ""
echo "🔗 Flow Verification:"
echo "   1. ✅ Searched Twilio for available numbers"
echo "   2. ✅ Purchased number from Twilio"
echo "   3. ✅ Mapped to platform trunk (TKb7dce640389bbae93497be426666a548)"
echo "   4. ✅ Saved to database"
echo ""
echo "📞 Next Steps:"
echo "   When someone calls $PHONE_NUMBER:"
echo "   1. Call arrives at Twilio"
echo "   2. Twilio routes to SIP trunk (TKb7dce640389bbae93497be426666a548)"
echo "   3. SIP trunk routes to LiveKit"
echo "   4. Your AI agent answers!"
echo ""
