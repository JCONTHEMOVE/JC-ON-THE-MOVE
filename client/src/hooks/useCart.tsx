import { createContext, useContext, useState, useCallback, useEffect, useMemo, type ReactNode } from "react";

export interface CartItem {
  id: string;
  referenceId?: string;
  bookingId?: string;
  name: string;
  price: number;
  image: string;
  type: "service" | "jewelry" | "promo" | "sponsor" | "shop" | "tip";
  quantity: number;
  settlementMode?: "pay_now" | "linked_booking" | "quote_later";
  bookNow?: boolean;
  metadata?: Record<string, unknown>;
}

export interface DiscountBreakdown {
  instantBookDiscount: number;
  jewelsDiscount: number;
  multiServiceDiscount: number;
  jewelsCount: number;
  hasInstantBook: boolean;
  multiService: boolean;
  totalPct: number;
}

interface CartContextType {
  items: CartItem[];
  guestCartId: string;
  addItem: (item: Omit<CartItem, "quantity"> & { quantity?: number }) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
  isInCart: (id: string) => boolean;
  itemCount: number;
  subtotal: number;
  discount: number;
  total: number;
  hasMultipleItems: boolean;
  breakdown: DiscountBreakdown;
}

const CART_KEY = "jc-commerce-cart-v2";
const GUEST_KEY = "jc-commerce-guest-cart-id";
const CartContext = createContext<CartContextType | null>(null);

function readStoredItems(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(CART_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function getGuestCartId(): string {
  if (typeof window === "undefined") return "00000000-0000-4000-8000-000000000000";
  const current = window.localStorage.getItem(GUEST_KEY);
  if (current) return current;
  const created = typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(16).padStart(8, "0")}-0000-4000-8000-${Math.random().toString(16).slice(2).padEnd(12, "0").slice(0, 12)}`;
  window.localStorage.setItem(GUEST_KEY, created);
  return created;
}

function mergeItems(local: CartItem[], remote: CartItem[]): CartItem[] {
  const merged = new Map<string, CartItem>();
  for (const item of [...remote, ...local]) merged.set(item.id, { ...item, quantity: item.quantity || 1 });
  return Array.from(merged.values()).slice(0, 100);
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(readStoredItems);
  const [guestCartId] = useState(getGuestCartId);
  const [remoteLoaded, setRemoteLoaded] = useState(false);

  const loadRemote = useCallback(async () => {
    try {
      const response = await fetch(`/api/commerce/cart?guestCartId=${encodeURIComponent(guestCartId)}`, { credentials: "include" });
      if (!response.ok) return;
      const data = await response.json();
      const remote = Array.isArray(data?.items) ? data.items : [];
      if (remote.length) setItems((current) => mergeItems(current, remote));
    } catch {
      // The local cart remains usable while offline.
    } finally {
      setRemoteLoaded(true);
    }
  }, [guestCartId]);

  useEffect(() => {
    loadRemote();
    const onFocus = () => loadRemote();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadRemote]);

  useEffect(() => {
    window.localStorage.setItem(CART_KEY, JSON.stringify(items));
    if (!remoteLoaded) return;
    const timer = window.setTimeout(() => {
      fetch("/api/commerce/cart", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guestCartId, items }),
      }).catch(() => {});
    }, 300);
    return () => window.clearTimeout(timer);
  }, [guestCartId, items, remoteLoaded]);

  const addItem = useCallback((item: Omit<CartItem, "quantity"> & { quantity?: number }) => {
    setItems((previous) => {
      const index = previous.findIndex((current) => current.id === item.id);
      if (index >= 0) {
        if (item.type === "jewelry" || item.settlementMode === "linked_booking") return previous;
        return previous.map((current, itemIndex) => itemIndex === index
          ? { ...current, ...item, quantity: Math.min(25, current.quantity + (item.quantity || 1)) }
          : current);
      }
      return [...previous, { ...item, quantity: item.quantity || 1, settlementMode: item.settlementMode || "pay_now" }];
    });
  }, []);

  const removeItem = useCallback((id: string) => setItems((previous) => previous.filter((item) => item.id !== id)), []);
  const clearCart = useCallback(() => setItems([]), []);
  const isInCart = useCallback((id: string) => items.some((item) => item.id === id), [items]);

  const computed = useMemo(() => {
    const payable = items.filter((item) => item.settlementMode !== "linked_booking" && item.settlementMode !== "quote_later");
    const subtotal = payable.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const jewelryItems = payable.filter((item) => item.type === "jewelry");
    const jewelrySubtotal = jewelryItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const jewelsCount = jewelryItems.reduce((sum, item) => sum + item.quantity, 0);
    const hasServiceBooking = items.some((item) => (item.type === "service" || item.type === "promo") && item.settlementMode === "linked_booking");
    const bundlePct = jewelsCount >= 3 ? 10 : jewelsCount >= 2 ? 5 : 0;
    const totalPct = Math.min(15, bundlePct + (hasServiceBooking ? 5 : 0));
    const jewelsDiscount = Math.round(jewelrySubtotal * totalPct) / 100;
    return {
      subtotal,
      discount: jewelsDiscount,
      total: Math.max(0, subtotal - jewelsDiscount),
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
      breakdown: {
        instantBookDiscount: 0,
        jewelsDiscount,
        multiServiceDiscount: 0,
        jewelsCount,
        hasInstantBook: false,
        multiService: false,
        totalPct,
      },
    };
  }, [items]);

  return (
    <CartContext.Provider value={{
      items,
      guestCartId,
      addItem,
      removeItem,
      clearCart,
      isInCart,
      itemCount: computed.itemCount,
      subtotal: computed.subtotal,
      discount: computed.discount,
      total: computed.total,
      hasMultipleItems: computed.itemCount > 1,
      breakdown: computed.breakdown,
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within a CartProvider");
  return context;
}
