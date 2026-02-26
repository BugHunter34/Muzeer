module.exports = (req, res, next) => {
  const role = req.user?.role;

  if (role === 'owner') return next();

  return res.status(403).json({ message: 'Access denied. System owners only.' });
};