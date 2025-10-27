import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Plus, X, Eye } from "lucide-react";
import { type ShopItem } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

// Item Card Component with Photo Slideshow
function ShopItemCard({ item }: { item: ShopItem }) {
  const [, setLocation] = useLocation();
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  
  const photos = Array.isArray(item.photos) ? item.photos : [];
  const hasMultiplePhotos = photos.length > 1;

  const nextPhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentPhotoIndex((prev) => (prev + 1) % photos.length);
  };

  const prevPhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentPhotoIndex((prev) => (prev - 1 + photos.length) % photos.length);
  };

  const handleClick = () => {
    setLocation(`/shop/${item.id}`);
  };

  return (
    <Card 
      className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow" 
      onClick={handleClick}
      data-testid={`card-shop-item-${item.id}`}
    >
      {/* Media Slideshow (Photos/Videos) */}
      {photos.length > 0 && (
        <div className="relative aspect-square bg-muted">
          {photos[currentPhotoIndex].startsWith("data:video/") || photos[currentPhotoIndex].match(/\.(mp4|webm|ogg|mov)(\?|$)/i) ? (
            <video
              src={photos[currentPhotoIndex]}
              controls
              playsInline
              className="w-full h-full object-contain"
              data-testid={`video-shop-item-${item.id}`}
            />
          ) : (
            <img
              src={photos[currentPhotoIndex]}
              alt={item.title}
              className="w-full h-full object-cover"
              data-testid={`img-shop-item-${item.id}`}
            />
          )}
          
          {/* Navigation for multiple media items */}
          {hasMultiplePhotos && (
            <>
              <button
                onClick={prevPhoto}
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-1 rounded-full hover:bg-black/70"
                data-testid={`button-prev-photo-${item.id}`}
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={nextPhoto}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-1 rounded-full hover:bg-black/70"
                data-testid={`button-next-photo-${item.id}`}
              >
                <ChevronRight className="h-5 w-5" />
              </button>
              
              {/* Media indicators */}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                {photos.map((_, index) => (
                  <div
                    key={index}
                    className={`h-1.5 w-1.5 rounded-full ${
                      index === currentPhotoIndex ? "bg-white" : "bg-white/50"
                    }`}
                    data-testid={`indicator-photo-${item.id}-${index}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <CardContent className="p-4">
        <div className="flex justify-between items-start gap-2 mb-2">
          <h3 className="font-semibold text-lg line-clamp-1" data-testid={`text-title-${item.id}`}>
            {item.title}
          </h3>
          <p className="font-bold text-primary text-lg whitespace-nowrap" data-testid={`text-price-${item.id}`}>
            ${item.price}
          </p>
        </div>
        
        <p className="text-sm text-muted-foreground line-clamp-2 mb-2" data-testid={`text-description-${item.id}`}>
          {item.description}
        </p>
        
        <div className="flex justify-between items-center text-xs text-muted-foreground">
          <div className="flex gap-2">
            {item.category && (
              <Badge variant="secondary" data-testid={`badge-category-${item.id}`}>
                {item.category}
              </Badge>
            )}
            {item.status !== "active" && (
              <Badge variant="outline" data-testid={`badge-status-${item.id}`}>
                {item.status}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Eye className="h-3 w-3" />
            <span data-testid={`text-views-${item.id}`}>{item.views || 0}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Create Item Form Component
function CreateItemForm({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [currentPhotoUrl, setCurrentPhotoUrl] = useState("");
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    price: "",
    category: "",
    status: "active" as "active" | "draft" | "sold" | "archived",
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/shop", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shop"] });
      toast({
        title: "Success",
        description: "Item posted successfully!",
      });
      // Reset form
      setFormData({
        title: "",
        description: "",
        price: "",
        category: "",
        status: "active",
      });
      setPhotoUrls([]);
      setCurrentPhotoUrl("");
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to post item",
        variant: "destructive",
      });
    },
  });

  const addPhoto = () => {
    if (currentPhotoUrl && photoUrls.length < 10) {
      try {
        new URL(currentPhotoUrl); // Validate URL
        setPhotoUrls([...photoUrls, currentPhotoUrl]);
        setCurrentPhotoUrl("");
      } catch {
        toast({
          title: "Invalid URL",
          description: "Please enter a valid image URL",
          variant: "destructive",
        });
      }
    }
  };

  const removePhoto = (index: number) => {
    setPhotoUrls(photoUrls.filter((_, i) => i !== index));
    if (currentPhotoIndex >= photoUrls.length - 1) {
      setCurrentPhotoIndex(Math.max(0, photoUrls.length - 2));
    }
  };

  const handleSubmit = () => {
    if (!formData.title || !formData.description || !formData.price || photoUrls.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields and add at least one photo",
        variant: "destructive",
      });
      return;
    }

    createMutation.mutate({
      ...formData,
      price: formData.price,
      photos: photoUrls,
    });
  };

  return (
    <div className="space-y-4">
      {/* Media Preview (Photos/Videos) */}
      {photoUrls.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="relative aspect-square bg-muted rounded-lg overflow-hidden">
              {photoUrls[currentPhotoIndex].startsWith("data:video/") || photoUrls[currentPhotoIndex].match(/\.(mp4|webm|ogg|mov)(\?|$)/i) ? (
                <video
                  src={photoUrls[currentPhotoIndex]}
                  controls
                  playsInline
                  className="w-full h-full object-contain"
                  data-testid="preview-video"
                />
              ) : (
                <img
                  src={photoUrls[currentPhotoIndex]}
                  alt="Preview"
                  className="w-full h-full object-cover"
                  data-testid="preview-image"
                />
              )}
              
              {photoUrls.length > 1 && (
                <>
                  <button
                    onClick={() => setCurrentPhotoIndex((prev) => (prev - 1 + photoUrls.length) % photoUrls.length)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => setCurrentPhotoIndex((prev) => (prev + 1) % photoUrls.length)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              )}
              
              <button
                onClick={() => removePhoto(currentPhotoIndex)}
                className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full"
              >
                <X className="h-4 w-4" />
              </button>
              
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                {photoUrls.map((_, index) => (
                  <div
                    key={index}
                    className={`h-2 w-2 rounded-full ${index === currentPhotoIndex ? "bg-white" : "bg-white/50"}`}
                  />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Media (Photo or Video) */}
      <div className="space-y-2">
        <Label>Add Media {photoUrls.length > 0 && `(${photoUrls.length}/10)`}</Label>
        
        {/* File Upload Buttons */}
        <div className="flex gap-2">
          {/* Photo Upload */}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            id="photo-upload"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file && photoUrls.length < 10) {
                if (file.size > 5 * 1024 * 1024) {
                  toast({
                    title: "File too large",
                    description: "Please select an image smaller than 5MB",
                    variant: "destructive",
                  });
                  return;
                }
                
                const reader = new FileReader();
                reader.onloadend = () => {
                  const base64String = reader.result as string;
                  setPhotoUrls([...photoUrls, base64String]);
                };
                reader.readAsDataURL(file);
              }
              e.target.value = "";
            }}
            data-testid="input-photo-file"
          />
          
          {/* Video Upload */}
          <input
            type="file"
            accept="video/*"
            className="hidden"
            id="video-upload"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file && photoUrls.length < 10) {
                if (file.size > 50 * 1024 * 1024) {
                  toast({
                    title: "File too large",
                    description: "Please select a video smaller than 50MB",
                    variant: "destructive",
                  });
                  return;
                }
                
                // Check video duration
                const video = document.createElement("video");
                video.preload = "metadata";
                video.onloadedmetadata = () => {
                  window.URL.revokeObjectURL(video.src);
                  if (video.duration > 60) {
                    toast({
                      title: "Video too long",
                      description: "Please select a video up to 1 minute long",
                      variant: "destructive",
                    });
                    return;
                  }
                  
                  const reader = new FileReader();
                  reader.onloadend = () => {
                    const base64String = reader.result as string;
                    setPhotoUrls([...photoUrls, base64String]);
                  };
                  reader.readAsDataURL(file);
                };
                video.src = URL.createObjectURL(file);
              }
              e.target.value = "";
            }}
            data-testid="input-video-file"
          />
          
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => document.getElementById("photo-upload")?.click()}
            disabled={photoUrls.length >= 10}
            data-testid="button-upload-photo"
          >
            <Plus className="h-4 w-4 mr-2" />
            Photo
          </Button>
          
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => document.getElementById("video-upload")?.click()}
            disabled={photoUrls.length >= 10}
            data-testid="button-upload-video"
          >
            <Plus className="h-4 w-4 mr-2" />
            Video
          </Button>
        </div>
        
        {/* OR divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">or enter url</span>
          </div>
        </div>
        
        {/* URL Input */}
        <div className="flex gap-2">
          <Input
            placeholder="https://example.com/image.jpg or video.mp4"
            value={currentPhotoUrl}
            onChange={(e) => setCurrentPhotoUrl(e.target.value)}
            data-testid="input-photo-url"
          />
          <Button onClick={addPhoto} size="icon" disabled={photoUrls.length >= 10} data-testid="button-add-photo">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Form Fields */}
      <div className="space-y-2">
        <Label htmlFor="title">Title *</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="Item title"
          data-testid="input-title"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description *</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Describe your item"
          rows={3}
          data-testid="input-description"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="price">Price *</Label>
        <Input
          id="price"
          type="text"
          value={formData.price}
          onChange={(e) => setFormData({ ...formData, price: e.target.value })}
          placeholder="10.99"
          data-testid="input-price"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="category">Category (Optional)</Label>
        <Input
          id="category"
          value={formData.category}
          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
          placeholder="e.g., Furniture, Electronics"
          data-testid="input-category"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="status">Status</Label>
        <Select
          value={formData.status}
          onValueChange={(value: any) => setFormData({ ...formData, status: value })}
        >
          <SelectTrigger data-testid="select-status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="sold">Sold</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button 
        onClick={handleSubmit} 
        className="w-full" 
        disabled={createMutation.isPending}
        data-testid="button-submit"
      >
        {createMutation.isPending ? "Posting..." : "Post Item"}
      </Button>
    </div>
  );
}

// Main Shop Page Component
export function ShopPage() {
  const [view, setView] = useState<"browse" | "create">("browse");
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="space-y-4 p-4 pb-20">
      {/* Header with View Toggle */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Shop</h1>
        <Button
          variant={view === "create" ? "default" : "outline"}
          size="sm"
          onClick={() => setView(view === "browse" ? "create" : "browse")}
          data-testid="button-toggle-view"
        >
          {view === "browse" ? <Plus className="h-4 w-4 mr-1" /> : <ChevronLeft className="h-4 w-4 mr-1" />}
          {view === "browse" ? "Post Item" : "Back"}
        </Button>
      </div>

      {view === "browse" ? (
        <>
          {/* Filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger data-testid="select-filter">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="sold">Sold</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>

          {/* Items Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i}>
                  <Skeleton className="aspect-square" />
                  <CardContent className="p-4 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : items && items.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {items.map((item) => (
                <ShopItemCard key={item.id} item={item} />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground mb-4">No items found</p>
                <Button onClick={() => setView("create")} data-testid="button-create-first">
                  <Plus className="h-4 w-4 mr-1" />
                  Post Your First Item
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <CreateItemForm onSuccess={() => setView("browse")} />
      )}
      </div>
    </div>
  );
}
