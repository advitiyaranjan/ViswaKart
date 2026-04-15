const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM || "onboarding@resend.dev";

/**
 * Sends an OTP email.
 * @param {string} to  - recipient email
 * @param {string} otp - 6-digit OTP
 */
async function sendOtpEmail(to, otp) {
  const { error } = await resend.emails.send({
    from: FROM,
    to,
    subject: "Your ViswaKart verification code",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#f8fafc;border-radius:12px;">
        <div style="text-align:center;margin-bottom:20px;">
          <img src="${process.env.SITE_URL || 'https://ecom.advitiyaranjan.in'}/ecom.png" alt="ViswaKart" style="height:56px;width:auto;object-fit:contain;" />
        </div>
        <h2 style="color:#0f766e;margin-bottom:8px;">Verify your email</h2>
        <p style="color:#475569;margin-bottom:24px;">Use the code below to complete your ViswaKart registration. It expires in <strong>10 minutes</strong>.</p>
        <div style="background:#fff;border:2px solid #0f766e;border-radius:10px;padding:24px;text-align:center;">
          <span style="font-size:40px;font-weight:800;letter-spacing:12px;color:#0f766e;">${otp}</span>
        </div>
        <p style="color:#94a3b8;font-size:13px;margin-top:24px;">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  });
  if (error) console.error("📧  OTP email error:", error);
}

/**
 * Sends a newsletter welcome/thank-you email after subscription.
 * @param {string} to - subscriber email
 */
async function sendNewsletterWelcomeEmail(to) {
  const { error } = await resend.emails.send({
    from: FROM,
    to,
    subject: "🎉 Thanks for subscribing to ViswaKart!",
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px;background:#f8fafc;border-radius:12px;">
        <div style="text-align:center;margin-bottom:24px;">
          <img src="${process.env.SITE_URL || 'https://ecom.advitiyaranjan.in'}/ecom.png" alt="ViswaKart" style="height:56px;width:auto;object-fit:contain;margin-bottom:12px;" />
          <h1 style="color:#0f172a;font-size:28px;margin:0;">🎉 You're In!</h1>
        </div>
        <div style="background:#fff;border-radius:10px;padding:28px;border:1px solid #e2e8f0;">
          <h2 style="color:#0f766e;margin-top:0;">Thank you for subscribing!</h2>
          <p style="color:#475569;line-height:1.6;">
            Welcome to the <strong>ViswaKart</strong> community! You're now part of 50,000+ smart shoppers who get:
          </p>
          <ul style="color:#475569;line-height:2;padding-left:20px;">
            <li>🔥 Early access to flash sales</li>
            <li>🎁 Exclusive subscriber-only deals</li>
            <li>📦 New arrival announcements</li>
            <li>💰 Special discount codes</li>
          </ul>
          <div style="text-align:center;margin-top:24px;">
            <a href="${process.env.SITE_URL || "http://localhost:5173"}/products"
               style="background:#0f766e;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:15px;display:inline-block;">
              Start Shopping
            </a>
          </div>
        </div>
        <p style="color:#94a3b8;font-size:12px;text-align:center;margin-top:20px;">
          You subscribed with ${to}. To unsubscribe, reply to this email.
        </p>
      </div>
    `,
  });
  if (error) console.error("📧  Newsletter email error:", error);
}

module.exports = { sendOtpEmail, sendNewsletterWelcomeEmail };
