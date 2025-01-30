const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

// Temporary route to check user details
router.get('/check/:email', async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email });
    if (user) {
      res.json({
        exists: true,
        email: user.email,
        role: user.role,
        hasPassword: !!user.password
      });
    } else {
      res.json({ exists: false });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Debug route to check password
router.post('/debug-password', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.json({ error: 'User not found' });
    }

    const plainTextHash = await bcrypt.hash(password, 10);
    const isMatch = await bcrypt.compare(password, user.password);

    res.json({
      userExists: true,
      passwordInDb: user.password,
      newHashedPassword: plainTextHash,
      passwordMatch: isMatch
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Client Register
router.post('/client/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create new user with hashed password
    const user = new User({
      username,
      email,
      password: hashedPassword,
      role: 'client'
    });
    await user.save();
    
    const token = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET || 'secret');
    res.status(201).json({ token, role: 'client' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Admin Register
router.post('/admin/register', async (req, res) => {
  try {
    const { username, email, password, adminSecret } = req.body;
    
    // Verify admin secret
    if (adminSecret !== process.env.ADMIN_SECRET) {
      return res.status(403).json({ error: 'Invalid admin secret key' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password using a consistent salt rounds value
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Create new admin user with hashed password
    const user = new User({
      username,
      email,
      password: hashedPassword,
      role: 'admin'
    });
    
    await user.save();
    console.log('Admin registered:', {
      email: user.email,
      hashedPassword: user.password,
      role: user.role
    });
    
    const token = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET || 'secret');
    res.status(201).json({ token, role: 'admin' });
  } catch (error) {
    console.error('Admin registration error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Client Login
router.post('/client/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email, role: 'client' });
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET || 'secret');
    res.json({ token, role: 'client' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Admin Login
router.post('/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('Admin login attempt:', { email });

    const user = await User.findOne({ email });
    if (!user) {
      console.log('User not found');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.role !== 'admin') {
      console.log('Not an admin user');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Log the stored password hash
    console.log('Stored password hash:', user.password);
    
    // Create a new hash of the provided password for comparison
    const salt = await bcrypt.genSalt(10);
    const testHash = await bcrypt.hash(password, salt);
    console.log('New hash of provided password:', testHash);

    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.password);
    console.log('Password match result:', isMatch);

    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET || 'secret');
    res.json({ token, role: 'admin' });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
