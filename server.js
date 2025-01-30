const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const authRoutes = require('./routes/auth');
const bookRoutes = require('./routes/books');

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/books', bookRoutes);

// MongoDB connection //mongodb://localhost:27017/bookstall // mongodb+srv://Dinesh:Dkimp2005@cluster0.hlwz20a.mongodb.net/bookstall
mongoose.connect(process.env.MONGODB_URI || ' mongodb+srv://Dinesh:Dkimp2005@cluster0.hlwz20a.mongodb.net/bookstall ')
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
