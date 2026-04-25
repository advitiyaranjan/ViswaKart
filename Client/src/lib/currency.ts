export function formatCurrency(amount: number | null | undefined) {
  const n = Number(amount || 0);
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(n);
  } catch (e) {
    return `₹${n.toFixed(2)}`;
  }
}
