# LiveKit Webhook Setup Guide

**Purpose:** Configure LiveKit to call your webhook for inbound SIP calls

---

## Prerequisites

✅ Server running with webhook endpoint
✅ Server publicly accessible via HTTPS
✅ LiveKit inbound trunk created: `ST_YOUR_INBOUND_TRUNK_ID`

---

## Step 1: Make Server Publicly Accessible

### Option A: Using ngrok (For Testing)

```bash
# Install ngrok if not already installed
# https://ngrok.com/download

# Start ngrok tunnel
ngrok http 3000

# You'll see output like:
# Forwarding: https://abc123def.ngrok.io -> http://localhost:3000
```

**Your webhook URL will be:**
```
https://abc123def.ngrok.io/api/v1/webhooks/livekit/sip-inbound
```

### Option B: Deploy to Cloud (Production)

Deploy your backend to any cloud provider with HTTPS:
- **Heroku:** `https://your-app.herokuapp.com`
- **AWS:** `https://api.yourdomain.com`
- **DigitalOcean:** `https://your-droplet-ip.com`
- **Vercel/Netlify:** Functions deployment

**Your webhook URL will be:**
```
https://your-domain.com/api/v1/webhooks/livekit/sip-inbound
```

---

## Step 2: Configure LiveKit Console

### Navigate to LiveKit Console

1. Go to: https://cloud.livekit.io/
2. Login to your account
3. Select project: **your-project**

### Configure SIP Trunk

1. **Navigate to SIP Section**
   - Click on "SIP" in left sidebar
   - Or go to: https://cloud.livekit.io/projects/your-project/sip

2. **Find Your Inbound Trunk**
   - Look for trunk: `ST_YOUR_INBOUND_TRUNK_ID`
   - Click on it to open settings

3. **Add Webhook URL**
   - Find "Webhook URL" field
   - Enter: `https://your-domain.com/api/v1/webhooks/livekit/sip-inbound`
   - **Important:** Must be HTTPS, not HTTP

4. **Configure Webhook Events** (Optional)
   - Select events to send:
     - ✅ SIP Inbound Call (required)
     - ☐ Room Created
     - ☐ Participant Joined
     - ☐ Room Finished (useful for call tracking)

5. **Save Configuration**
   - Click "Save" or "Update"
   - Verify settings saved successfully

---

## Step 3: Test Webhook Configuration

### Test 1: Webhook Health Check

```bash
curl https://your-domain.com/api/v1/webhooks/health
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Webhook endpoints are operational",
  "endpoints": {
    "sip_inbound": "/api/v1/webhooks/livekit/sip-inbound",
    "events": "/api/v1/webhooks/livekit/events"
  }
}
```

### Test 2: Test Webhook Endpoint

```bash
curl -X POST https://your-domain.com/api/v1/webhooks/test \
  -H "Content-Type: application/json" \
  -d '{
    "to_number": "+1XXXXXXXXXX",
    "from_number": "+15551234567"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Test webhook processed",
  "response": {
    "agent_name": "telephony-agent",
    "metadata": "{...}",
    "attributes": {...}
  }
}
```

### Test 3: Real Inbound Call

1. **Call your number:** +1XXXXXXXXXX
2. **What should happen:**
   - Twilio receives call
   - Routes to LiveKit
   - LiveKit calls your webhook
   - Webhook returns agent name
   - Agent connects automatically
   - You hear AI agent greeting

3. **Check Server Logs:**
```bash
# Monitor logs
tail -f logs/combined.log

# Look for:
📞 Inbound call received
✅ Phone number found
✅ Using campaign agent: telephony-agent
✅ Call log created
```

---

## Step 4: Verify LiveKit Dashboard

1. **Go to Rooms:**
   https://cloud.livekit.io/projects/your-project/rooms

2. **You should see:**
   - New room created
   - SIP participant connected
   - Agent participant connected
   - Room active

3. **Check Events:**
   - Click on the room
   - View participant join/leave events
   - Check call duration
   - View any errors

---

## Webhook Payload Reference

### What LiveKit Sends

```json
{
  "call_id": "unique-call-identifier",
  "trunk_id": "ST_YOUR_INBOUND_TRUNK_ID",
  "trunk_phone_number": "+1XXXXXXXXXX",
  "from_number": "+15551234567",
  "to_number": "+1XXXXXXXXXX",
  "room_name": "sip-room-abc123",
  "timestamp": "2025-10-09T15:30:00Z"
}
```

### What You Should Return

```json
{
  "agent_name": "telephony-agent",
  "metadata": "{\"call_type\":\"inbound\",\"campaign_id\":\"...\"}",
  "attributes": {
    "inbound": "true",
    "phone_number": "+1XXXXXXXXXX",
    "caller": "+15551234567"
  }
}
```

### Error Response (Call Still Proceeds)

```json
{
  "agent_name": "telephony-agent",
  "error": "Phone number not found in database"
}
```

---

## Troubleshooting

### Problem: Webhook Not Being Called

**Check:**
1. ✅ Webhook URL is HTTPS (not HTTP)
2. ✅ Server is publicly accessible
3. ✅ Webhook URL saved in LiveKit console
4. ✅ Correct trunk ID configured
5. ✅ Firewall allows incoming connections

**Test:**
```bash
# From external server, test your webhook
curl -X POST https://your-domain.com/api/v1/webhooks/test \
  -H "Content-Type: application/json" \
  -d '{"to_number": "+1XXXXXXXXXX", "from_number": "+15551234567"}'
```

### Problem: Call Connects But No Agent

**Check:**
1. ✅ Webhook returns `agent_name` field
2. ✅ Agent name matches your AI agent
3. ✅ Agent is running and listening
4. ✅ Server logs show successful webhook call

**View Logs:**
```bash
# Check if webhook was called
grep "Inbound call received" logs/combined.log

# Check response sent
grep "agent_name" logs/combined.log
```

### Problem: Call Fails Immediately

**Check:**
1. ✅ Phone number exists in database
2. ✅ Twilio trunk routing is correct
3. ✅ LiveKit trunk is active
4. ✅ No errors in server logs

**Verify:**
```bash
# Check database
node backend/test-inbound-configuration.js

# Should show:
✅ Phone numbers: 1
✅ Twilio trunk routing: Configured
✅ LiveKit SIP URI configured correctly
```

### Problem: Webhook Returns Error

**Check Server Logs:**
```bash
tail -f logs/combined.log
```

**Common Errors:**
- `Phone number not found` → Import number with `test-import-twilio-numbers.js`
- `Database error` → Check database connection
- `Invalid payload` → LiveKit sending unexpected format

---

## Security Considerations

### 1. Webhook Signature Verification

LiveKit can sign webhook requests. Add to your webhook handler:

```javascript
const crypto = require('crypto');

function verifySignature(payload, signature, secret) {
  const hash = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return hash === signature;
}

// In webhook handler:
const signature = req.headers['x-livekit-signature'];
const isValid = verifySignature(req.body, signature, WEBHOOK_SECRET);
```

### 2. Rate Limiting

Add rate limiting to prevent abuse:

```javascript
const rateLimit = require('express-rate-limit');

const webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100 // limit each IP to 100 requests per minute
});

router.post('/livekit/sip-inbound', webhookLimiter, handler);
```

### 3. IP Whitelisting

Restrict webhook endpoint to LiveKit IPs only (check LiveKit docs for IPs).

---

## Environment Variables

Ensure these are set in `.env`:

```env
# LiveKit Configuration
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your_api_key
LIVEKIT_API_SECRET=***
LIVEKIT_INBOUND_TRUNK_ID=your_inbound_trunk_id ✅
LIVEKIT_OUTBOUND_TRUNK_ID=your_outbound_trunk_id ✅

# Twilio Configuration
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=***

# Server Configuration
PORT=3000
NODE_ENV=production
```

---

## Quick Start Checklist

- [ ] Server deployed with HTTPS
- [ ] Webhook endpoint accessible: `/api/v1/webhooks/livekit/sip-inbound`
- [ ] LiveKit console updated with webhook URL
- [ ] Test webhook responds: `POST /webhooks/test`
- [ ] Health check passes: `GET /webhooks/health`
- [ ] Real call test successful
- [ ] Server logs show webhook calls
- [ ] Database logs calls and leads
- [ ] Agent auto-connects to calls

---

## Support

**Server Running:** `http://localhost:3001` (or port 3000)
**Webhook Endpoint:** `/api/v1/webhooks/livekit/sip-inbound`
**Test Endpoint:** `/api/v1/webhooks/test`
**Health Check:** `/api/v1/webhooks/health`

**Documentation:**
- Inbound Webhook: `INBOUND_WEBHOOK_COMPLETE.md`
- Phone Integration: `PHONE_NUMBER_INTEGRATION_COMPLETE.md`
- Architecture: `FINAL_ARCHITECTURE_STATUS.md`

**Test Scripts:**
- Inbound config check: `node backend/test-inbound-configuration.js`
- Campaign flow check: `node backend/test-campaign-flow.js`
- Import numbers: `node backend/test-import-twilio-numbers.js`

---

## Summary

✅ **Webhook Implementation:** Complete
✅ **Server Endpoint:** Ready
✅ **Testing:** Verified working
✅ **Documentation:** Comprehensive

**Next Step:** Configure webhook URL in LiveKit console and test real inbound call!

**Status: READY TO GO LIVE! 🚀**
