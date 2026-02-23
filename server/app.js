var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var cors = require('cors');
var mongoose = require('mongoose');
var dns = require('dns');
var dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '.env') });

// --- Fix BOM in env keys ---
Object.keys(process.env).forEach((key) => {
  if (key.charCodeAt(0) === 0xFEFF) {
    const normalizedKey = key.slice(1);
    if (!process.env[normalizedKey]) {
      process.env[normalizedKey] = process.env[key];
    }
  }
});

// --- IMPORTS ---
var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var authRoutes = require('./routes/login');
var app = express();

const authMiddleware = require('./middleware/auth'); // cookie auth

// --- CORS CONFIGURATION ---
const allowedOrigins = [
  'http://localhost:5173',
  // 'https://evocative-fransisca-bootlessly.ngrok-free.dev'
];

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

// --- CORS (must be before routes) ---
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (curl, mobile apps)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  allowedHeaders: 'Content-Type, Authorization',
};

app.use(cors(corsOptions));
// preflight pro všechno
app.options('*', cors(corsOptions));

// --- ROUTES ---
app.use('/', indexRouter);
app.use('/users', usersRouter);

app.use('/api/admin', require('./routes/admin'));
app.use('/api/bot', require('./routes/bot'));
app.use('/api/token', require('./routes/token'));

// Auth router
app.use('/api/auth', authRoutes);

// ✅ Me router (profile self)
app.use('/api/me', require('./routes/me'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// Heartbeat verify
app.get('/api/auth/verify', authMiddleware, (req, res) => {
  res.status(200).json({ message: "User is alive" });
});

// --- EMAIL VERIFY ENDPOINT ---
const Login = require('./models/login');

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