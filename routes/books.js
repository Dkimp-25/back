const express = require('express');
const Book = require('../models/Book');
const Purchase = require('../models/Purchase');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Middleware to authenticate user
const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization').replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    req.userId = decoded.userId;
    req.role = decoded.role;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Please authenticate' });
  }
};

// Get all available books
router.get('/available', async (req, res) => {
  try {
    const books = await Book.find({ 
      status: 'available', 
      quantity: { $gt: 0 } 
    }).populate('seller', 'username');
    res.json(books);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get pending books (admin only)
router.get('/pending', auth, async (req, res) => {
  try {
    if (req.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const books = await Book.find({ status: 'pending' })
      .populate('seller', 'username email');
    res.json(books);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Approve or reject book (admin only)
router.patch('/:id/review', auth, async (req, res) => {
  try {
    if (req.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { action } = req.body;
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    const book = await Book.findById(req.params.id);
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    if (book.status !== 'pending') {
      return res.status(400).json({ error: 'Book is not pending review' });
    }

    book.status = action === 'approve' ? 'available' : 'rejected';
    await book.save();
    res.json(book);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get book statistics
router.get('/statistics', auth, async (req, res) => {
  try {
    if (req.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const totalBooks = await Book.countDocuments();
    const availableBooks = await Book.countDocuments({ 
      status: 'available',
      quantity: { $gt: 0 }
    });
    const soldBooks = await Book.countDocuments({ status: 'sold' });
    const pendingBooks = await Book.countDocuments({ status: 'pending' });
    const outOfStock = await Book.countDocuments({ 
      status: 'available',
      quantity: 0
    });

    const totalQuantity = await Book.aggregate([
      { $match: { status: 'available' } },
      { $group: { _id: null, total: { $sum: '$quantity' } } }
    ]);

    const totalSoldQuantity = await Book.aggregate([
      { $group: { _id: null, total: { $sum: '$soldQuantity' } } }
    ]);

    res.json({
      totalBooks,
      availableBooks,
      soldBooks,
      pendingBooks,
      outOfStock,
      totalQuantity: totalQuantity[0]?.total || 0,
      totalSoldQuantity: totalSoldQuantity[0]?.total || 0
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Add a new book (for selling)
router.post('/', auth, async (req, res) => {
  try {
    const book = new Book({
      ...req.body,
      seller: req.userId,
      status: req.role === 'admin' ? 'available' : 'pending',
      soldQuantity: 0
    });
    await book.save();
    res.status(201).json(book);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Buy a book
router.patch('/:id/buy', auth, async (req, res) => {
  try {
    const { quantity: purchaseQuantity } = req.body;
    const book = await Book.findById(req.params.id);
    
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }
    
    if (book.status !== 'available' || book.quantity < purchaseQuantity) {
      return res.status(400).json({ 
        error: book.quantity < purchaseQuantity ? 
          'Requested quantity not available' : 
          'Book not available for purchase'
      });
    }

    // Create purchase record
    const purchase = new Purchase({
      buyer: req.userId,
      book: book._id,
      quantity: purchaseQuantity,
      totalPrice: book.price * purchaseQuantity
    });
    await purchase.save();

    // Update quantity and soldQuantity
    book.quantity -= purchaseQuantity;
    book.soldQuantity += purchaseQuantity;
    
    if (book.quantity === 0) {
      book.status = 'sold';
    }
    
    await book.save();
    res.json({ book, purchase });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get user's books with sales information
router.get('/my-books', auth, async (req, res) => {
  try {
    const books = await Book.find({ seller: req.userId });
    res.json(books);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get user's purchase history
router.get('/purchases', auth, async (req, res) => {
  try {
    const purchases = await Purchase.find({ buyer: req.userId })
      .populate('book')
      .sort({ purchaseDate: -1 });
    res.json(purchases);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get client statistics
router.get('/client-stats', auth, async (req, res) => {
  try {
    const totalBooks = await Book.countDocuments({ seller: req.userId });
    const pendingBooks = await Book.countDocuments({ 
      seller: req.userId,
      status: 'pending'
    });
    const approvedBooks = await Book.countDocuments({ 
      seller: req.userId,
      status: 'available'
    });
    const rejectedBooks = await Book.countDocuments({ 
      seller: req.userId,
      status: 'rejected'
    });
    const totalPurchases = await Purchase.countDocuments({ buyer: req.userId });

    res.json({
      totalBooks,
      pendingBooks,
      approvedBooks,
      rejectedBooks,
      totalPurchases
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
