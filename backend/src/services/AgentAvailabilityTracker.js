/**
 * Agent Availability Tracker
 * Manages agent availability and load balancing
 */

const logger = require('../utils/logger');

class AgentAvailabilityTracker {
  constructor() {
    // Track active calls per agent
    // agentName -> Set of roomNames
    this.activeCallsByAgent = new Map();

    // Agent configurations
    // agentName -> { maxConcurrent, isActive }
    this.agentConfigs = new Map();
  }

  /**
   * Register agents for a campaign
   * @param {Array} agents - Array of agent objects from database
   */
  registerAgents(agents) {
    agents.forEach((agent) => {
      this.agentConfigs.set(agent.name, {
        id: agent.id,
        name: agent.name,
        maxConcurrent: agent.maxConcurrentCalls || 3,
        isActive: agent.isActive,
      });

      // Initialize active calls tracking
      if (!this.activeCallsByAgent.has(agent.name)) {
        this.activeCallsByAgent.set(agent.name, new Set());
      }

      logger.info(`Agent registered: ${agent.name}`, {
        maxConcurrent: agent.maxConcurrentCalls || 3,
        isActive: agent.isActive,
      });
    });
  }

  /**
   * Get available agent for a call
   * Uses least-busy algorithm
   * @returns {string|null} Agent name or null if none available
   */
  getAvailableAgent() {
    let selectedAgent = null;
    let minActiveCalls = Infinity;

    for (const [agentName, config] of this.agentConfigs.entries()) {
      // Skip inactive agents
      if (!config.isActive) {
        continue;
      }

      const activeCalls = this.activeCallsByAgent.get(agentName)?.size || 0;

      // Check if agent has capacity
      if (activeCalls < config.maxConcurrent) {
        // Select agent with least active calls (load balancing)
        if (activeCalls < minActiveCalls) {
          minActiveCalls = activeCalls;
          selectedAgent = agentName;
        }
      }
    }

    if (selectedAgent) {
      logger.info(`Selected agent: ${selectedAgent}`, {
        activeCalls: minActiveCalls,
        maxConcurrent: this.agentConfigs.get(selectedAgent).maxConcurrent,
      });
    } else {
      logger.warn('No available agents found');
    }

    return selectedAgent;
  }

  /**
   * Mark agent as busy (call started)
   * @param {string} agentName - Agent name
   * @param {string} roomName - Room name
   */
  markBusy(agentName, roomName) {
    if (!this.activeCallsByAgent.has(agentName)) {
      this.activeCallsByAgent.set(agentName, new Set());
    }

    this.activeCallsByAgent.get(agentName).add(roomName);

    logger.debug(`Agent marked busy: ${agentName}`, {
      roomName,
      activeCalls: this.activeCallsByAgent.get(agentName).size,
    });
  }

  /**
   * Mark agent as available (call ended)
   * @param {string} agentName - Agent name
   * @param {string} roomName - Room name
   */
  markAvailable(agentName, roomName) {
    const activeCalls = this.activeCallsByAgent.get(agentName);
    if (activeCalls) {
      activeCalls.delete(roomName);

      logger.debug(`Agent marked available: ${agentName}`, {
        roomName,
        activeCalls: activeCalls.size,
      });
    }
  }

  /**
   * Get agent statistics
   * @returns {Array} Agent stats
   */
  getStats() {
    const stats = [];

    for (const [agentName, config] of this.agentConfigs.entries()) {
      const activeCalls = this.activeCallsByAgent.get(agentName)?.size || 0;

      stats.push({
        name: agentName,
        isActive: config.isActive,
        activeCalls,
        maxConcurrent: config.maxConcurrent,
        utilization: ((activeCalls / config.maxConcurrent) * 100).toFixed(1) + '%',
        available: config.isActive && activeCalls < config.maxConcurrent,
      });
    }

    return stats;
  }

  /**
   * Check if any agent is available
   * @returns {boolean}
   */
  hasAvailableAgent() {
    return this.getAvailableAgent() !== null;
  }

  /**
   * Reset tracker (for testing or campaign restart)
   */
  reset() {
    this.activeCallsByAgent.clear();
    logger.info('Agent availability tracker reset');
  }
}

module.exports = AgentAvailabilityTracker;
