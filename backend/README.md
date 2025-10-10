# Campaign Calling Backend

Production-ready Express.js backend for campaign-based calling system with LiveKit and Twilio integration.

## 🏗️ Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** PostgreSQL with Prisma ORM
- **Queue:** Bull (Redis-based)
- **Scheduler:** node-cron
- **Logging:** Winston
- **API Docs:** Swagger/OpenAPI
- **Security:** Helmet, CORS, Rate Limiting
- **Validation:** Joi

## 📁 Project Structure

```
backend/
├── src/
│   ├── config/           # Configuration files
│   │   ├── database.js   # Prisma client
│   │   ├── redis.js      # Redis client
│   │   └── swagger.js    # Swagger config
│   ├── controllers/      # Route controllers
│   ├── middleware/       # Express middleware
│   │   ├── errorHandler.js
│   │   └── validation.js
│   ├── models/           # Business logic models
│   ├── routes/           # API routes
│   ├── services/         # Business services
│   │   ├── CampaignQueue.js
│   │   ├── LiveKitExecutor.js
│   │   └── WebhookHandler.js
│   ├── utils/            # Utility functions
│   │   └── logger.js
│   ├── app.js            # Express app setup
│   └── server.js         # Server entry point
├── prisma/
│   └── schema.prisma     # Database schema
├── logs/                 # Log files
├── .env                  # Environment variables
├── .env.example          # Environment template
├── package.json
└── README.md
```

## 🚀 Quick Start

### 1. Prerequisites

- Node.js 16+ and npm
- PostgreSQL database (or SQLite for development)
- Redis server (optional, for queue management)
- LiveKit account with configured agents and dispatch rules

### 2. LiveKit Dashboard Setup (Required)

**Before running the application, configure dispatch rules in LiveKit Dashboard:**

1. **Navigate to Agents** in LiveKit Dashboard
2. **Create/Configure Agent** (e.g., "telephony-agent")
   - Set agent behavior, prompts, and voice settings
   - Note the agent name for use in campaigns

3. **Set Dispatch Rule:**
   ```
   Room Pattern: outbound-*
   Agent: telephony-agent
   Auto-join: ✅ Enabled
   ```

4. **Configure SIP Trunk** (if using Twilio):
   - Add your Twilio SIP trunk in LiveKit Dashboard
   - Note the trunk ID (e.g., "ST_YOUR_TRUNK_ID")

**Why Dispatch Rules?**
- Agents automatically join rooms matching the pattern
- No explicit dispatch API calls needed
- Faster performance (~1 second vs ~2.5 seconds)
- Simpler architecture and better scalability

### 3. Installation

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env
# Edit .env with your configuration
```

### 3. Database Setup

```bash
# Generate Prisma Client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# (Optional) Seed database
npm run db:seed

# (Optional) Open Prisma Studio
npm run prisma:studio
```

### 4. Start Server

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

The server will start on `http://localhost:3000`

## 📚 API Documentation

Once the server is running, access the interactive Swagger documentation at:

```
http://localhost:3000/api-docs
```

## 🔧 Environment Variables

See `.env.example` for all available configuration options.

### Required Variables:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/campaign_calling_db
REDIS_HOST=localhost
REDIS_PORT=6379
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your_api_key
LIVEKIT_API_SECRET=your_api_secret
```

## 🛣️ API Endpoints

### Campaigns
- `POST /api/v1/campaigns` - Create campaign
- `GET /api/v1/campaigns` - List campaigns
- `GET /api/v1/campaigns/:id` - Get campaign
- `PUT /api/v1/campaigns/:id` - Update campaign
- `DELETE /api/v1/campaigns/:id` - Delete campaign
- `POST /api/v1/campaigns/:id/start` - Start campaign
- `POST /api/v1/campaigns/:id/pause` - Pause campaign
- `POST /api/v1/campaigns/:id/stop` - Stop campaign

### Leads
- `POST /api/v1/campaigns/:id/leads` - Add lead
- `POST /api/v1/campaigns/:id/leads/upload` - Upload CSV
- `GET /api/v1/campaigns/:id/leads` - List leads
- `PUT /api/v1/leads/:id` - Update lead
- `DELETE /api/v1/leads/:id` - Delete lead

### Agents
- `GET /api/v1/agents` - List agents
- `POST /api/v1/agents` - Create agent
- `PUT /api/v1/agents/:id` - Update agent
- `DELETE /api/v1/agents/:id` - Delete agent
- `POST /api/v1/campaigns/:id/agents` - Assign agents

### Webhooks
- `POST /api/v1/webhooks/twilio/status` - Twilio status callback

### Analytics
- `GET /api/v1/campaigns/:id/stats` - Campaign statistics
- `GET /api/v1/analytics/dashboard` - Dashboard overview

## 🔐 Security Features

- **Helmet.js** - Security headers
- **CORS** - Cross-origin resource sharing
- **Rate Limiting** - Prevent abuse
- **Input Validation** - Joi schemas
- **Error Handling** - Graceful error responses

## 📊 Database Schema

The system uses 5 main tables:

1. **campaigns** - Campaign configurations
2. **leads** - Phone numbers to call
3. **agents** - AI agents with LiveKit trunks
4. **campaign_agents** - Many-to-many relationship
5. **call_logs** - Call history and status

See `prisma/schema.prisma` for full schema details.

## 🐛 Troubleshooting

### Database Connection Issues

```bash
# Test database connection
npx prisma db pull

# Reset database (WARNING: deletes all data)
npx prisma migrate reset
```

### Redis Connection Issues

```bash
# Check if Redis is running
redis-cli ping
# Should return: PONG
```

### Port Already in Use

```bash
# Change PORT in .env file
PORT=3001
```

## 📝 Development

### Available Scripts

```bash
npm run dev          # Start development server with nodemon
npm start            # Start production server
npm run prisma:generate    # Generate Prisma Client
npm run prisma:migrate     # Run database migrations
npm run prisma:studio      # Open Prisma Studio
npm run db:seed      # Seed database with sample data
```

### Code Style

- Use ES6+ features
- Follow async/await pattern
- Use descriptive variable names
- Add JSDoc comments for functions
- Handle errors properly

## 🚧 Roadmap

- [x] Phase 1: Foundation Setup ✅
- [x] Phase 2: Campaign APIs ✅
- [x] Phase 3: Lead Management & CSV Upload ✅
- [ ] Phase 4: Agent Management
- [x] Phase 5: LiveKit Integration ✅
- [x] Phase 6: Call Queue System ✅
- [ ] Phase 7: Webhook Handler
- [ ] Phase 8: Scheduler
- [ ] Phase 9: Analytics Dashboard
- [ ] Phase 10: Testing & QA
- [ ] Phase 11: Deployment

## 📚 Additional Documentation

- **[CODE-CLEANUP-GUIDE.md](./CODE-CLEANUP-GUIDE.md)** - Track unused code and technical debt
- **[QUICK-CLEANUP-CHECKLIST.md](./QUICK-CLEANUP-CHECKLIST.md)** - Fast reference for cleanup tasks
- **[MAINTENANCE-SCHEDULE.md](./MAINTENANCE-SCHEDULE.md)** - Monthly/quarterly maintenance tasks
- **[CURRENT-ARCHITECTURE.md](./CURRENT-ARCHITECTURE.md)** - System architecture details
- **[AGENT-AVAILABILITY-GUIDE.md](./AGENT-AVAILABILITY-GUIDE.md)** - Multi-agent setup guide
- **[API-DOCUMENTATION.md](./API-DOCUMENTATION.md)** - Detailed API reference

### Development Commands

```bash
# Run unused code checker
npm run check:unused

# Monthly maintenance
# See MAINTENANCE-SCHEDULE.md for checklist
```

## 📄 License

ISC

## 🤝 Contributing

This is a production project. Follow the development plan and maintain code quality.
