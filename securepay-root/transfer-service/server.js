const express = require('express');
const { Pool } = require('pg');
const axios = require('axios');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

const app = express();
const PORT = process.env.TRANSFER_SERVICE_PORT || 3002;

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

// Helper function to validate and prevent SQL injection
const validateAccountNumber = (accountNumber) => {
  // Account numbers should be alphanumeric only
  const accountRegex = /^[A-Z0-9]{10,20}$/;
  return accountRegex.test(accountNumber);
};

// Helper function to validate amount
const validateAmount = (amount) => {
  const num = parseFloat(amount);
  return !isNaN(num) && num > 0 && num <= 999999999.99;
};

// Helper function to log audit event
const logAudit = async (action, userId, resourceType, resourceId, status, details) => {
  try {
    await axios.post(`${process.env.AUDIT_SERVICE_URL}/log`, {
      service_name: 'transfer-service',
      action,
      user_id: userId,
      resource_type: resourceType,
      resource_id: resourceId,
      status,
      details
    });
  } catch (err) {
    console.error('Failed to log audit event:', err);
  }
};

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'Transfer Service is running' });
});

// Get user accounts
app.get('/accounts', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const result = await pool.query(
      'SELECT id, account_number, account_type, balance, currency, is_active FROM accounts WHERE user_id = $1 AND is_active = true',
      [userId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Get accounts error:', err);
    res.status(500).json({ error: 'Failed to retrieve accounts' });
  }
});

// Create transfer
app.post('/create', [
  body('from_account_id').isInt(),
  body('to_account_id').isInt(),
  body('amount').custom(validateAmount),
  body('description').optional().trim().escape()
], async (req, res) => {
  const client = await pool.connect();

  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.headers['x-user-id'];
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const { from_account_id, to_account_id, amount, description } = req.body;

    // Validate accounts belong to correct users
    const fromAccount = await client.query(
      'SELECT id, account_number, balance, user_id FROM accounts WHERE id = $1',
      [from_account_id]
    );

    if (fromAccount.rows.length === 0) {
      await logAudit('transfer', userId, 'transfer', null, 'failed', { reason: 'From account not found' });
      return res.status(404).json({ error: 'From account not found' });
    }

    if (fromAccount.rows[0].user_id != userId) {
      await logAudit('transfer', userId, 'transfer', null, 'failed', { reason: 'Unauthorized access to account' });
      return res.status(403).json({ error: 'Unauthorized access to account' });
    }

    // Check sufficient balance
    if (fromAccount.rows[0].balance < amount) {
      await logAudit('transfer', userId, 'transfer', from_account_id, 'failed', { reason: 'Insufficient balance' });
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    // Start transaction
    await client.query('BEGIN');

    // Generate reference number
    const referenceNumber = `TRF-${uuidv4().substring(0, 8).toUpperCase()}`;

    // Insert transfer record
    const transferResult = await client.query(
      'INSERT INTO transfers (from_account_id, to_account_id, amount, description, reference_number, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [from_account_id, to_account_id, amount, description || '', referenceNumber, 'pending']
    );

    const transferId = transferResult.rows[0].id;

    // Update from account balance
    await client.query(
      'UPDATE accounts SET balance = balance - $1 WHERE id = $2',
      [amount, from_account_id]
    );

    // Update to account balance
    await client.query(
      'UPDATE accounts SET balance = balance + $1 WHERE id = $2',
      [amount, to_account_id]
    );

    // Update transfer status to completed
    await client.query(
      'UPDATE transfers SET status = $1 WHERE id = $2',
      ['completed', transferId]
    );

    await client.query('COMMIT');

    // Log successful transfer
    await logAudit('transfer', userId, 'transfer', transferId, 'success', {
      from_account: fromAccount.rows[0].account_number,
      amount,
      reference_number: referenceNumber
    });

    res.status(201).json({
      message: 'Transfer created successfully',
      transfer: {
        id: transferId,
        reference_number: referenceNumber,
        amount,
        status: 'completed'
      }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create transfer error:', err);
    res.status(500).json({ error: 'Transfer failed' });
  } finally {
    client.release();
  }
});

// Get transfer history
app.get('/history/:account_id', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const accountId = req.params.account_id;

    // Verify account belongs to user
    const account = await pool.query(
      'SELECT user_id FROM accounts WHERE id = $1',
      [accountId]
    );

    if (account.rows.length === 0 || account.rows[0].user_id != userId) {
      return res.status(403).json({ error: 'Unauthorized access' });
    }

    const result = await pool.query(
      'SELECT id, from_account_id, to_account_id, amount, currency, description, status, reference_number, created_at FROM transfers WHERE from_account_id = $1 OR to_account_id = $1 ORDER BY created_at DESC LIMIT 50',
      [accountId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Get history error:', err);
    res.status(500).json({ error: 'Failed to retrieve history' });
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Transfer service error:', err);
  res.status(err.status || 500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

app.listen(PORT, () => {
  console.log(`💰 Transfer Service running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  pool.end();
  process.exit(0);
});
