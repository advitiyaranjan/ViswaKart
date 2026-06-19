import { Navigate } from "react-router";
import { sellerDestination } from "../../../lib/seller";
import { SellerPageError, SellerPageLoading, useSellerStatus } from "./SellerShell";

/**
 * /sell — the target of every "Sell your product" entry point. Signed-out visitors are sent to sign in by
 * ProtectedRoute (which remembers /sell); signed-in users are routed by their server-side seller status.
 */
export default function SellEntry() {
  const { seller, error, reload } = useSellerStatus();
  if (error) return <SellerPageError message={error} retry={reload} />;
  if (!seller) return <SellerPageLoading />;
  return <Navigate to={sellerDestination(seller)} replace />;
}
