const express = require('express');
const { getPrismaClient } = require('../config/prisma');
const { authenticateToken, requireRole, requireAccount } = require('../middleware/auth');
const { randomBytes } = require('crypto');

const router = express.Router();
const prisma = getPrismaClient();

// ID generation helper (similar to cuid format)
const generateTenantId = () => {
  const timestamp = Date.now().toString(36);
  const randomPart = randomBytes(6).toString('base64url');
  return `cl${timestamp}${randomPart}`;
};

// Validation helpers
const validateTenantData = (data) => {
  const errors = [];
  
  if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
    errors.push('Name is required and must be a non-empty string');
  }
  
  if (!data.domain || typeof data.domain !== 'string' || data.domain.trim().length === 0) {
    errors.push('Domain is required and must be a non-empty string');
  }
  
  if (data.domain && !/^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/.test(data.domain)) {
    errors.push('Domain must be a valid domain name');
  }
  
  // Validate tenantId if provided
  if (data.tenantId !== undefined) {
    if (typeof data.tenantId !== 'string' || data.tenantId.trim().length === 0) {
      errors.push('TenantId must be a non-empty string when provided');
    } else if (data.tenantId.trim().length > 255) {
      errors.push('TenantId must be 255 characters or less');
    }
  }
  
  if (data.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.contactEmail)) {
    errors.push('Contact email must be a valid email address');
  }
  
  if (data.maxUsers && (!Number.isInteger(data.maxUsers) || data.maxUsers < 1)) {
    errors.push('Max users must be a positive integer');
  }
  
  return errors;
};

/**
 * @swagger
 * /api/tenants:
 *   get:
 *     summary: List all tenants
 *     description: Retrieve a paginated list of tenants with optional filtering and sorting capabilities
 *     tags: [Tenants]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term to filter tenants by name, domain, or description
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by tenant active status
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [name, domain, createdAt, updatedAt]
 *           default: createdAt
 *         description: Field to sort by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Successfully retrieved tenants
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedTenants'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/', authenticateToken, requireAccount('00000000-0000-0000-0000-00000000b40d'), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      isActive,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where = {};
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { domain: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }
    
    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    // Build orderBy
    const orderBy = {};
    if (['name', 'domain', 'createdAt', 'updatedAt'].includes(sortBy)) {
      orderBy[sortBy] = sortOrder === 'asc' ? 'asc' : 'desc';
    } else {
      orderBy.createdAt = 'desc';
    }

    const [tenants, total] = await Promise.all([
      prisma.tenant.findMany({
        where,
        orderBy,
        skip,
        take: limitNum,
      }),
      prisma.tenant.count({ where })
    ]);

    const totalPages = Math.ceil(total / limitNum);

    res.json({
      data: tenants,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1
      }
    });
  } catch (error) {
    console.error('Error fetching tenants:', error);
    res.status(500).json({
      error: {
        message: 'Failed to fetch tenants',
        code: 'FETCH_TENANTS_ERROR'
      }
    });
  }
});

/**
 * @swagger
 * /api/tenants/{id}:
 *   get:
 *     summary: Get a tenant by ID
 *     description: Retrieve a specific tenant by its unique identifier
 *     tags: [Tenants]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique tenant identifier
 *         example: clx1234567890abcdef
 *     responses:
 *       200:
 *         description: Successfully retrieved tenant
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/Tenant'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:id', authenticateToken, requireAccount('00000000-0000-0000-0000-00000000b40d'), async (req, res) => {
  try {
    const { id } = req.params;

    const tenant = await prisma.tenant.findUnique({
      where: { id }
    });

    if (!tenant) {
      return res.status(404).json({
        error: {
          message: 'Tenant not found',
          code: 'TENANT_NOT_FOUND'
        }
      });
    }

    res.json({ data: tenant });
  } catch (error) {
    console.error('Error fetching tenant:', error);
    res.status(500).json({
      error: {
        message: 'Failed to fetch tenant',
        code: 'FETCH_TENANT_ERROR'
      }
    });
  }
});

/**
 * @swagger
 * /api/tenants:
 *   post:
 *     summary: Create a new tenant
 *     description: Create a new tenant. Requires admin or tenant-manager role.
 *     tags: [Tenants]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TenantInput'
 *           example:
 *             tenantId: "custom-tenant-123"
 *             name: "Example Corp"
 *             domain: "example.com"
 *             description: "A leading technology company"
 *             contactEmail: "admin@example.com"
 *             contactPhone: "+1-555-123-4567"
 *             address: "123 Main St, City, State 12345"
 *             maxUsers: 100
 *             isActive: true
 *     responses:
 *       201:
 *         description: Tenant created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/Tenant'
 *                 message:
 *                   type: string
 *                   example: "Tenant created successfully"
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       409:
 *         description: Domain or Tenant ID already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               domain_exists:
 *                 summary: Domain already exists
 *                 value:
 *                   error:
 *                     message: "Domain already exists"
 *                     code: "DOMAIN_EXISTS"
 *               tenant_id_exists:
 *                 summary: Tenant ID already exists
 *                 value:
 *                   error:
 *                     message: "Tenant ID already exists"
 *                     code: "TENANT_ID_EXISTS"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/', authenticateToken, requireAccount('00000000-0000-0000-0000-00000000b40d'), async (req, res) => {
  try {
    const validationErrors = validateTenantData(req.body);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        error: {
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: validationErrors
        }
      });
    }

    const {
      tenantId,
      name,
      domain,
      description,
      isActive = true,
      contactEmail,
      contactPhone,
      address,
      maxUsers
    } = req.body;

    // Generate ID if not provided, or use the provided one
    const finalTenantId = tenantId ? tenantId.trim() : generateTenantId();

    // Check if tenant ID already exists (when custom ID is provided)
    if (tenantId) {
      const existingTenantById = await prisma.tenant.findUnique({
        where: { id: finalTenantId }
      });

      if (existingTenantById) {
        return res.status(409).json({
          error: {
            message: 'Tenant ID already exists',
            code: 'TENANT_ID_EXISTS'
          }
        });
      }
    }

    // Check if domain already exists
    const existingTenant = await prisma.tenant.findUnique({
      where: { domain }
    });

    if (existingTenant) {
      return res.status(409).json({
        error: {
          message: 'Domain already exists',
          code: 'DOMAIN_EXISTS'
        }
      });
    }

    const tenant = await prisma.tenant.create({
      data: {
        id: finalTenantId,
        name: name.trim(),
        domain: domain.trim().toLowerCase(),
        description: description?.trim(),
        isActive,
        contactEmail: contactEmail?.trim(),
        contactPhone: contactPhone?.trim(),
        address: address?.trim(),
        maxUsers
      }
    });

    res.status(201).json({
      data: tenant,
      message: 'Tenant created successfully'
    });
  } catch (error) {
    console.error('Error creating tenant:', error);
    res.status(500).json({
      error: {
        message: 'Failed to create tenant',
        code: 'CREATE_TENANT_ERROR'
      }
    });
  }
});

/**
 * @swagger
 * /api/tenants/{id}:
 *   put:
 *     summary: Update an existing tenant
 *     description: Update a tenant's information. Requires admin or tenant-manager role.
 *     tags: [Tenants]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique tenant identifier
 *         example: clx1234567890abcdef
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Tenant name
 *                 example: "Updated Example Corp"
 *               domain:
 *                 type: string
 *                 description: Unique tenant domain
 *                 example: "updated-example.com"
 *               description:
 *                 type: string
 *                 description: Optional tenant description
 *                 example: "An updated description"
 *               isActive:
 *                 type: boolean
 *                 description: Whether the tenant is active
 *                 example: true
 *               contactEmail:
 *                 type: string
 *                 format: email
 *                 description: Contact email address
 *                 example: "updated-admin@example.com"
 *               contactPhone:
 *                 type: string
 *                 description: Contact phone number
 *                 example: "+1-555-987-6543"
 *               address:
 *                 type: string
 *                 description: Physical address
 *                 example: "456 Updated St, City, State 67890"
 *               maxUsers:
 *                 type: integer
 *                 minimum: 1
 *                 description: Maximum number of users allowed
 *                 example: 200
 *     responses:
 *       200:
 *         description: Tenant updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/Tenant'
 *                 message:
 *                   type: string
 *                   example: "Tenant updated successfully"
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       409:
 *         description: Domain already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error:
 *                 message: "Domain already exists"
 *                 code: "DOMAIN_EXISTS"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put('/:id', authenticateToken, requireAccount('00000000-0000-0000-0000-00000000b40d'), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if tenant exists
    const existingTenant = await prisma.tenant.findUnique({
      where: { id }
    });

    if (!existingTenant) {
      return res.status(404).json({
        error: {
          message: 'Tenant not found',
          code: 'TENANT_NOT_FOUND'
        }
      });
    }

    const validationErrors = validateTenantData({ ...existingTenant, ...req.body });
    if (validationErrors.length > 0) {
      return res.status(400).json({
        error: {
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: validationErrors
        }
      });
    }

    const {
      name,
      domain,
      description,
      isActive,
      contactEmail,
      contactPhone,
      address,
      maxUsers
    } = req.body;

    // Check if domain already exists (excluding current tenant)
    if (domain && domain !== existingTenant.domain) {
      const domainExists = await prisma.tenant.findUnique({
        where: { domain: domain.trim().toLowerCase() }
      });

      if (domainExists) {
        return res.status(409).json({
          error: {
            message: 'Domain already exists',
            code: 'DOMAIN_EXISTS'
          }
        });
      }
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (domain !== undefined) updateData.domain = domain.trim().toLowerCase();
    if (description !== undefined) updateData.description = description?.trim();
    if (isActive !== undefined) updateData.isActive = isActive;
    if (contactEmail !== undefined) updateData.contactEmail = contactEmail?.trim();
    if (contactPhone !== undefined) updateData.contactPhone = contactPhone?.trim();
    if (address !== undefined) updateData.address = address?.trim();
    if (maxUsers !== undefined) updateData.maxUsers = maxUsers;

    const tenant = await prisma.tenant.update({
      where: { id },
      data: updateData
    });

    res.json({
      data: tenant,
      message: 'Tenant updated successfully'
    });
  } catch (error) {
    console.error('Error updating tenant:', error);
    res.status(500).json({
      error: {
        message: 'Failed to update tenant',
        code: 'UPDATE_TENANT_ERROR'
      }
    });
  }
});

/**
 * @swagger
 * /api/tenants/{id}:
 *   delete:
 *     summary: Delete a tenant
 *     description: Delete a tenant (soft delete by default, permanent delete if specified). Requires admin role.
 *     tags: [Tenants]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique tenant identifier
 *         example: clx1234567890abcdef
 *       - in: query
 *         name: permanent
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Whether to permanently delete the tenant (true) or just deactivate it (false)
 *         example: false
 *     responses:
 *       200:
 *         description: Tenant deleted or deactivated successfully
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Tenant'
 *                     message:
 *                       type: string
 *                       example: "Tenant deactivated successfully"
 *                 - type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: "Tenant permanently deleted"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete('/:id', authenticateToken, requireAccount('00000000-0000-0000-0000-00000000b40d'), requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { permanent = false } = req.query;

    // Check if tenant exists
    const existingTenant = await prisma.tenant.findUnique({
      where: { id }
    });

    if (!existingTenant) {
      return res.status(404).json({
        error: {
          message: 'Tenant not found',
          code: 'TENANT_NOT_FOUND'
        }
      });
    }

    if (permanent === 'true') {
      // Permanent delete
      await prisma.tenant.delete({
        where: { id }
      });

      res.json({
        message: 'Tenant permanently deleted'
      });
    } else {
      // Soft delete
      const tenant = await prisma.tenant.update({
        where: { id },
        data: { isActive: false }
      });

      res.json({
        data: tenant,
        message: 'Tenant deactivated successfully'
      });
    }
  } catch (error) {
    console.error('Error deleting tenant:', error);
    res.status(500).json({
      error: {
        message: 'Failed to delete tenant',
        code: 'DELETE_TENANT_ERROR'
      }
    });
  }
});

/**
 * @swagger
 * /api/tenants/{id}/activate:
 *   patch:
 *     summary: Activate a tenant
 *     description: Reactivate a deactivated tenant. Requires admin or tenant-manager role.
 *     tags: [Tenants]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique tenant identifier
 *         example: clx1234567890abcdef
 *     responses:
 *       200:
 *         description: Tenant activated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/Tenant'
 *                 message:
 *                   type: string
 *                   example: "Tenant activated successfully"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.patch('/:id/activate', authenticateToken, requireAccount('00000000-0000-0000-0000-00000000b40d'), async (req, res) => {
  try {
    const { id } = req.params;

    const tenant = await prisma.tenant.update({
      where: { id },
      data: { isActive: true }
    });

    res.json({
      data: tenant,
      message: 'Tenant activated successfully'
    });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        error: {
          message: 'Tenant not found',
          code: 'TENANT_NOT_FOUND'
        }
      });
    }

    console.error('Error activating tenant:', error);
    res.status(500).json({
      error: {
        message: 'Failed to activate tenant',
        code: 'ACTIVATE_TENANT_ERROR'
      }
    });
  }
});

module.exports = router;