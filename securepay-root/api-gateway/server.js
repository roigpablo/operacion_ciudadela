const express = require('express');
const proxy = require('express-http-proxy');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.GATEWAY_PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));
app.use(morgan('combined'));

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: process.env.RATE_LIMIT_WINDOW * 60 * 1000,
  max: process.env.RATE_LIMIT_MAX_REQUESTS || 100,
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  // Public routes that don't need authentication
  const publicRoutes = ['/auth/login', '/auth/register', '/health'];
  if (publicRoutes.some(route => req.path.startsWith(route))) {
    return next();
  }

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      console.error('JWT verification error:', err.message);
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = decoded;
    next();
  });
};

// Apply authentication to all routes except public ones
app.use(authenticateToken);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'API Gateway is running' });
});

// Proxy routes to microservices
// Auth Service
app.use('/auth', proxy(process.env.AUTH_SERVICE_URL, {
  proxyReqPathResolver: (req) => {
    return req.originalUrl.replace('/auth', '');
  },
  userResDecorator: (proxyRes, proxyResData, userReq, userRes) => {
    try {
      return JSON.parse(proxyResData.toString('utf8'));
    } catch (err) {
      return proxyResData;
    }
  }
}));

// Transfer Service
app.use('/transfers', proxy(process.env.TRANSFER_SERVICE_URL, {
  proxyReqPathResolver: (req) => {
    return req.originalUrl.replace('/transfers', '');
  },
  userResDecorator: (proxyRes, proxyResData, userReq, userRes) => {
    try {
      return JSON.parse(proxyResData.toString('utf8'));
    } catch (err) {
      return proxyResData;
    }
  }
}));

// Audit Logs Service
app.use('/audit', proxy(process.env.AUDIT_SERVICE_URL, {
  proxyReqPathResolver: (req) => {
    return req.originalUrl.replace('/audit', '');
  },
  userResDecorator: (proxyRes, proxyResData, userReq, userRes) => {
    try {
      return JSON.parse(proxyResData.toString('utf8'));
    } catch (err) {
      return proxyResData;
    }
  }
}));

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Gateway error:', err);
  res.status(err.status || 500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

app.listen(PORT, () => {
  console.log(`🚀 API Gateway running on port ${PORT}`);
});
