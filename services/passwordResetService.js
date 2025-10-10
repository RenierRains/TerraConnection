'use strict';

const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { Op } = require('sequelize');
const db = require('../models');
const { sendPasswordResetEmail } = require('../utils/emailService');
const { logSecurityAudit, logUserAudit } = require('../controllers/auditLogger');

const OTP_LENGTH = parseInt(process.env.PASSWORD_RESET_OTP_LENGTH || '6', 10);
const OTP_TTL_MINUTES = parseInt(process.env.PASSWORD_RESET_OTP_TTL_MINUTES || '15', 10);
const MAX_ATTEMPTS = parseInt(process.env.PASSWORD_RESET_MAX_ATTEMPTS || '5', 10);
const REQUEST_COOLDOWN_MINUTES = parseInt(process.env.PASSWORD_RESET_REQUEST_COOLDOWN_MINUTES || '5', 10);
const SESSION_TOKEN_TTL_MINUTES = parseInt(process.env.PASSWORD_RESET_SESSION_TTL_MINUTES || '30', 10);

const SALT_ROUNDS = 10;

function maskEmail(email) {
  if (!email || typeof email !== 'string') {
    return '';
  }
  const [user, domain] = email.split('@');
  if (!domain) return email;
  const maskedUser = user.length <= 2
    ? `${user[0] || ''}*`
    : `${user[0]}${'*'.repeat(Math.max(user.length - 2, 1))}${user[user.length - 1]}`;
  return `${maskedUser}@${domain}`;
}

function generateNumericOtp(length) {
  if (length <= 0) {
    throw new Error('OTP length must be greater than zero');
  }
  const digits = [];
  for (let i = 0; i < length; i++) {
    digits.push(Math.floor(Math.random() * 10));
  }
  return digits.join('');
}

async function enforceCooldown(userId) {
  const cooldownTimestamp = new Date(Date.now() - REQUEST_COOLDOWN_MINUTES * 60 * 1000);
  const recentRequest = await db.Password_Reset_Token.findOne({
    where: {
      user_id: userId,
      created_at: { [Op.gt]: cooldownTimestamp },
      invalidated_at: null,
      used_at: null
    },
    order: [['created_at', 'DESC']]
  });

  if (recentRequest) {
    const minutesRemaining = Math.max(
      0,
      REQUEST_COOLDOWN_MINUTES - Math.floor((Date.now() - recentRequest.created_at.getTime()) / 60000)
    );
    const error = new Error('Password reset already requested recently');
    error.code = 'COOLDOWN_ACTIVE';
    error.retryAfterMinutes = minutesRemaining;
    throw error;
  }
}

async function invalidatePreviousTokens(userId) {
  await db.Password_Reset_Token.update(
    {
      invalidated_at: new Date(),
      invalidated_reason: 'superseded'
    },
    {
      where: {
        user_id: userId,
        used_at: null,
        invalidated_at: null
      }
    }
  );
}

async function requestPasswordReset(email, clientIp) {
  const normalizedEmail = (email || '').trim().toLowerCase();
  if (!normalizedEmail) {
    const error = new Error('Email is required');
    error.code = 'EMAIL_REQUIRED';
    throw error;
  }

  const user = await db.User.findOne({ where: { email: normalizedEmail } });
  if (!user) {
    await logSecurityAudit(null, 'PASSWORD_RESET_REQUEST', {
      email: normalizedEmail,
      ip: clientIp,
      reason: 'unknown_email'
    });
    const error = new Error('Account does not exist.');
    error.code = 'ACCOUNT_NOT_FOUND';
    throw error;
  }

  await enforceCooldown(user.id);
  await invalidatePreviousTokens(user.id);

  const otp = generateNumericOtp(OTP_LENGTH);
  const otpHash = await bcrypt.hash(otp, SALT_ROUNDS);

  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  const tokenRecord = await db.Password_Reset_Token.create({
    user_id: user.id,
    otp_hash: otpHash,
    request_ip: clientIp,
    expires_at: expiresAt
  });

  const emailSent = await sendPasswordResetEmail(user.email, otp);

  if (!emailSent) {
    await tokenRecord.update({
      invalidated_at: new Date(),
      invalidated_reason: 'email_send_failed'
    });

    const error = new Error('Failed to send reset email');
    error.code = 'EMAIL_FAILED';
    throw error;
  }

  const expiresAtIso = expiresAt.toISOString();

  await logSecurityAudit(user.id, 'PASSWORD_RESET_REQUEST', {
    email: maskEmail(user.email),
    ip: clientIp,
    tokenId: tokenRecord.id,
    expiresAt: expiresAtIso
  });

  return {
    emailMasked: maskEmail(user.email),
    emailSent: true,
    expiresAt: expiresAtIso
  };
}

async function verifyResetOtp(email, otp) {
  const normalizedEmail = (email || '').trim().toLowerCase();
  if (!normalizedEmail || !otp) {
    const error = new Error('Email and OTP are required');
    error.code = 'MISSING_FIELDS';
    throw error;
  }

  const user = await db.User.findOne({ where: { email: normalizedEmail } });
  if (!user) {
    const error = new Error('Invalid OTP');
    error.code = 'INVALID_OTP';
    throw error;
  }

  const tokenRecord = await db.Password_Reset_Token.findOne({
    where: {
      user_id: user.id,
      used_at: null,
      invalidated_at: null,
      expires_at: { [Op.gt]: new Date() }
    },
    order: [['created_at', 'DESC']]
  });

  if (!tokenRecord) {
    const error = new Error('OTP expired or not found');
    error.code = 'OTP_EXPIRED';
    throw error;
  }

  if (tokenRecord.attempt_count >= MAX_ATTEMPTS) {
    await tokenRecord.update({
      invalidated_at: new Date(),
      invalidated_reason: 'max_attempts'
    });

    const error = new Error('Too many invalid attempts');
    error.code = 'MAX_ATTEMPTS';
    throw error;
  }

  const matches = await bcrypt.compare(otp, tokenRecord.otp_hash);

  if (!matches) {
    const attempts = tokenRecord.attempt_count + 1;
    const updates = {
      attempt_count: attempts
    };
    if (attempts >= MAX_ATTEMPTS) {
      updates.invalidated_at = new Date();
      updates.invalidated_reason = 'max_attempts';
      await logSecurityAudit(user.id, 'PASSWORD_RESET_MAX_ATTEMPTS', {
        tokenId: tokenRecord.id
      });
    }

    await tokenRecord.update(updates);

    const error = new Error('Invalid OTP');
    error.code = 'INVALID_OTP';
    error.attemptsRemaining = Math.max(MAX_ATTEMPTS - attempts, 0);
    throw error;
  }

  const sessionTokenPlain = crypto.randomBytes(32).toString('hex');
  const sessionTokenHash = await bcrypt.hash(sessionTokenPlain, SALT_ROUNDS);

  const sessionExpiresAt = new Date(Date.now() + SESSION_TOKEN_TTL_MINUTES * 60 * 1000);

  await tokenRecord.update({
    reset_token_hash: sessionTokenHash,
    attempt_count: 0,
    expires_at: sessionExpiresAt
  });

  await logSecurityAudit(user.id, 'PASSWORD_RESET_OTP_VERIFIED', {
    tokenId: tokenRecord.id
  });

  return {
    resetToken: sessionTokenPlain,
    expiresAt: sessionExpiresAt.toISOString(),
    userId: user.id
  };
}

function validatePasswordStrength(password) {
  const minLength = parseInt(process.env.PASSWORD_RESET_MIN_LENGTH || '8', 10);
  if (!password || password.length < minLength) {
    return `Password must be at least ${minLength} characters long.`;
  }
  const requireNumber = process.env.PASSWORD_RESET_REQUIRE_NUMBER !== 'false';
  const requireLetter = process.env.PASSWORD_RESET_REQUIRE_LETTER !== 'false';
  if (requireNumber && !/\d/.test(password)) {
    return 'Password must contain at least one number.';
  }
  if (requireLetter && !/[A-Za-z]/.test(password)) {
    return 'Password must contain at least one letter.';
  }
  return null;
}

async function resetPassword(email, resetToken, newPassword) {
  const normalizedEmail = (email || '').trim().toLowerCase();
  if (!normalizedEmail || !resetToken || !newPassword) {
    const error = new Error('Email, reset token, and password are required');
    error.code = 'MISSING_FIELDS';
    throw error;
  }

  const strengthError = validatePasswordStrength(newPassword);
  if (strengthError) {
    const error = new Error(strengthError);
    error.code = 'WEAK_PASSWORD';
    throw error;
  }

  const user = await db.User.findOne({ where: { email: normalizedEmail } });
  if (!user) {
    const error = new Error('Invalid reset token');
    error.code = 'INVALID_TOKEN';
    throw error;
  }

  const tokenRecord = await db.Password_Reset_Token.findOne({
    where: {
      user_id: user.id,
      reset_token_hash: { [Op.ne]: null },
      used_at: null,
      invalidated_at: null,
      expires_at: { [Op.gt]: new Date() }
    },
    order: [['updated_at', 'DESC']]
  });

  if (!tokenRecord) {
    const error = new Error('Reset session expired');
    error.code = 'SESSION_EXPIRED';
    throw error;
  }

  const tokenMatches = await bcrypt.compare(resetToken, tokenRecord.reset_token_hash);

  if (!tokenMatches) {
    const error = new Error('Invalid reset token');
    error.code = 'INVALID_TOKEN';
    throw error;
  }

  const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await user.update({ password_hash: newPasswordHash });

  await tokenRecord.update({
    used_at: new Date(),
    invalidated_at: new Date(),
    invalidated_reason: 'completed',
    reset_token_hash: null
  });

  await logUserAudit(user.id, 'PASSWORD_CHANGE', {
    email: maskEmail(user.email)
  });

  return { success: true };
}

module.exports = {
  requestPasswordReset,
  verifyResetOtp,
  resetPassword
};
