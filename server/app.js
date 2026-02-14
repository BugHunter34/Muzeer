var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
require("dotenv").config();

const cors = require('cors'); // You had this...
const mongoose = require('mongoose');

const cookieParser = require('cookie-parser');
app.use(cookieParser()); // Make sure this is above your routes

mongoose
.connect(process.env.DATABASE, {
  serverSelectionTimeoutMS: 5000,
})
.then(() => console.log('Connected to MongoDB'))
.catch((err) => console.error('Error connecting to MongoDB:', err));

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var loginRouter = require('./routes/login'); // 1. IMPORT YOUR LOGIN ROUTER

var app = express();

app.use(cors()); // 2. USE CORS! Without this, React cannot fetch from Express.

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/api/auth', loginRouter); // 3. MOUNT THE LOGIN ROUTER
// Your endpoints are now: http://localhost:3000/api/auth/login and /register

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;