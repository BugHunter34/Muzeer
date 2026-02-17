var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var cors = require('cors');
var mongoose = require('mongoose');
require("dotenv").config();

// --- IMPORTS ---
var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var authRoutes = require('./routes/login'); // This handles login AND register

var app = express();

// --- DATABASE CONNECTION ---
mongoose
  .connect(process.env.DATABASE, {
    serverSelectionTimeoutMS: 5000,
  })
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('Error connecting to MongoDB:', err));

// --- MIDDLEWARE (Order is critical!) ---
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(express.json()); // MUST be before routes to read JSON body
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(cors()); 

// --- ROUTES ---
app.use('/', indexRouter);
app.use('/users', usersRouter);

// Mount the Auth Router
// This means all routes in 'routes/login.js' will start with /api/auth
app.use('/api/auth', authRoutes); 

// --- ERROR HANDLING ---
// Catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// Error handler
app.use(function(err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;