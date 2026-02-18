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

const authMiddleware = require('./middleware/auth'); // Check path if needed

// The Heartbeat endpoint


// --- CORS CONFIGURATION ---
const allowedOrigins = [
  'http://localhost:5173', 
  'https://evocative-fransisca-bootlessly.ngrok-free.dev'
];

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

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // This is the magic line that allows the login cookie!
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
  allowedHeaders: "Content-Type, Authorization"
}));

// --- ROUTES ---
app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/api/admin', require('./routes/admin'));

// Mount the Auth Router
// This means all routes in 'routes/login.js' will start with /api/auth
app.use('/api/auth', authRoutes); 

app.get('/api/auth/verify', authMiddleware, (req, res) => {
  // If the auth middleware passes, they are still alive!
  res.status(200).json({ message: "User is alive" });
});

const Login = require('./models/login'); // Ujisti se, že cesta k modelu je správná

// ENDPOINT PRO KLIKNUTÍ NA LINK V EMAILU
app.get('/api/auth/verify-email/:token', async (req, res) => {
  try {
    const token = req.params.token;
    
    // 1. Najdi uživatele s tímto unikátním tokenem
    const user = await Login.findOne({ verifyToken: token });

    // 2. Pokud token neexistuje nebo už byl použit
    if (!user) {
      return res.status(400).send(`
        <div style="background-color: #02021a; color: #ff2a2a; height: 100vh; width: 100vw; display: flex; align-items: center; justify-content: center; font-family: sans-serif; margin: 0;">
          <h2>❌ Invalid or expired verification link.</h2>
        </div>
      `);
    }

    // 3. ÚSPĚCH! Odemkni uživatele a smaž token z DB
    user.isVerified = true;
    user.verifyToken = undefined;
    await user.save();

    // 4. Pošli krásnou HTML odpověď přímo do prohlížeče
    res.status(200).send(`
      <div style="background-color: #02021a; color: #facc15; height: 100vh; width: 100vw; display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: sans-serif; margin: 0; text-align: center;">
        <h1 style="font-size: 3rem; margin-bottom: 10px;">✅ Auth Completed!</h1>
        <p style="color: rgba(255,255,255,0.7); font-size: 1.2rem;">Your account is now verified. You can close this window and log in to Muzeer.</p>
        
        <script>
          setTimeout(() => {
            window.close();
          }, 3000);
        </script>
      </div>
    `);

  } catch (err) {
    console.error("Verification Error:", err);
    res.status(500).send("Server error during verification.");
  }
});

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