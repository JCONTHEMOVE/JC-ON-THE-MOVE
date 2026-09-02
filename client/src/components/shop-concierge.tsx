import { useState, type FormEvent } from "react";
import { Bot, Check, Loader2, Send, ShoppingCart, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCart } from "@/hooks/useCart";
import { useToast } from "@/hooks/use-toast";

type SuggestedItem = {
  id: string;
  title: string;
  short_description?: string;
  description?: string;
  price: string;
  category?: string;
  materials?: string;
  image_url?: string;
};

type ConciergeResponse = {
  message: string;
  suggestedItems: SuggestedItem[];
  canAutoAdd: false;
};

export function ShopConcierge() {
  const { addItem, isInCart } = useCart();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [message, setMessage] = useState("Tell me what you are shopping for—a color, material, jewelry type, gift, or budget.");
  const [suggestions, setSuggestions] = useState<SuggestedItem[]>([]);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const query = input.trim();
    if (!query || loading) return;
    setLoading(true);
    try {
      const response = await fetch("/api/ashley-shop/concierge", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: query }),
      });
      const data = await response.json() as ConciergeResponse & { error?: string };
      if (!response.ok) throw new Error(data.error || "The assistant is unavailable");
      setMessage(data.message);
      setSuggestions(data.suggestedItems || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The assistant is unavailable. Please try again.");
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }

  function addSuggestion(item: SuggestedItem) {
    addItem({
      id: `jewelry-${item.id}`,
      referenceId: item.id,
      name: item.title,
      price: Number(item.price),
      image: item.image_url || "",
      type: "jewelry",
    });
    toast({ title: `${item.title} added`, description: "The server will verify availability and all discounts at checkout." });
  }

  if (!open) {
    return (
      <Button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-4 z-40 rounded-full bg-rose-600 px-4 shadow-xl hover:bg-rose-700"
        aria-label="Open Ashley shop assistant"
      >
        <Sparkles className="mr-2 h-4 w-4" /> Find a piece
      </Button>
    );
  }

  return (
    <section className="fixed bottom-24 right-4 z-40 flex max-h-[70vh] w-[min(390px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-rose-200 bg-white shadow-2xl" aria-label="Ashley shop assistant">
      <header className="flex items-center justify-between bg-gradient-to-r from-rose-600 to-pink-500 px-4 py-3 text-white">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          <div><p className="text-sm font-bold">Ashley’s Shop Assistant</p><p className="text-[11px] text-rose-100">Suggestions only—you control the cart</p></div>
        </div>
        <button type="button" onClick={() => setOpen(false)} className="rounded-full p-1 hover:bg-white/20" aria-label="Close shop assistant"><X className="h-4 w-4" /></button>
      </header>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-rose-50/40 p-3">
        <p className="rounded-xl rounded-tl-sm border border-rose-100 bg-white p-3 text-sm text-stone-700">{message}</p>
        {suggestions.map((item) => {
          const cartId = `jewelry-${item.id}`;
          const added = isInCart(cartId);
          return (
            <article key={item.id} className="flex gap-3 rounded-xl border border-rose-100 bg-white p-3">
              {item.image_url ? <img src={item.image_url} alt="" className="h-20 w-20 shrink-0 rounded-lg object-cover" /> : <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-rose-100"><Sparkles className="h-6 w-6 text-rose-400" /></div>}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-stone-800">{item.title}</p>
                <p className="line-clamp-2 text-xs text-stone-500">{item.short_description || item.materials || item.category}</p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="font-bold text-rose-600">${Number(item.price).toFixed(2)}</span>
                  <Button type="button" size="sm" variant={added ? "outline" : "default"} disabled={added} onClick={() => addSuggestion(item)}>
                    {added ? <Check className="mr-1 h-3.5 w-3.5" /> : <ShoppingCart className="mr-1 h-3.5 w-3.5" />}{added ? "Added" : "Add"}
                  </Button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <form onSubmit={submit} className="flex gap-2 border-t border-rose-100 bg-white p-3">
        <Input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Try “blue earrings under $40”" maxLength={1_000} aria-label="What are you shopping for?" />
        <Button type="submit" size="icon" disabled={!input.trim() || loading} aria-label="Send request">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </section>
  );
}
