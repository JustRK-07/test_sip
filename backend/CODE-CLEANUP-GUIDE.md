# Code Cleanup & Technical Debt Guide

**Last Updated:** 2025-10-08
**Purpose:** Track unused code, architectural inconsistencies, and cleanup tasks to prevent codebase bloat

---

## 🎯 Quick Summary

| Status | Count | Priority |
|--------|-------|----------|
| **Unused Files** | 1 | 🔴 High |
| **Unused Dependencies** | 2 | 🟡 Medium |
| **Unused DB Fields** | 6 | 🟢 Low |
| **Architectural Mismatches** | 3 | 🟡 Medium |
| **Missing Implementations** | 3 | 🟡 Medium |

**Total Technical Debt Items:** 15

---

## 🔴 HIGH PRIORITY - Immediate Action Required

### 1. AgentAvailabilityTracker.js - Completely Unused ⚠️

**Status:** 🔴 CRITICAL - Fully implemented but never used

**Location:** `src/services/AgentAvailabilityTracker.js`

**Details:**
- File size: 4KB, 159 lines of code
- Purpose: Load balancing for multi-agent campaigns
- Zero imports/references in entire codebase
- Documented in AGENT-AVAILABILITY-GUIDE.md as required

**Decision Required:**
```
[ ] Option A: Integrate into CampaignQueue (recommended if multi-agent support needed)
    - Update CampaignQueue.js constructor to initialize tracker
    - Modify startCall() to use getAvailableAgent()
    - Add agent stats endpoint

[ ] Option B: Delete file and related documentation
    - Remove AgentAvailabilityTracker.js
    - Update AGENT-AVAILABILITY-GUIDE.md (mark as future feature)
    - Remove checklist item from line 464-468
```

**Impact:** High - Wasted development effort, confusing documentation

**Estimated Cleanup Time:** 2-3 hours (Option A) or 15 minutes (Option B)

---

### 2. Winston Logger EPIPE Errors

**Status:** 🔴 CRITICAL - Causing error log spam

**Location:** `logs/error.log` (30+ repeated errors)

**Issue:**
```javascript
Error: write EPIPE
at Console.log (winston/lib/winston/transports/console.js:87:23)
```

**Root Cause:** Winston console transport not handling process interruption gracefully

**Fix Required:**
```javascript
// In: src/utils/logger.js
// Add error handling to console transport

const consoleTransport = new winston.transports.Console({
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.simple()
  ),
  handleExceptions: true,
  handleRejections: true
});

// Add error handler
consoleTransport.on('error', (error) => {
  if (error.code === 'EPIPE') {
    // Ignore EPIPE errors (broken pipe when process exits)
    return;
  }
  console.error('Console transport error:', error);
});
```

**Estimated Fix Time:** 15-30 minutes

---

## 🟡 MEDIUM PRIORITY - Should Address Soon

### 3. Bull Queue System - Installed but Not Used

**Status:** 🟡 UNUSED

**Packages:**
- `bull` (v4.16.5) - 0 imports
- `redis` (v5.8.3) - Only used for shutdown hook

**Location:** `src/config/redis.js` (50 lines, only called once in server.js:36)

**Current Approach:** In-memory CampaignQueue with EventEmitter

**Decision Required:**
```
[ ] Option A: Implement Bull queue for production scalability
    - Create job processors for campaigns
    - Add queue monitoring dashboard
    - Implement job retry and failure handling
    - Enable distributed campaigns across multiple servers

[ ] Option B: Remove Bull/Redis dependencies (if staying single-server)
    - npm uninstall bull redis
    - Delete src/config/redis.js
    - Remove redis imports from server.js
```

**Trade-offs:**
- Bull: Better for production, horizontal scaling, persistence
- EventEmitter: Simpler, faster, sufficient for single-server setups

**Estimated Cleanup Time:** 1 hour (Option B) or 1-2 days (Option A)

---

### 4. node-cron Scheduler - Not Implemented

**Status:** 🟡 MISSING FEATURE

**Package:** `node-cron` (v4.16.5) - Zero imports

**Impact:** `scheduledAt` field in database but no scheduler to process it

**Location:** Campaign.scheduledAt exists at `prisma/schema.prisma:31`

**Missing Implementation:**
```javascript
// Need to create: src/services/CampaignScheduler.js

const cron = require('node-cron');

class CampaignScheduler {
  constructor() {
    // Run every minute to check for scheduled campaigns
    this.task = cron.schedule('* * * * *', async () => {
      await this.checkScheduledCampaigns();
    });
  }

  async checkScheduledCampaigns() {
    const now = new Date();
    const campaigns = await prisma.campaign.findMany({
      where: {
        status: 'scheduled',
        scheduledAt: { lte: now }
      }
    });

    for (const campaign of campaigns) {
      // Start campaign via campaignController.startCampaign()
    }
  }
}
```

**Decision Required:**
```
[ ] Option A: Implement scheduler (if scheduled campaigns needed)
    - Create CampaignScheduler service
    - Initialize in server.js startup
    - Add timezone support
    - Test scheduled campaign flow

[ ] Option B: Remove scheduling feature
    - Remove scheduledAt from schema
    - Run prisma migration
    - Remove from validation schemas
    - Remove from API documentation
    - npm uninstall node-cron
```

**Estimated Implementation Time:** 4-6 hours (Option A) or 1 hour (Option B)

---

### 5. Explicit Dispatch vs Dispatch Rules - Architecture Mismatch

**Status:** 🟡 INCONSISTENT

**Documentation Says:** Use dispatch rules (1 second, simpler)
- CURRENT-ARCHITECTURE.md:143 recommends dispatch rules

**Code Actually Does:** Explicit dispatch (2.6 seconds)
- LiveKitExecutor.js:92-110 uses `agentDispatch.createDispatch()`

**Performance Impact:** 62% slower than documented approach

**Fix Options:**
```
[ ] Option A: Switch to dispatch rules (recommended for single-agent campaigns)
    File: src/services/LiveKitExecutor.js

    async makeCall(phoneNumber, sipTrunkId, roomName, agentName, callerIdNumber) {
      // Remove lines 92-110 (dispatch code)
      // Keep only SIP participant creation

      const sipParticipantInfo = await this.sipClient.createSipParticipant(
        sipTrunkId,
        phoneNumber,
        roomName,
        sipOptions
      );
      // Agent auto-joins via dispatch rules
    }

    Requirements:
    - Configure dispatch rules in LiveKit Dashboard
    - Set room pattern: "outbound-*"
    - Enable auto-join for agent

[ ] Option X: Keep explicit dispatch (if using AgentAvailabilityTracker)
    - Update documentation to reflect explicit dispatch
    - Explain multi-agent use case
    - Accept 2.6s performance for dynamic agent selection
```

**Estimated Fix Time:** 30 minutes (Option A) or update docs only

---

### 6. dispatchId - Deprecated but Still Used

**Status:** 🟡 INCONSISTENT

**Documentation Says:**
- CURRENT-ARCHITECTURE.md:227 - "dispatchId - Still in schema but not used (can be removed)"

**Code Reality:**
- LiveKitExecutor.js actively returns dispatchId (lines 107, 119, 142, 155)
- campaignController.js saves to CallLog (line 390)
- Prisma schema includes it (schema.prisma:134)

**Decision Required:**
```
[ ] Option A: Remove dispatchId completely (if using dispatch rules)
    1. Remove from LiveKitExecutor return values
    2. Remove from campaignController CallLog creation
    3. Create migration: remove CallLog.dispatchId
    4. Update CURRENT-ARCHITECTURE.md

[ ] Option B: Keep dispatchId (if using explicit dispatch)
    1. Update CURRENT-ARCHITECTURE.md to mark as ACTIVE
    2. Document its purpose clearly
    3. Add to webhook tracking
```

**Estimated Cleanup Time:** 45 minutes

---

## 🟢 LOW PRIORITY - Nice to Have

### 7. Unused Database Fields

**Location:** `prisma/schema.prisma`

| Field | Line | Status | Action |
|-------|------|--------|--------|
| `CallLog.recordingUrl` | 139 | Never populated | [ ] Implement webhook or remove |
| `CallLog.dispatchId` | 134 | See item #6 above | [ ] Decision pending |
| `Agent.voiceId` | 58 | Stored, never used | [ ] Pass to LiveKit or remove |
| `Agent.personality` | 59 | Stored, never used | [ ] Pass to agent prompt or remove |
| `Agent.systemPrompt` | 60 | Stored, never used | [ ] Pass to agent or remove |
| `Campaign.scheduledAt` | 31 | See item #4 above | [ ] Decision pending |

**Recommendation:** Audit each field
- If implementing: Add to LiveKitExecutor or agent config
- If removing: Create migration, update API, test thoroughly

**Estimated Cleanup Time:** 2-3 hours for full audit

---

### 8. Python Service Redundancy

**Status:** 🟢 ACCEPTABLE (Different purposes)

**Python Side** (Agent runtime - NEEDED):
```
✅ agent/agent.py           - LiveKit agent implementation
✅ agent/assistant.py       - Agent behavior/personality
✅ agent/handlers.py        - Event handlers
❓ services/dispatch_service.py  - Redundant with Node.js?
❓ services/sip_manager.py       - Redundant with Node.js?
```

**Node.js Side** (API backend):
```
✅ backend/src/services/LiveKitExecutor.js
✅ backend/src/services/CampaignQueue.js
```

**Recommendation:**
```
[ ] Clarify separation of concerns
    - Python: Only for agent runtime (keep agent/*)
    - Node.js: Only for API/campaigns (keep backend/*)
    - Delete services/dispatch_service.py if not used by Python agent
    - Delete services/sip_manager.py if not used by Python agent
```

**Estimated Cleanup Time:** 30 minutes review + 15 minutes deletion

---

### 9. Empty Uploads Directory

**Status:** 🟢 WORKING AS INTENDED

**Location:** `backend/uploads/` (empty)

**Purpose:** Temporary storage for CSV uploads via multer

**Issue:** No explicit cleanup mechanism mentioned

**Recommendation:**
```javascript
// Add to leadController.js after processing CSV

const fs = require('fs').promises;

// After line 285 (successful upload)
try {
  await fs.unlink(req.file.path);
  logger.debug(`Deleted temporary file: ${req.file.path}`);
} catch (err) {
  logger.warn(`Failed to delete temp file: ${err.message}`);
}

// Also add cleanup cron job
// In server.js or new cleanup service
const cron = require('node-cron');

// Clean up uploads folder daily at 2 AM
cron.schedule('0 2 * * *', async () => {
  const uploadsDir = path.join(__dirname, '../uploads');
  const files = await fs.readdir(uploadsDir);
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

  for (const file of files) {
    const filePath = path.join(uploadsDir, file);
    const stats = await fs.stat(filePath);
    if (stats.mtimeMs < oneDayAgo) {
      await fs.unlink(filePath);
    }
  }
});
```

**Estimated Implementation Time:** 30 minutes

---

## 📋 MISSING IMPLEMENTATIONS (Roadmap Items)

### 10. Webhook Handler - Phase 7

**Status:** 🟡 NOT IMPLEMENTED

**Mentioned In:**
- backend/README.md:257 (Roadmap Phase 7)
- API-DOCUMENTATION.md endpoint listed

**Missing Endpoint:** `POST /api/v1/webhooks/twilio/status`

**Purpose:**
- Receive call status updates from Twilio
- Update CallLog with duration, recording URLs, final status
- Trigger campaign completion events

**Implementation Checklist:**
```
[ ] Create src/controllers/webhookController.js
[ ] Add webhook route to src/routes/webhookRoutes.js
[ ] Implement signature verification for Twilio
[ ] Update CallLog on call completion
[ ] Handle call events: answered, completed, no-answer, busy, failed
[ ] Update Campaign statistics
[ ] Emit events for real-time updates
[ ] Add webhook URL to Twilio SIP trunk configuration
[ ] Test with Twilio simulator
```

**Estimated Implementation Time:** 4-6 hours

---

### 11. Campaign Scheduler - Phase 8

**Status:** 🟡 NOT IMPLEMENTED (See item #4 above)

---

### 12. Analytics Dashboard - Phase 9

**Status:** 🟡 NOT IMPLEMENTED

**Missing Endpoint:** `GET /api/v1/analytics/dashboard`

**Purpose:**
- Overview metrics across all campaigns
- Call volume trends
- Success/failure rates
- Agent performance metrics

**Implementation Checklist:**
```
[ ] Create src/controllers/analyticsController.js
[ ] Add analytics routes
[ ] Aggregate campaign statistics
[ ] Calculate metrics:
    - Total calls (today, week, month)
    - Success rate
    - Average call duration
    - Peak calling times
    - Agent utilization
[ ] Add date range filtering
[ ] Create dashboard endpoint
[ ] Consider caching for performance
```

**Estimated Implementation Time:** 6-8 hours

---

## 🔍 VALIDATION & SAFETY CHECKS

### Before Deleting Any Code

Run these checks to ensure code is truly unused:

```bash
# 1. Check for imports/requires
cd backend
grep -r "AgentAvailabilityTracker" src/

# 2. Check for string references
grep -r "AgentAvailability" src/

# 3. Check tests (if they exist)
grep -r "AgentAvailability" test/ 2>/dev/null

# 4. Check documentation references
grep -r "AgentAvailability" *.md

# 5. Git history check (see if recently used)
git log --all --oneline --grep="AgentAvailability"
git log --all --oneline -- src/services/AgentAvailabilityTracker.js
```

### Before Removing Dependencies

```bash
# Check if dependency is imported anywhere
cd backend
grep -r "require.*bull" src/
grep -r "require.*node-cron" src/
grep -r "require.*redis" src/

# Check package.json scripts
grep -E "bull|cron|redis" package.json
```

---

## 📊 Cleanup Impact Analysis

### If All High Priority Items Fixed

**Benefits:**
- Remove 159 lines of unused code
- Fix 30+ error log entries
- Improve code maintainability
- Clear architectural confusion

**Risks:**
- May need multi-agent feature later (keep AgentAvailabilityTracker commented?)
- Breaking changes if dispatchId removal impacts external systems

### If All Medium Priority Items Fixed

**Benefits:**
- Remove 2 unused npm packages (~5MB)
- Resolve architectural inconsistencies
- Clear feature roadmap

**Package Size Reduction:**
```
bull: ~2.5MB
redis: ~2.5MB
node-cron: ~500KB
Total savings: ~5.5MB
```

---

## ✅ CLEANUP CHECKLIST

### Phase 1: Critical Fixes (Est. 3-4 hours)
```
[ ] Fix Winston EPIPE errors
[ ] Decide on AgentAvailabilityTracker (integrate or delete)
[ ] Update CURRENT-ARCHITECTURE.md to match reality
```

### Phase 2: Dependency Cleanup (Est. 2-3 hours)
```
[ ] Remove Bull/Redis OR implement job queue
[ ] Remove node-cron OR implement scheduler
[ ] Update package.json
[ ] Test application startup and campaigns
```

### Phase 3: Architecture Alignment (Est. 2-3 hours)
```
[ ] Choose: Dispatch rules vs explicit dispatch
[ ] Update LiveKitExecutor accordingly
[ ] Decide on dispatchId field
[ ] Update documentation
```

### Phase 4: Database Cleanup (Est. 2-3 hours)
```
[ ] Audit unused database fields
[ ] Create migration for removals
[ ] Test CRUD operations
[ ] Update API documentation
```

### Phase 5: Missing Features (Est. 12-16 hours)
```
[ ] Implement webhook handler
[ ] Implement scheduler (if needed)
[ ] Implement analytics dashboard (if needed)
[ ] Update roadmap in README
```

---

## 📝 DECISION LOG

Track decisions made during cleanup:

| Date | Decision | Rationale | Status |
|------|----------|-----------|--------|
| 2025-10-08 | Created cleanup guide | Initial audit completed | ✅ Done |
| _TBD_ | AgentAvailabilityTracker | [Integrate / Delete] | ⏳ Pending |
| _TBD_ | Bull/Redis | [Implement / Remove] | ⏳ Pending |
| _TBD_ | node-cron | [Implement / Remove] | ⏳ Pending |
| _TBD_ | Dispatch method | [Rules / Explicit] | ⏳ Pending |

---

## 🎓 LESSONS LEARNED

### How This Happened
1. **Feature creep**: Built AgentAvailabilityTracker but never integrated
2. **Over-dependency**: Installed packages for "future features" that never came
3. **Documentation lag**: Architecture docs didn't match implementation
4. **No code reviews**: Unused code slipped through

### Prevention Strategies
```
[ ] Set up pre-commit hooks to detect unused imports
[ ] Regular dependency audits (monthly)
[ ] Keep documentation in sync with code changes
[ ] Remove TODOs older than 30 days
[ ] Implement code coverage tracking
[ ] Use ESLint rule: no-unused-vars
[ ] Review roadmap quarterly, remove or implement items
```

### Recommended Tools
```bash
# Find unused dependencies
npm install -g depcheck
cd backend && depcheck

# Find unused code
npm install -g eslint
eslint src/ --rule 'no-unused-vars: error'

# Find dead code
npm install -g ts-prune  # if using TypeScript
```

---

## 📞 QUICK REFERENCE

### Before Starting Cleanup

```bash
# 1. Create cleanup branch
git checkout -b cleanup/technical-debt

# 2. Backup database
cp backend/prisma/dev.db backend/prisma/dev.db.backup

# 3. Document current state
git add -A
git commit -m "Pre-cleanup snapshot"

# 4. Run tests (if they exist)
cd backend && npm test
```

### After Completing Cleanup

```bash
# 1. Test all critical paths
npm run dev
# Test: Create campaign, add leads, start campaign

# 2. Check for broken imports
grep -r "require.*\.\." src/ | grep -v node_modules

# 3. Verify no broken routes
curl http://localhost:3000/api/v1/campaigns
curl http://localhost:3000/health

# 4. Update documentation
# - README.md
# - CURRENT-ARCHITECTURE.md
# - CODE-CLEANUP-GUIDE.md (this file)

# 5. Commit cleanup
git add -A
git commit -m "chore: cleanup unused code and dependencies"

# 6. Create pull request with checklist
```

---

## 🔗 RELATED DOCUMENTATION

- [CURRENT-ARCHITECTURE.md](./CURRENT-ARCHITECTURE.md) - System architecture
- [AGENT-AVAILABILITY-GUIDE.md](./AGENT-AVAILABILITY-GUIDE.md) - Multi-agent setup
- [README.md](./README.md) - Project roadmap
- [API-DOCUMENTATION.md](./API-DOCUMENTATION.md) - API endpoints

---

**Last Review Date:** 2025-10-08
**Next Review Due:** 2025-11-08
**Reviewer:** _[Your Name]_

---

## 📌 NOTES

Add any additional observations here:

- [ ] Consider adding integration tests before major refactoring
- [ ] Set up CI/CD to catch unused imports automatically
- [ ] Review this document monthly to prevent accumulation
- [ ] Keep this file updated as cleanup progresses

---

**END OF DOCUMENT**
