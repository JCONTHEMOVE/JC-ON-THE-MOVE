import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, ArrowLeft, Eye, MessageCircle, DollarSign, X } from "lucide-react";
import { type ShopItem } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export function ShopItemDetailPage() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [isZoomOpen, setIsZoomOpen] = useState(false);

  // Fetch shop item details
  const { data: item, isLoading } = useQuery<ShopItem>({
    queryKey: ["/api/shop", id],
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <Skeleton className="h-8 w-32 mb-4" />
        <Skeleton className="h-96 w-full mb-4" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Item Not Found</h1>
          <p className="text-muted-foreground mb-4">The item you're looking for doesn't exist.</p>
          <Button onClick={() => setLocation("/")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Shop
          </Button>
        </div>
      </div>
    );
  }

  const media = Array.isArray(item.photos) ? item.photos : [];
  const hasMultipleMedia = media.length > 1;
  const currentMedia = media[currentMediaIndex];
  const isVideo = currentMedia?.startsWith("data:video/") || currentMedia?.match(/\.(mp4|webm|ogg|mov)(\?|$)/i);

  const nextMedia = () => {
    setCurrentMediaIndex((prev) => (prev + 1) % media.length);
  };

  const prevMedia = () => {
    setCurrentMediaIndex((prev) => (prev - 1 + media.length) % media.length);
  };

  const handleContactSeller = () => {
    toast({
      title: "Contact Seller",
      description: "Contact functionality coming soon! You'll be able to message the seller directly.",
    });
  };

  const handleMakeOffer = () => {
    toast({
      title: "Make an Offer",
      description: "Payment integration coming soon! You'll be able to purchase items directly.",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b p-4 flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation("/")}
          data-testid="button-back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold flex-1 truncate" data-testid="text-page-title">
          {item.title}
        </h1>
      </div>

      <div className="p-4 space-y-4">
        {/* Media Gallery */}
        {media.length > 0 && (
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div className="relative aspect-square bg-muted">
                {isVideo ? (
                  <video
                    src={currentMedia}
                    controls
                    playsInline
                    className="w-full h-full object-contain"
                    data-testid={`video-detail-${item.id}`}
                  />
                ) : (
                  <Dialog open={isZoomOpen} onOpenChange={setIsZoomOpen}>
                    <DialogTrigger asChild>
                      <img
                        src={currentMedia}
                        alt={item.title}
                        className="w-full h-full object-cover cursor-zoom-in"
                        data-testid={`img-detail-${item.id}`}
                      />
                    </DialogTrigger>
                    <DialogContent className="max-w-[95vw] max-h-[95vh] p-2">
                      <div className="relative w-full h-full flex items-center justify-center">
                        <img
                          src={currentMedia}
                          alt={item.title}
                          className="max-w-full max-h-[90vh] object-contain"
                          data-testid="img-zoomed"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute top-2 right-2"
                          onClick={() => setIsZoomOpen(false)}
                        >
                          <X className="h-5 w-5" />
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}

                {/* Navigation for multiple media */}
                {hasMultipleMedia && (
                  <>
                    <button
                      onClick={prevMedia}
                      className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full hover:bg-black/70"
                      data-testid="button-prev-media"
                    >
                      <ChevronLeft className="h-6 w-6" />
                    </button>
                    <button
                      onClick={nextMedia}
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full hover:bg-black/70"
                      data-testid="button-next-media"
                    >
                      <ChevronRight className="h-6 w-6" />
                    </button>

                    {/* Media counter and indicators */}
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white px-3 py-1 rounded-full text-sm">
                      {currentMediaIndex + 1} / {media.length}
                    </div>

                    {/* Thumbnail strip */}
                    <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex gap-2 max-w-full overflow-x-auto px-4">
                      {media.map((mediaUrl, index) => {
                        const isThumbVideo = mediaUrl.startsWith("data:video/") || mediaUrl.match(/\.(mp4|webm|ogg|mov)(\?|$)/i);
                        return (
                          <button
                            key={index}
                            onClick={() => setCurrentMediaIndex(index)}
                            className={`flex-shrink-0 h-12 w-12 rounded overflow-hidden border-2 ${
                              index === currentMediaIndex ? "border-white" : "border-white/30"
                            }`}
                            data-testid={`button-thumb-${index}`}
                          >
                            {isThumbVideo ? (
                              <div className="w-full h-full bg-black/80 flex items-center justify-center text-white text-xs">
                                📹
                              </div>
                            ) : (
                              <img
                                src={mediaUrl}
                                alt={`Thumbnail ${index + 1}`}
                                className="w-full h-full object-cover"
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Price and Status */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-3xl font-bold text-primary mb-1" data-testid="text-price">
                  ${item.price}
                </h2>
                <div className="flex gap-2 items-center">
                  {item.category && (
                    <Badge variant="secondary" data-testid="badge-category">
                      {item.category}
                    </Badge>
                  )}
                  {item.status !== "active" && (
                    <Badge variant="outline" data-testid="badge-status">
                      {item.status}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <Eye className="h-4 w-4" />
                <span className="text-sm" data-testid="text-views">{item.views || 0}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                size="lg"
                className="w-full"
                onClick={handleMakeOffer}
                data-testid="button-make-offer"
              >
                <DollarSign className="h-5 w-5 mr-2" />
                Buy Now
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="w-full"
                onClick={handleContactSeller}
                data-testid="button-contact-seller"
              >
                <MessageCircle className="h-5 w-5 mr-2" />
                Contact
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Description */}
        <Card>
          <CardContent className="p-4">
            <h3 className="text-lg font-semibold mb-2">Description</h3>
            <p className="text-foreground whitespace-pre-wrap" data-testid="text-full-description">
              {item.description}
            </p>
          </CardContent>
        </Card>

        {/* Payment Options Info */}
        <Card>
          <CardContent className="p-4">
            <h3 className="text-lg font-semibold mb-2">Payment Options</h3>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>💳 Cash on delivery</p>
              <p>💵 Bank transfer</p>
              <p>🪙 Cryptocurrency (coming soon)</p>
              <p className="pt-2 border-t">
                <strong>Safe Transaction Tips:</strong> Meet in public places, inspect items before payment,
                and use secure payment methods.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Item Details */}
        <Card>
          <CardContent className="p-4">
            <h3 className="text-lg font-semibold mb-2">Item Details</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Posted</span>
                <span>{new Date(item.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Item ID</span>
                <span className="font-mono text-xs">{item.id.slice(0, 8)}...</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
