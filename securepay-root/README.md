# SecurePay Microservices Architecture

A secure, containerized payment processing system built with Node.js, Express, and PostgreSQL. Implements CIA principles (Confidentiality, Integrity, Availability) with security best practices.

## 📋 Project Structure

```
securepay-root/
├── api-gateway/              # Single entry point (Proxy + Auth Check)
├── auth-service/             # User management and JWT tokens
├── transfer-service/         # Core critical service (Validation + Anti-SQLi)
├── audit-logs/              # Event persistence and audit trail
├── database/
│   └── init.sql            # Database schema and sample data
├── docker-compose.yml       # Container orchestration
└── .env                     # Environment configuration
```

## 🔒 Security Features

- **Authentication & Authorization**: JWT-based token system with role-based access control
- **SQL Injection Prevention**: Parameterized queries and input validation
- **HTTPS Security**: Helmet middleware for HTTP header protection
- **CORS**: Configurable cross-origin resource sharing
- **Rate Limiting**: Request throttling to prevent brute force attacks
- **Audit Logging**: Complete audit trail of all operations
- **Minimum Privilege**: Services only access necessary resources
- **Password Security**: bcrypt hashing with salt rounds
- **Transaction Safety**: Database ACID compliance for transfers

## 🚀 Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for local development)
- PostgreSQL 15+ (if running without Docker)

### 1. Clone or Extract the Project

```bash
cd securepay-root
```

### 2. Configure Environment Variables

The `.env` file is already configured with secure defaults. For production:

```bash
# Change these values to strong random strings
JWT_SECRET=your-super-secret-jwt-key-here
GATEWAY_SECRET=your-gateway-secret-key-here
DB_PASSWORD=YourStrongPassword123!
```

### 3. Start Services with Docker Compose

```bash
docker-compose up --build
```

This will:
- Create PostgreSQL database with schema
- Build all microservice containers
- Start services in correct dependency order
- Expose API on `http://localhost:3000`

### 4. Wait for Services to Be Ready

```bash
# Check service health
curl http://localhost:3000/health
```

## 📡 API Endpoints

### Authentication Service (via Gateway)

#### Register New User
```bash
POST /auth/register
Content-Type: application/json

{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "SecurePass123!",
  "full_name": "John Doe"
}
```

#### Login
```bash
POST /auth/login
Content-Type: application/json

{
  "username": "john_doe",
  "password": "SecurePass123!"
}
```

Response:
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "john_doe",
    "email": "john@example.com",
    "role": "user"
  }
}
```

#### Get User Profile
```bash
GET /auth/profile
Authorization: Bearer <token>
```

### Transfer Service (via Gateway)

#### Get User Accounts
```bash
GET /transfers/accounts
Authorization: Bearer <token>
X-User-Id: 1
```

#### Create Transfer
```bash
POST /transfers/create
Authorization: Bearer <token>
Content-Type: application/json
X-User-Id: 1

{
  "from_account_id": 1,
  "to_account_id": 3,
  "amount": 100.50,
  "description": "Payment for services"
}
```

#### Get Transfer History
```bash
GET /transfers/history/1
Authorization: Bearer <token>
X-User-Id: 1
```

### Audit Logs Service (via Gateway)

#### Get All Logs
```bash
GET /audit/logs?limit=50&offset=0
Authorization: Bearer <token>
```

#### Get Statistics
```bash
GET /audit/stats/summary
Authorization: Bearer <token>
```

## 🗄️ Database Schema

### Users Table
```sql
- id (PRIMARY KEY)
- username (UNIQUE)
- email (UNIQUE)
- password_hash
- full_name
- role (admin/user)
- is_active
- created_at, updated_at
```

### Accounts Table
```sql
- id (PRIMARY KEY)
- user_id (FOREIGN KEY)
- account_number (UNIQUE)
- account_type (checking/savings)
- balance
- currency
- is_active
- created_at, updated_at
```

### Transfers Table
```sql
- id (PRIMARY KEY)
- from_account_id (FOREIGN KEY)
- to_account_id (FOREIGN KEY)
- amount
- currency
- description
- status (pending/completed/failed)
- reference_number (UNIQUE)
- created_at, updated_at
```

### Audit Logs Table
```sql
- id (PRIMARY KEY)
- service_name
- action
- user_id
- resource_type
- resource_id
- details (JSONB)
- ip_address
- status (success/failed)
- error_message
- timestamp
```

## 🧪 Sample Data

The database initializes with:
- **3 Users**: admin, john_doe, jane_smith
- **4 Accounts**: Mixed checking and savings accounts with balances
- All passwords hashed: `password` (bcrypt)

### Default Test Credentials

| Username | Password | Role |
|----------|----------|------|
| john_doe | password | user |
| jane_smith | password | user |
| admin | password | admin |

### Sample Account Numbers

- ACC001000001 (John Doe - Checking) - $5,000
- ACC001000002 (John Doe - Savings) - $10,000
- ACC001000003 (Jane Smith - Checking) - $3,500
- ACC001000004 (Jane Smith - Savings) - $8,000

## 🔧 Service Configuration

### API Gateway (Port 3000)
- Proxy to all microservices
- JWT authentication check
- Rate limiting: 100 requests per 15 minutes
- CORS enabled

### Auth Service (Port 3001)
- User registration and login
- JWT token generation and verification
- Password hashing with bcryptjs
- User profile management

### Transfer Service (Port 3002)
- Account management
- Transfer processing with transaction safety
- Balance validation
- Anti-SQL injection measures
- Audit logging integration

### Audit Logs Service (Port 3003)
- Event logging and persistence
- Query filters by user, service, action
- Statistical summaries
- Complete audit trail

## 📊 Monitoring & Logging

Each service logs:
- HTTP requests (Morgan)
- Errors and warnings
- Audit events (for Transfer Service)
- Service health status

View logs:
```bash
docker-compose logs -f api-gateway
docker-compose logs -f auth-service
docker-compose logs -f transfer-service
docker-compose logs -f audit-logs
```

## 🛡️ Security Best Practices Implemented

1. **Input Validation**
   - express-validator for all input
   - SQL parameter binding to prevent injection
   - Account number regex validation

2. **Password Security**
   - bcryptjs hashing with salt
   - Minimum 8 character requirement
   - Never stored in plaintext

3. **JWT Tokens**
   - Signed with strong secret
   - 1-hour expiration by default
   - Claims validation on every request

4. **Database**
   - Parameterized queries throughout
   - Role-based user permissions
   - Transaction support for transfers

5. **API Security**
   - Helmet for HTTP headers
   - CORS restrictions
   - Rate limiting per IP
   - Public/Private route separation

## 🐳 Docker Commands

### Build and Run
```bash
docker-compose up --build
```

### Run in Background
```bash
docker-compose up -d
```

### Stop Services
```bash
docker-compose down
```

### Remove Everything (including data)
```bash
docker-compose down -v
```

### View Service Status
```bash
docker-compose ps
```

### Access Database
```bash
docker-compose exec postgres psql -U securepay_user -d securepay
```

## 🧹 Development

### Local Setup (Without Docker)

1. Install dependencies for each service:
```bash
cd api-gateway && npm install
cd ../auth-service && npm install
cd ../transfer-service && npm install
cd ../audit-logs && npm install
```

2. Start PostgreSQL locally

3. Run each service:
```bash
npm run dev
```

### Environment Variables

Copy `.env` and modify as needed:
```bash
cp .env .env.local
# Edit .env.local with your values
```

## 📝 API Response Format

### Success Response
```json
{
  "message": "Operation successful",
  "data": { ... }
}
```

### Error Response
```json
{
  "error": "Error description",
  "errors": [ ... ]  // Validation errors if applicable
}
```

## 🚨 Troubleshooting

### Services won't start
```bash
# Check logs
docker-compose logs

# Verify ports are free
netstat -an | find ":3000"
```

### Database connection failed
```bash
# Ensure PostgreSQL is running
docker-compose ps postgres

# Check database exists
docker-compose exec postgres psql -U securepay_user -l
```

### JWT authentication failing
- Verify token is included in Authorization header
- Check JWT_SECRET matches across services
- Ensure token hasn't expired

## 📦 Dependencies

### Core Framework
- **Express.js** - Web framework
- **Node.js** - Runtime environment

### Database
- **pg** - PostgreSQL client
- **PostgreSQL 15** - Database engine

### Security
- **jsonwebtoken** - JWT signing/verification
- **bcryptjs** - Password hashing
- **helmet** - Security headers
- **cors** - Cross-origin support
- **express-validator** - Input validation
- **express-rate-limit** - Rate limiting
- **express-http-proxy** - API Gateway proxy

### Development
- **nodemon** - Auto-reload on changes
- **morgan** - HTTP logging

## 📄 License

MIT

## 👥 Contributing

This is an educational project for learning secure microservices architecture.

## 📧 Support

For issues or questions, refer to the service logs:
```bash
docker-compose logs <service-name>
```

---

**Last Updated**: March 2026
**Version**: 1.0.0
