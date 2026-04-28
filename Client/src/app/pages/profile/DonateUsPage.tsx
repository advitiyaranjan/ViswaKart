import React from "react";
import { Button } from "../../components/Button";
import { Copy, Heart, QrCode } from "lucide-react";

export default function DonateUsPage() {
  const upiId = "9430435643@ptsbi";

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

      <div className="bg-white rounded-xl border p-4 sm:p-5 space-y-4">
        <p className="text-sm text-muted-foreground">
          Thank you for supporting this student-run marketplace. Donations help with hosting,
          maintenance, and student initiatives.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,240px),1fr] gap-4 items-start">
          <div className="rounded-2xl border bg-slate-50 p-3 w-full max-w-[280px] mx-auto md:mx-0">
            <img
              src="/donate-upi-qr.png"
              alt="UPI QR code for donations"
              className="block w-full aspect-square object-contain rounded-xl border bg-white"
            />
            <div className="mt-3 flex items-center justify-center gap-2 text-sm font-medium text-slate-700">
              <QrCode className="w-4 h-4 text-teal-600" />
              Scan to donate
            </div>
          </div>

          <div className="p-4 border rounded-2xl bg-gradient-to-br from-teal-50 to-white space-y-4">
            <div>
              <div className="text-base font-semibold">Donate via UPI</div>
              <div className="text-sm text-muted-foreground mt-1">
                Scan the QR code in any UPI app or use the UPI ID below.
              </div>
            </div>

            <div className="rounded-xl border bg-white px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">UPI ID</div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="font-mono text-sm sm:text-base break-all">{upiId}</div>
                <Button size="sm" onClick={handleCopy} className="sm:ml-auto">
                  <Copy className="w-4 h-4 mr-2" />
                  Copy
                </Button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Paytm, PhonePe, Google Pay, BHIM, and other UPI apps can be used with this QR code.
            </p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">All donations are voluntary. This is a community initiative by IIITM students.</p>
      </div>
    </div>
  );
}
