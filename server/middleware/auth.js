const jwt = require("jsonwebtoken");
const Login = require("../models/login");

module.exports = async (req, res, next) => {
  try {
    // Look for token in cookies instead of headers
    const token = req.cookies.token; 
    
    if (!token) {
      return res.status(401).send({ message: "Chybí token v cookies" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await Login.findById(decoded.id).select("-password");
    
    if (!user) return res.status(401).send({ message: "Neplatný uživatel" });

    req.user = user;
    next();
  } catch {
    return res.status(401).send({ message: "Neplatný/expir. token" });
  }
};