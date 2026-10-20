const User = require('../models/User');
const generateToken = require('../utils/generateToken');

// Sets the JWT as an httpOnly cookie on the response
const sendTokenCookie = (res, token) => {
  res.cookie('token', token, {
    httpOnly: true,                                  // JS on the frontend can't read this — protects against XSS token theft
    secure: process.env.NODE_ENV === 'production',    // only sent over HTTPS in production
    sameSite: 'lax',                                  // baseline CSRF protection
    maxAge: 30 * 24 * 60 * 60 * 1000,                 // 30 days, matches JWT expiry
  });
};

// POST /api/auth/signup
const signup = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    const user = await User.create({ name, email, password });
    const token = generateToken(user._id);
    sendTokenCookie(res, token);

    res.status(201).json({
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (err) {
    res.status(500).json({ message: 'Signup failed', error: err.message });
  }
};

// POST /api/auth/login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user || !(await user.matchPassword(password))) {
      // deliberately vague — don't reveal whether the email exists or the password was wrong
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = generateToken(user._id);
    sendTokenCookie(res, token);

    res.status(200).json({
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (err) {
    res.status(500).json({ message: 'Login failed', error: err.message });
  }
};

// POST /api/auth/logout
const logout = (req, res) => {
  res.clearCookie('token');
  res.status(200).json({ message: 'Logged out' });
};

// GET /api/auth/me  (protected)
const getMe = (req, res) => {
  // req.user was attached by the protect middleware
  res.status(200).json({
    user: { id: req.user._id, name: req.user.name, email: req.user.email },
  });
};

module.exports = { signup, login, logout, getMe };