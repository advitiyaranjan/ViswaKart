import React from "react";
import { Button } from "../../components/Button";
import { Heart } from "lucide-react";

export default function DonateUsPage() {
  const upiId = "advitiya@upi";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(upiId);
      alert("UPI ID copied to clipboard");
    } catch (err) {
      alert("Copy failed — please copy manually: " + upiId);
    }
  };

  return (
    <div className="py-4 space-y-4">
      <h2 className="text-lg font-bold flex items-center gap-2"><Heart className="w-5 h-5 text-rose-500" /> Donate Us</h2>

      <div className="bg-white rounded-lg border p-4 space-y-3">
        <p className="text-sm text-muted-foreground">Thank you for supporting this student-run marketplace. Donations help with hosting, maintenance and student initiatives.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3 border rounded">
            <div className="font-medium mb-1">UPI</div>
            <div className="text-sm text-muted-foreground mb-2">Pay via UPI ID</div>
            <div className="flex items-center gap-2">
              <div className="font-mono">{upiId}</div>
              <Button size="sm" onClick={handleCopy}>Copy</Button>
            </div>
          </div>

          <div className="p-3 border rounded">
            <div className="font-medium mb-1">PayPal / Card</div>
            <div className="text-sm text-muted-foreground mb-2">Use the button below to donate via PayPal (opens in new tab).</div>
            <div>
              <a href="https://www.paypal.com/donate" target="_blank" rel="noreferrer">
                <Button>Donate via PayPal</Button>
              </a>
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">All donations are voluntary. This is a community initiative by IIITM students.</p>
      </div>
    </div>
  );
}
