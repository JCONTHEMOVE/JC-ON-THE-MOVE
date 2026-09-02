import { Link } from "wouter";
import { ShoppingCart } from "lucide-react";
import { useCart } from "@/hooks/useCart";

export function FloatingCartButton() {
  const { itemCount } = useCart();

  if (itemCount === 0) return null;

  return (
    <Link href="/cart">
      <button className="fixed bottom-6 right-6 z-50 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white p-4 rounded-full shadow-2xl transition-all duration-300 hover:scale-110 group">
        <ShoppingCart className="h-6 w-6" />
        <span className="absolute -top-2 -right-2 bg-yellow-500 text-black text-xs font-extrabold w-6 h-6 rounded-full flex items-center justify-center shadow-lg">
          {itemCount}
        </span>
        {itemCount > 1 && (
          <span className="absolute -top-8 right-0 bg-emerald-700 text-emerald-100 text-xs px-2 py-1 rounded-full whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
            Review bundle savings
          </span>
        )}
      </button>
    </Link>
  );
}
