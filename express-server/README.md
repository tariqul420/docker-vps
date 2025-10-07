# Express.js API Server

Production-ready Express.js API server with file upload, image processing, and database integration.

## 🚀 Quick Start

### 1. Setup Environment
```bash
cp .env.example .env
# Edit .env with your configuration
```

### 2. Ensure Networks Exist
```bash
docker network create proxy
docker network create appnet
```

### 3. Start Dependencies
```bash
# Start Traefik and database
cd ../traefik && docker compose up -d
cd ../postgres && docker compose up -d  # or ../mongodb
cd ../files-gateway && docker compose up -d
```

### 4. Deploy API Server
```bash
docker compose up -d
```

## 📋 Features

- **File Upload** - S3/MinIO integration with multipart upload
- **Image Processing** - Imgproxy integration for optimization
- **Database** - PostgreSQL or MongoDB support
- **Authentication** - JWT-based auth with middleware
- **Rate Limiting** - Built-in request rate limiting
- **CORS** - Configured for cross-origin requests
- **Health Checks** - Docker health monitoring
- **Logging** - Structured logging with Morgan

## 🌐 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/api/auth/login` | User authentication |
| POST | `/api/upload` | File upload |
| GET | `/api/files/:id` | Get file info |
| DELETE | `/api/files/:id` | Delete file |
| GET | `/api/images/:id` | Optimized image |

## 📚 Example Implementation

### Main Server (index.js)
```javascript
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');

const authRoutes = require('./routes/auth');
const uploadRoutes = require('./routes/upload');
const fileRoutes = require('./routes/files');

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? /^https:\/\/.*\.example\.com$/ 
    : 'http://localhost:3000',
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
});
app.use(limiter);

// Logging
app.use(morgan('combined'));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/files', fileRoutes);

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(\`Server running on port \${PORT}\`);
});
```

### File Upload Route (routes/upload.js)
```javascript
const express = require('express');
const multer = require('multer');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const router = express.Router();

// S3 Client
const s3Client = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
  },
  forcePathStyle: true,
});

// Multer configuration
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    // Allow images and documents
    const allowedTypes = /jpeg|jpg|png|gif|webp|pdf|doc|docx|txt/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Invalid file type'));
  },
});

// Upload single file
router.post('/single', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const { folder = 'uploads' } = req.body;
    const fileExt = path.extname(req.file.originalname);
    const fileName = \`\${uuidv4()}\${fileExt}\`;
    const key = \`\${folder}/\${fileName}\`;

    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
      Metadata: {
        originalName: req.file.originalname,
        uploadedAt: new Date().toISOString(),
        uploadedBy: req.user?.id || 'anonymous',
      },
    });

    await s3Client.send(command);

    const fileUrl = \`\${process.env.S3_ENDPOINT}/\${process.env.S3_BUCKET}/\${key}\`;

    res.json({
      success: true,
      file: {
        id: fileName.split('.')[0],
        key,
        url: fileUrl,
        originalName: req.file.originalname,
        size: req.file.size,
        type: req.file.mimetype,
        uploadedAt: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Upload multiple files
router.post('/multiple', upload.array('files', 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }

    const { folder = 'uploads' } = req.body;
    const uploadPromises = req.files.map(async (file) => {
      const fileExt = path.extname(file.originalname);
      const fileName = \`\${uuidv4()}\${fileExt}\`;
      const key = \`\${folder}/\${fileName}\`;

      const command = new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        Metadata: {
          originalName: file.originalname,
          uploadedAt: new Date().toISOString(),
          uploadedBy: req.user?.id || 'anonymous',
        },
      });

      await s3Client.send(command);

      return {
        id: fileName.split('.')[0],
        key,
        url: \`\${process.env.S3_ENDPOINT}/\${process.env.S3_BUCKET}/\${key}\`,
        originalName: file.originalname,
        size: file.size,
        type: file.mimetype,
        uploadedAt: new Date().toISOString(),
      };
    });

    const files = await Promise.all(uploadPromises);

    res.json({
      success: true,
      files,
    });

  } catch (error) {
    console.error('Multiple upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

module.exports = router;
```

### Image Processing Helper (utils/imgproxy.js)
```javascript
const crypto = require('crypto');

function getOptimizedImageUrl(imageUrl, options = {}) {
  const {
    width = 800,
    height = 600,
    quality = 85,
    format = 'webp',
    resize = 'fit'
  } = options;

  const key = process.env.IMGPROXY_KEY;
  const salt = process.env.IMGPROXY_SALT;
  const baseUrl = process.env.IMGPROXY_BASE_URL;

  if (!key || !salt || !baseUrl) {
    return imageUrl;
  }

  const processing = [
    \`rs:\${resize}:\${width}:\${height}\`,
    \`q:\${quality}\`,
    \`f:\${format}\`
  ].join('/');

  const encodedUrl = Buffer.from(imageUrl).toString('base64url');
  const path = \`/\${processing}/\${encodedUrl}\`;

  const signature = crypto
    .createHmac('sha256', Buffer.from(key, 'hex'))
    .update(Buffer.from(salt, 'hex'))
    .update(path)
    .digest('base64url');

  return \`\${baseUrl}/\${signature}\${path}\`;
}

module.exports = { getOptimizedImageUrl };
```

### Authentication Middleware (middleware/auth.js)
```javascript
const jwt = require('jsonwebtoken');

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
      if (!err) {
        req.user = user;
      }
    });
  }
  next();
}

module.exports = { authenticateToken, optionalAuth };
```

### Package.json
```json
{
  "name": "express-api-server",
  "version": "1.0.0",
  "description": "Production Express.js API server",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "dev": "nodemon index.js",
    "test": "jest"
  },
  "dependencies": {
    "@aws-sdk/client-s3": "^3.450.0",
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "helmet": "^7.0.0",
    "express-rate-limit": "^7.1.5",
    "morgan": "^1.10.0",
    "multer": "^1.4.5-lts.1",
    "jsonwebtoken": "^9.0.2",
    "bcryptjs": "^2.4.3",
    "uuid": "^9.0.1",
    "pg": "^8.11.3",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "nodemon": "^3.0.2",
    "jest": "^29.7.0"
  }
}
```

## 🔧 Advanced Features

### Database Integration (PostgreSQL)
```javascript
// config/database.js
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
};
```

### WebSocket Support
```javascript
// Add to index.js
const { Server } = require('socket.io');
const http = require('http');

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? /^https:\/\/.*\.example\.com$/ 
      : 'http://localhost:3000',
  },
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(\`Server with WebSocket running on port \${PORT}\`);
});
```

## 🛡️ Security

### Best Practices
1. Use environment variables for secrets
2. Implement proper CORS policies
3. Add rate limiting to prevent abuse
4. Validate and sanitize all inputs
5. Use HTTPS in production
6. Implement proper authentication
7. Log security events

### Security Headers
```javascript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));
```

## 📊 Monitoring

### Health Checks
The server includes comprehensive health checks for Docker monitoring.

### Logging
```javascript
// Add request ID for tracing
app.use((req, res, next) => {
  req.id = uuidv4();
  res.setHeader('X-Request-ID', req.id);
  next();
});

// Structured logging
const winston = require('winston');
const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'app.log' }),
  ],
});
```

## 🔍 Troubleshooting

### Common Issues
1. **Port already in use**: Change PORT in .env
2. **S3 connection failed**: Verify endpoint and credentials
3. **Database connection error**: Check DATABASE_URL
4. **CORS errors**: Review origin configuration
5. **File upload fails**: Check file size limits and S3 permissions

### Debug Commands
```bash
# View logs
docker compose logs -f express-api

# Access container
docker exec -it express-api sh

# Test health endpoint
curl -f https://api.example.com/health

# Check file permissions
docker exec express-api ls -la /app
```