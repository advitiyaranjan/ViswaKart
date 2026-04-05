const nodemailer = require("nodemailer");

/**
 * Creates a transporter. Uses SMTP env vars if available,
 * falls back to Ethereal (test account) in development,
 * or logs to console if nothing is configured.
 */
async function getTransporter() {
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  // Development: use Ethereal fake SMTP (prints preview URL to console)
  const testAccount = await nodemailer.createTestAccount();
  const transporter = nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    secure: false,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });
  transporter._ethereal = true;
  return transporter;
}

/**
 * Sends an OTP email.
 * @param {string} to  - recipient email
 * @param {string} otp - 6-digit OTP
 */
async function sendOtpEmail(to, otp) {
  const transporter = await getTransporter();

  const info = await transporter.sendMail({
    from: process.env.EMAIL_FROM || '"ShopZen" <noreply@shopzen.com>',
    to,
    subject: "Your ShopZen verification code",
    text: `Your OTP is: ${otp}. It expires in 10 minutes.`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#f8fafc;border-radius:12px;">
        <h2 style="color:#0f766e;margin-bottom:8px;">Verify your email</h2>
        <p style="color:#475569;margin-bottom:24px;">Use the code below to complete your ShopZen registration. It expires in <strong>10 minutes</strong>.</p>
        <div style="background:#fff;border:2px solid #0f766e;border-radius:10px;padding:24px;text-align:center;">
          <span style="font-size:40px;font-weight:800;letter-spacing:12px;color:#0f766e;">${otp}</span>
        </div>
        <p style="color:#94a3b8;font-size:13px;margin-top:24px;">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  });

  if (transporter._ethereal) {
    // Show preview link in server console during development
    console.log("📧  OTP email preview:", nodemailer.getTestMessageUrl(info));
    console.log(`📧  OTP for ${to}: ${otp}`);
  }
}

module.exports = { sendOtpEmail };
