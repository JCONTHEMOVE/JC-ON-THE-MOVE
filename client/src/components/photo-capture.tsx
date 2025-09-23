import { useState, useRef, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Camera,
  Upload,
  X,
  MapPin,
  Clock,
  Image as ImageIcon,
  FileImage,
  AlertTriangle,
  CheckCircle,
  Eye
} from "lucide-react";
import { JobPhoto } from "@shared/schema";
import { useGeolocation } from "@/hooks/use-geolocation";

interface PhotoCaptureProps {
  leadId: string;
  existingPhotos: JobPhoto[];
  onClose: () => void;
  onPhotoAdded: (photo: JobPhoto) => void;
}

export function PhotoCapture({ leadId, existingPhotos, onClose, onPhotoAdded }: PhotoCaptureProps) {
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [photoType, setPhotoType] = useState<JobPhoto["type"]>("before");
  const [description, setDescription] = useState("");
  const [isCapturing, setIsCapturing] = useState(false);
  const [selectedPhotoForView, setSelectedPhotoForView] = useState<JobPhoto | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Get current location for photo geotagging
  const { latitude, longitude } = useGeolocation({
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 60000, // 1 minute
  });

  const addPhotoMutation = useMutation({
    mutationFn: async (photoData: JobPhoto) => {
      return apiRequest("POST", `/api/leads/${leadId}/photos`, photoData);
    },
    onSuccess: (response: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads/my-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads/available"] });
      // Use the actual photo data from server response
      onPhotoAdded(response.photo);
      toast({
        title: "Photo added successfully",
        description: `${photoType} photo has been added to the job.`,
      });
      resetForm();
    },
    onError: (error) => {
      toast({
        title: "Failed to add photo",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const startCamera = useCallback(async () => {
    try {
      setIsCapturing(true);
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: "environment", // Use back camera on mobile
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      }
    } catch (error) {
      toast({
        title: "Camera access denied",
        description: "Please allow camera access to take photos.",
        variant: "destructive",
      });
      setIsCapturing(false);
    }
  }, [toast]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCapturing(false);
  }, []);

  const capturePhoto = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      if (context) {
        context.drawImage(video, 0, 0);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
        setCapturedPhoto(dataUrl);
        stopCamera();
      }
    }
  }, [stopCamera]);

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setCapturedPhoto(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const resetForm = () => {
    setCapturedPhoto(null);
    setDescription("");
    setPhotoType("before");
    stopCamera();
  };

  const handleSubmit = () => {
    if (!capturedPhoto) {
      toast({
        title: "No photo selected",
        description: "Please capture or upload a photo first.",
        variant: "destructive",
      });
      return;
    }

    const photoData: JobPhoto = {
      id: crypto.randomUUID(),
      url: capturedPhoto,
      type: photoType,
      description: description.trim() || undefined,
      timestamp: new Date().toISOString(),
      location: latitude && longitude ? { latitude, longitude } : undefined,
    };

    addPhotoMutation.mutate(photoData);
  };

  const getTypeIcon = (type: JobPhoto["type"]) => {
    switch (type) {
      case "before": return <ImageIcon className="h-4 w-4" />;
      case "after": return <CheckCircle className="h-4 w-4" />;
      case "progress": return <Clock className="h-4 w-4" />;
      case "issue": return <AlertTriangle className="h-4 w-4" />;
      default: return <FileImage className="h-4 w-4" />;
    }
  };

  const getTypeBadgeColor = (type: JobPhoto["type"]) => {
    switch (type) {
      case "before": return "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200";
      case "after": return "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200";
      case "progress": return "bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200";
      case "issue": return "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200";
      default: return "bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200";
    }
  };

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-lg font-semibold">Job Photos</h2>
        <Button variant="ghost" size="sm" onClick={onClose} data-testid="button-close-photo-capture">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Existing Photos */}
      {existingPhotos.length > 0 && (
        <div className="p-4 border-b">
          <h3 className="text-sm font-medium mb-3">Existing Photos ({existingPhotos.length})</h3>
          <div className="grid grid-cols-3 gap-2">
            {existingPhotos.map((photo) => (
              <div key={photo.id} className="relative">
                <img
                  src={photo.url}
                  alt={photo.description || `${photo.type} photo`}
                  className="w-full h-20 object-cover rounded-lg cursor-pointer"
                  onClick={() => setSelectedPhotoForView(photo)}
                  data-testid={`existing-photo-${photo.id}`}
                />
                <Badge 
                  className={`absolute top-1 left-1 text-xs ${getTypeBadgeColor(photo.type)}`}
                >
                  {getTypeIcon(photo.type)}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Camera/Photo Capture Area */}
      <div className="flex-1 overflow-y-auto p-4">
        {selectedPhotoForView ? (
          /* Photo Viewer */
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Badge className={getTypeBadgeColor(selectedPhotoForView.type)}>
                    {getTypeIcon(selectedPhotoForView.type)}
                    <span className="ml-1 capitalize">{selectedPhotoForView.type}</span>
                  </Badge>
                  {selectedPhotoForView.location && (
                    <Badge variant="outline">
                      <MapPin className="h-3 w-3 mr-1" />
                      GPS
                    </Badge>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedPhotoForView(null)}
                  data-testid="button-close-photo-viewer"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <img
                src={selectedPhotoForView.url}
                alt={selectedPhotoForView.description || `${selectedPhotoForView.type} photo`}
                className="w-full rounded-lg mb-4"
              />
              {selectedPhotoForView.description && (
                <p className="text-sm text-muted-foreground mb-2">
                  {selectedPhotoForView.description}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {new Date(selectedPhotoForView.timestamp).toLocaleString()}
              </p>
            </CardContent>
          </Card>
        ) : (
          /* Photo Capture Interface */
          <div className="space-y-4">
            {/* Camera View or Captured Photo */}
            <Card>
              <CardContent className="p-4">
                {capturedPhoto ? (
                  <div className="relative">
                    <img
                      src={capturedPhoto}
                      alt="Captured photo"
                      className="w-full rounded-lg"
                      data-testid="captured-photo-preview"
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={() => setCapturedPhoto(null)}
                      data-testid="button-retake-photo"
                    >
                      Retake
                    </Button>
                  </div>
                ) : isCapturing ? (
                  <div className="relative">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      className="w-full rounded-lg"
                      data-testid="camera-video-preview"
                    />
                    <canvas ref={canvasRef} className="hidden" />
                    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
                      <Button
                        onClick={capturePhoto}
                        size="lg"
                        className="rounded-full h-16 w-16"
                        data-testid="button-capture-photo"
                      >
                        <Camera className="h-6 w-6" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Camera className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-4">Take a photo for job documentation</p>
                    <div className="flex flex-col gap-2">
                      <Button onClick={startCamera} data-testid="button-start-camera">
                        <Camera className="h-4 w-4 mr-2" />
                        Open Camera
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        data-testid="button-upload-photo"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Photo
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Photo Details Form */}
            {capturedPhoto && (
              <Card>
                <CardContent className="p-4 space-y-4">
                  <div>
                    <Label htmlFor="photo-type">Photo Type</Label>
                    <Select
                      value={photoType}
                      onValueChange={(value) => setPhotoType(value as JobPhoto["type"])}
                    >
                      <SelectTrigger data-testid="select-photo-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="before">Before Photos</SelectItem>
                        <SelectItem value="after">After Photos</SelectItem>
                        <SelectItem value="progress">Progress Photos</SelectItem>
                        <SelectItem value="issue">Issue Documentation</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="photo-description">Description (Optional)</Label>
                    <Textarea
                      id="photo-description"
                      placeholder="Add details about this photo..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      data-testid="input-photo-description"
                    />
                  </div>

                  {latitude && longitude && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      <span>Location will be saved with photo</span>
                    </div>
                  )}

                  <Button
                    onClick={handleSubmit}
                    className="w-full"
                    disabled={addPhotoMutation.isPending}
                    data-testid="button-save-photo"
                  >
                    {addPhotoMutation.isPending ? "Saving..." : "Save Photo"}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileUpload}
        className="hidden"
        data-testid="file-input-photo"
      />
    </div>
  );
}