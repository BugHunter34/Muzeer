const jwt = require("jsonwebtoken");
const Login = require("../models/login");

module.exports = async (req, res, next) => {
  try {
    // Cookie token (httpOnly)
    const token = req.cookies?.token;

    if (!token) {
      return res.status(401).json({ message: "Chybí token v cookies" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded?.id) {
      return res.status(401).json({ message: "Neplatný token (chybí id)" });
    }

    // u tebe je passwordHash
    const user = await Login.findById(decoded.id).select("-passwordHash");
    if (!user) {
      return res.status(401).json({ message: "Neplatný uživatel" });
    }

    req.user = user; // mongoose user
    req.jwt = decoded; // payload (id, role, exp...)
    next();
  } catch (err) {
    console.error("AUTH ERROR:", err?.name, err?.message);

    if (err?.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Token expiroval" });
    }
    return res.status(401).json({ message: "Neplatný/expir. token" });
  }
};