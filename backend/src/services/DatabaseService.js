const { getPrismaClient } = require('../config/prisma');

/**
 * Service class for database operations
 * Centralizes common database patterns and operations
 */
class DatabaseService {
  constructor() {
    this.prisma = getPrismaClient();
  }

  /**
   * Get Prisma client instance
   * @returns {PrismaClient} Prisma client instance
   */
  getClient() {
    return this.prisma;
  }

  /**
   * Find active platform trunk
   * @returns {Promise<Object|null>} Active platform trunk or null
   */
  async findActivePlatformTrunk() {
    return await this.prisma.platformTrunk.findFirst({
      where: {
        isActive: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  /**
   * Find tenant by ID
   * @param {string} tenantId Tenant ID
   * @returns {Promise<Object|null>} Tenant or null if not found
   */
  async findTenantById(tenantId) {
    return await this.prisma.tenant.findUnique({
      where: { id: tenantId }
    });
  }

  /**
   * Find campaign with tenant validation
   * @param {string} campaignId Campaign ID
   * @param {string} tenantId Tenant ID
   * @returns {Promise<Object|null>} Campaign or null if not found
   */
  async findCampaignByIdAndTenant(campaignId, tenantId) {
    return await this.prisma.campaign.findFirst({
      where: { 
        id: campaignId,
        tenantId,
        isActive: true
      }
    });
  }

  /**
   * Find phone numbers for campaign
   * @param {string} campaignId Campaign ID
   * @param {boolean} [activeOnly=true] Only return active phone numbers
   * @returns {Promise<Array>} Array of phone numbers
   */
  async findPhoneNumbersByCampaign(campaignId, activeOnly = true) {
    const where = {
      campaignId
    };

    if (activeOnly) {
      where.isActive = true;
    }

    return await this.prisma.phoneNumber.findMany({
      where,
      select: {
        number: true
      }
    });
  }

  /**
   * Find LiveKit trunk for campaign
   * @param {string} tenantId Tenant ID
   * @param {string} campaignId Campaign ID
   * @param {string} trunkType Trunk type (INBOUND/OUTBOUND)
   * @returns {Promise<Object|null>} LiveKit trunk or null if not found
   */
  async findLiveKitTrunkByCampaign(tenantId, campaignId, trunkType) {
    return await this.prisma.liveKitTrunk.findFirst({
      where: {
        tenantId,
        campaignId,
        trunkType,
        isActive: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  /**
   * Update LiveKit trunk status and ID
   * @param {string} trunkId Database trunk ID
   * @param {string} livekitTrunkId LiveKit trunk ID
   * @param {string} status Trunk status
   * @returns {Promise<Object>} Updated trunk
   */
  async updateLiveKitTrunkStatus(trunkId, livekitTrunkId, status) {
    return await this.prisma.liveKitTrunk.update({
      where: { id: trunkId },
      data: {
        livekitTrunkId,
        status,
        updatedAt: new Date()
      }
    });
  }

  /**
   * Create LiveKit trunk record
   * @param {Object} data Trunk data
   * @returns {Promise<Object>} Created trunk with relations
   */
  async createLiveKitTrunk(data) {
    return await this.prisma.liveKitTrunk.create({
      data,
      include: {
        tenant: {
          select: {
            name: true,
            domain: true
          }
        },
        platformTrunk: {
          select: {
            name: true
          }
        }
      }
    });
  }

  /**
   * Check for existing record by unique constraint
   * @param {string} model Model name (campaign, liveKitTrunk, etc.)
   * @param {Object} where Where clause for finding existing record
   * @param {string} [excludeId] ID to exclude from search (for updates)
   * @returns {Promise<Object|null>} Existing record or null
   */
  async findExistingRecord(model, where, excludeId = null) {
    const whereClause = { ...where };
    
    if (excludeId) {
      whereClause.id = { not: excludeId };
    }

    return await this.prisma[model].findFirst({
      where: whereClause
    });
  }

  /**
   * Build pagination query
   * @param {Object} options Query options
   * @param {Object} options.where Where clause
   * @param {number} options.skip Skip count
   * @param {number} options.limit Take limit
   * @param {Object} options.orderBy Order by clause
   * @param {Object} [options.include] Include relations
   * @param {Object} [options.select] Select fields
   * @returns {Promise<Array>} Query results
   */
  async findManyWithPagination(model, options) {
    const { where, skip, limit: take, orderBy, include, select } = options;
    
    const queryOptions = {
      where,
      skip,
      take,
      orderBy
    };

    if (include) {
      queryOptions.include = include;
    }

    if (select) {
      queryOptions.select = select;
    }

    return await this.prisma[model].findMany(queryOptions);
  }

  /**
   * Count records with where clause
   * @param {string} model Model name
   * @param {Object} where Where clause
   * @returns {Promise<number>} Count of records
   */
  async countRecords(model, where) {
    return await this.prisma[model].count({ where });
  }

  /**
   * Execute paginated query with count
   * @param {string} model Model name
   * @param {Object} queryOptions Query options
   * @returns {Promise<Object>} Results with data and count
   */
  async executePaginatedQuery(model, queryOptions) {
    const [data, totalCount] = await Promise.all([
      this.findManyWithPagination(model, queryOptions),
      this.countRecords(model, queryOptions.where)
    ]);

    return { data, totalCount };
  }

  /**
   * Build search where clause
   * @param {string} searchTerm Search term
   * @param {Array<string>} searchFields Fields to search in
   * @param {Object} [additionalWhere] Additional where conditions
   * @returns {Object} Where clause object
   */
  buildSearchWhere(searchTerm, searchFields, additionalWhere = {}) {
    const where = { ...additionalWhere };
    
    if (searchTerm) {
      where.OR = searchFields.map(field => ({
        [field]: { contains: searchTerm, mode: 'insensitive' }
      }));
    }
    
    return where;
  }

  /**
   * Generic create with error handling
   * @param {string} model Model name
   * @param {Object} data Data to create
   * @param {Object} [include] Relations to include
   * @returns {Promise<Object>} Created record
   */
  async createRecord(model, data, include = null) {
    const createOptions = { data };
    
    if (include) {
      createOptions.include = include;
    }

    return await this.prisma[model].create(createOptions);
  }

  /**
   * Generic update with error handling
   * @param {string} model Model name
   * @param {string} id Record ID
   * @param {Object} data Data to update
   * @param {Object} [include] Relations to include
   * @returns {Promise<Object>} Updated record
   */
  async updateRecord(model, id, data, include = null) {
    const updateOptions = {
      where: { id },
      data
    };
    
    if (include) {
      updateOptions.include = include;
    }

    return await this.prisma[model].update(updateOptions);
  }

  /**
   * Generic delete with error handling
   * @param {string} model Model name
   * @param {string} id Record ID
   * @returns {Promise<Object>} Deleted record
   */
  async deleteRecord(model, id) {
    return await this.prisma[model].delete({
      where: { id }
    });
  }

  /**
   * Find record by ID with relations
   * @param {string} model Model name
   * @param {string} id Record ID
   * @param {Object} [include] Relations to include
   * @returns {Promise<Object|null>} Record or null if not found
   */
  async findRecordById(model, id, include = null) {
    const findOptions = {
      where: { id }
    };
    
    if (include) {
      findOptions.include = include;
    }

    return await this.prisma[model].findUnique(findOptions);
  }

  /**
   * Transaction wrapper
   * @param {Function} callback Transaction callback function
   * @returns {Promise<*>} Transaction result
   */
  async transaction(callback) {
    return await this.prisma.$transaction(callback);
  }

  /**
   * Disconnect Prisma client (for cleanup)
   * @returns {Promise<void>}
   */
  async disconnect() {
    await this.prisma.$disconnect();
  }
}

// Export singleton instance
module.exports = new DatabaseService();