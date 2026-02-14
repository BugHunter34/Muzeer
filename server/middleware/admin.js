module.exports = (req, res, next) => {
    if (!req.user) return res.status(401).send({ message: "Not logged in" });
    if (req.user.role !== "admin") return res.status(403).send({ message: "Admin only" });
    next();
  };
  