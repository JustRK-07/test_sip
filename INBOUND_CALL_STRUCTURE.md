# Complete Inbound Call Structure

**Comprehensive guide showing every component, connection, and data flow**

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    INBOUND CALL FLOW                             │
│                                                                   │
│  External      Twilio        LiveKit        Your          AI     │
│  Caller    →   PSTN     →    SIP      →    Webhook   →   Agent  │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📞 Complete Call Flow - Step by Step

### Step 1: External Caller Initiates Call

```
┌──────────────────┐
│  📱 Caller       │
│  +15551234567    │
│                  │
│  Dials:          │
│  +1XXXXXXXXXX    │
└────────┬─────────┘
         │
         │ [Voice Call via PSTN]
         │
         ↓
```

**What Happens:**
- Caller picks up phone
- Dials your purchased Twilio number: `+1XXXXXXXXXX`
- Call goes through Public Switched Telephone Network (PSTN)

---

### Step 2: Twilio Receives Call

```
         ↓
┌─────────────────────────────────────────────┐
│  🌐 TWILIO PLATFORM                         │
│                                              │
│  Account: ACab65066171a1ff3ff2ab1290ccbf... │
│                                              │
│  ┌────────────────────────────────────┐    │
│  │  Incoming Phone Number              │    │
│  │  +1XXXXXXXXXX                       │    │
│  │                                     │    │
│  │  SID: PNa636a188160685c79de4134... │    │
│  │  Friendly Name: Test Number         │    │
│  │  Voice URL: (not set)               │    │
│  │  Trunk SID: TKb7dce640389bbae...   │    │
│  └────────────────────────────────────┘    │
└─────────────────┬───────────────────────────┘
                  │
                  │ [Trunk routing configured]
                  │
                  ↓
```

**What Happens:**
- Twilio receives inbound call on `+1XXXXXXXXXX`
- Looks up phone number configuration
- Finds it's assigned to trunk: `TKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
- Routes call to trunk

**Database Record:**
```javascript
PhoneNumber {
  number: "+1XXXXXXXXXX",
  providerSid: "PNxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  provider: "TWILIO",
  tenantId: "7c8693c6-976e-4324-9123-2c1d811605f9",
  campaignId: "cmgjk3k1m0000sbll7wvbqgt4"
}
```

---

### Step 3: Twilio Trunk Routes to LiveKit

```
                  ↓
┌─────────────────────────────────────────────┐
│  📡 TWILIO ELASTIC SIP TRUNK                │
│                                              │
│  Trunk SID: TKb7dce640389bbae93497be426...  │
│  Name: Balaji Trunk                          │
│  Status: Active                              │
│                                              │
│  ┌────────────────────────────────────┐    │
│  │  Origination URI Configuration      │    │
│  │                                     │    │
│  │  SIP URI:                           │    │
│  │  sip:your-sip-domain.sip.livekit.cloud │    │
│  │                                     │    │
│  │  Priority: 10                       │    │
│  │  Weight: 10                         │    │
│  │  Enabled: ✅ Yes                    │    │
│  └────────────────────────────────────┘    │
└─────────────────┬───────────────────────────┘
                  │
                  │ [SIP Protocol]
                  │ sip:your-sip-domain.sip.livekit.cloud
                  │
                  ↓
```

**What Happens:**
- Trunk receives call from phone number
- Looks up Origination URI
- Initiates SIP connection to: `sip:your-sip-domain.sip.livekit.cloud`
- Sends SIP INVITE with call details

**SIP INVITE Contains:**
```
FROM: +15551234567
TO: +1XXXXXXXXXX
CALL-ID: unique-call-identifier
```

**Database Record:**
```javascript
PlatformTrunk {
  twilioTrunkSid: "TKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  name: "Test Platform Trunk",
  tenantId: "7c8693c6-976e-4324-9123-2c1d811605f9",
  isActive: true
}
```

---

### Step 4: LiveKit Receives SIP Call

```
                  ↓
┌─────────────────────────────────────────────┐
│  🎙️ LIVEKIT PLATFORM                        │
│                                              │
│  Project: your-project             │
│  URL: your-project.livekit.cloud   │
│                                              │
│  ┌────────────────────────────────────┐    │
│  │  SIP Inbound Trunk                  │    │
│  │  ST_YOUR_INBOUND_TRUNK_ID                    │    │
│  │                                     │    │
│  │  Type: INBOUND                      │    │
│  │  SIP URI: your-sip-domain.sip...       │    │
│  │  Status: Active                     │    │
│  │                                     │    │
│  │  Webhook URL:                       │    │
│  │  https://your-domain.com/api/v1/    │    │
│  │  webhooks/livekit/sip-inbound       │    │
│  └────────────────────────────────────┘    │
│                                              │
│  🔄 Creating room...                        │
│     Room: sip-room-abc123                   │
│                                              │
└─────────────────┬───────────────────────────┘
                  │
                  │ [Creates SIP participant]
                  │ [Calls webhook for agent dispatch]
                  │
                  ↓
```

**What Happens:**
- LiveKit receives SIP INVITE
- Inbound trunk `ST_YOUR_INBOUND_TRUNK_ID` accepts call
- Creates room: `sip-room-abc123` (auto-generated)
- Creates SIP participant in room (the caller)
- **Calls webhook** to ask which agent to connect

**Environment Variable:**
```env
LIVEKIT_INBOUND_TRUNK_ID=your_inbound_trunk_id
```

---

### Step 5: LiveKit Calls Your Webhook

```
                  ↓
┌─────────────────────────────────────────────┐
│  🌐 HTTP POST REQUEST                       │
│                                              │
│  POST https://your-domain.com/api/v1/       │
│       webhooks/livekit/sip-inbound          │
│                                              │
│  Headers:                                    │
│    Content-Type: application/json           │
│    X-LiveKit-Signature: [signature]         │
│                                              │
│  Body:                                       │
│  {                                           │
│    "call_id": "SIPxxxxxx-1234",            │
│    "trunk_id": "ST_YOUR_INBOUND_TRUNK_ID",           │
│    "trunk_phone_number": "+1XXXXXXXXXX",    │
│    "from_number": "+15551234567",           │
│    "to_number": "+1XXXXXXXXXX",             │
│    "room_name": "sip-room-abc123",          │
│    "timestamp": "2025-10-09T15:30:00Z"      │
│  }                                           │
└─────────────────┬───────────────────────────┘
                  │
                  │ [Waiting for response...]
                  │
                  ↓
```

**What Happens:**
- LiveKit makes HTTP POST to your webhook
- Sends all call details
- Waits for response (max 10 seconds)
- Response tells LiveKit which agent to dispatch

---

### Step 6: Your Backend Processes Webhook

```
                  ↓
┌──────────────────────────────────────────────────────────┐
│  🖥️ YOUR BACKEND SERVER                                  │
│  https://your-domain.com                                  │
│                                                            │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Express.js Route Handler                         │   │
│  │  POST /api/v1/webhooks/livekit/sip-inbound       │   │
│  │                                                    │   │
│  │  src/routes/webhookRoutes.js                      │   │
│  └──────────────┬───────────────────────────────────┘   │
│                 │                                          │
│                 ↓                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  InboundCallService.handleInboundCall()          │   │
│  │                                                    │   │
│  │  src/services/InboundCallService.js               │   │
│  │                                                    │   │
│  │  Process Flow:                                     │   │
│  │  1. Extract call data from webhook                │   │
│  │  2. Lookup phone number in database               │   │
│  │  3. Find associated campaign                      │   │
│  │  4. Determine which agent to use                  │   │
│  │  5. Create lead for caller                        │   │
│  │  6. Log call to database                          │   │
│  │  7. Return agent name to LiveKit                  │   │
│  └──────────────┬───────────────────────────────────┘   │
│                 │                                          │
│                 ↓                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Database Queries                                 │   │
│  │                                                    │   │
│  │  Prisma ORM → SQLite (dev.db)                    │   │
│  └──────────────────────────────────────────────────┘   │
└──────────────────┬───────────────────────────────────────┘
                   │
                   ↓
```

**Code Flow:**

#### 6.1. Route Handler Receives Request
```javascript
// src/routes/webhookRoutes.js
router.post('/livekit/sip-inbound', async (req, res) => {
  const sipData = req.body;

  // {
  //   call_id: "SIPxxxxxx-1234",
  //   from_number: "+15551234567",
  //   to_number: "+1XXXXXXXXXX",
  //   room_name: "sip-room-abc123"
  // }

  const response = await InboundCallService.handleInboundCall(sipData);

  res.json(response);
});
```

#### 6.2. Lookup Phone Number
```javascript
// src/services/InboundCallService.js
async lookupPhoneNumber(phoneNumber) {
  // Normalize: "(858) 879-6658" → "+1XXXXXXXXXX"
  const normalized = this.normalizePhoneNumber(phoneNumber);

  // Query database
  const record = await prisma.phoneNumber.findUnique({
    where: { number: normalized },
    include: {
      tenant: { select: { id: true, name: true } },
      campaign: { select: { id: true, name: true, agentName: true } }
    }
  });

  return record;
  // {
  //   id: "cmgjk2lp30001sbfwxx2kbajs",
  //   number: "+1XXXXXXXXXX",
  //   tenant: { id: "7c8693c6...", name: "Ytel QA Team" },
  //   campaign: {
  //     id: "cmgjk3k1m...",
  //     name: "Phone Number Test Campaign",
  //     agentName: "telephony-agent"
  //   }
  // }
}
```

#### 6.3. Determine Agent
```javascript
async getAgentForCall(phoneNumber) {
  // Priority 1: Campaign's agent
  if (phoneNumber.campaign?.agentName) {
    return phoneNumber.campaign.agentName; // "telephony-agent"
  }

  // Priority 2: Tenant's default agent
  const defaultAgent = await prisma.agent.findFirst({
    where: { isActive: true }
  });
  if (defaultAgent) {
    return defaultAgent.name;
  }

  // Priority 3: System default
  return 'telephony-agent';
}
```

#### 6.4. Create Lead
```javascript
async logInboundCall(callData) {
  const { phoneNumber, fromNumber, campaignId } = callData;

  // Check if lead exists
  let lead = await prisma.lead.findFirst({
    where: {
      campaignId: phoneNumber.campaignId,
      phoneNumber: fromNumber
    }
  });

  // Create if doesn't exist
  if (!lead) {
    lead = await prisma.lead.create({
      data: {
        campaignId: phoneNumber.campaignId,
        phoneNumber: fromNumber, // "+15551234567"
        name: `Inbound Caller ${fromNumber}`,
        status: 'calling'
      }
    });
  }

  return lead;
  // {
  //   id: "cmgjkyhd20002sbzw...",
  //   phoneNumber: "+15551234567",
  //   name: "Inbound Caller +15551234567",
  //   status: "calling",
  //   campaignId: "cmgjk3k1m0000sbll7wvbqgt4"
  // }
}
```

#### 6.5. Log Call
```javascript
async logInboundCall(callData) {
  // ... lead creation above ...

  // Create call log
  const callLog = await prisma.callLog.create({
    data: {
      leadId: lead.id,
      campaignId: phoneNumber.campaignId,
      phoneNumber: fromNumber,
      callSid: callId,
      roomName: roomName,
      status: 'ringing',
      metadata: JSON.stringify({
        call_type: 'inbound',
        trunk_id: trunkId,
        phone_number_id: phoneNumber.id,
        tenant_id: phoneNumber.tenantId,
        campaign_id: phoneNumber.campaignId
      })
    }
  });

  return callLog;
  // {
  //   id: "cmgjkyhd20003sbzwf2hq01iv",
  //   callSid: "SIPxxxxxx-1234",
  //   roomName: "sip-room-abc123",
  //   status: "ringing",
  //   duration: null
  // }
}
```

#### 6.6. Return Response
```javascript
// Return to LiveKit
return {
  agent_name: "telephony-agent",
  metadata: JSON.stringify({
    call_type: "inbound",
    phone_number_id: "cmgjk2lp30001sbfwxx2kbajs",
    tenant_id: "7c8693c6-976e-4324-9123-2c1d811605f9",
    campaign_id: "cmgjk3k1m0000sbll7wvbqgt4",
    from_number: "+15551234567",
    to_number: "+1XXXXXXXXXX"
  }),
  attributes: {
    inbound: "true",
    phone_number: "+1XXXXXXXXXX",
    caller: "+15551234567"
  }
};
```

---

### Step 7: Backend Responds to LiveKit

```
                   ↓
┌──────────────────────────────────────────────┐
│  📤 HTTP RESPONSE                            │
│                                               │
│  Status: 200 OK                              │
│  Content-Type: application/json              │
│                                               │
│  Body:                                        │
│  {                                            │
│    "agent_name": "telephony-agent",          │
│    "metadata": "{...}",                      │
│    "attributes": {                           │
│      "inbound": "true",                      │
│      "phone_number": "+1XXXXXXXXXX",         │
│      "caller": "+15551234567"                │
│    }                                          │
│  }                                            │
└───────────────────┬──────────────────────────┘
                    │
                    │ [Response received]
                    │
                    ↓
```

**What Happens:**
- Backend returns JSON response
- LiveKit receives agent name: `"telephony-agent"`
- LiveKit knows which agent to dispatch
- Webhook call completes (typically <100ms)

---

### Step 8: LiveKit Dispatches AI Agent

```
                    ↓
┌──────────────────────────────────────────────────┐
│  🤖 LIVEKIT AGENT DISPATCH                       │
│                                                   │
│  Room: sip-room-abc123                           │
│  Agent Name: telephony-agent                     │
│                                                   │
│  ┌─────────────────────────────────────────┐   │
│  │  Agent Dispatch Request                  │   │
│  │                                          │   │
│  │  Finding agent: "telephony-agent"        │   │
│  │  Connecting to room: sip-room-abc123    │   │
│  │                                          │   │
│  │  Status: Dispatching...                 │   │
│  └─────────────────────────────────────────┘   │
│                                                   │
│  Current Participants:                           │
│  1. SIP Participant (Caller +15551234567)       │
│  2. Agent "telephony-agent" ← Joining...        │
│                                                   │
└───────────────────┬─────────────────────────────┘
                    │
                    │ [Agent connecting...]
                    │
                    ↓
```

**What Happens:**
- LiveKit looks for available agent named `"telephony-agent"`
- Agent service receives dispatch request
- Agent connects to room `sip-room-abc123`
- Agent can now communicate with caller

**Agent Connection:**
```javascript
// Your AI agent receives:
{
  room_name: "sip-room-abc123",
  metadata: {
    call_type: "inbound",
    phone_number_id: "cmgjk2lp30001sbfwxx2kbajs",
    from_number: "+15551234567",
    to_number: "+1XXXXXXXXXX"
  }
}
```

---

### Step 9: AI Agent Connects & Conversation Begins

```
                    ↓
┌──────────────────────────────────────────────────┐
│  🎤 ACTIVE CALL                                  │
│                                                   │
│  Room: sip-room-abc123                           │
│  Duration: 00:00:05                              │
│                                                   │
│  ┌─────────────────────────────────────────┐   │
│  │  Participants                            │   │
│  │                                          │   │
│  │  👤 SIP-Participant                      │   │
│  │     Identity: caller-+15551234567       │   │
│  │     Audio: 🔊 Publishing                │   │
│  │     Video: ❌ Not publishing            │   │
│  │                                          │   │
│  │  🤖 AI-Agent                             │   │
│  │     Identity: telephony-agent           │   │
│  │     Audio: 🔊 Publishing                │   │
│  │     Status: ✅ Connected                │   │
│  │                                          │   │
│  └─────────────────────────────────────────┘   │
│                                                   │
│  🔊 Audio Streams:                               │
│  Caller ←→ Agent (bidirectional)                │
│                                                   │
└──────────────────────────────────────────────────┘
```

**What Happens:**
- Caller hears: "Hello! This is your AI assistant. How can I help you?"
- Caller speaks: "I'd like to schedule an appointment"
- Agent processes speech with AI
- Agent responds with natural language
- Conversation continues...

**Audio Flow:**
```
Caller Voice → SIP → LiveKit → Agent AI
Agent AI → LiveKit → SIP → Caller Hears
```

---

### Step 10: Call Ends & Cleanup

```
┌──────────────────────────────────────────────────┐
│  📞 CALL ENDING                                  │
│                                                   │
│  Trigger: Caller hangs up / Agent ends call     │
│                                                   │
│  ┌─────────────────────────────────────────┐   │
│  │  LiveKit Room Events                     │   │
│  │                                          │   │
│  │  Event: participant.left                │   │
│  │  Identity: caller-+15551234567          │   │
│  │                                          │   │
│  │  Event: room.finished                   │   │
│  │  Room: sip-room-abc123                  │   │
│  │  Duration: 183 seconds                  │   │
│  │                                          │   │
│  └─────────────────────────────────────────┘   │
│                                                   │
│  🌐 Webhook POST:                                │
│  POST /api/v1/webhooks/livekit/events           │
│  {                                                │
│    "event": "room.finished",                    │
│    "room": {                                     │
│      "name": "sip-room-abc123",                 │
│      "duration": 183                            │
│    }                                             │
│  }                                               │
└───────────────────┬──────────────────────────────┘
                    │
                    ↓
┌──────────────────────────────────────────────────┐
│  💾 DATABASE UPDATE                              │
│                                                   │
│  Update CallLog:                                 │
│  {                                                │
│    id: "cmgjkyhd20003sbzwf2hq01iv",             │
│    status: "ringing" → "completed",             │
│    duration: 183 seconds,                       │
│    updatedAt: "2025-10-09T15:33:03Z"            │
│  }                                               │
│                                                   │
│  Update Lead:                                    │
│  {                                                │
│    id: "cmgjkyhd20002sbzw...",                  │
│    status: "calling" → "completed",             │
│    lastCallAt: "2025-10-09T15:33:03Z"           │
│  }                                               │
└──────────────────────────────────────────────────┘
```

**What Happens:**
- Call ends (caller or agent hangs up)
- LiveKit sends `room.finished` event to webhook
- Backend updates call log with final status & duration
- Lead status updated to "completed"
- Room is destroyed
- All complete!

---

## 🗂️ Database Structure

### Tables Involved

#### PhoneNumber
```javascript
{
  id: "cmgjk2lp30001sbfwxx2kbajs",
  number: "+1XXXXXXXXXX",               // E.164 format
  type: "LOCAL",                        // LOCAL, TOLL_FREE, MOBILE
  provider: "TWILIO",
  providerSid: "PNa636a188160685c...",  // Twilio SID
  tenantId: "7c8693c6-976e-4324...",    // Links to tenant
  campaignId: "cmgjk3k1m0000sbll...",   // Links to campaign (optional)
  livekitTrunkId: null,
  isActive: true,
  purchasedAt: "2025-10-09T10:00:00Z",
  metadata: {
    capabilities: { voice: true, sms: true },
    importedFrom: "twilio"
  }
}
```

#### Campaign
```javascript
{
  id: "cmgjk3k1m0000sbll7wvbqgt4",
  name: "Phone Number Test Campaign",
  status: "active",
  agentName: "telephony-agent",         // Which agent to use
  sipTrunkId: "ST_YOUR_OUTBOUND_TRUNK_ID",        // For outbound
  maxConcurrent: 3,
  phoneNumbers: [                        // Linked phone numbers
    { id: "cmgjk2lp30001sbfwxx2kbajs", number: "+1XXXXXXXXXX" }
  ],
  leads: [...]
}
```

#### Lead
```javascript
{
  id: "cmgjkyhd20002sbzw...",
  campaignId: "cmgjk3k1m0000sbll7wvbqgt4",
  phoneNumber: "+15551234567",          // Caller's number
  name: "Inbound Caller +15551234567",
  status: "calling" → "completed",
  attempts: 1,
  lastCallAt: "2025-10-09T15:30:00Z",
  metadata: {
    source: "inbound"
  }
}
```

#### CallLog
```javascript
{
  id: "cmgjkyhd20003sbzwf2hq01iv",
  leadId: "cmgjkyhd20002sbzw...",
  campaignId: "cmgjk3k1m0000sbll7wvbqgt4",
  phoneNumber: "+15551234567",          // Caller
  callSid: "SIPxxxxxx-1234",            // LiveKit call ID
  roomName: "sip-room-abc123",          // LiveKit room
  status: "ringing" → "completed",
  duration: 183,                         // seconds
  metadata: {
    call_type: "inbound",
    trunk_id: "ST_YOUR_INBOUND_TRUNK_ID",
    phone_number_id: "cmgjk2lp30001sbfwxx2kbajs",
    tenant_id: "7c8693c6-976e-4324-9123-2c1d811605f9",
    campaign_id: "cmgjk3k1m0000sbll7wvbqgt4"
  },
  createdAt: "2025-10-09T15:30:00Z",
  updatedAt: "2025-10-09T15:33:03Z"
}
```

#### Tenant
```javascript
{
  id: "7c8693c6-976e-4324-9123-2c1d811605f9",
  name: "Ytel QA Team",
  isActive: true,
  phoneNumbers: [...]  // All tenant's phone numbers
}
```

---

## 🔧 Configuration Files

### Environment Variables (.env)
```env
# LiveKit Configuration
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your_api_key
LIVEKIT_API_SECRET=***
LIVEKIT_INBOUND_TRUNK_ID=your_inbound_trunk_id   ← Used to verify trunk
LIVEKIT_OUTBOUND_TRUNK_ID=your_outbound_trunk_id

# Twilio Configuration
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=***
TWILIO_PHONE_NUMBER=+1XXXXXXXXXX

# Server Configuration
PORT=3000
NODE_ENV=production
DATABASE_URL=file:./dev.db
```

### Twilio Console Settings
```
Phone Number: +1XXXXXXXXXX
├── Voice Configuration
│   ├── Accept Incoming: Voice Calls
│   ├── Configure With: SIP Trunk
│   └── SIP Trunk: TKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
└── Advanced Settings
    └── Voice URL: (empty - using trunk routing)
```

### Twilio Trunk Settings
```
Trunk SID: TKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
├── Origination
│   └── SIP URI: sip:your-sip-domain.sip.livekit.cloud
│       ├── Priority: 10
│       ├── Weight: 10
│       └── Enabled: Yes
└── Phone Numbers
    └── +1XXXXXXXXXX (assigned)
```

### LiveKit Console Settings
```
Project: your-project
└── SIP Trunks
    └── Inbound Trunk
        ├── ID: ST_YOUR_INBOUND_TRUNK_ID
        ├── Type: INBOUND
        ├── SIP URI: your-sip-domain.sip.livekit.cloud
        └── Webhook URL: https://your-domain.com/api/v1/webhooks/livekit/sip-inbound
```

---

## 📁 File Structure

```
backend/
├── src/
│   ├── routes/
│   │   ├── webhookRoutes.js           ← Webhook endpoints
│   │   ├── phoneNumbers.js            ← Phone number management
│   │   ├── campaignRoutes.js          ← Campaign management
│   │   └── index.js                   ← Route registration
│   │
│   ├── services/
│   │   ├── InboundCallService.js      ← Inbound call logic
│   │   ├── TwilioService.js           ← Twilio integration
│   │   └── LiveKitService.js          ← LiveKit integration
│   │
│   ├── middleware/
│   │   └── auth.js                    ← JWT authentication
│   │
│   └── utils/
│       └── logger.js                  ← Logging
│
├── prisma/
│   └── schema.prisma                  ← Database schema
│
├── .env                               ← Configuration
├── package.json
└── server.js                          ← Entry point
```

---

## 🔄 Data Flow Summary

```
1. Caller → Twilio
   Data: Voice call to +1XXXXXXXXXX

2. Twilio → Database Lookup
   Query: Find phone number configuration

3. Twilio → Trunk → LiveKit
   Protocol: SIP INVITE
   Data: from_number, to_number, call_id

4. LiveKit → Your Webhook
   Protocol: HTTP POST
   Data: Complete call details

5. Webhook → Database Query
   Query: Find phone, campaign, agent

6. Webhook → Database Write
   Write: Create lead, call log

7. Webhook → LiveKit
   Response: agent_name, metadata

8. LiveKit → Agent Dispatch
   Connect: Agent to room

9. Agent ↔ Caller
   Protocol: RTP audio streams

10. Call End → Webhook
    Event: room.finished

11. Webhook → Database Update
    Update: Call log status, duration
```

---

## 🎯 Quick Reference

### Webhook Endpoints
```
Health:     GET  /api/v1/webhooks/health
Test:       POST /api/v1/webhooks/test
Inbound:    POST /api/v1/webhooks/livekit/sip-inbound
Events:     POST /api/v1/webhooks/livekit/events
```

### Key IDs
```
Tenant:            7c8693c6-976e-4324-9123-2c1d811605f9
Phone Number:      +1XXXXXXXXXX
Twilio Trunk:      TKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
LiveKit Inbound:   ST_YOUR_INBOUND_TRUNK_ID
LiveKit Outbound:  ST_YOUR_OUTBOUND_TRUNK_ID
Campaign:          cmgjk3k1m0000sbll7wvbqgt4
```

### Test Commands
```bash
# Test webhook
curl -X POST http://localhost:3000/api/v1/webhooks/test \
  -H "Content-Type: application/json" \
  -d '{"to_number": "+1XXXXXXXXXX", "from_number": "+15551234567"}'

# Check inbound config
node backend/test-inbound-configuration.js

# Import phone numbers
node backend/test-import-twilio-numbers.js

# Check campaign flow
node backend/test-campaign-flow.js
```

---

## ✅ Checklist

- [x] Twilio phone number purchased
- [x] Twilio trunk configured
- [x] Twilio trunk points to LiveKit SIP URI
- [x] LiveKit inbound trunk created
- [x] Phone number imported to database
- [x] Campaign created and linked
- [x] Webhook endpoint implemented
- [x] Webhook tested successfully
- [x] Database logging working
- [x] Agent dispatch logic complete
- [ ] Server deployed with HTTPS
- [ ] Webhook URL configured in LiveKit
- [ ] Real inbound call tested

---

**Status: Structure Complete - Ready for Deployment! 🚀**
