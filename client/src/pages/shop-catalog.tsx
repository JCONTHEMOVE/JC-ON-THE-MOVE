import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { type ShopItem } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, ChevronLeft, ChevronRight, Eye } from "lucide-react";

function ShopItemCard({ item }: { item: ShopItem }) {
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const photos = item.photos as string[];

  const handlePrevPhoto = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentPhotoIndex((prev) => (prev > 0 ? prev - 1 : photos.length - 1));
  };

  const handleNextPhoto = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentPhotoIndex((prev) => (prev < photos.length - 1 ? prev + 1 : 0));
  };

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow" data-testid={`card-shop-item-${item.id}`}>
      <CardHeader className="p-0">
        {/* Photo Slideshow */}
        <div className="relative bg-muted aspect-square overflow-hidden">
          {photos && photos.length > 0 ? (
            <>
              <img
                src={photos[currentPhotoIndex]}
                alt={item.title}
                className="w-full h-full object-cover"
                data-testid={`img-shop-item-${item.id}-${currentPhotoIndex}`}
              />
              
              {/* Navigation Arrows */}
              {photos.length > 1 && (
                <>
                  <button
                    onClick={handlePrevPhoto}
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors"
                    data-testid={`button-prev-photo-${item.id}`}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={handleNextPhoto}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors"
                    data-testid={`button-next-photo-${item.id}`}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  
                  {/* Photo Indicators */}
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                    {photos.map((_, index) => (
                      <div
                        key={index}
                        className={`h-1.5 rounded-full transition-all ${
                          index === currentPhotoIndex
                            ? "w-6 bg-white"
                            : "w-1.5 bg-white/50"
                        }`}
                      />
                    ))}
                  </div>
                </>
              )}
              
              {/* Status Badge */}
              {item.status !== "active" && (
                <div className="absolute top-2 left-2">
                  <Badge variant="secondary" className="capitalize">
                    {item.status}
                  </Badge>
                </div>
              )}
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              No Image
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="p-4">
        <h3 className="font-semibold text-lg mb-1 truncate" data-testid={`text-title-${item.id}`}>
          {item.title}
        </h3>
        <p className="text-sm text-muted-foreground mb-2 line-clamp-2" data-testid={`text-description-${item.id}`}>
          {item.description}
        </p>
        
        <div className="flex items-center justify-between">
          <span className="text-2xl font-bold text-primary" data-testid={`text-price-${item.id}`}>
            ${parseFloat(item.price).toFixed(2)}
          </span>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Eye className="h-4 w-4" />
            <span data-testid={`text-views-${item.id}`}>{item.views}</span>
          </div>
        </div>
        
        {item.category && (
          <div className="mt-2">
            <Badge variant="outline" className="text-xs" data-testid={`badge-category-${item.id}`}>
              {item.category}
            </Badge>
          </div>
        )}
      </CardContent>
      
      <CardFooter className="p-4 pt-0">
        <Button variant="outline" className="w-full" data-testid={`button-view-details-${item.id}`}>
          View Details
        </Button>
      </CardFooter>
    </Card>
  );
}

export function ShopCatalogPage() {
  const [statusFilter, setStatusFilter] = useState<string>("active");
  
  const { data: items, isLoading } = useQuery<ShopItem[]>({
    queryKey: ["/api/shop", statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== "all") {
        params.append("status", statusFilter);
      }
      const url = `/api/shop${params.toString() ? `?${params.toString()}` : ""}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Failed to fetch shop items");
      }
      return response.json();
    },
  });

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold" data-testid="heading-shop">Shop</h1>
          <p className="text-muted-foreground">
            Browse items from our community
          </p>
        </div>
        
        <Link href="/shop/create">
          <Button data-testid="button-post-item">
            <Plus className="h-4 w-4 mr-2" />
            Post Item
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="mb-6 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <label htmlFor="status-filter" className="text-sm font-medium">
            Status:
          </label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger id="status-filter" className="w-[150px]" data-testid="select-status-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="sold">Sold</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Items Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <Card key={i}>
              <Skeleton className="aspect-square w-full" />
              <CardContent className="p-4">
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-8 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : items && items.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {items.map((item) => (
            <ShopItemCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4" data-testid="text-no-items">
            No items found. Be the first to post!
          </p>
          <Link href="/shop/create">
            <Button variant="outline" data-testid="button-post-first-item">
              <Plus className="h-4 w-4 mr-2" />
              Post Item
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
