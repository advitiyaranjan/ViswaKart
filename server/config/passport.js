const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const { googleCallback } = require("../controllers/authController");

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${process.env.SERVER_URL || "http://localhost:5000"}/api/auth/google/callback`,
    },
    googleCallback
  )
);

// Not using sessions — serialize/deserialize are no-ops
passport.serializeUser((user, done) => done(null, user._id));
passport.deserializeUser((id, done) => done(null, { _id: id }));

module.exports = passport;
