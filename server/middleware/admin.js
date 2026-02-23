// server/middleware/admin.js
module.exports = (req, res, next) => {
  console.log("ADMIN MIDDLEWARE HIT:", req.method, req.originalUrl, "ROLE:", req.user?.role);

  const role = req.user?.role;
  if (role === "admin" || role === "owner") return next();

  return res.status(403).json({ message: "Access denied. Admins/Owners only." });
};