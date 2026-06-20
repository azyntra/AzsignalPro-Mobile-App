const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { OAuth2Client } = require('google-auth-library');

const router = express.Router();
const prisma = new PrismaClient();

// In production, this client ID should match your mobile app client ID
// For mobile apps with Expo, Google checks the audience matches the Web Client ID
const googleClient = new OAuth2Client(process.env.GOOGLE_WEB_CLIENT_ID);

const generateTokens = (user) => {
  const payload = { userId: user.id, email: user.email, tier: user.subscription_tier };
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '30d' });
  const refreshToken = jwt.sign({ userId: user.id }, process.env.JWT_REFRESH_SECRET, { expiresIn: '30d' });
  return { accessToken, refreshToken };
};

router.post('/google', async (req, res) => {
  const { idToken } = req.body;

  if (!idToken) {
    return res.status(400).json({ success: false, message: 'Google ID token is required' });
  }

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      // If audience check is needed, specify audience: process.env.GOOGLE_WEB_CLIENT_ID
      // audience: process.env.GOOGLE_WEB_CLIENT_ID,
    });
    
    const payload = ticket.getPayload();
    const { email, sub: googleId, name } = payload;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Google account missing email' });
    }

    // Find user by email or provider_id
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { provider_id: googleId },
          { email: email }
        ]
      }
    });

    if (user) {
      // If user exists but has no provider_id (e.g. they signed up with email before, now using google)
      // Link the account to google
      if (!user.provider_id) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { provider_id: googleId, auth_provider: 'google' }
        });
      }
    } else {
      // Create a brand new user
      user = await prisma.user.create({
        data: {
          email,
          auth_provider: 'google',
          provider_id: googleId,
          name: name || 'Google User',
          notification_prefs: {
            create: {}
          }
        }
      });
    }

    const { accessToken, refreshToken } = generateTokens(user);

    res.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name, tier: user.subscription_tier },
      accessToken,
      refreshToken
    });
  } catch (error) {
    console.error('Google Auth Error:', error);
    res.status(401).json({ success: false, message: 'Invalid Google token' });
  }
});

router.post('/register', async (req, res) => {
  const { email, password, name } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required' });
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return res.status(400).json({ success: false, message: 'Email already registered' });
  }

  const password_hash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email,
      password_hash,
      auth_provider: 'local',
      name,
      notification_prefs: {
        create: {} // create default preferences
      }
    }
  });

  const { accessToken, refreshToken } = generateTokens(user);

  res.status(201).json({
    success: true,
    user: { id: user.id, email: user.email, name: user.name, tier: user.subscription_tier },
    accessToken,
    refreshToken
  });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  // If user signed up with Google, they might not have a password
  if (!user.password_hash) {
    return res.status(401).json({ success: false, message: 'Please sign in with Google' });
  }

  const validPassword = await bcrypt.compare(password, user.password_hash);
  if (!validPassword) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  const { accessToken, refreshToken } = generateTokens(user);

  res.json({
    success: true,
    user: { id: user.id, email: user.email, name: user.name, tier: user.subscription_tier },
    accessToken,
    refreshToken
  });
});

router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(401).json({ success: false, message: 'Refresh token required' });

  jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET, async (err, payload) => {
    if (err) return res.status(403).json({ success: false, message: 'Invalid refresh token' });

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const newAccessToken = jwt.sign(
      { userId: user.id, email: user.email, tier: user.subscription_tier },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({ success: true, accessToken: newAccessToken });
  });
});

router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    // For security, don't reveal if user exists or not
    return res.json({ success: true, message: 'If an account exists, a reset code was sent' });
  }

  // Generate a random 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // Expire in 15 minutes
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  // Invalidate any existing tokens for this user
  await prisma.passwordResetToken.deleteMany({ where: { user_id: user.id } });

  await prisma.passwordResetToken.create({
    data: {
      user_id: user.id,
      token: otp,
      expires_at: expiresAt,
    }
  });

  // Since we don't have an SMTP provider, we will log it to the console
  console.log(`\n======================================`);
  console.log(`[DEVELOPMENT ONLY]`);
  console.log(`Password reset OTP for ${email} is: ${otp}`);
  console.log(`======================================\n`);

  res.json({ success: true, message: 'A password reset code has been generated. Check the server logs (or email).' });
});

router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) {
    return res.status(400).json({ success: false, message: 'Token and new password are required' });
  }

  const resetToken = await prisma.passwordResetToken.findUnique({ where: { token } });
  
  if (!resetToken) {
    return res.status(400).json({ success: false, message: 'Invalid or expired reset code' });
  }

  if (resetToken.expires_at < new Date()) {
    await prisma.passwordResetToken.delete({ where: { id: resetToken.id } });
    return res.status(400).json({ success: false, message: 'Reset code has expired' });
  }

  // Hash the new password
  const password_hash = await bcrypt.hash(newPassword, 10);

  // Update user's password
  await prisma.user.update({
    where: { id: resetToken.user_id },
    data: { password_hash, auth_provider: 'local' }
  });

  // Delete the used token
  await prisma.passwordResetToken.delete({ where: { id: resetToken.id } });

  res.json({ success: true, message: 'Password has been successfully reset. You can now login.' });
});

module.exports = router;
