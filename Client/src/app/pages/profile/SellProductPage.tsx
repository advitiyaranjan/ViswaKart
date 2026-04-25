import React, { useEffect, useState } from "react";
import { useUser, useClerk } from "@clerk/react";
import { authService } from "../../../services/authService";
import { userService } from "../../../services/userService";
import { productService, categoryService } from "../../../services/productService";
import api from "../../../services/api";
import { orderService } from "../../../services/orderService";
import { Button } from "../../components/Button";
import ImageUploader from "../../components/ImageUploader";
import { formatCurrency } from "../../../lib/currency";

export default function SellProductPage() {
  const [serverUser, setServerUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showRequestForm, setShowRequestForm] = useState(false);

  // Product form
  const [name, setName] = useState("");
  // Keep input state as strings so the field can be cleared by backspace
  const [price, setPrice] = useState("");
  const [discount, setDiscount] = useState("");
  const [specs, setSpecs] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [category, setCategory] = useState("");
  const [productAge, setProductAge] = useState("");
  const [images, setImages] = useState<string[]>([]);

  const [categories, setCategories] = useState<any[]>([]);
  const [myProducts, setMyProducts] = useState<any[]>([]);
  const [myOrders, setMyOrders] = useState<any[]>([]);
  const [updatingItem, setUpdatingItem] = useState<Record<string, boolean>>({});
  const [debugProducts, setDebugProducts] = useState<any[] | null>(null);
  const [debugLoading, setDebugLoading] = useState(false);

  // Request form
  const [hostelNumber, setHostelNumber] = useState("");
  const [courseYear, setCourseYear] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  // Seller contact fields for product listings (auto-filled)
  const [sellerMobile, setSellerMobile] = useState("");
  const [sellerHostel, setSellerHostel] = useState("");
  const [sellerRoom, setSellerRoom] = useState("");
  // Draft autosave key helper to preserve form across reloads
  const DRAFT_PREFIX = "sell:draft:";
  const getDraftKey = () => `${DRAFT_PREFIX}${serverUser?._id || "anon"}`;

  // Restore draft (if present) when serverUser becomes available (or on mount)
  useEffect(() => {
    const key = getDraftKey();
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (!draft) return;
      // Only overwrite empty fields to avoid clobbering server-provided defaults
      setName((v) => v || draft.name || "");
      setPrice((v) => v || draft.price || "");
      setDiscount((v) => v || draft.discount || "");
      setSpecs((v) => v || draft.specs || "");
      setShortDescription((v) => v || draft.shortDescription || "");
      setCategory((v) => v || draft.category || "");
      setProductAge((v) => v || draft.productAge || "");
      setImages((v) => (Array.isArray(v) && v.length ? v : draft.images || []));
      setSellerMobile((v) => v || draft.sellerMobile || "");
      setSellerHostel((v) => v || draft.sellerHostel || "");
      setSellerRoom((v) => v || draft.sellerRoom || "");
    } catch (e) {
      // ignore parse errors
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverUser, myProducts]);

  // Autosave draft when form fields change (debounced)
  useEffect(() => {
    const key = getDraftKey();
    const payload = {
      name,
      price,
      discount,
      specs,
      shortDescription,
      category,
      productAge,
      images,
      sellerMobile,
      sellerHostel,
      sellerRoom,
    };
    const t = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(payload));
      } catch (e) {}
    }, 500);
    return () => clearTimeout(t);
    // include serverUser so draft key changes when user logs in/out
  }, [name, price, discount, specs, shortDescription, category, productAge, images, sellerMobile, sellerHostel, sellerRoom, serverUser]);
  const [requestSent, setRequestSent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  // image uploads handled by ImageUploader
  const [imagesUploading, setImagesUploading] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([authService.getMe(), categoryService.getCategories()])
      .then(([meRes, catRes]) => {
        setServerUser(meRes.data.user);
        setCategories(catRes.data?.categories || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Re-fetch server-side user when Clerk sign-in state changes so serverUser is available
  const { isSignedIn } = useUser();
  const { openSignIn } = useClerk();
  useEffect(() => {
    if (!isSignedIn) return;
    // If Clerk just signed in, ensure server-side user exists and refresh seller data
    (async () => {
      try {
        setLoading(true);
        const meRes = await authService.getMe();
        setServerUser(meRes.data.user);
        // refresh seller products/orders when serverUser becomes available
        if (meRes?.data?.user?.isSeller || meRes?.data?.user?.sellerApproved) {
          try {
            const r = await productService.getProducts({ seller: meRes.data.user._id, limit: 50 });
            setMyProducts(r.data?.products || []);
          } catch (e) {}
          try {
            const or = await orderService.getSellerOrders({ limit: 50 });
            setMyOrders(or.data.orders || []);
          } catch (e) {}
        }
      } catch (e) {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, [isSignedIn]);

  useEffect(() => {
    if (!serverUser) return;
    setRequestSent(Boolean(serverUser.sellerRequested));
    // Only pre-fill seller contact fields when the user already has
    // existing product listings. Do not auto-fill for users who haven't
    // listed products before — this avoids showing stale/default values.
    if (Array.isArray(myProducts) && myProducts.length > 0) {
      setSellerMobile(serverUser?.sellerProfile?.mobileNumber || "");
      setSellerHostel(serverUser?.sellerProfile?.hostelNumber || "");
      setSellerRoom(serverUser?.sellerProfile?.roomNumber || "");
    }
  }, [serverUser]);

  useEffect(() => {
    if (!serverUser) return;
    const isEligibleDomain = (serverUser?.email || "").endsWith("@iiitm.ac.in");
    // load seller products & orders if seller or eligible IIITM domain
    if (serverUser.isSeller || serverUser.sellerApproved || isEligibleDomain) {
      (async () => {
        try {
          const res = await productService.getProducts({ seller: serverUser._id, limit: 50 });
          let serverProducts = res?.data?.products || [];

          // If nothing returned by seller id, try fallback queries by email then mobile
          if ((!serverProducts || serverProducts.length === 0) && serverUser?.email) {
            try {
              const r2 = await productService.getProducts({ sellerEmail: serverUser.email, limit: 50 });
              serverProducts = r2?.data?.products || serverProducts;
            } catch (e) {
              // ignore
            }
          }
          if ((!serverProducts || serverProducts.length === 0) && serverUser?.sellerProfile?.mobileNumber) {
            try {
              const r3 = await productService.getProducts({ sellerMobile: serverUser.sellerProfile.mobileNumber, limit: 50 });
              serverProducts = r3?.data?.products || serverProducts;
            } catch (e) {
              // ignore
            }
          }

          setMyProducts(serverProducts);
        } catch (e) {
          // ignore — leave empty list
        }
      })();
      // only fetch seller orders when the user is an actual seller (approved)
      if (serverUser.isSeller || serverUser.sellerApproved) {
        orderService.getSellerOrders({ limit: 50 }).then((r) => setMyOrders(r.data.orders)).catch(() => {});
      }
    }
    // fetch debug products for troubleshooting (dev-only endpoint)
    fetchDebugProducts(serverUser._id).catch(() => {});
  }, [serverUser]);

  // Listen for order item updates (from other tabs or actions) and refresh seller orders
  useEffect(() => {
    const handler = (e: any) => {
      orderService.getSellerOrders({ limit: 50 }).then((r) => setMyOrders(r.data.orders)).catch(() => {});
    };
    window.addEventListener("order:itemUpdated", handler as EventListener);
    const storageHandler = (ev: StorageEvent) => {
      if (ev.key === "order:update") {
        try { const payload = JSON.parse(ev.newValue || ev.oldValue || "null"); } catch (e) {}
        orderService.getSellerOrders({ limit: 50 }).then((r) => setMyOrders(r.data.orders)).catch(() => {});
      }
    };
    window.addEventListener("storage", storageHandler);
    return () => {
      window.removeEventListener("order:itemUpdated", handler as EventListener);
      window.removeEventListener("storage", storageHandler);
    };
  }, []);

  const eligibleDomain = serverUser?.email?.endsWith("@iiitm.ac.in");

  const handleRequestAccess = async () => {
    try {
      await userService.requestSellerAccess({ mobileNumber, message: "Requested via app" });
      alert("Request submitted to admin");
      setRequestSent(true);
      setShowRequestForm(false);
    } catch (err) {
      alert("Failed to submit request");
    }
  };

  const handleCreateProduct = async () => {
    const imagesPayload = images.filter(Boolean);
    const payload: any = {
      name,
      // shortDescription is the main product description shown on the product page
      description: shortDescription || name,
      price: Number(price),
      discount: Number(discount || 0),
      specifications: specs,
      category,
      productAge,
      images: imagesPayload,
      stock: 1,
      sellerProfile: {
        name: serverUser?.sellerProfile?.name || serverUser?.name,
        hostelNumber: serverUser?.sellerProfile?.hostelNumber || sellerHostel || hostelNumber,
        roomNumber: serverUser?.sellerProfile?.roomNumber || sellerRoom,
        courseYear: serverUser?.sellerProfile?.courseYear || courseYear,
        mobileNumber: serverUser?.sellerProfile?.mobileNumber || sellerMobile || mobileNumber,
      },
    };
    try {
      setSaving(true);
      setStatusMessage("");
      const res = await productService.createProduct(payload);
      console.log('[SELL_PAGE] createProduct response', res?.data);
      const created = res?.data?.product;
      // Immediately show the created product in the seller's listings
      if (created) {
        setMyProducts((prev) => [created, ...prev.filter((p) => p._id !== created._id)]);
        // broadcast event so other pages (homepage) can update optimistically
        try {
          window.dispatchEvent(new CustomEvent('app:productCreated', { detail: created }));
        } catch (e) {}
      }
      // Refresh products from server to ensure consistent data (populated fields, server defaults)
      try {
        const listRes = await productService.getProducts({ seller: serverUser._id, limit: 50 });
        let serverProducts = listRes.data.products || [];
        // If server returned no products but we have the created product, keep it (avoid overwriting optimistic insert)
        if (created) {
          const exists = serverProducts.find((p: any) => p._id === created._id);
          if (!exists) serverProducts = [created, ...serverProducts];
        }
        setMyProducts(serverProducts);
      } catch (err) {
        // ignore — keep optimistic product already inserted
      }
      // Update debug list
      await fetchDebugProducts(serverUser._id).catch(() => {});
      // clear form
      setName("");
      setPrice("");
      setDiscount("");
      setShortDescription("");
      setSpecs("");
      setImages([]);
      setProductAge("");
      try { localStorage.removeItem(getDraftKey()); } catch (e) {}
      setStatusMessage("Product listed successfully");
    } catch (err: any) {
      setStatusMessage(err?.response?.data?.message || "Failed to create product");
    } finally {
      setSaving(false);
      setTimeout(() => setStatusMessage(""), 3500);
    }
  };

  const fetchDebugProducts = async (sellerId: string) => {
    if (!sellerId && !serverUser?.email && !serverUser?.sellerProfile?.mobileNumber) return;
    setDebugLoading(true);
    try {
      // try by id first
      if (sellerId) {
        const res = await api.get(`/debug/products`, { params: { seller: sellerId } });
        if (res?.data?.products && res.data.products.length > 0) {
          setDebugProducts(res.data.products || []);
          return;
        }
      }

      // fallback to email
      if (serverUser?.email) {
        try {
          const r2 = await api.get(`/debug/products`, { params: { sellerEmail: serverUser.email } });
          if (r2?.data?.products && r2.data.products.length > 0) {
            setDebugProducts(r2.data.products || []);
            return;
          }
        } catch (e) {}
      }

      // fallback to mobile
      if (serverUser?.sellerProfile?.mobileNumber) {
        try {
          const r3 = await api.get(`/debug/products`, { params: { sellerMobile: serverUser.sellerProfile.mobileNumber } });
          if (r3?.data?.products) {
            setDebugProducts(r3.data.products || []);
            return;
          }
        } catch (e) {}
      }

      // if none matched, show empty list
      setDebugProducts([]);
    } catch (err) {
      setDebugProducts(null);
    } finally {
      setDebugLoading(false);
    }
  };

  if (loading) return <div>Loading…</div>;

  // Not eligible message
  if (!eligibleDomain && !serverUser?.sellerApproved) {
    return (
      <div className="py-4">
        <h2 className="text-lg font-bold mb-2">Sell a Product</h2>
        <div className="bg-white rounded-lg border p-4">
          <p className="mb-3">Only IIITM users are allowed to sell products. You don’t belong to this category.</p>
          {!showRequestForm ? (
            <Button onClick={() => setShowRequestForm(true)} disabled={requestSent}>{requestSent ? "Request Submitted" : "Request Access from Admin"}</Button>
          ) : (
            <div className="space-y-3">
              <input placeholder="Mobile Number" value={mobileNumber} onChange={(e) => setMobileNumber(e.target.value)} className="w-full p-2 border rounded" />
              <div className="flex gap-2">
                <Button onClick={handleRequestAccess} disabled={requestSent}>{requestSent ? "Requested" : "Send Request"}</Button>
                <Button variant="ghost" onClick={() => setShowRequestForm(false)} disabled={requestSent}>Cancel</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Seller UI (approved or iiitm domain)
  const parsedImages = images;
  const isValid = name.trim() !== "" && Number(price) > 0 && category && shortDescription.trim() !== "" && sellerMobile.trim() !== "" && sellerHostel.trim() !== "" && sellerRoom.trim() !== "";

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Sell a Product</h2>
        <div className="text-sm text-muted-foreground">Manage your listings and orders</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <div className="bg-white rounded-xl border border-border p-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-3">New Listing</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Product Name</label>
              <input
                placeholder="Product Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-3 pr-4 py-2 bg-muted rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Price (₹)</label>
              <input
                placeholder="Price"
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full pl-3 pr-4 py-2 bg-muted rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Discount %</label>
              <input
                placeholder="Discount %"
                type="number"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                className="w-full pl-3 pr-4 py-2 bg-muted rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Short Description</label>
              <textarea
                placeholder="Short description shown on product page"
                value={shortDescription}
                onChange={(e) => setShortDescription(e.target.value)}
                className="w-full p-3 bg-muted rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-ring"
                rows={2}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-2 bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select category</option>
                {categories?.map((c: any) => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Product Age</label>
              <input
                placeholder="e.g. 6 months"
                value={productAge}
                onChange={(e) => setProductAge(e.target.value)}
                className="w-full pl-3 pr-4 py-2 bg-muted rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Specifications</label>
              <textarea
                placeholder="Detailed specifications (optional)"
                value={specs}
                onChange={(e) => setSpecs(e.target.value)}
                className="w-full p-3 bg-muted rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-ring"
                rows={4}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Seller Mobile</label>
              <input
                placeholder="e.g. 9876543210"
                value={sellerMobile}
                onChange={(e) => setSellerMobile(e.target.value)}
                className="w-full pl-3 pr-4 py-2 bg-muted rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Hostel Number</label>
                <input
                  placeholder="e.g. A-12"
                  value={sellerHostel}
                  onChange={(e) => setSellerHostel(e.target.value)}
                  className="w-full pl-3 pr-4 py-2 bg-muted rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Room Number</label>
                <input
                  placeholder="e.g. 101"
                  value={sellerRoom}
                  onChange={(e) => setSellerRoom(e.target.value)}
                  className="w-full pl-3 pr-4 py-2 bg-muted rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Images</label>
              <div className="text-sm text-muted-foreground mb-2">Upload up to 6 images. First image will be used as thumbnail.</div>
              <ImageUploader images={images} onChange={setImages} max={6} onUploadingChange={setImagesUploading} />
            </div>
          </div>

            <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-muted-foreground">Fields marked are required: Name, Price, Category, Short Description</div>
            <div className="flex items-center gap-2">
              <Button onClick={handleCreateProduct} disabled={!isValid || saving || imagesUploading}>{saving ? "Listing…" : imagesUploading ? "Uploading…" : "Add Product"}</Button>
            </div>
          </div>

          {statusMessage && <div className="mt-3 text-sm text-green-600">{statusMessage}</div>}
        </div>

        {/* Listings & Orders */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-border p-4 shadow-sm">
            <h3 className="text-lg font-semibold mb-3">Your Listings</h3>
            {myProducts.length === 0 ? (
              <div>
                <div className="text-muted-foreground">No products listed yet.</div>
                <div className="mt-2 text-xs text-muted-foreground">Debug: {debugLoading ? 'Checking products...' : (debugProducts === null ? 'Debug endpoint not available' : `${debugProducts.length} products found in DB for you`)}</div>
                {debugProducts && debugProducts.length > 0 && (
                  <div className="mt-2">
                    <div className="text-sm font-medium mb-1">DB Products (dev)</div>
                    <ul className="text-xs list-disc ml-5 space-y-1">
                      {debugProducts.map((p) => (
                        <li key={p._id}>{p.name || '— unnamed —'} ({p._id})</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {myProducts.map((p) => (
                  <div key={p._id} className="flex items-center gap-3 p-3 border rounded-lg">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.images?.[0] || "/placeholder.png"} alt={p.name} className="w-20 h-20 object-cover rounded" />
                    <div className="flex-1">
                      <div className="font-medium">{p.name}</div>
                      <div className="text-sm text-muted-foreground">{p.category?.name} • {formatCurrency(Number(p.price || 0))}</div>
                    </div>
                    <div className="text-sm">{p.sold ? "Sold" : p.isActive ? "Active" : "Removed"}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

              <div className="bg-white rounded-xl border border-border p-4 shadow-sm">
                <h3 className="text-lg font-semibold mb-3">Orders For Your Items</h3>
                {myOrders.length === 0 ? (
                  <div className="text-muted-foreground">No orders yet.</div>
                ) : (
                  <div className="space-y-3">
                    {myOrders.map((o) => (
                      <div key={o._id} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">Order #{o._id.slice(-8).toUpperCase()}</div>
                            <div className="text-sm text-muted-foreground">{new Date(o.createdAt).toLocaleString()}</div>
                          </div>
                          <div className="text-sm">{o.status}</div>
                        </div>
                        <div className="mt-2 text-sm">
                          {o.items.map((it: any) => {
                            // Determine if this item belongs to the current seller
                            const belongsToMe = (() => {
                              try {
                                if (!serverUser) return false;
                                const myId = String(serverUser._id);
                                if (it.seller && String(it.seller) === myId) return true;
                                if (it.sellerEmail && serverUser.email && String(it.sellerEmail).toLowerCase() === String(serverUser.email).toLowerCase()) return true;
                                if (it.sellerMobile && serverUser.sellerProfile?.mobileNumber && String(it.sellerMobile) === String(serverUser.sellerProfile.mobileNumber)) return true;
                                return false;
                              } catch (e) { return false; }
                            })();

                            return (
                              <div key={it._id || (it.product?._id || it.product)} className="flex items-center gap-2 py-1">
                                <img src={it.product?.images?.[0] || "/placeholder.png"} className="w-10 h-10 object-cover rounded" />
                                <div className="flex-1">{it.name} × {it.quantity}
                                  <div className="text-xs text-muted-foreground">Seller: {it.sellerName || it.sellerEmail || '—'}</div>
                                </div>
                                <div className="text-sm">{formatCurrency(Number(it.price) * Number(it.quantity))}</div>
                                {belongsToMe ? (
                                  <div className="ml-2">
                                    {/* If user is not signed in with Clerk, prompt sign-in instead of showing the select */}
                                    {!isSignedIn ? (
                                      <button
                                        onClick={() => openSignIn()}
                                        className="ml-2 px-2 py-1 text-sm border rounded-lg bg-yellow-50"
                                      >
                                        Sign in to update
                                      </button>
                                    ) : (
                                      <select
                                        value={it.itemStatus || 'Pending'}
                                        onChange={async (e) => {
                                          const newStatus = e.target.value;
                                          const itemId = it._id;
                                          if (!itemId) return;
                                          setUpdatingItem((s) => ({ ...s, [itemId]: true }));
                                          try {
                                            await orderService.updateOrderItemStatus(o._id, itemId, newStatus);
                                          } catch (err: any) {
                                            const statusCode = err?.response?.status;
                                            // if unauthenticated, open Clerk sign-in
                                            if (statusCode === 401) {
                                              openSignIn();
                                            } else {
                                              alert('Failed to update item status');
                                            }
                                          } finally {
                                            setUpdatingItem((s) => ({ ...s, [itemId]: false }));
                                            // refresh orders list to reflect change
                                            orderService.getSellerOrders({ limit: 50 }).then((r) => setMyOrders(r.data.orders)).catch(() => {});
                                          }
                                        }}
                                        disabled={!!updatingItem[it._id]}
                                        className="ml-2 px-2 py-1 text-sm border rounded-lg"
                                      >
                                        {['Pending','Processing','Shipped','Delivered','Cancelled'].map((s) => (
                                          <option key={s} value={s}>{s}</option>
                                        ))}
                                      </select>
                                    )}
                                  </div>
                                ) : (
                                  <div className="ml-2 text-xs text-muted-foreground">{it.itemStatus || 'Pending'}</div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
        </div>
      </div>
    </div>
  );
}
