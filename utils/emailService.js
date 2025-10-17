'use strict';

const { Resend } = require('resend');

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

async function sendViaResend({ to, subject, html }) {
  if (!resend) return false;
  try {
    const { data, error } = await resend.emails.send({
      from: 'TerraConnection <noreply@terraconnection.online>',
      to,
      subject,
      html
    });
    if (error) {
      console.error('[Email] Resend send failed:', error);
      return false;
    }
    console.log('[Email] Resend message sent:', data?.id);
    return true;
  } catch (error) {
    console.error('[Email] Resend exception:', error);
    return false;
  }
}

async function dispatchEmail({ to, subject, html }) {
  if (await sendViaResend({ to, subject, html })) {
    return true;
  }
  console.error('[Email] Resend provider unavailable or failed for', subject, to);
  return false;
}

const sendOtpEmail = async (email, otp) => {
  const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Login Verification Code</h2>
            <p>Your verification code for TerraConnection is:</p>
            <div style="background-color: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0; border-radius: 8px;">
                ${otp}
            </div>
            <p style="color: #666;">This code will expire in 5 minutes.</p>
            <p style="color: #999; font-size: 14px;">If you didn't request this code, please ignore this email.</p>
        </div>
    `;
  return dispatchEmail({
    to: email,
    subject: 'TerraConnection Login Verification Code',
    html
  });
};

const sendPasswordResetEmail = async (email, otp) => {
  const ttl = process.env.PASSWORD_RESET_OTP_TTL_MINUTES || 15;
  const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Password Reset Requested</h2>
            <p>We received a request to reset the password on your TerraConnection account.</p>
            <p>Please use the verification code below to continue:</p>
            <div style="background-color: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0; border-radius: 8px;">
                ${otp}
            </div>
            <p style="color: #666;">This code will expire in ${ttl} minutes.</p>
            <p style="color: #999; font-size: 14px;">If you did not request a password reset, you can safely ignore this email.</p>
        </div>
    `;
  return dispatchEmail({
    to: email,
    subject: 'Reset your TerraConnection password',
    html
  });
};

module.exports = {
  sendOtpEmail,
  sendPasswordResetEmail
};
