var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var cors = require('cors');
var mongoose = require('mongoose');
var dns = require('dns');
var dotenv = require('dotenv');
const Login = require('./models/login');

dotenv.config();

Object.keys(process.env).forEach((key) => {
  if (typeof process.env[key] === 'string') {
    process.env[key] = process.env[key].trim();
    if (key.charCodeAt(0) === 0xFEFF) {
      const normalizedKey = key.slice(1);
      process.env[normalizedKey] = process.env[key];
    }
  }
});

const isProduction = process.env.NODE_ENV === 'production';

const parseCsvEnv = (value, fallback) => {
  const source = typeof value === 'string' ? value : fallback;
  return source
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const defaultOrigins = isProduction 
  ? 'https://muzeer.com,https://www.muzeer.com' 
  : 'http://localhost:5173';

const allowedOrigins = parseCsvEnv(process.env.CORS_ALLOWED_ORIGINS, defaultOrigins);
console.log('🚀 Loaded CORS Allowed Origins:', allowedOrigins);

// --- IMPORTS ---
var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var authRoutes = require('./routes/login');
var app = express();

const authMiddleware = require('./middleware/auth'); // cookie auth

app.set('trust proxy', process.env.TRUST_PROXY || 1);

// --- DATABASE CONNECTION ---
const dnsServers = (process.env.DNS_SERVERS || '1.1.1.1,8.8.8.8')
  .split(',')
  .map((server) => server.trim())
  .filter(Boolean);

if (dnsServers.length > 0) {
  try {
    dns.setServers(dnsServers);
  } catch (err) {
    console.warn('Could not apply custom DNS_SERVERS:', err.message);
  }
}

async function connectDatabase() {
  const databaseUri = process.env.DATABASE;
  const directDatabaseUri = process.env.DATABASE_DIRECT;

  if (!databaseUri) {
    console.warn('DATABASE is not set in server/.env. Server started without MongoDB connection.');
    return;
  }

  try {
    await mongoose.connect(databaseUri, { serverSelectionTimeoutMS: 5000 });
    console.log('Connected to MongoDB');
  } catch (err) {
    const isSrvDnsIssue = err && err.code === 'ECONNREFUSED' && err.syscall === 'querySrv';

    if (isSrvDnsIssue && directDatabaseUri) {
      try {
        console.warn('MongoDB SRV DNS lookup failed. Trying DATABASE_DIRECT fallback...');
        await mongoose.connect(directDatabaseUri, { serverSelectionTimeoutMS: 5000 });
        console.log('Connected to MongoDB (DATABASE_DIRECT fallback)');
        return;
      } catch (directErr) {
        console.error('Error connecting to MongoDB with DATABASE_DIRECT:', directErr);
        return;
      }
    }

    if (isSrvDnsIssue) {
      console.error('MongoDB SRV DNS lookup failed. Set DATABASE_DIRECT in server/.env or fix local DNS/network.');
      return;
    }

    console.error('Error connecting to MongoDB:', err);
  }
}

connectDatabase();

// --- VIEW ENGINE ---
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// --- MIDDLEWARE (Order is critical) ---
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// ✅ serve uploaded avatars
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- CORS (must be before routes) ---
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  allowedHeaders: 'Content-Type, Authorization',
};

let safeSameSite = (process.env.COOKIE_SAME_SITE || 'lax')
  .replace(/['"\r\n\s]/g, '')
  .toLowerCase();

// Double-check it. If it's still weird, default it to 'none' for production
if (!['none', 'lax', 'strict'].includes(safeSameSite)) {
  safeSameSite = process.env.NODE_ENV === 'production' ? 'none' : 'lax';
}

const safeDomain = process.env.COOKIE_DOMAIN ? process.env.COOKIE_DOMAIN.trim() : undefined;

// --- SET GLOBALS ---
app.locals.cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production', // MUST be true if sameSite is 'none'
  sameSite: safeSameSite,
  domain: safeDomain,
  path: '/',
  maxAge: 2 * 60 * 60 * 1000 // 2 hours (or whatever you had before)
};


app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// --- ROUTES ---
app.use('/', indexRouter);
app.use('/users', usersRouter);

app.use('/api/admin', require('./routes/admin'));
app.use('/api/bot', require('./routes/bot'));
app.use('/api/token', require('./routes/token'));
app.use('/api/media', require('./routes/media'));
app.use('/api/artist', require('./routes/artist'));

// Auth router
app.use('/api/auth', authRoutes);

// Me router
app.use('/api/me', require('./routes/me'));



// Heartbeat verify
app.get('/api/auth/verify', authMiddleware, async (req, res) => {
  try {
    // Note: Use req.user.id, req.user._id, or however your authMiddleware stores the user ID
    const userId = req.user.id || req.user._id || req.user.userId; 
    
    // Fetch the freshest data from the database
    const user = await Login.findById(userId);

    // 1. User doesn't exist anymore (deleted)
    if (!user) {
      return res.status(401).json({ error: "User no longer exists" });
    }

    // 2. User exists, but an admin banned them
    if (user.isBanned) {
      return res.status(403).json({ error: "Account suspended", isBanned: true });
    }

    // 3. User is good to go
    res.status(200).json({ 
      message: "User is alive", 
      isBanned: false,
      role: user.role 
    });

  } catch (err) {
    console.error("Heartbeat DB Check Error:", err);
    res.status(500).json({ error: "Server error" });
  }
});
// --- EMAIL VERIFY ENDPOINT ---
app.get('/api/auth/verify-email/:token', async (req, res) => {
  try {
    const token = req.params.token;
    const user = await Login.findOne({ verifyToken: token });

    if (!user) {
      return res.status(400).send(`
        <div style="margin:0;background:#060918;min-height:100vh;width:100%;display:flex;align-items:center;justify-content:center;font-family:Arial,sans-serif;padding:24px;box-sizing:border-box;">
          <div style="max-width:560px;width:100%;background:#0b1020;border:1px solid #1e293b;border-radius:12px;padding:28px;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,0.35);">
            <h2 style="margin:0 0 10px 0;color:#f8fafc;font-size:28px;line-height:1.3;">Verification failed</h2>
            <p style="margin:0;color:#94a3b8;font-size:16px;line-height:1.7;">This verification link is invalid or has expired. Please request a new verification email and try again.</p>
          </div>
        </div>
      `);
    }

    user.isVerified = true;
    user.verifyToken = undefined;
    await user.save();

    res.status(200).send(`
      <div style="margin:0;background:#060918;min-height:100vh;width:100%;display:flex;align-items:center;justify-content:center;font-family:Arial,sans-serif;padding:24px;box-sizing:border-box;">
        <div style="max-width:560px;width:100%;background:#0b1020;border:1px solid #1e293b;border-radius:12px;padding:28px;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,0.35);">
          <h1 style="margin:0 0 10px 0;color:#f8fafc;font-size:34px;line-height:1.2;">Email verified</h1>
          <p style="margin:0;color:#94a3b8;font-size:16px;line-height:1.7;">Your account has been successfully verified. You can close this window and log in to Muzeer.</p>
        </div>

        <script>
          setTimeout(() => { window.close(); }, 3000);
        </script>
      </div>
    `);
  } catch (err) {
    console.error("Verification Error:", err);
    res.status(500).send("Server error during verification.");
  }
});

// --- ERROR HANDLING ---
app.use(function(req, res, next) {
  next(createError(404));
});

app.use(function(err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;