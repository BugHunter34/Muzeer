module.exports = (req, res, next) => {
  // auth.js runs first and creates req.user. 
  // Now we just check if that user is an admin.
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    return res.status(403).json({ message: "Access denied. Admins only, nice try!" });
  }
};