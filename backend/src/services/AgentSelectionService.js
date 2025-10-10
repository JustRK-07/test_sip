/**
 * Agent Selection Service
 * Handles intelligent agent selection with rotation, load balancing, and fallback
 */

const { getPrismaClient } = require('../config/prisma');
const logger = require('../utils/logger');

const prisma = getPrismaClient();

/**
 * Agent Selection Strategies
 */
const SELECTION_STRATEGIES = {
  PRIMARY_FIRST: 'primary_first',      // Always use primary, fallback to others
  ROUND_ROBIN: 'round_robin',          // Rotate through all agents
  LEAST_LOADED: 'least_loaded',        // Select agent with fewest active calls
  RANDOM: 'random',                     // Random selection
};

class AgentSelectionService {
  constructor() {
    // Track current agent index for round-robin (per campaign)
    this.roundRobinIndex = new Map();

    // Track active calls per agent (for load balancing)
    this.activeCallsPerAgent = new Map();
  }

  /**
   * Select best agent for a campaign call
   * @param {string} campaignId Campaign ID
   * @param {string} strategy Selection strategy (default: primary_first)
   * @returns {Promise<Object|null>} Selected agent or null
   */
  async selectAgentForCampaign(campaignId, strategy = SELECTION_STRATEGIES.PRIMARY_FIRST) {
    try {
      // Get all agents assigned to this campaign
      const campaignAgents = await prisma.campaignAgent.findMany({
        where: {
          campaignId,
          agent: {
            isActive: true  // Only active agents
          }
        },
        include: {
          agent: true
        },
        orderBy: [
          { isPrimary: 'desc' },  // Primary agents first
          { createdAt: 'asc' }     // Then by creation order
        ]
      });

      if (campaignAgents.length === 0) {
        logger.warn(`No agents assigned to campaign ${campaignId}`);
        return this._getFallbackAgent();
      }

      // Select agent based on strategy
      let selectedAgent = null;

      switch (strategy) {
        case SELECTION_STRATEGIES.PRIMARY_FIRST:
          selectedAgent = this._selectPrimaryFirst(campaignAgents);
          break;

        case SELECTION_STRATEGIES.ROUND_ROBIN:
          selectedAgent = this._selectRoundRobin(campaignId, campaignAgents);
          break;

        case SELECTION_STRATEGIES.LEAST_LOADED:
          selectedAgent = this._selectLeastLoaded(campaignAgents);
          break;

        case SELECTION_STRATEGIES.RANDOM:
          selectedAgent = this._selectRandom(campaignAgents);
          break;

        default:
          selectedAgent = this._selectPrimaryFirst(campaignAgents);
      }

      // Check if selected agent can handle more calls
      if (selectedAgent && !this._canAgentTakeCall(selectedAgent)) {
        logger.warn(`Agent ${selectedAgent.name} at max capacity, selecting another`);
        // Try to find another available agent
        const availableAgent = campaignAgents.find(ca =>
          ca.agent.id !== selectedAgent.id &&
          this._canAgentTakeCall(ca.agent)
        );

        if (availableAgent) {
          selectedAgent = availableAgent.agent;
        } else {
          logger.warn(`All campaign agents at capacity, using fallback`);
          return this._getFallbackAgent();
        }
      }

      logger.info(`Selected agent: ${selectedAgent?.name} (strategy: ${strategy})`);
      return selectedAgent;

    } catch (error) {
      logger.error('Error selecting agent:', error);
      return this._getFallbackAgent();
    }
  }

  /**
   * Select agent for inbound call (phone number based)
   * @param {Object} phoneNumber Phone number object with campaign
   * @returns {Promise<string>} Agent name
   */
  async selectAgentForInbound(phoneNumber) {
    try {
      // If phone number has campaign with agents
      if (phoneNumber.campaignId) {
        const agent = await this.selectAgentForCampaign(
          phoneNumber.campaignId,
          SELECTION_STRATEGIES.LEAST_LOADED  // Use least loaded for inbound
        );

        if (agent) {
          logger.info(`Using campaign agent: ${agent.name} (LiveKit: ${agent.livekitAgentName || agent.name})`);
          return agent.livekitAgentName || agent.name;
        }
      }

      // Fallback to campaign.agentName if exists (backward compatibility)
      if (phoneNumber.campaign?.agentName) {
        logger.info(`Using campaign agentName: ${phoneNumber.campaign.agentName}`);
        return phoneNumber.campaign.agentName;
      }

      // Fallback to tenant default agent
      const defaultAgent = await prisma.agent.findFirst({
        where: {
          isActive: true
        },
        orderBy: {
          createdAt: 'asc'
        }
      });

      if (defaultAgent) {
        logger.info(`Using tenant default agent: ${defaultAgent.name} (LiveKit: ${defaultAgent.livekitAgentName || defaultAgent.name})`);
        return defaultAgent.livekitAgentName || defaultAgent.name;
      }

      // System default
      logger.info('Using system default agent: telephony-agent');
      return 'telephony-agent';

    } catch (error) {
      logger.error('Error selecting inbound agent:', error);
      return 'telephony-agent';
    }
  }

  /**
   * Primary First Strategy: Use primary agent, fallback to others
   */
  _selectPrimaryFirst(campaignAgents) {
    // Try primary agent first
    const primaryAgent = campaignAgents.find(ca => ca.isPrimary);
    if (primaryAgent && this._canAgentTakeCall(primaryAgent.agent)) {
      return primaryAgent.agent;
    }

    // Fallback to any available agent
    const availableAgent = campaignAgents.find(ca =>
      this._canAgentTakeCall(ca.agent)
    );

    return availableAgent?.agent || campaignAgents[0]?.agent;
  }

  /**
   * Round Robin Strategy: Rotate through agents
   */
  _selectRoundRobin(campaignId, campaignAgents) {
    if (!this.roundRobinIndex.has(campaignId)) {
      this.roundRobinIndex.set(campaignId, 0);
    }

    const currentIndex = this.roundRobinIndex.get(campaignId);
    const selectedAgent = campaignAgents[currentIndex % campaignAgents.length];

    // Increment for next call
    this.roundRobinIndex.set(campaignId, currentIndex + 1);

    return selectedAgent.agent;
  }

  /**
   * Least Loaded Strategy: Select agent with fewest active calls
   */
  _selectLeastLoaded(campaignAgents) {
    let leastLoadedAgent = null;
    let minCalls = Infinity;

    for (const ca of campaignAgents) {
      const activeCalls = this.activeCallsPerAgent.get(ca.agent.id) || 0;

      if (activeCalls < minCalls && activeCalls < ca.agent.maxConcurrentCalls) {
        minCalls = activeCalls;
        leastLoadedAgent = ca.agent;
      }
    }

    // If all at capacity, return first one
    return leastLoadedAgent || campaignAgents[0]?.agent;
  }

  /**
   * Random Strategy: Random agent selection
   */
  _selectRandom(campaignAgents) {
    const randomIndex = Math.floor(Math.random() * campaignAgents.length);
    return campaignAgents[randomIndex].agent;
  }

  /**
   * Check if agent can take another call
   */
  _canAgentTakeCall(agent) {
    const activeCalls = this.activeCallsPerAgent.get(agent.id) || 0;
    return activeCalls < agent.maxConcurrentCalls;
  }

  /**
   * Get fallback agent (system default)
   */
  async _getFallbackAgent() {
    try {
      const fallbackAgent = await prisma.agent.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' }
      });

      if (fallbackAgent) {
        return fallbackAgent;
      }

      // Return mock agent for system default
      return {
        id: 'system-default',
        name: 'telephony-agent',
        isActive: true,
        maxConcurrentCalls: 100
      };
    } catch (error) {
      logger.error('Error getting fallback agent:', error);
      return {
        id: 'system-default',
        name: 'telephony-agent',
        isActive: true,
        maxConcurrentCalls: 100
      };
    }
  }

  /**
   * Increment active call count for agent
   */
  incrementActiveCall(agentId) {
    const current = this.activeCallsPerAgent.get(agentId) || 0;
    this.activeCallsPerAgent.set(agentId, current + 1);
    logger.debug(`Agent ${agentId} active calls: ${current + 1}`);
  }

  /**
   * Decrement active call count for agent
   */
  decrementActiveCall(agentId) {
    const current = this.activeCallsPerAgent.get(agentId) || 0;
    const newCount = Math.max(0, current - 1);
    this.activeCallsPerAgent.set(agentId, newCount);
    logger.debug(`Agent ${agentId} active calls: ${newCount}`);
  }

  /**
   * Get agent load statistics
   */
  getAgentLoadStats() {
    const stats = {};
    for (const [agentId, calls] of this.activeCallsPerAgent.entries()) {
      stats[agentId] = calls;
    }
    return stats;
  }

  /**
   * Reset agent load tracking (for testing)
   */
  resetLoadTracking() {
    this.activeCallsPerAgent.clear();
    this.roundRobinIndex.clear();
    logger.info('Agent load tracking reset');
  }

  /**
   * Get available agents for campaign
   */
  async getAvailableAgents(campaignId) {
    const campaignAgents = await prisma.campaignAgent.findMany({
      where: {
        campaignId,
        agent: {
          isActive: true
        }
      },
      include: {
        agent: true
      },
      orderBy: [
        { isPrimary: 'desc' },
        { createdAt: 'asc' }
      ]
    });

    return campaignAgents.map(ca => ({
      ...ca.agent,
      isPrimary: ca.isPrimary,
      activeCalls: this.activeCallsPerAgent.get(ca.agent.id) || 0,
      available: this._canAgentTakeCall(ca.agent)
    }));
  }

  /**
   * Set agent selection strategy for campaign
   * Stores in campaign metadata
   */
  async setStrategyForCampaign(campaignId, strategy) {
    if (!Object.values(SELECTION_STRATEGIES).includes(strategy)) {
      throw new Error(`Invalid strategy: ${strategy}`);
    }

    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        metadata: JSON.stringify({
          agentSelectionStrategy: strategy
        })
      }
    });

    logger.info(`Campaign ${campaignId} strategy set to: ${strategy}`);
  }

  /**
   * Get agent selection strategy for campaign
   */
  async getStrategyForCampaign(campaignId) {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { metadata: true }
    });

    if (campaign?.metadata) {
      try {
        const metadata = JSON.parse(campaign.metadata);
        return metadata.agentSelectionStrategy || SELECTION_STRATEGIES.PRIMARY_FIRST;
      } catch (error) {
        logger.warn('Error parsing campaign metadata:', error);
      }
    }

    return SELECTION_STRATEGIES.PRIMARY_FIRST;
  }
}

// Export singleton instance
module.exports = new AgentSelectionService();
module.exports.SELECTION_STRATEGIES = SELECTION_STRATEGIES;
