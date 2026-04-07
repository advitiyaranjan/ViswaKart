import { UserProfile } from "@clerk/react";
import { MapPin, ShoppingBag } from "lucide-react";
import AddressesPage from "./profile/AddressesPage";
import OrdersPage from "./profile/OrdersPage";

export default function Account() {
  return (
    <div className="min-h-screen bg-slate-50/60 flex justify-center py-10 px-4">
      <UserProfile routing="hash">
        {/* My Addresses — appears alongside Profile & Security in the left sidebar */}
        <UserProfile.Page
          label="My Addresses"
          url="addresses"
          labelIcon={<MapPin className="w-4 h-4" />}
        >
          <AddressesPage />
        </UserProfile.Page>

        {/* My Orders */}
        <UserProfile.Page
          label="My Orders"
          url="orders"
          labelIcon={<ShoppingBag className="w-4 h-4" />}
        >
          <OrdersPage />
        </UserProfile.Page>
      </UserProfile>
    </div>
  );
}

