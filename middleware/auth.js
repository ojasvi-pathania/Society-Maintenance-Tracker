const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_academic_submission_2026';

function verifyToken(req, res, next) {
  let token = null;

  // Check header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required. Please log in.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired session. Please log in again.' });
  }
}

function requireAdmin(req, res, next) {
  verifyToken(req, res, () => {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Access denied. Admin privileges required.' });
    }
    next();
  });
}

function requireResident(req, res, next) {
  verifyToken(req, res, () => {
    if (req.user.role !== 'RESIDENT') {
      return res.status(403).json({ success: false, message: 'Access denied. Resident role required.' });
    }
    next();
  });
}

module.exports = {
  verifyToken,
  requireAdmin,
  requireResident
};
