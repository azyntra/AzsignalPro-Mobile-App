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

module.exports = router;
