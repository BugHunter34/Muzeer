// Google OAuth2 — no passport, pure Node https
const https = require('https');
const Login = require('../models/login');
const jwt = require('jsonwebtoken');

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

function getCallbackUrl() {
  return (
    process.env.GOOGLE_CALLBACK_URL ||
    `${process.env.PUBLIC_API_URL}/api/auth/google/callback`
  );
}

function getFrontendUrl() {
  return (
    process.env.FRONTEND_URL ||
    (process.env.CORS_ALLOWED_ORIGINS || '').split(',')[0].trim() ||
    'http://localhost:5173'
  );
}

// POST to Google token endpoint
function googleTokenExchange(params) {
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams(params).toString();
    const url = new URL(GOOGLE_TOKEN_URL);
    const req = https.request(
      {
        hostname: url.hostname,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let d = '';
        res.on('data', (c) => (d += c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(d));
          } catch (e) {
            reject(new Error('Failed to parse token response'));
          }
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// GET Google userinfo
function googleUserInfo(accessToken) {
  return new Promise((resolve, reject) => {
    const url = new URL(GOOGLE_USERINFO_URL);
    https
      .get(
        {
          hostname: url.hostname,
          path: url.pathname,
          headers: { Authorization: `Bearer ${accessToken}` },
        },
        (res) => {
          let d = '';
          res.on('data', (c) => (d += c));
          res.on('end', () => {
            try {
              resolve(JSON.parse(d));
            } catch (e) {
              reject(new Error('Failed to parse userinfo response'));
            }
          });
        }
      )
      .on('error', reject);
  });
}

// GET /api/auth/google — redirect to Google consent screen
exports.googleRedirect = (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return res
      .status(500)
      .send('Google OAuth is not configured (GOOGLE_CLIENT_ID missing).');
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getCallbackUrl(),
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'online',
    prompt: 'select_account',
  });

  res.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
};

// GET /api/auth/google/callback
exports.googleCallback = async (req, res) => {
  const frontendUrl = getFrontendUrl();

  try {
    const { code, error } = req.query;

    if (error || !code) {
      return res.redirect(`${frontendUrl}/login?googleError=cancelled`);
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return res.redirect(`${frontendUrl}/login?googleError=config`);
    }

    // Exchange auth code for access token
    const tokenData = await googleTokenExchange({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: getCallbackUrl(),
      grant_type: 'authorization_code',
    });

    if (tokenData.error) {
      console.error('Google token exchange error:', tokenData.error_description);
      return res.redirect(`${frontendUrl}/login?googleError=token`);
    }

    // Get Google user profile
    const profile = await googleUserInfo(tokenData.access_token);
    if (!profile.email) {
      return res.redirect(`${frontendUrl}/login?googleError=profile`);
    }

    const googleEmail = profile.email.toLowerCase();

    // Find existing user by googleId or email
    let user = await Login.findOne({
      $or: [{ googleId: profile.sub }, { email: googleEmail }],
    });

    if (user) {
      // Link Google ID if account existed before OAuth was added
      if (!user.googleId) {
        user.googleId = profile.sub;
        await user.save();
      }
    } else {
      // Create new user from Google profile
      let userName = (profile.name || googleEmail.split('@')[0])
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9_]/g, '')
        .slice(0, 24);
      if (!userName) userName = 'user';

      // Ensure unique userName
      const existing = await Login.findOne({ userName });
      if (existing) {
        userName = `${userName}_${Date.now().toString(36).slice(-4)}`;
      }

      user = await Login.create({
        email: googleEmail,
        userName,
        passwordHash: null,
        googleId: profile.sub,
        isVerified: true,
        role: 'user',
      });
    }

    if (user.isBanned) {
      return res.redirect(`${frontendUrl}/login?googleError=banned`);
    }

    // Issue JWT cookie (same as regular login)
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    );

    res.cookie('token', token, req.app.locals.cookieOptions);
    res.redirect(`${frontendUrl}?googleAuth=1`);
  } catch (err) {
    console.error('Google OAuth callback error:', err);
    res.redirect(`${frontendUrl}/login?googleError=server`);
  }
};
