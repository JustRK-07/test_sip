/**
 * Service class for pagination operations
 * Centralizes pagination logic and response formatting
 */
class PaginationService {
  
  /**
   * Calculate pagination metadata
   * @param {number} page Current page number
   * @param {number} limit Items per page
   * @param {number} totalCount Total number of items
   * @returns {Object} Pagination metadata
   */
  calculatePagination(page, limit, totalCount) {
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;
    
    return {
      currentPage: page,
      totalPages,
      totalCount,
      hasNextPage,
      hasPreviousPage,
      itemsPerPage: limit
    };
  }

  /**
   * Format paginated response
   * @param {Array} data Data array
   * @param {Object} paginationParams Pagination parameters
   * @param {number} paginationParams.page Current page
   * @param {number} paginationParams.limit Items per page
   * @param {number} paginationParams.totalCount Total count
   * @returns {Object} Formatted response with data and pagination
   */
  formatPaginatedResponse(data, paginationParams) {
    const { page, limit, totalCount } = paginationParams;
    const pagination = this.calculatePagination(page, limit, totalCount);
    
    return {
      data,
      pagination
    };
  }

  /**
   * Build order by clause from sort parameters
   * @param {string} sortBy Field to sort by
   * @param {string} sortOrder Sort order (asc/desc)
   * @param {string} [defaultSortBy='createdAt'] Default sort field
   * @param {string} [defaultSortOrder='desc'] Default sort order
   * @returns {Object} Order by clause
   */
  buildOrderBy(sortBy, sortOrder, defaultSortBy = 'createdAt', defaultSortOrder = 'desc') {
    const field = sortBy || defaultSortBy;
    const order = sortOrder || defaultSortOrder;
    
    return {
      [field]: order
    };
  }

  /**
   * Validate and normalize pagination parameters
   * @param {Object} query Query parameters
   * @param {number} [defaultLimit=10] Default limit
   * @param {number} [maxLimit=100] Maximum allowed limit
   * @returns {Object} Normalized pagination parameters
   */
  normalizePaginationParams(query, defaultLimit = 10, maxLimit = 100) {
    const page = Math.max(1, parseInt(query.page) || 1);
    const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit) || defaultLimit));
    const skip = (page - 1) * limit;
    
    return {
      page,
      limit,
      skip
    };
  }

  /**
   * Build complete query options for paginated requests
   * @param {Object} params Parameters object
   * @param {Object} params.query Request query parameters
   * @param {Object} params.where Base where clause
   * @param {Array<string>} [params.searchFields] Fields to search in
   * @param {string} [params.defaultSortBy='createdAt'] Default sort field
   * @param {string} [params.defaultSortOrder='desc'] Default sort order
   * @param {number} [params.defaultLimit=10] Default limit
   * @param {number} [params.maxLimit=100] Maximum allowed limit
   * @returns {Object} Complete query options
   */
  buildPaginatedQuery(params) {
    const {
      query,
      where: baseWhere = {},
      searchFields = [],
      defaultSortBy = 'createdAt',
      defaultSortOrder = 'desc',
      defaultLimit = 10,
      maxLimit = 100
    } = params;

    // Normalize pagination parameters
    const paginationParams = this.normalizePaginationParams(query, defaultLimit, maxLimit);
    
    // Build where clause with search
    let where = { ...baseWhere };
    
    if (query.search && searchFields.length > 0) {
      where.OR = searchFields.map(field => ({
        [field]: { contains: query.search, mode: 'insensitive' }
      }));
    }
    
    // Add additional filters
    if (query.isActive !== undefined) {
      where.isActive = query.isActive === 'true';
    }
    
    // Build order by
    const orderBy = this.buildOrderBy(
      query.sortBy,
      query.sortOrder,
      defaultSortBy,
      defaultSortOrder
    );
    
    return {
      where,
      skip: paginationParams.skip,
      limit: paginationParams.limit,
      orderBy,
      paginationParams
    };
  }

  /**
   * Create pagination response with metadata
   * @param {Array} data Data array
   * @param {Object} paginationParams Pagination parameters
   * @param {Object} [metadata] Additional metadata to include
   * @returns {Object} Complete paginated response
   */
  createPaginatedResponse(data, paginationParams, metadata = {}) {
    const response = this.formatPaginatedResponse(data, paginationParams);
    
    // Add any additional metadata
    if (Object.keys(metadata).length > 0) {
      response.metadata = metadata;
    }
    
    return response;
  }

  /**
   * Get page navigation info
   * @param {number} currentPage Current page number
   * @param {number} totalPages Total number of pages
   * @param {number} [windowSize=5] Number of pages to show around current page
   * @returns {Object} Navigation information
   */
  getPageNavigation(currentPage, totalPages, windowSize = 5) {
    const halfWindow = Math.floor(windowSize / 2);
    let startPage = Math.max(1, currentPage - halfWindow);
    let endPage = Math.min(totalPages, currentPage + halfWindow);
    
    // Adjust if we're near the beginning or end
    if (endPage - startPage < windowSize - 1) {
      if (startPage === 1) {
        endPage = Math.min(totalPages, startPage + windowSize - 1);
      } else if (endPage === totalPages) {
        startPage = Math.max(1, endPage - windowSize + 1);
      }
    }
    
    const pages = [];
    for (let i = startPage; i <= endPage; i++) {
      pages.push({
        page: i,
        isCurrent: i === currentPage
      });
    }
    
    return {
      pages,
      showFirstPage: startPage > 1,
      showLastPage: endPage < totalPages,
      showPreviousEllipsis: startPage > 2,
      showNextEllipsis: endPage < totalPages - 1,
      firstPage: 1,
      lastPage: totalPages,
      previousPage: currentPage > 1 ? currentPage - 1 : null,
      nextPage: currentPage < totalPages ? currentPage + 1 : null
    };
  }

  /**
   * Calculate offset-based pagination (for APIs that use offset instead of page)
   * @param {number} offset Starting offset
   * @param {number} limit Items per page
   * @param {number} totalCount Total number of items
   * @returns {Object} Offset-based pagination metadata
   */
  calculateOffsetPagination(offset, limit, totalCount) {
    const currentPage = Math.floor(offset / limit) + 1;
    const totalPages = Math.ceil(totalCount / limit);
    const hasMore = offset + limit < totalCount;
    const nextOffset = hasMore ? offset + limit : null;
    const previousOffset = offset > 0 ? Math.max(0, offset - limit) : null;
    
    return {
      offset,
      limit,
      totalCount,
      currentPage,
      totalPages,
      hasMore,
      nextOffset,
      previousOffset
    };
  }

  /**
   * Format response for cursor-based pagination
   * @param {Array} data Data array
   * @param {string} cursorField Field used for cursor
   * @param {number} limit Items per page
   * @param {*} [nextCursor] Next cursor value
   * @param {*} [previousCursor] Previous cursor value
   * @returns {Object} Cursor-based paginated response
   */
  formatCursorPaginatedResponse(data, cursorField, limit, nextCursor = null, previousCursor = null) {
    const hasNextPage = data.length === limit && nextCursor !== null;
    const hasPreviousPage = previousCursor !== null;
    
    // Remove extra item if we fetched limit + 1 to check for next page
    const responseData = hasNextPage ? data.slice(0, -1) : data;
    
    return {
      data: responseData,
      pageInfo: {
        hasNextPage,
        hasPreviousPage,
        startCursor: responseData.length > 0 ? responseData[0][cursorField] : null,
        endCursor: responseData.length > 0 ? responseData[responseData.length - 1][cursorField] : null,
        nextCursor: hasNextPage ? nextCursor : null,
        previousCursor: hasPreviousPage ? previousCursor : null
      },
      totalCount: responseData.length
    };
  }
}

// Export singleton instance
module.exports = new PaginationService();