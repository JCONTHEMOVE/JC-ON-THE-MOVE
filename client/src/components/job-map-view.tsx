import { useState, useEffect, useRef } from "react";
import { type Lead } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  MapPin, 
  Navigation, 
  Phone, 
  MessageSquare, 
  Camera, 
  CheckCircle,
  ExternalLink,
  Locate,
  Layers
} from "lucide-react";
import { calculateDistance, geocodeAddress } from "@/hooks/use-geolocation";
import { useToast } from "@/hooks/use-toast";

interface JobMapViewProps {
  availableJobs: Lead[];
  myJobs: Lead[];
  userLocation?: { latitude: number; longitude: number } | null;
  onAcceptJob?: (jobId: string) => void;
  onNavigateToJob?: (jobId: string) => void;
  onCallCustomer?: (jobId: string) => void;
  onMessageCustomer?: (jobId: string) => void;
  onPhotosClick?: (jobId: string) => void;
}

interface JobWithCoords extends Lead {
  coordinates?: { lat: number; lng: number };
  distance?: number;
}

export function JobMapView({
  availableJobs,
  myJobs,
  userLocation,
  onAcceptJob,
  onNavigateToJob,
  onCallCustomer,
  onMessageCustomer,
  onPhotosClick
}: JobMapViewProps) {
  const { toast } = useToast();
  const [jobsWithCoords, setJobsWithCoords] = useState<JobWithCoords[]>([]);
  const [selectedJob, setSelectedJob] = useState<JobWithCoords | null>(null);
  const [mapUrl, setMapUrl] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [mapView, setMapView] = useState<'map' | 'satellite'>('map');

  // Geocode job addresses and calculate distances
  useEffect(() => {
    const geocodeJobs = async () => {
      setIsLoading(true);
      const allJobs = [...availableJobs, ...myJobs];
      const jobsWithLocationData: JobWithCoords[] = [];

      for (const job of allJobs) {
        try {
          const coords = await geocodeAddress(job.fromAddress);
          let distance: number | undefined;
          
          if (coords && userLocation) {
            distance = calculateDistance(
              userLocation.latitude,
              userLocation.longitude,
              coords.lat,
              coords.lng
            );
          }

          jobsWithLocationData.push({
            ...job,
            coordinates: coords || undefined,
            distance
          });

          // Add delay to prevent rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.error(`Failed to geocode job ${job.id}:`, error);
          jobsWithLocationData.push(job);
        }
      }

      setJobsWithCoords(jobsWithLocationData);
      setIsLoading(false);
    };

    if (availableJobs.length > 0 || myJobs.length > 0) {
      geocodeJobs();
    } else {
      setIsLoading(false);
    }
  }, [availableJobs, myJobs, userLocation]); // Removed mapView from dependencies

  // Separate effect for map URL generation to avoid race conditions
  useEffect(() => {
    if (!isLoading) {
      generateMapUrl(jobsWithCoords, mapView);
    }
  }, [jobsWithCoords, mapView, userLocation, isLoading]); // generateMapUrl is stable since it doesn't depend on props/state

  const generateMapUrl = (jobs: JobWithCoords[], currentMapView: 'map' | 'satellite') => {
    const validJobs = jobs.filter(job => job.coordinates);
    
    // Use consistent map type parameters everywhere
    const mapType = currentMapView === 'satellite' ? 'k' : 'm'; // k=satellite, m=map
    
    if (validJobs.length === 0) {
      if (userLocation) {
        // Show user location only with embed parameter
        setMapUrl(`https://maps.google.com/maps?q=${userLocation.latitude},${userLocation.longitude}&t=${mapType}&z=13&output=embed`);
      }
      return;
    }

    // Use Google Maps for better mobile experience with multiple markers
    let mapUrl = "https://maps.google.com/maps?q=";
    
    // Add job locations as markers
    const markers: string[] = [];
    
    validJobs.forEach((job, index) => {
      if (job.coordinates) {
        const label = job.status === 'accepted' ? `${index + 1}★` : `${index + 1}`;
        markers.push(`${job.coordinates.lat},${job.coordinates.lng}(${label}+${job.serviceType})`);
      }
    });

    mapUrl += markers.join("|");
    
    // Add user location if available
    if (userLocation) {
      mapUrl += `|${userLocation.latitude},${userLocation.longitude}(You)`;
    }

    // Add map type and embed parameters
    mapUrl += `&t=${mapType}&z=12&output=embed`;

    setMapUrl(mapUrl);
  };

  const getJobMarkerColor = (job: Lead) => {
    if (job.status === 'accepted') return 'bg-green-500';
    return 'bg-blue-500';
  };

  const getJobTypeIcon = (serviceType: string) => {
    // Reuse the same logic from mobile-lead-manager
    switch (serviceType) {
      case "residential": return "🏠";
      case "commercial": return "🏢";
      case "junk": return "🗑️";
      default: return "📦";
    }
  };

  const handleJobClick = (job: JobWithCoords) => {
    setSelectedJob(job);
  };

  const handleOpenInMaps = () => {
    if (selectedJob && selectedJob.coordinates) {
      const address = encodeURIComponent(selectedJob.fromAddress);
      let navigationUrl: string;
      
      if (userLocation) {
        navigationUrl = `https://www.google.com/maps/dir/${userLocation.latitude},${userLocation.longitude}/${selectedJob.coordinates.lat},${selectedJob.coordinates.lng}`;
      } else {
        navigationUrl = `https://maps.google.com/?q=${address}`;
      }
      
      window.open(navigationUrl, '_blank');
      toast({
        title: "Opening navigation",
        description: "Launching maps with directions to job location"
      });
    }
  };

  const handleCenterOnUser = () => {
    if (userLocation) {
      const mapType = mapView === 'satellite' ? 'k' : 'm';
      const userMapUrl = `https://maps.google.com/maps?q=${userLocation.latitude},${userLocation.longitude}&t=${mapType}&z=15&output=embed`;
      setMapUrl(userMapUrl);
      toast({
        title: "Centered on your location",
        description: "Map updated to show your current position"
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
        <p className="text-sm text-muted-foreground">Loading job locations...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Map Controls */}
      <div className="flex items-center justify-between p-4 bg-background border-b">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-primary" />
          <span className="font-medium">Job Map</span>
        </div>
        <div className="flex items-center gap-2">
          {userLocation && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCenterOnUser}
              data-testid="center-on-user"
            >
              <Locate className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const newMapView = mapView === 'map' ? 'satellite' : 'map';
              setMapView(newMapView);
              // Map URL will be regenerated automatically by useEffect
              toast({
                title: `Switched to ${newMapView} view`,
                description: `Map updated to show ${newMapView} imagery`
              });
            }}
            data-testid="toggle-map-view"
          >
            <Layers className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Map Container */}
      <div className="flex-1 relative">
        {mapUrl ? (
          <iframe
            src={mapUrl}
            className="w-full h-full border-0"
            title="Job Locations Map"
            loading="lazy"
            data-testid="job-map-iframe"
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <MapPin className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-2">No job locations to display</p>
            <p className="text-sm text-muted-foreground">
              {!userLocation && "Enable location access to see nearby jobs"}
            </p>
          </div>
        )}
      </div>

      {/* Job List Overlay */}
      <div className="max-h-48 overflow-y-auto bg-background border-t">
        <div className="p-4">
          <h3 className="font-medium mb-3 flex items-center gap-2">
            <span>Nearby Jobs</span>
            <Badge variant="secondary" className="text-xs">
              {jobsWithCoords.filter(job => job.coordinates).length}
            </Badge>
          </h3>
          
          {jobsWithCoords.filter(job => job.coordinates).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No jobs with valid addresses found
            </p>
          ) : (
            <div className="space-y-2">
              {jobsWithCoords
                .filter(job => job.coordinates)
                .sort((a, b) => (a.distance || 999) - (b.distance || 999))
                .slice(0, 5) // Show top 5 closest jobs
                .map((job) => (
                  <Card
                    key={job.id}
                    className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                      selectedJob?.id === job.id ? 'ring-2 ring-primary' : ''
                    }`}
                    onClick={() => handleJobClick(job)}
                    data-testid={`map-job-${job.id}`}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${getJobMarkerColor(job)}`} />
                          <span className="text-lg">{getJobTypeIcon(job.serviceType)}</span>
                          <div>
                            <p className="font-medium text-sm">{job.firstName} {job.lastName}</p>
                            <p className="text-xs text-muted-foreground truncate max-w-32">
                              {job.fromAddress}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {job.distance && (
                            <Badge variant="outline" className="text-xs">
                              {job.distance.toFixed(1)}mi
                            </Badge>
                          )}
                          <ExternalLink className="h-3 w-3 text-muted-foreground" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Selected Job Quick Actions */}
      {selectedJob && (
        <div className="bg-primary text-primary-foreground p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="font-medium">{selectedJob.firstName} {selectedJob.lastName}</h4>
              <p className="text-sm opacity-90">{selectedJob.serviceType} • {selectedJob.distance?.toFixed(1)}mi</p>
            </div>
            <Badge variant="outline" className="bg-primary-foreground/10 text-primary-foreground border-primary-foreground/20">
              {selectedJob.status}
            </Badge>
          </div>
          <div className="flex gap-2">
            {selectedJob.status === 'available' && onAcceptJob && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onAcceptJob(selectedJob.id)}
                className="flex-1"
                data-testid={`accept-job-${selectedJob.id}`}
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                Accept
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={handleOpenInMaps}
              className="flex-1"
              data-testid={`navigate-job-${selectedJob.id}`}
            >
              <Navigation className="h-4 w-4 mr-1" />
              Navigate
            </Button>
            {onCallCustomer && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onCallCustomer(selectedJob.id)}
                data-testid={`call-customer-${selectedJob.id}`}
              >
                <Phone className="h-4 w-4" />
              </Button>
            )}
            {onMessageCustomer && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onMessageCustomer(selectedJob.id)}
                data-testid={`message-customer-${selectedJob.id}`}
              >
                <MessageSquare className="h-4 w-4" />
              </Button>
            )}
            {selectedJob.status === 'accepted' && onPhotosClick && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onPhotosClick(selectedJob.id)}
                data-testid={`photos-job-${selectedJob.id}`}
              >
                <Camera className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}