const { Resend } = require("resend");

// Safe Resend client initialization: if `RESEND_API_KEY` is not provided
// we create a no-op mock that logs email attempts instead of throwing.
let resend;
if (process.env.RESEND_API_KEY) {
  resend = new Resend(process.env.RESEND_API_KEY);
} else {
  console.warn("[email] RESEND_API_KEY not set — emails will be logged to console.");
  resend = {
    emails: {
      send: async (opts) => {
        console.log("[email mock] send called:", { from: opts.from, to: opts.to, subject: opts.subject });
        return { id: `mock_${Date.now()}` };
      },
    },
  };
}

const User = require("../models/User");
const FROM = process.env.EMAIL_FROM || "onboarding@resend.dev";
const SITE = process.env.SITE_URL || "https://ecom.advitiyaranjan.in";
const LOGO = `${SITE}/ecom.png`;

// Hidden preheader trick
function preheader(text) {
  const padding = "&nbsp;&zwnj;".repeat(120);
  return `<div style="display:none;max-height:0;overflow:hidden;">${text}${padding}</div>`;
}

/**
 * Sends an OTP email.
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
} // FIXED: Added missing closing brace here

/**
 * Sends a notification email to the seller when an order contains their items.
 */
async function sendSellerOrderNotificationEmail(to, sellerName, items, buyerInfo, order) {
  const itemRows = items.map(it => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #f1f5f9;color:#334155;">${it.name}</td>
      <td style="padding:8px;border-bottom:1px solid #f1f5f9;color:#334155;text-align:center;">${it.quantity}</td>
      <td style="padding:8px;border-bottom:1px solid #f1f5f9;color:#334155;text-align:right;">$${(it.price * it.quantity).toFixed(2)}</td>
    </tr>
  `).join("");

  const { error } = await resend.emails.send({
    from: FROM,
    to,
    subject: `New order for your items — #${order._id.toString().slice(-6).toUpperCase()}`,
    html: `
      ${preheader(`New order contains items you listed. Order ID: ${order._id.toString().slice(-6).toUpperCase()}`)}
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#f8fafc;border-radius:12px;">
        <div style="text-align:center;margin-bottom:18px;"><img src="${LOGO}" alt="ViswaKart" style="height:48px;"/></div>
        <div style="background:#fff;border-radius:10px;padding:18px;border:1px solid #e2e8f0;">
          <h2 style="color:#0f172a;margin:0 0 8px;">Hi ${sellerName},</h2>
          <p style="color:#475569;margin:0 0 12px;">You have new order items to fulfil. Details below.</p>

          <table style="width:100%;border-collapse:collapse;margin-bottom:12px;">
            <thead>
              <tr style="background:#f8fafc;"><th style="text-align:left;padding:8px;color:#64748b;font-size:13px;">Item</th><th style="text-align:center;padding:8px;color:#64748b;font-size:13px;">Qty</th><th style="text-align:right;padding:8px;color:#64748b;font-size:13px;">Price</th></tr>
            </thead>
            <tbody>${itemRows}</tbody>
          </table>

          <div style="padding:8px;border-top:1px solid #e2e8f0;margin-top:8px;">
            <p style="margin:4px 0;color:#334155;"><strong>Buyer:</strong> ${buyerInfo.buyerName} — ${buyerInfo.buyerEmail}</p>
            <p style="margin:4px 0;color:#334155;"><strong>Shipping:</strong> ${buyerInfo.shippingAddress.street}, ${buyerInfo.shippingAddress.city}, ${buyerInfo.shippingAddress.state} ${buyerInfo.shippingAddress.zipCode}, ${buyerInfo.shippingAddress.country}</p>
            <p style="margin:8px 0 0;color:#64748b;font-size:13px;">Order total: <strong>$${order.totalPrice.toFixed(2)}</strong></p>
          </div>

          <div style="text-align:center;margin-top:14px;">
            <a href="${SITE}/admin/orders/${order._id}" style="background:#0f766e;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:700;display:inline-block;">View Order</a>
          </div>
        </div>
        <p style="color:#94a3b8;font-size:12px;text-align:center;margin-top:14px;">ViswaKart · ${SITE}</p>
      </div>
    `,
  });
  if (error) console.error("📧 Seller notification email error:", error);
}


/**
 * Sends a welcome email after user signs up.
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
 */
async function sendOrderConfirmationEmail(to, name, order) {
  const itemRowsWithSeller = order.items.map(item => `
    <tr>
      <td style="padding:10px;border-bottom:1px solid #f1f5f9;color:#334155;">
        <div>${item.name}</div>
        <div style="font-size:12px;color:#64748b;margin-top:6px;">
          Seller: ${item.sellerName || '—'}${item.sellerEmail ? ' • ' + item.sellerEmail : ''}${item.sellerMobile ? ' • ' + item.sellerMobile : ''}
          ${item.sellerHostelNumber ? ' • Hostel: ' + item.sellerHostelNumber : ''}${item.sellerRoomNumber ? ' • Room: ' + item.sellerRoomNumber : ''}
        </div>
      </td>
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
            <tbody>${itemRowsWithSeller}</tbody>
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

/**
 * Sends a short notification to the buyer when a single order item's status changes.
 */
async function sendItemStatusUpdateEmail(to, name, order, item, status) {
  const itemName = item.name || "Item";
  const shortId = order._id.toString().slice(-6).toUpperCase();
  const colorMap = {
    Pending: "#64748b",
    Processing: "#0ea5e9",
    Shipped: "#f97316",
    Delivered: "#10b981",
    Cancelled: "#ef4444",
  };
  const color = colorMap[status] || "#64748b";

  let sellerName = item.sellerName || "";
  let sellerEmail = item.sellerEmail || "";
  let sellerMobile = item.sellerMobile || "";
  let sellerHostelNumber = item.sellerHostelNumber || "";
  let sellerRoomNumber = item.sellerRoomNumber || "";

  if (item.seller) {
    try {
      const s = await User.findById(item.seller).lean();
      if (s) {
        sellerName = (s.sellerProfile && s.sellerProfile.name) || s.name || sellerName;
        sellerEmail = s.email || sellerEmail;
        sellerMobile = (s.sellerProfile && s.sellerProfile.mobileNumber) || sellerMobile;
        sellerHostelNumber = (s.sellerProfile && s.sellerProfile.hostelNumber) || sellerHostelNumber;
        sellerRoomNumber = (s.sellerProfile && s.sellerProfile.roomNumber) || sellerRoomNumber;
      }
    } catch (e) {
      // ignore and fall back to snapshot fields
    }
  }

  const sellerInfo = `
    ${sellerName ? `<div><strong>Seller:</strong> ${sellerName}</div>` : ""}
    ${sellerEmail ? `<div><strong>Email:</strong> ${sellerEmail}</div>` : ""}
    ${sellerMobile ? `<div><strong>Mobile:</strong> ${sellerMobile}</div>` : ""}
    ${sellerHostelNumber ? `<div><strong>Hostel:</strong> ${sellerHostelNumber}</div>` : ""}
    ${sellerRoomNumber ? `<div><strong>Room:</strong> ${sellerRoomNumber}</div>` : ""}
  `;

  const { error } = await resend.emails.send({
    from: FROM,
    to,
    subject: `Update for ${itemName} — Order #${shortId}`,
    html: `
      ${preheader(`${itemName} status updated to ${status} for order #${shortId}`)}
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#f8fafc;border-radius:12px;">
        <div style="text-align:center;margin-bottom:12px;"><img src="${LOGO}" alt="ViswaKart" style="height:44px;"/></div>
        <div style="background:#fff;border-radius:10px;padding:18px;border:1px solid #e2e8f0;">
          <h2 style="margin:0 0 8px;color:#0f172a;">Update on your item</h2>
          <p style="color:#475569;margin:0 0 12px;">Hi ${name || "Customer"}, the status for <strong>${itemName}</strong> in your order <strong>#${shortId}</strong> has been updated.</p>
          <div style="padding:12px;border-radius:8px;background:#f8fafc;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;">
            <div style="color:#334155;font-size:14px;"><strong>${itemName}</strong><div style="font-size:13px;color:#64748b;margin-top:6px;">Quantity: ${item.quantity}</div></div>
            <div style="background:${color};color:#fff;padding:8px 12px;border-radius:8px;font-weight:700;">${status}</div>
          </div>
          <div style="color:#334155;font-size:14px;margin-bottom:10px;">${sellerInfo}</div>
          <div style="text-align:center;margin-top:12px;"><a href="${SITE}/account/orders/${order._id}" style="background:#0f766e;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:700;">View Order</a></div>
        </div>
        <p style="color:#94a3b8;font-size:12px;text-align:center;margin-top:12px;">ViswaKart · ${SITE}</p>
      </div>
    `,
  });
  if (error) console.error("📧 Item status update email error:", error);
}

// FIXED: All functions are now correctly exported
module.exports = {
  sendOtpEmail,
  sendNewsletterWelcomeEmail,
  sendSupportReplyEmail,
  sendSellerOrderNotificationEmail,
  sendItemStatusUpdateEmail,
  sendOrderConfirmationEmail,
  sendWelcomeEmail,
  sendLoginAlertEmail,
};