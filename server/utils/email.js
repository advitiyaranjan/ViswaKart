const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM || "onboarding@resend.dev";
const SITE = process.env.SITE_URL || "https://ecom.advitiyaranjan.in";
const LOGO = `${SITE}/ecom.png`;

// Hidden preheader trick — pads the preview text so Gmail doesn't pull
// content from the email body and show the "three dots" clip button.
function preheader(text) {
  const padding = "&nbsp;&zwnj;".repeat(120);
  return `<div style="display:none;max-height:0;overflow:hidden;">${text}${padding}</div>`;
}

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
      ${preheader(`Your ViswaKart verification code is ${otp}. It expires in 10 minutes.`)}
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#f8fafc;border-radius:12px;">
        <div style="text-align:center;margin-bottom:20px;">
          <img src="${LOGO}" alt="ViswaKart" style="height:56px;width:auto;object-fit:contain;" />
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
      ${preheader("Welcome to ViswaKart! You're now subscribed for exclusive deals and early access to sales.")}
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px;background:#f8fafc;border-radius:12px;">
        <div style="text-align:center;margin-bottom:24px;">
          <img src="${LOGO}" alt="ViswaKart" style="height:56px;width:auto;object-fit:contain;margin-bottom:12px;" />
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
            <a href="${SITE}"
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

/**
 * Sends a support reply email to the user.
 * @param {string} to      - user email
 * @param {string} name    - user name
 * @param {string} subject - original subject
 * @param {string} reply   - admin reply message
 */
async function sendSupportReplyEmail(to, name, subject, reply) {
  const { error } = await resend.emails.send({
    from: FROM,
    to,
    subject: `Re: ${subject} — ViswaKart Support`,
    html: `
      ${preheader(`ViswaKart Support replied to your message: "${subject}"`)}
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px;background:#f8fafc;border-radius:12px;">
        <div style="text-align:center;margin-bottom:24px;">
          <img src="${LOGO}" alt="ViswaKart" style="height:56px;width:auto;object-fit:contain;" />
        </div>
        <div style="background:#fff;border-radius:10px;padding:28px;border:1px solid #e2e8f0;">
          <h2 style="color:#0f766e;margin-top:0;">We've replied to your message 💬</h2>
          <p style="color:#475569;line-height:1.6;">Hi <strong>${name}</strong>, our support team has responded to your enquiry.</p>
          <div style="background:#f1f5f9;border-radius:8px;padding:4px 16px;margin:16px 0;">
            <p style="color:#64748b;font-size:13px;margin:8px 0;"><strong>Subject:</strong> ${subject}</p>
          </div>
          <div style="background:#f0fdf4;border-left:4px solid #0f766e;border-radius:6px;padding:16px;margin:16px 0;color:#334155;line-height:1.7;font-size:15px;">
            ${reply.replace(/\n/g, "<br/>")}
          </div>
          <p style="color:#64748b;font-size:13px;">If you have further questions, feel free to contact us again through the Help & Support section in your account.</p>
          <div style="text-align:center;margin-top:20px;">
            <a href="${SITE}" style="background:#0f766e;color:#fff;text-decoration:none;padding:10px 24px;border-radius:8px;font-weight:700;font-size:14px;display:inline-block;">
              Visit ViswaKart
            </a>
          </div>
        </div>
        <p style="color:#94a3b8;font-size:12px;text-align:center;margin-top:20px;">ViswaKart Support · ${SITE}</p>
      </div>
    `,
  });
  if (error) console.error("📧  Support reply email error:", error);
}

module.exports = { sendOtpEmail, sendNewsletterWelcomeEmail, sendWelcomeEmail, sendLoginAlertEmail, sendOrderConfirmationEmail, sendSupportReplyEmail };

/**
 * Sends a welcome email after user signs up.
 * @param {string} to   - user email
 * @param {string} name - user name
 */
async function sendWelcomeEmail(to, name) {
  const { error } = await resend.emails.send({
    from: FROM,
    to,
    subject: "Welcome to ViswaKart! 🛍️",
    html: `
      ${preheader(`Hey ${name}, welcome to ViswaKart! Start exploring thousands of products at unbeatable prices.`)}
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px;background:#f8fafc;border-radius:12px;">
        <div style="text-align:center;margin-bottom:24px;">
          <img src="${LOGO}" alt="ViswaKart" style="height:56px;width:auto;object-fit:contain;" />
        </div>
        <div style="background:#fff;border-radius:10px;padding:28px;border:1px solid #e2e8f0;">
          <h2 style="color:#0f766e;margin-top:0;">Hey ${name}, welcome aboard! 👋</h2>
          <p style="color:#475569;line-height:1.6;">
            Your ViswaKart account is ready. You can now browse thousands of products, track your orders, and enjoy exclusive deals.
          </p>
          <ul style="color:#475569;line-height:2;padding-left:20px;">
            <li>🛒 Add items to your cart and wishlist</li>
            <li>📦 Track your orders in real time</li>
            <li>💳 Fast & secure checkout</li>
            <li>🎁 Member-only discounts</li>
          </ul>
          <div style="text-align:center;margin-top:24px;">
            <a href="${SITE}" style="background:#0f766e;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:15px;display:inline-block;">
              Start Shopping
            </a>
          </div>
        </div>
        <p style="color:#94a3b8;font-size:12px;text-align:center;margin-top:20px;">
          You're receiving this because you created an account at ViswaKart.
        </p>
      </div>
    `,
  });
  if (error) console.error("📧  Welcome email error:", error);
}

/**
 * Sends a login alert email.
 * @param {string} to   - user email
 * @param {string} name - user name
 */
async function sendLoginAlertEmail(to, name) {
  const now = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
  const { error } = await resend.emails.send({
    from: FROM,
    to,
    subject: "New login to your ViswaKart account",
    html: `
      ${preheader(`A new login was detected on your ViswaKart account at ${now}.`)}
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px;background:#f8fafc;border-radius:12px;">
        <div style="text-align:center;margin-bottom:24px;">
          <img src="${LOGO}" alt="ViswaKart" style="height:56px;width:auto;object-fit:contain;" />
        </div>
        <div style="background:#fff;border-radius:10px;padding:28px;border:1px solid #e2e8f0;">
          <h2 style="color:#0f172a;margin-top:0;">New Login Detected 🔐</h2>
          <p style="color:#475569;line-height:1.6;">Hi <strong>${name}</strong>, we noticed a new login to your ViswaKart account.</p>
          <div style="background:#f1f5f9;border-radius:8px;padding:16px;margin:16px 0;color:#334155;font-size:14px;">
            <p style="margin:4px 0;">🕐 <strong>Time:</strong> ${now} (IST)</p>
          </div>
          <p style="color:#475569;font-size:14px;">If this was you, no action needed. If you didn't log in, please secure your account immediately.</p>
          <div style="text-align:center;margin-top:20px;">
            <a href="${SITE}/account" style="background:#ef4444;color:#fff;text-decoration:none;padding:10px 24px;border-radius:8px;font-weight:700;font-size:14px;display:inline-block;">
              Secure My Account
            </a>
          </div>
        </div>
        <p style="color:#94a3b8;font-size:12px;text-align:center;margin-top:20px;">ViswaKart · ${SITE}</p>
      </div>
    `,
  });
  if (error) console.error("📧  Login alert email error:", error);
}

/**
 * Sends an order confirmation email.
 * @param {string} to    - user email
 * @param {string} name  - user name
 * @param {object} order - order object
 */
async function sendOrderConfirmationEmail(to, name, order) {
  const itemRows = order.items.map(item => `
    <tr>
      <td style="padding:10px;border-bottom:1px solid #f1f5f9;color:#334155;">${item.name}</td>
      <td style="padding:10px;border-bottom:1px solid #f1f5f9;color:#334155;text-align:center;">${item.quantity}</td>
      <td style="padding:10px;border-bottom:1px solid #f1f5f9;color:#334155;text-align:right;">$${(item.price * item.quantity).toFixed(2)}</td>
    </tr>
  `).join("");

  const { error } = await resend.emails.send({
    from: FROM,
    to,
    subject: `Order Confirmed! #${order._id.toString().slice(-6).toUpperCase()}`,
    html: `
      ${preheader(`Your ViswaKart order #${order._id.toString().slice(-6).toUpperCase()} has been placed successfully. Total: $${order.totalPrice.toFixed(2)}`)}
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px;background:#f8fafc;border-radius:12px;">
        <div style="text-align:center;margin-bottom:24px;">
          <img src="${LOGO}" alt="ViswaKart" style="height:56px;width:auto;object-fit:contain;" />
        </div>
        <div style="background:#fff;border-radius:10px;padding:28px;border:1px solid #e2e8f0;">
          <div style="text-align:center;margin-bottom:20px;">
            <span style="font-size:40px;">📦</span>
            <h2 style="color:#0f766e;margin:8px 0 4px;">Order Confirmed!</h2>
            <p style="color:#64748b;margin:0;">Hi ${name}, your order has been placed successfully.</p>
          </div>
          <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:12px 16px;margin-bottom:20px;text-align:center;">
            <p style="margin:0;color:#166534;font-weight:700;font-size:15px;">Order ID: #${order._id.toString().slice(-6).toUpperCase()}</p>
          </div>
          <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
            <thead>
              <tr style="background:#f8fafc;">
                <th style="padding:10px;text-align:left;color:#64748b;font-size:13px;border-bottom:2px solid #e2e8f0;">Item</th>
                <th style="padding:10px;text-align:center;color:#64748b;font-size:13px;border-bottom:2px solid #e2e8f0;">Qty</th>
                <th style="padding:10px;text-align:right;color:#64748b;font-size:13px;border-bottom:2px solid #e2e8f0;">Price</th>
              </tr>
            </thead>
            <tbody>${itemRows}</tbody>
          </table>
          <div style="border-top:2px solid #e2e8f0;padding-top:12px;">
            <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
              <span style="color:#64748b;font-size:14px;">Subtotal</span>
              <span style="color:#334155;font-size:14px;">$${order.itemsPrice.toFixed(2)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
              <span style="color:#64748b;font-size:14px;">Shipping</span>
              <span style="color:#334155;font-size:14px;">${order.shippingPrice === 0 ? "Free" : "$" + order.shippingPrice.toFixed(2)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
              <span style="color:#64748b;font-size:14px;">Tax</span>
              <span style="color:#334155;font-size:14px;">$${order.taxPrice.toFixed(2)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-top:10px;padding-top:10px;border-top:1px solid #e2e8f0;">
              <span style="color:#0f172a;font-weight:700;font-size:16px;">Total</span>
              <span style="color:#0f766e;font-weight:700;font-size:16px;">$${order.totalPrice.toFixed(2)}</span>
            </div>
          </div>
          <div style="text-align:center;margin-top:24px;">
            <a href="${SITE}/account/orders" style="background:#0f766e;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:15px;display:inline-block;">
              Track My Order
            </a>
          </div>
        </div>
        <p style="color:#94a3b8;font-size:12px;text-align:center;margin-top:20px;">ViswaKart · ${SITE}</p>
      </div>
    `,
  });
  if (error) console.error("📧  Order confirmation email error:", error);
}
