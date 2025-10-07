# 🚀 Campaign Calling Prototype

## 📋 Overview

This prototype demonstrates the **campaign-based calling system** logic before building the full API.

**What it does:**
- Takes a list of phone numbers (leads)
- Calls them using your existing Python script (`test_outbound.py`)
- Manages concurrency (max X calls at once)
- Tracks status in real-time
- Shows you how the queue system works

---

## 🏗️ Architecture

```
┌────────────────────────────────────────────────────────────┐
│                    CAMPAIGN PROTOTYPE                       │
└────────────────────────────────────────────────────────────┘

test-campaign.js (Node.js)
     ↓
CampaignQueue.js (Queue Manager)
     ├─ Manages pending/active/completed leads
     ├─ Controls concurrency (max 2-3 calls at once)
     ├─ Tracks status and progress
     └─ Emits events for monitoring
     ↓
PythonExecutor.js (Python Integration)
     ├─ Spawns Python child processes
     ├─ Captures stdout/stderr
     ├─ Returns call results
     └─ Handles errors
     ↓
test_outbound.py (Existing Python Script)
     ├─ Dispatches LiveKit agent
     ├─ Creates SIP call via Twilio
     └─ Returns room/dispatch info
     ↓
LiveKit + Twilio
     ↓
Phone Call
```

---

## 📊 How It Works

### **1. Queue Management**

```javascript
Campaign Queue:
┌─────────────────────────────────────────┐
│ Pending:   [Lead3, Lead4, Lead5]        │ ← Waiting
│ Active:    [Lead1, Lead2]               │ ← Calling now (max 2-3)
│ Completed: []                           │ ← Finished
│ Failed:    []                           │ ← Errors
└─────────────────────────────────────────┘

Flow:
1. Start with all leads in "Pending"
2. Move leads to "Active" (respecting maxConcurrent)
3. Spawn Python process for each active lead
4. When call completes → move to "Completed"
5. When call fails → move to "Failed" (or retry)
6. Repeat until all leads processed
```

### **2. Concurrency Control**

```javascript
Max Concurrent = 3

Time: 0s
  ├─ Call Lead 1 ✓ (Active: 1/3)
  ├─ Wait 2s...
  ├─ Call Lead 2 ✓ (Active: 2/3)
  ├─ Wait 2s...
  ├─ Call Lead 3 ✓ (Active: 3/3) ← MAX REACHED
  └─ WAIT for one to finish...

Time: 15s
  ├─ Lead 1 completed ✅
  └─ Call Lead 4 ✓ (Active: 3/3)

Time: 30s
  ├─ Lead 2 completed ✅
  ├─ Lead 3 failed ❌
  ├─ Call Lead 5 ✓ (Active: 2/3)
  └─ ALL LEADS PROCESSED
```

### **3. Event Flow**

```javascript
Events emitted during campaign:

1. campaign_started
   └─ Campaign begins

2. call_started (for each lead)
   └─ Python process spawned

3. call_completed OR call_failed
   └─ Call finished (success/error)

4. campaign_completed
   └─ All leads processed
```

---

## 🎯 Components Created

### **1. PythonExecutor.js**
```javascript
// Spawns Python processes
const executor = new PythonExecutor();
const result = await executor.makeCall('+1234567890');

// Returns:
{
  success: true,
  phoneNumber: '+1234567890',
  roomName: 'outbound-call-abc123',
  dispatchId: 'AD_xyz',
  duration: 5234, // ms
}
```

**Features:**
- ✅ Spawns Python as child process
- ✅ Captures stdout/stderr in real-time
- ✅ Extracts room name & dispatch ID
- ✅ Handles errors gracefully
- ✅ Returns structured results

### **2. CampaignQueue.js**
```javascript
// Manages the campaign queue
const campaign = new CampaignQueue({
  campaignName: 'Q4 Sales',
  maxConcurrent: 3,
  retryFailed: true,
  retryAttempts: 2,
});

campaign.addLeads([...]);
await campaign.start();
```

**Features:**
- ✅ Queue management (pending/active/completed)
- ✅ Concurrency limiting
- ✅ Retry logic
- ✅ Event emitters (real-time updates)
- ✅ Status tracking
- ✅ Pause/resume/stop controls

### **3. test-campaign.js**
```javascript
// Runs the test campaign
const leads = require('./test-leads.json');
campaign.addLeads(leads);
await campaign.start();
```

**Features:**
- ✅ Loads leads from JSON
- ✅ Beautiful CLI output
- ✅ Real-time progress
- ✅ Detailed results
- ✅ Error handling

---

## 🚀 How to Test

### **Prerequisites:**

1. ✅ `voice_agent.py` must be running
2. ✅ LiveKit & Twilio configured (`.env.local`)
3. ✅ Test phone numbers in `test-leads.json`

### **Step 1: Edit test-leads.json**

```json
[
  {
    "phoneNumber": "+919529117230",
    "name": "Test Lead 1",
    "priority": 1
  },
  {
    "phoneNumber": "+919876543210",
    "name": "Test Lead 2",
    "priority": 2
  }
]
```

**Replace with your test numbers!**

### **Step 2: Run voice_agent.py**

```bash
# In one terminal
cd /home/rushabh/Desktop/Rushabh\ Work/SIP/test_sip
python voice_agent.py dev
```

**Wait for:** `✓ registered worker`

### **Step 3: Run campaign test**

```bash
# In another terminal
cd backend
npm run test:campaign
```

---

## 📺 Expected Output

```
══════════════════════════════════════════════════════════════════
  ╔═╗┌─┐┌┬┐┌─┐┌─┐┬┌─┐┌┐┌  ╔═╗┌─┐┬  ┬  ┬┌┐┌┌─┐  ╔═╗┬─┐┌─┐┌┬┐┌─┐┌┬┐┬ ┬┌─┐┌─┐
  ║  ├─┤│││├─┘├─┤││ ┬│││  ║  ├─┤│  │  │││││ ┬  ╠═╝├┬┘│ │ │ │ │ │ └┬┘├─┘├┤
  ╚═╝┴ ┴┴ ┴┴  ┴ ┴┴└─┘┘└┘  ╚═╝┴ ┴┴─┘┴─┘┴┘└┘└─┘  ╩  ┴└─└─┘ ┴ └─┘ ┴  ┴ ┴  └─┘
══════════════════════════════════════════════════════════════════

💡 Testing Campaign Queue with Node.js + Python Integration

📂 Loading leads from file...
✅ Loaded 5 leads from file
📋 CampaignQueue initialized: "Q4 Sales Campaign - Prototype Test"

──────────────────────────────────────────────────────────────────
📋 CAMPAIGN PREVIEW:
──────────────────────────────────────────────────────────────────
Campaign Name:    Q4 Sales Campaign - Prototype Test
Max Concurrent:   2 calls
Total Leads:      5
Call Delay:       3000ms
──────────────────────────────────────────────────────────────────

📞 Leads to call:
   1. Test Lead 1 - +919529117230
   2. Test Lead 2 - +919529117231
   3. Test Lead 3 - +919529117232
   4. Test Lead 4 - +919529117233
   5. Test Lead 5 - +919529117234
──────────────────────────────────────────────────────────────────

⚠️  WARNING: This will make REAL phone calls!
💡 Make sure voice_agent.py is running in another terminal

⏳ Starting campaign in 5 seconds... (Press Ctrl+C to cancel)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 Campaign Started: Q4 Sales Campaign - Prototype Test
📊 Total Leads: 5
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📞 [CALLING] Test Lead 1 - +919529117230 (Attempt 1)
[Python] 📞 Making outbound call to +919529117230...
[Python] Step 1: Dispatching agent...
[Python] ✓ Agent dispatched to room: outbound-call-a1b2c3d4
[Python] Waiting 5 seconds for agent to connect...

📞 [CALLING] Test Lead 2 - +919529117231 (Attempt 1)
[Python] 📞 Making outbound call to +919529117231...
[Python] Step 1: Dispatching agent...
...

✅ [SUCCESS] Test Lead 1 - +919529117230
   ├─ Room: outbound-call-a1b2c3d4
   ├─ Dispatch: AD_xyz123
   └─ Duration: 8234ms

📞 [CALLING] Test Lead 3 - +919529117232 (Attempt 1)
...

══════════════════════════════════════════════════════════════════
🎉 Campaign Completed: Q4 Sales Campaign - Prototype Test
══════════════════════════════════════════════════════════════════
📊 FINAL RESULTS:
   ├─ Total Leads:     5
   ├─ ✅ Completed:    4 (80%)
   ├─ ❌ Failed:       1 (20%)
   └─ ⏱️  Duration:     1m 23s
══════════════════════════════════════════════════════════════════
```

---

## 🔧 Configuration

Edit `test-campaign.js` to customize:

```javascript
const campaign = new CampaignQueue({
  campaignName: 'Your Campaign Name',
  maxConcurrent: 2,      // Max parallel calls (2-5 recommended)
  retryFailed: false,    // Retry failed calls?
  retryAttempts: 1,      // How many times?
  callDelay: 3000,       // Delay between calls (ms)
});
```

---

## 🐛 Troubleshooting

### **Issue:** Python errors

**Solution:**
```bash
# Check Python path
which python  # Should be: test_sip/venv/bin/python

# Update .env if needed
PYTHON_PATH=../venv/bin/python
PYTHON_SCRIPT_PATH=../test_outbound.py
```

### **Issue:** voice_agent.py not running

**Solution:**
```bash
# Start it in another terminal
cd test_sip
python voice_agent.py dev

# Wait for: "registered worker"
```

### **Issue:** No calls initiated

**Solution:**
- Check LiveKit credentials in `.env.local`
- Check Twilio trunk ID: `LIVEKIT_OUTBOUND_TRUNK_ID`
- Check `test-leads.json` has valid phone numbers

### **Issue:** Calls fail immediately

**Solution:**
- Invalid phone number format (must be E.164: +1234567890)
- LiveKit trunk not configured
- Twilio account issue

---

## 📊 What You'll Learn

By running this prototype, you'll see:

1. ✅ **Queue Management** - How leads move through the queue
2. ✅ **Concurrency Control** - Max X calls at once works
3. ✅ **Node.js → Python Integration** - Child process spawning
4. ✅ **Real-time Status** - Live updates as calls progress
5. ✅ **Error Handling** - Failed calls are tracked
6. ✅ **Campaign Flow** - Start → Process → Complete

---

## 🎯 Next Steps

After validating the prototype:

1. ✅ **You confirmed the logic works**
2. ➡️ **Build full APIs** (Phase 2-7)
   - Campaign CRUD
   - Lead management + CSV upload
   - Agent management
   - Webhook handler
   - Scheduler
   - Analytics

3. ➡️ **Add database persistence**
   - Store campaigns, leads, call logs
   - Track status in DB
   - Historical data

4. ➡️ **Add production features**
   - Bull queue (Redis-based)
   - Better retry logic
   - Rate limiting
   - Monitoring

---

## 💡 Tips

- **Start small:** Test with 2-3 leads first
- **Use test numbers:** Don't call real customers yet!
- **Monitor logs:** Watch Winston logs in `logs/combined.log`
- **Adjust concurrency:** Start with `maxConcurrent: 2`
- **Check costs:** Each call costs money (Twilio + LiveKit)

---

## 🎉 Success Criteria

You'll know it works when:

- ✅ Calls are initiated in order
- ✅ Max concurrent limit is respected
- ✅ Phones actually ring
- ✅ Calls complete or fail gracefully
- ✅ Final stats are accurate

---

**Ready to test? Run:** `npm run test:campaign`
