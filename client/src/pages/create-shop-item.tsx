import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { insertShopItemSchema, type InsertShopItem } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, X, Upload, Loader2 } from "lucide-react";
import { z } from "zod";

// Form schema for client-side validation
// Updated to accept both URLs and base64 data URLs for photo uploads
const formSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().min(1, "Description is required"),
  price: z.string().min(1, "Price is required").regex(/^\d+(\.\d{1,2})?$/, "Invalid price format (e.g., 10.99)"),
  photos: z.array(
    z.string()
      .refine(
        (val) => val.startsWith("http://") || val.startsWith("https://") || val.startsWith("data:image/"),
        { message: "Must be a valid URL or image file" }
      )
  ).min(1, "At least one photo is required").max(10, "Maximum 10 photos allowed"),
  status: z.enum(["draft", "active", "sold", "archived"]),
  category: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

export function CreateShopItemPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [photoInputValue, setPhotoInputValue] = useState("");

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      price: "",
      photos: [],
      status: "draft",
      category: "",
    },
  });

  const createItemMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const response = await apiRequest("POST", "/api/shop", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shop"] });
      toast({
        title: "Success!",
        description: "Your item has been posted to the shop.",
      });
      setLocation("/shop");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create shop item. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleAddPhoto = () => {
    if (photoInputValue && !photoUrls.includes(photoInputValue)) {
      const newPhotos = [...photoUrls, photoInputValue];
      setPhotoUrls(newPhotos);
      form.setValue("photos", newPhotos);
      setPhotoInputValue("");
      setCurrentPhotoIndex(newPhotos.length - 1);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach(file => {
      // Check file size (max 25MB to support 40MP photos)
      if (file.size > 25 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: `${file.name} exceeds 25MB limit`,
          variant: "destructive",
        });
        return;
      }

      // Check file type
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Invalid file type",
          description: `${file.name} is not an image`,
          variant: "destructive",
        });
        return;
      }

      // Convert to base64
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64String = event.target?.result as string;
        if (base64String && !photoUrls.includes(base64String)) {
          const newPhotos = [...photoUrls, base64String];
          if (newPhotos.length <= 10) {
            setPhotoUrls(newPhotos);
            form.setValue("photos", newPhotos);
            setCurrentPhotoIndex(newPhotos.length - 1);
          } else {
            toast({
              title: "Photo limit reached",
              description: "Maximum 10 photos allowed",
              variant: "destructive",
            });
          }
        }
      };
      reader.onerror = () => {
        toast({
          title: "Upload failed",
          description: `Failed to read ${file.name}`,
          variant: "destructive",
        });
      };
      reader.readAsDataURL(file);
    });

    // Reset input
    e.target.value = '';
  };

  const handleRemovePhoto = (index: number) => {
    const newPhotos = photoUrls.filter((_, i) => i !== index);
    setPhotoUrls(newPhotos);
    form.setValue("photos", newPhotos);
    if (currentPhotoIndex >= newPhotos.length && newPhotos.length > 0) {
      setCurrentPhotoIndex(newPhotos.length - 1);
    } else if (newPhotos.length === 0) {
      setCurrentPhotoIndex(0);
    }
  };

  const handlePrevPhoto = () => {
    setCurrentPhotoIndex((prev) => (prev > 0 ? prev - 1 : photoUrls.length - 1));
  };

  const handleNextPhoto = () => {
    setCurrentPhotoIndex((prev) => (prev < photoUrls.length - 1 ? prev + 1 : 0));
  };

  const onSubmit = (data: FormData) => {
    createItemMutation.mutate(data);
  };

  return (
    <div className="container max-w-3xl mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <CardTitle>Post New Item</CardTitle>
          <CardDescription>
            Share items you want to sell with the community. Add photos, set a price, and publish when ready.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Photos Section with Slideshow Preview */}
              <div className="space-y-4">
                <FormLabel>Photos</FormLabel>
                
                {/* Photo Slideshow Preview */}
                {photoUrls.length > 0 && (
                  <div className="relative bg-muted rounded-lg aspect-video overflow-hidden">
                    <img
                      src={photoUrls[currentPhotoIndex]}
                      alt={`Photo ${currentPhotoIndex + 1}`}
                      className="w-full h-full object-contain"
                      data-testid={`img-preview-${currentPhotoIndex}`}
                    />
                    
                    {/* Navigation Arrows */}
                    {photoUrls.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={handlePrevPhoto}
                          className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors"
                          data-testid="button-prev-photo"
                        >
                          <ChevronLeft className="h-5 w-5" />
                        </button>
                        <button
                          type="button"
                          onClick={handleNextPhoto}
                          className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors"
                          data-testid="button-next-photo"
                        >
                          <ChevronRight className="h-5 w-5" />
                        </button>
                      </>
                    )}
                    
                    {/* Photo Counter */}
                    <div className="absolute bottom-2 right-2 bg-black/50 text-white px-3 py-1 rounded-full text-sm">
                      {currentPhotoIndex + 1} / {photoUrls.length}
                    </div>
                    
                    {/* Remove Photo Button */}
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(currentPhotoIndex)}
                      className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white p-2 rounded-full transition-colors"
                      data-testid={`button-remove-photo-${currentPhotoIndex}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}

                {/* Photo Upload Options */}
                <div className="space-y-3">
                  {/* File Upload Button */}
                  <div className="flex gap-2">
                    <Input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleFileUpload}
                      className="hidden"
                      id="photo-file-input"
                      data-testid="input-photo-file"
                    />
                    <Button
                      type="button"
                      onClick={() => document.getElementById('photo-file-input')?.click()}
                      variant="outline"
                      className="flex-1"
                      data-testid="button-upload-photo"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Upload from Device
                    </Button>
                  </div>

                  {/* URL Input */}
                  <div className="flex gap-2">
                    <Input
                      placeholder="Or enter photo URL (e.g., https://...)"
                      value={photoInputValue}
                      onChange={(e) => setPhotoInputValue(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddPhoto())}
                      data-testid="input-photo-url"
                    />
                    <Button
                      type="button"
                      onClick={handleAddPhoto}
                      disabled={!photoInputValue}
                      data-testid="button-add-photo"
                    >
                      Add URL
                    </Button>
                  </div>
                </div>
                
                <FormDescription>
                  Add up to 10 photos (max 25MB each, supports 40MP images). Upload from your device or paste image URLs. Photos will appear in a slideshow.
                </FormDescription>
                {form.formState.errors.photos && (
                  <p className="text-sm font-medium text-destructive">{form.formState.errors.photos.message}</p>
                )}
              </div>

              {/* Title Field */}
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Vintage Leather Couch" {...field} data-testid="input-title" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Description Field */}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe the item, its condition, features, etc."
                        className="min-h-[120px]"
                        {...field}
                        data-testid="textarea-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Price and Category Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Price Field */}
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price ($)</FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          placeholder="0.00"
                          {...field}
                          data-testid="input-price"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Category Field */}
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Furniture, Electronics"
                          {...field}
                          data-testid="input-category"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Status Field */}
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-status">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="draft">Draft (Not visible to others)</SelectItem>
                        <SelectItem value="active">Active (Visible to everyone)</SelectItem>
                        <SelectItem value="sold">Sold</SelectItem>
                        <SelectItem value="archived">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Draft items are only visible to you. Active items are visible to all users.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Submit Buttons */}
              <div className="flex gap-3">
                <Button
                  type="submit"
                  disabled={createItemMutation.isPending}
                  className="flex-1"
                  data-testid="button-submit"
                >
                  {createItemMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Post Item
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setLocation("/shop")}
                  disabled={createItemMutation.isPending}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
