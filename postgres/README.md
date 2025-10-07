# PostgreSQL Database

PostgreSQL 16 with Adminer web GUI for database management.

## 🚀 Quick Start

### 1. Ensure Networks Exist
```bash
docker network create appnet
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with your credentials
```

### 3. Create Init Scripts (Optional)
```bash
mkdir -p init-scripts
# Add .sql files for database initialization
```

### 4. Start Services
```bash
docker compose up -d
```

## 📋 Configuration

### Environment Variables (.env)
```bash
# PostgreSQL Configuration
POSTGRES_USER=admin
POSTGRES_PASSWORD=your_strong_password
POSTGRES_DB=admin
```

### Database Initialization
Place initialization scripts in `./init-scripts/`:

```sql
-- init-scripts/01-create-database.sql
CREATE DATABASE myapp;
CREATE USER appuser WITH PASSWORD 'apppassword';
GRANT ALL PRIVILEGES ON DATABASE myapp TO appuser;

\c myapp;

-- Create tables
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE posts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    title VARCHAR(200) NOT NULL,
    content TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Grant permissions to tables
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO appuser;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO appuser;
```

## 🌐 Access

### Adminer GUI
Access at: https://pg.example.com

### Connection Details for Adminer
- **System**: PostgreSQL
- **Server**: postgres
- **Username**: admin (or your POSTGRES_USER)
- **Password**: your_strong_password
- **Database**: admin (or your POSTGRES_DB)

### Connection Strings

#### From Docker Containers (Internal)
```bash
# PostgreSQL connection
postgresql://admin:password@postgres:5432/myapp

# For applications in the same network
postgres://postgres:5432/myapp
```

#### From External Applications
```bash
# If exposing PostgreSQL port (not recommended for production)
postgresql://admin:password@your-server:5432/myapp
```

## 📚 Integration Examples

### Node.js with pg (node-postgres)
```javascript
// config/database.js
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 
    'postgresql://admin:password@postgres:5432/myapp',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
};
```

### Next.js with Prisma
```typescript
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        Int      @id @default(autoincrement())
  username  String   @unique
  email     String   @unique
  createdAt DateTime @default(now()) @map("created_at")
  posts     Post[]

  @@map("users")
}

model Post {
  id        Int      @id @default(autoincrement())
  userId    Int      @map("user_id")
  title     String
  content   String?
  createdAt DateTime @default(now()) @map("created_at")
  user      User     @relation(fields: [userId], references: [id])

  @@map("posts")
}
```

```typescript
// lib/prisma.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['query'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

### Docker Compose Application Integration
```yaml
# In your app's docker-compose.yaml
services:
  my-app:
    image: my-app:latest
    environment:
      DATABASE_URL: postgresql://admin:password@postgres:5432/myapp
    networks:
      - appnet
    depends_on:
      postgres:
        condition: service_healthy

networks:
  appnet:
    external: true
```

## 🔧 Management Commands

### Backup Database
```bash
# Create backup
docker exec postgres pg_dump -U admin -d myapp > backup_$(date +%Y%m%d_%H%M%S).sql

# Create backup inside container
docker exec postgres pg_dump -U admin -d myapp -f /backups/backup_$(date +%Y%m%d_%H%M%S).sql
```

### Restore Database
```bash
# Restore from backup
docker exec -i postgres psql -U admin -d myapp < backup_20241007_120000.sql

# Or from inside container
docker exec postgres psql -U admin -d myapp -f /backups/backup_20241007_120000.sql
```

### PostgreSQL Shell Access
```bash
# Access PostgreSQL shell as admin
docker exec -it postgres psql -U admin -d admin

# Connect to specific database
docker exec -it postgres psql -U admin -d myapp

# Run SQL commands from file
docker exec -i postgres psql -U admin -d myapp < script.sql
```

### User Management
```sql
-- In PostgreSQL shell - Create application user
CREATE USER appuser WITH PASSWORD 'apppassword';
CREATE DATABASE myapp OWNER appuser;

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE myapp TO appuser;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO appuser;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO appuser;

-- List users
\du

-- List databases
\l

-- Connect to database
\c myapp

-- List tables
\dt
```

## 🛡️ Security

### Production Considerations
1. Use strong passwords for all users
2. Limit network access to PostgreSQL port
3. Use SSL/TLS in production
4. Regularly backup data
5. Monitor database access logs
6. Use read-only users for reporting

### SSL Configuration (Production)
```yaml
# docker-compose.yaml - add to postgres service
command: ["postgres", "-c", "ssl=on", "-c", "ssl_cert_file=/etc/ssl/certs/server.crt", "-c", "ssl_key_file=/etc/ssl/private/server.key"]
volumes:
  - ./ssl/server.crt:/etc/ssl/certs/server.crt:ro
  - ./ssl/server.key:/etc/ssl/private/server.key:ro
```

### Firewall Rules
```bash
# Allow only from application network
ufw allow from 172.18.0.0/16 to any port 5432
```

## 📊 Monitoring

### Health Checks
The service includes built-in health checks using `pg_isready`.

### Performance Monitoring
```sql
-- View active connections
SELECT * FROM pg_stat_activity;

-- View database statistics
SELECT * FROM pg_stat_database;

-- View table statistics
SELECT * FROM pg_stat_user_tables;

-- View slow queries (if logging enabled)
SELECT query, mean_time, calls 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;
```

### Enable Query Logging
```yaml
# docker-compose.yaml - PostgreSQL configuration
services:
  postgres:
    command: ["postgres", "-c", "log_statement=all", "-c", "log_duration=on"]
```

## 🔍 Troubleshooting

### Common Issues

1. **Connection refused**
   - Check if PostgreSQL container is running
   - Verify network connectivity
   - Check port configuration

2. **Authentication failed**
   - Verify username/password in environment variables
   - Check user permissions

3. **Database does not exist**
   - Ensure database is created in init scripts
   - Check POSTGRES_DB environment variable

4. **Permission denied**
   - Check user roles and permissions
   - Grant necessary privileges

### Debug Commands
```bash
# Check container status
docker compose ps

# View detailed logs
docker compose logs -f postgres

# Access container shell
docker exec -it postgres bash

# Test connectivity
docker exec postgres pg_isready -U admin

# Check PostgreSQL version
docker exec postgres psql -U admin -c "SELECT version();"
```

### Performance Tuning
```yaml
# docker-compose.yaml - PostgreSQL optimizations
services:
  postgres:
    command: [
      "postgres",
      "-c", "shared_preload_libraries=pg_stat_statements",
      "-c", "max_connections=200",
      "-c", "shared_buffers=256MB",
      "-c", "effective_cache_size=1GB",
      "-c", "work_mem=4MB",
      "-c", "maintenance_work_mem=64MB"
    ]
```

### Backup Automation
```bash
# Create backup script
#!/bin/bash
# backup.sh
DATE=$(date +%Y%m%d_%H%M%S)
docker exec postgres pg_dump -U admin -d myapp > /backups/postgres_backup_$DATE.sql
# Keep only last 7 days
find /backups -name "postgres_backup_*.sql" -mtime +7 -delete
```