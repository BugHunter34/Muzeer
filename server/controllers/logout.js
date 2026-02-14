// LOGOUT
exports.logout = async (req, res) => {
    // Clear the cookie named "token"
    res.clearCookie("token");
    res.status(200).send({ message: "Logged out successfully" });
  };