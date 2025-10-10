/**
 * Campaign Queue Service (Prototype)
 * Manages call queue with concurrency control
 */

const EventEmitter = require('events');
const logger = require('../utils/logger');
const LiveKitExecutor = require('./LiveKitExecutor');
const AgentSelectionService = require('./AgentSelectionService');

class CampaignQueue extends EventEmitter {
  constructor(options = {}) {
    super();

    this.campaignId = options.campaignId;
    this.campaignName = options.campaignName || 'Test Campaign';
    this.maxConcurrent = options.maxConcurrent || 3;
    this.retryFailed = options.retryFailed || false;
    this.retryAttempts = options.retryAttempts || 2;
    this.callDelay = options.callDelay || 2000; // 2 seconds between calls

    // LiveKit/SIP Configuration
    this.agentName = options.agentName || 'telephony-agent'; // Fallback for backward compatibility
    this.sipTrunkId = options.sipTrunkId;
    this.callerIdNumber = options.callerIdNumber;

    // Agent selection strategy (default: primary_first)
    this.agentSelectionStrategy = options.agentSelectionStrategy || AgentSelectionService.SELECTION_STRATEGIES.PRIMARY_FIRST;

    // Queues
    this.pendingLeads = [];
    this.activeLeads = new Map(); // leadId -> callPromise
    this.completedLeads = [];
    this.failedLeads = [];

    // Stats
    this.stats = {
      total: 0,
      pending: 0,
      active: 0,
      completed: 0,
      failed: 0,
      startTime: null,
      endTime: null,
    };

    // State
    this.isRunning = false;
    this.isPaused = false;

    // Services
    this.livekitExecutor = new LiveKitExecutor();

    logger.info(`📋 CampaignQueue initialized: "${this.campaignName}"`, {
      campaignId: this.campaignId,
      maxConcurrent: this.maxConcurrent,
      retryFailed: this.retryFailed,
      retryAttempts: this.retryAttempts,
      agentName: this.agentName,
      sipTrunkId: this.sipTrunkId,
    });
  }

  /**
   * Add leads to the campaign
   * @param {Array} leads - Array of lead objects {id, phoneNumber, name, ...}
   */
  addLeads(leads) {
    const leadsWithMetadata = leads.map((lead, index) => ({
      id: lead.id || `lead-${Date.now()}-${index}`, // Use database ID if available
      phoneNumber: lead.phoneNumber,
      name: lead.name || 'Unknown',
      priority: lead.priority || 0,
      metadata: lead.metadata || {},
      status: 'pending',
      attempts: 0,
      createdAt: new Date(),
    }));

    this.pendingLeads.push(...leadsWithMetadata);
    this.stats.total = this.pendingLeads.length;
    this.stats.pending = this.pendingLeads.length;

    logger.info(`✅ Added ${leads.length} leads to campaign`, {
      totalLeads: this.stats.total,
    });

    this.emit('leads_added', { count: leads.length, total: this.stats.total });

    return leadsWithMetadata;
  }

  /**
   * Start processing the campaign
   */
  async start() {
    if (this.isRunning) {
      logger.warn('Campaign is already running');
      return;
    }

    if (this.pendingLeads.length === 0) {
      logger.warn('No leads to process');
      return;
    }

    this.isRunning = true;
    this.isPaused = false;
    this.stats.startTime = new Date();

    logger.info('═'.repeat(60));
    logger.info(`🚀 Starting Campaign: "${this.campaignName}"`);
    logger.info('═'.repeat(60));
    logger.info(`📊 Campaign Stats:`, {
      totalLeads: this.stats.total,
      maxConcurrent: this.maxConcurrent,
    });
    logger.info('═'.repeat(60));

    this.emit('campaign_started', {
      campaignName: this.campaignName,
      totalLeads: this.stats.total,
    });

    // Start processing loop
    await this.processQueue();
  }

  /**
   * Main queue processing loop
   */
  async processQueue() {
    while (this.isRunning && !this.isPaused) {
      // Check if we can start more calls
      if (
        this.activeLeads.size < this.maxConcurrent &&
        this.pendingLeads.length > 0
      ) {
        // Get next lead
        const lead = this.pendingLeads.shift();

        // Update stats
        this.stats.pending = this.pendingLeads.length;
        this.stats.active = this.activeLeads.size + 1;

        // Start call
        this.startCall(lead);

        // Wait before starting next call (prevent overwhelming system)
        await this.sleep(this.callDelay);
      } else if (this.activeLeads.size === 0 && this.pendingLeads.length === 0) {
        // All calls completed
        break;
      } else {
        // Wait for active calls to finish
        await this.sleep(1000);
      }
    }

    // Campaign finished
    if (!this.isPaused) {
      await this.finish();
    }
  }

  /**
   * Start a call for a lead
   * @param {object} lead
   */
  async startCall(lead) {
    lead.status = 'calling';
    lead.attempts++;

    logger.info(`📞 Calling ${lead.name} (${lead.phoneNumber})`, {
      attempt: lead.attempts,
      activeCallsslots: `${this.activeLeads.size + 1}/${this.maxConcurrent}`,
      remainingLeads: this.pendingLeads.length,
    });

    this.emit('call_started', { lead });

    // Generate unique room name
    const roomName = this.livekitExecutor.generateRoomName(this.campaignId || 'unknown');

    // Select agent dynamically for this call
    let selectedAgent = null;
    let agentName = this.agentName; // Default fallback

    if (this.campaignId) {
      try {
        selectedAgent = await AgentSelectionService.selectAgentForCampaign(
          this.campaignId,
          this.agentSelectionStrategy
        );

        if (selectedAgent) {
          agentName = selectedAgent.livekitAgentName || selectedAgent.name;
          logger.info(`🤖 Selected agent: ${selectedAgent.name} (LiveKit: ${agentName}, ID: ${selectedAgent.id})`);

          // Track active call for this agent
          AgentSelectionService.incrementActiveCall(selectedAgent.id);
          lead.agentId = selectedAgent.id; // Store for cleanup
        }
      } catch (error) {
        logger.warn(`Failed to select agent, using fallback: ${agentName}`, error);
      }
    }

    // Create call promise using LiveKitExecutor (faster, direct API call)
    const callPromise = this.livekitExecutor
      .makeCall(lead.phoneNumber, this.sipTrunkId, roomName, agentName)
      .then((result) => {
        // Call succeeded
        lead.status = 'completed';
        lead.result = result;
        lead.completedAt = new Date();

        this.completedLeads.push(lead);
        this.stats.completed++;

        logger.info(`✅ Call completed: ${lead.name} (${lead.phoneNumber})`, {
          duration: result.duration,
          roomName: result.roomName,
          participantId: result.participantId,
        });

        this.emit('call_completed', { lead, result });
      })
      .catch((error) => {
        // Call failed
        lead.status = 'failed';
        lead.error = error;
        lead.failedAt = new Date();

        logger.error(`❌ Call failed: ${lead.name} (${lead.phoneNumber})`, {
          error: error.error || error.message,
          attempt: lead.attempts,
        });

        // Retry logic
        if (this.retryFailed && lead.attempts < this.retryAttempts) {
          logger.info(`🔄 Retrying ${lead.name} (Attempt ${lead.attempts + 1}/${this.retryAttempts})`);
          lead.status = 'pending';
          this.pendingLeads.push(lead);
          this.stats.pending = this.pendingLeads.length;
        } else {
          this.failedLeads.push(lead);
          this.stats.failed++;
        }

        this.emit('call_failed', { lead, error });
      })
      .finally(() => {
        // Decrement active call count for agent
        if (lead.agentId) {
          AgentSelectionService.decrementActiveCall(lead.agentId);
        }

        // Remove from active calls
        this.activeLeads.delete(lead.id);
        this.stats.active = this.activeLeads.size;
      });

    // Add to active calls
    this.activeLeads.set(lead.id, callPromise);
  }

  /**
   * Finish the campaign
   */
  async finish() {
    this.isRunning = false;
    this.stats.endTime = new Date();

    const duration = this.stats.endTime - this.stats.startTime;
    const durationMinutes = Math.floor(duration / 60000);
    const durationSeconds = Math.floor((duration % 60000) / 1000);

    logger.info('═'.repeat(60));
    logger.info(`🎉 Campaign Completed: "${this.campaignName}"`);
    logger.info('═'.repeat(60));
    logger.info(`📊 Final Stats:`);
    logger.info(`   Total Leads: ${this.stats.total}`);
    logger.info(`   ✅ Completed: ${this.stats.completed}`);
    logger.info(`   ❌ Failed: ${this.stats.failed}`);
    logger.info(`   ⏱️  Duration: ${durationMinutes}m ${durationSeconds}s`);
    logger.info('═'.repeat(60));

    this.emit('campaign_completed', {
      campaignName: this.campaignName,
      stats: this.stats,
      duration: {
        ms: duration,
        formatted: `${durationMinutes}m ${durationSeconds}s`,
      },
    });
  }

  /**
   * Pause the campaign
   */
  pause() {
    if (!this.isRunning) {
      logger.warn('Campaign is not running');
      return;
    }

    this.isPaused = true;
    logger.warn(`⏸️  Campaign paused: "${this.campaignName}"`);
    this.emit('campaign_paused');
  }

  /**
   * Resume the campaign
   */
  async resume() {
    if (!this.isPaused) {
      logger.warn('Campaign is not paused');
      return;
    }

    this.isPaused = false;
    logger.info(`▶️  Campaign resumed: "${this.campaignName}"`);
    this.emit('campaign_resumed');

    await this.processQueue();
  }

  /**
   * Stop the campaign
   */
  stop() {
    this.isRunning = false;
    this.isPaused = false;
    logger.warn(`⏹️  Campaign stopped: "${this.campaignName}"`);
    this.emit('campaign_stopped');
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      campaignName: this.campaignName,
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      stats: {
        ...this.stats,
        active: this.activeLeads.size,
        pending: this.pendingLeads.length,
      },
      activeCalls: Array.from(this.activeLeads.keys()).map((id) => {
        const lead = [
          ...this.pendingLeads,
          ...this.completedLeads,
          ...this.failedLeads,
        ].find((l) => l.id === id);
        return lead ? { id: lead.id, phoneNumber: lead.phoneNumber } : null;
      }),
    };
  }

  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

module.exports = CampaignQueue;
