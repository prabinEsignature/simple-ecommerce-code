const sendToken = (user, statusCode, res) => {
  const token = user.getJWTToken();

  // Convert COOKIE_EXPIRE to number of days
  const expireDays = parseInt(process.env.COOKIE_EXPIRE.replace("d", ""), 10);

  const options = {
    expires: new Date(Date.now() + expireDays * 24 * 60 * 60 * 1000),
    httpOnly: true,
    secure: process.env.NODE_ENV === "PRODUCTION", // Serve cookie over HTTPS in production
    sameSite: "Strict", // Controls when cookies are sent (Strict, Lax, None)
  };

  res.status(statusCode).cookie("token", token, options).json({
    success: true,
    user,
    token,
  });
};

module.exports = sendToken;
