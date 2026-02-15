// LOGIN - Updated for Backend-Only Cookies
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).send({ message: "Chybí email nebo heslo" });
    }

    const user = await Login.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(401).send({ message: "Špatné přihlašovací údaje" });
    }

 const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
     return res.status(401).send({ message: "Špatné přihlašovací údaje" });
}

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "2h" }
    );

    // --- NEW: SET COOKIE INSTEAD OF JUST SENDING TOKEN ---
    res.cookie("token", token, {
      httpOnly: true,       // Cannot be accessed by frontend JS (XSS Protection)
      secure: false,        // Set to true in production (requires HTTPS)
      maxAge: 2 * 60 * 60 * 1000, // 2 hours in milliseconds
      sameSite: "lax",      // Helps against CSRF
    });

    res.status(200).send({
      message: "Login successful",
      // We still send user data, but the token is now in the browser's cookie jar
      user: sanitizeUser(user) 
    });

  } catch (err) {
    res.status(500).send({ error: err.message });
  }
};