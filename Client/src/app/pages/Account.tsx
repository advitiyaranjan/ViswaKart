import { UserProfile } from "@clerk/react";
import { MapPin, ShoppingBag, HelpCircle, Heart, Truck, Store } from "lucide-react";
import AddressesPage from "./profile/AddressesPage";
import OrdersPage from "./profile/OrdersPage";
import HelpSupportPage from "./profile/HelpSupportPage";
import DonateUsPage from "./profile/DonateUsPage";
import SellerOrdersPage from "./profile/SellerOrdersPage";

export default function Account() {
  return (
    <div className="min-h-screen bg-slate-50/60 flex justify-center py-10 px-4">
      <UserProfile routing="hash">
        {/* My Addresses — appears alongside Profile & Security in the left sidebar */}
        <UserProfile.Page label="My Addresses" url="addresses" labelIcon={<MapPin className="w-4 h-4" />}>
          <AddressesPage />
        </UserProfile.Page>

        {/* My Orders */}
        <UserProfile.Page label="My Orders" url="orders" labelIcon={<ShoppingBag className="w-4 h-4" />}>
          <OrdersPage />
        </UserProfile.Page>

        {/* Seller Orders (for sellers) */}
        <UserProfile.Page label="Seller Orders" url="seller-orders" labelIcon={<Truck className="w-4 h-4" />}>
          <SellerOrdersPage />
        </UserProfile.Page>

        {/* Help & Support */}
        <UserProfile.Page label="Help & Support" url="help" labelIcon={<HelpCircle className="w-4 h-4" />}>
          <HelpSupportPage />
        </UserProfile.Page>

        {/* Selling has its own pages; this opens the seller flow at /sell */}
        <UserProfile.Link label="Sell your product" url="/sell" labelIcon={<Store className="w-4 h-4" />} />

        {/* Donate Us */}
        <UserProfile.Page label="Donate Us" url="donate" labelIcon={<Heart className="w-4 h-4" />}>
          <DonateUsPage />
        </UserProfile.Page>
      </UserProfile>
    </div>
  );
}
