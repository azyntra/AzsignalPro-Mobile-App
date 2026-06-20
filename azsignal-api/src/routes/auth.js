const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

const generateTokens = (user) => {
  const payload = { userId: user.id, email: user.email, tier: user.subscription_tier };
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '30d' });
  const refreshToken = jwt.sign({ userId: user.id }, process.env.JWT_REFRESH_SECRET, { expiresIn: '30d' });
  return { accessToken, refreshToken };
};

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
