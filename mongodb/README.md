# MongoDB Database

MongoDB 8.0 with Mongo Express web GUI for database management.

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
# Add .js or .sh files for database initialization
```

### 4. Start Services
```bash
docker compose up -d
```

## 📋 Configuration

### Environment Variables (.env)
```bash
# MongoDB Root User
MONGO_INITDB_ROOT_USERNAME=admin
MONGO_INITDB_ROOT_PASSWORD=your_strong_password

# Mongo Express (GUI) Authentication
ME_BASIC_AUTH_USER=admin
ME_BASIC_AUTH_PASS=your_gui_password
```

### Database Initialization
Place initialization scripts in `./init-scripts/`:

```javascript
// init-scripts/01-create-users.js
db = db.getSiblingDB('myapp');

db.createUser({
  user: 'appuser',
  pwd: 'apppassword',
  roles: [
    {
      role: 'readWrite',
      db: 'myapp'
    }
  ]
});

db.createCollection('users');
db.createCollection('posts');
```

## 🌐 Access

### Mongo Express GUI
Access at: https://mongo.example.com

### Connection Strings

#### From Docker Containers (Internal)
```bash
# MongoDB connection
mongodb://admin:password@mongodb:27017/database?authSource=admin

# For applications in the same network
mongodb://mongodb:27017
```

#### From External Applications
```bash
# If exposing MongoDB port (not recommended for production)
mongodb://admin:password@your-server:27017/database?authSource=admin
```

## 📚 Integration Examples

### Node.js with Mongoose
```javascript
// config/database.js
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 
      'mongodb://admin:password@mongodb:27017/myapp?authSource=admin', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('Database connection error:', error);
    process.exit(1);
  }
};

module.exports = connectDB;
```

### Next.js with MongoDB
```typescript
// lib/mongodb.ts
import { MongoClient, MongoClientOptions } from 'mongodb';

const uri = process.env.MONGODB_URI || 'mongodb://admin:password@mongodb:27017/myapp?authSource=admin';
const options: MongoClientOptions = {};

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === 'development') {
  if (!(global as any)._mongoClientPromise) {
    client = new MongoClient(uri, options);
    (global as any)._mongoClientPromise = client.connect();
  }
  clientPromise = (global as any)._mongoClientPromise;
} else {
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

export default clientPromise;
```

### Docker Compose Application Integration
```yaml
# In your app's docker-compose.yaml
services:
  my-app:
    image: my-app:latest
    environment:
      MONGODB_URI: mongodb://admin:password@mongodb:27017/myapp?authSource=admin
    networks:
      - appnet
    depends_on:
      - mongodb

networks:
  appnet:
    external: true
```

## 🔧 Management Commands

### Backup Database
```bash
# Create backup
docker exec mongodb mongodump --username admin --password password --authenticationDatabase admin --out /backups/$(date +%Y%m%d_%H%M%S)

# List backups
docker exec mongodb ls -la /backups/
```

### Restore Database
```bash
# Restore from backup
docker exec mongodb mongorestore --username admin --password password --authenticationDatabase admin /backups/20241007_120000/
```

### MongoDB Shell Access
```bash
# Access MongoDB shell
docker exec -it mongodb mongosh -u admin -p password --authenticationDatabase admin

# Connect to specific database
docker exec -it mongodb mongosh -u admin -p password --authenticationDatabase admin myapp
```

### User Management
```javascript
// In MongoDB shell - Create application user
use myapp
db.createUser({
  user: "appuser",
  pwd: "apppassword",
  roles: [ { role: "readWrite", db: "myapp" } ]
});

// List users
db.getUsers();

// Drop user
db.dropUser("username");
```

## 🛡️ Security

### Production Considerations
1. Use strong passwords for all users
2. Limit network access to MongoDB port
3. Enable MongoDB authentication (already enabled)
4. Use SSL/TLS in production
5. Regularly backup data
6. Monitor database access logs

### SSL Configuration (Production)
```yaml
# docker-compose.yaml - add to mongodb service
command: ["--auth", "--tlsMode", "requireTLS", "--tlsCertificateKeyFile", "/etc/ssl/mongodb.pem"]
volumes:
  - ./ssl/mongodb.pem:/etc/ssl/mongodb.pem:ro
```

### Firewall Rules
```bash
# Allow only from application network
ufw allow from 172.18.0.0/16 to any port 27017
```

## 📊 Monitoring

### Health Checks
The service includes built-in health checks that verify MongoDB connectivity.

### Performance Monitoring
```javascript
// Enable profiling in MongoDB shell
db.setProfilingLevel(2);

// View slow operations
db.system.profile.find().limit(5).sort({ ts: -1 }).pretty();
```

### Log Analysis
```bash
# View MongoDB logs
docker compose logs -f mongodb

# View Mongo Express logs
docker compose logs -f mongo-express
```

## 🔍 Troubleshooting

### Common Issues

1. **Connection refused**
   - Check if MongoDB container is running
   - Verify network connectivity
   - Check credentials

2. **Authentication failed**
   - Verify username/password in environment variables
   - Ensure using correct authSource database

3. **Permission denied**
   - Check user roles and permissions
   - Verify database names match

4. **Out of disk space**
   - Monitor volume usage: `docker system df`
   - Clean old backups if needed

### Debug Commands
```bash
# Check container status
docker compose ps

# View detailed logs
docker compose logs -f mongodb

# Access container shell
docker exec -it mongodb bash

# Test connectivity
docker exec mongodb mongosh --eval "db.runCommand({ping: 1})"
```

### Performance Tuning
```yaml
# docker-compose.yaml - MongoDB optimizations
services:
  mongodb:
    ulimits:
      nofile:
        soft: 64000
        hard: 64000
    sysctls:
      - net.core.somaxconn=65535
```