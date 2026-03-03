const express = require('express');
const { Pool } = require('pg');
const { body, validationResult } = require('express-validator');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

const app = express();
const PORT = process.env.AUDIT_SERVICE_PORT || 3003;

// Database connection pool
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

// Error handling for database connection
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'Audit Logs Service is running' });
});

// Log audit event
app.post('/log', [
  body('service_name').trim().notEmpty(),
  body('action').trim().notEmpty(),
  body('status').trim().notEmpty(),
  body('user_id').optional().isInt(),
  body('resource_type').optional().trim(),
  body('resource_id').optional().isInt(),
  body('details').optional().isObject()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      service_name,
      action,
      user_id,
      resource_type,
      resource_id,
      details,
      ip_address,
      status,
      error_message
    } = req.body;

    // Get client IP if not provided
    const clientIp = ip_address || req.ip;

    // Insert audit log
    const result = await pool.query(
      `INSERT INTO audit_logs (
        service_name, action, user_id, resource_type, resource_id,
        details, ip_address, status, error_message
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, timestamp`,
      [
        service_name,
        action,
        user_id || null,
        resource_type || null,
        resource_id || null,
        JSON.stringify(details) || null,
        clientIp,
        status,
        error_message || null
      ]
    );

    res.status(201).json({
      message: 'Audit log created successfully',
      log: result.rows[0]
    });
  } catch (err) {
    console.error('Audit log error:', err);
    res.status(500).json({ error: 'Failed to create audit log' });
  }
});

// Get audit logs with filtering
app.get('/logs', async (req, res) => {
  try {
    const { user_id, service_name, action, limit = 50, offset = 0 } = req.query;

    let query = 'SELECT * FROM audit_logs WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (user_id) {
      query += ` AND user_id = $${paramIndex}`;
      params.push(user_id);
      paramIndex++;
    }

    if (service_name) {
      query += ` AND service_name = $${paramIndex}`;
      params.push(service_name);
      paramIndex++;
    }

    if (action) {
      query += ` AND action = $${paramIndex}`;
      params.push(action);
      paramIndex++;
    }

    query += ` ORDER BY timestamp DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    res.json({
      logs: result.rows,
      count: result.rows.length
    });
  } catch (err) {
    console.error('Get logs error:', err);
    res.status(500).json({ error: 'Failed to retrieve logs' });
  }
});

// Get audit log by ID
app.get('/logs/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'SELECT * FROM audit_logs WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Audit log not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get log error:', err);
    res.status(500).json({ error: 'Failed to retrieve log' });
  }
});

// Get audit statistics
app.get('/stats/summary', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        service_name,
        COUNT(*) as total_events,
        COUNT(CASE WHEN status = 'success' THEN 1 END) as successful,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
        MAX(timestamp) as last_event
      FROM audit_logs
      GROUP BY service_name
      ORDER BY total_events DESC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Failed to retrieve statistics' });
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Audit service error:', err);
  res.status(err.status || 500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

app.listen(PORT, () => {
  console.log(`📋 Audit Logs Service running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  pool.end();
  process.exit(0);
});
