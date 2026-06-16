const { sendOrderConfirmationEmail, sendSellerOrderNotificationEmail } = require("../utils/email");

/** Emails the buyer and each seller about a new order. Failures are logged, never thrown. */
async function notifyOrder(order, buyer) {
  const log = (error) => console.error("[ORDER_EMAIL]", order._id?.toString(), error?.message || error);
  if (buyer?.email) await sendOrderConfirmationEmail(buyer.email, buyer.name || "Customer", order).catch(log);
  for (const item of order.items) {
    if (!item.sellerEmail) continue;
    await sendSellerOrderNotificationEmail(
      item.sellerEmail, item.sellerName || "Seller",
      [{ productId: item.product, name: item.name, quantity: item.quantity, price: item.price }],
      { buyerName: buyer?.name, buyerEmail: buyer?.email, shippingAddress: order.shippingAddress }, order
    ).catch(log);
  }
}

module.exports = { notifyOrder };
