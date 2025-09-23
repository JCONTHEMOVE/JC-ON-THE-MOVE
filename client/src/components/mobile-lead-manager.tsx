import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import { type Lead } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Briefcase, 
  MapPin, 
  Phone, 
  Mail, 
  Calendar,
  Clock,
  CheckCircle,
  ArrowLeft,
  ArrowRight,
  User,
  Home,
  Building,
  Trash2,
  Navigation,
  MessageSquare
} from "lucide-react";

interface SwipeCardProps {
  lead: Lead;
  onSwipeLeft?: (leadId: string) => void;
  onSwipeRight?: (leadId: string) => void;
  onTap?: (leadId: string) => void;
  showAcceptActions?: boolean;
}

function SwipeCard({ lead, onSwipeLeft, onSwipeRight, onTap, showAcceptActions = false }: SwipeCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [translateX, setTranslateX] = useState(0);
  const [opacity, setOpacity] = useState(1);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!showAcceptActions) return;
    setIsDragging(true);
    setStartX(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || !showAcceptActions) return;
    
    const currentX = e.touches[0].clientX;
    const diff = currentX - startX;
    const maxSwipe = 120;
    const constrainedDiff = Math.max(-maxSwipe, Math.min(maxSwipe, diff));
    
    setTranslateX(constrainedDiff);
    setOpacity(1 - Math.abs(constrainedDiff) / maxSwipe * 0.3);
  };

  const handleTouchEnd = () => {
    if (!isDragging || !showAcceptActions) return;
    
    setIsDragging(false);
    const threshold = 60;
    
    if (translateX > threshold && onSwipeRight) {
      onSwipeRight(lead.id);
    } else if (translateX < -threshold && onSwipeLeft) {
      onSwipeLeft(lead.id);
    }
    
    setTranslateX(0);
    setOpacity(1);
  };

  const handleClick = () => {
    if (!isDragging && onTap) {
      onTap(lead.id);
    }
  };

  const getServiceIcon = (serviceType: string) => {
    switch (serviceType) {
      case "residential": return <Home className="h-4 w-4" />;
      case "commercial": return <Building className="h-4 w-4" />;
      case "junk": return <Trash2 className="h-4 w-4" />;
      default: return <Briefcase className="h-4 w-4" />;
    }
  };

  const getServiceBadgeColor = (serviceType: string) => {
    switch (serviceType) {
      case "residential": return "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200";
      case "commercial": return "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200";  
      case "junk": return "bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200";
      default: return "bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200";
    }
  };

  return (
    <div className="relative">
      {/* Swipe Action Indicators */}
      {showAcceptActions && (
        <>
          <div className={`absolute left-4 top-1/2 transform -translate-y-1/2 z-10 transition-opacity ${
            translateX > 30 ? 'opacity-100' : 'opacity-0'
          }`}>
            <div className="bg-green-500 text-white p-3 rounded-full">
              <CheckCircle className="h-6 w-6" />
            </div>
          </div>
          <div className={`absolute right-4 top-1/2 transform -translate-y-1/2 z-10 transition-opacity ${
            translateX < -30 ? 'opacity-100' : 'opacity-0'
          }`}>
            <div className="bg-gray-500 text-white p-3 rounded-full">
              <ArrowLeft className="h-6 w-6" />
            </div>
          </div>
        </>
      )}
      
      <Card 
        ref={cardRef}
        className="mb-4 cursor-pointer transition-all duration-200"
        style={{
          transform: `translateX(${translateX}px)`,
          opacity: opacity,
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleClick}
        data-testid={`mobile-job-card-${lead.id}`}
      >
        <CardContent className="p-4">
          <div className="space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="bg-primary/10 p-2 rounded-lg">
                  {getServiceIcon(lead.serviceType)}
                </div>
                <div>
                  <h3 className="font-semibold text-base">
                    {lead.firstName} {lead.lastName}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {new Date(lead.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <Badge className={getServiceBadgeColor(lead.serviceType)}>
                {lead.serviceType === "residential" && "Residential"}
                {lead.serviceType === "commercial" && "Commercial"}
                {lead.serviceType === "junk" && "Junk Removal"}
              </Badge>
            </div>

            {/* Location Info */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">From:</span>
                <span className="font-medium truncate">{lead.fromAddress}</span>
              </div>
              {lead.toAddress && (
                <div className="flex items-center gap-2 text-sm">
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">To:</span>
                  <span className="font-medium truncate">{lead.toAddress}</span>
                </div>
              )}
            </div>

            {/* Date and Details */}
            {lead.moveDate && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Move Date:</span>
                <span className="font-medium">{lead.moveDate}</span>
              </div>
            )}

            {/* Contact Actions - Only show for accepted jobs */}
            {!showAcceptActions && (
              <div className="flex items-center gap-2 pt-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1"
                  asChild
                  data-testid={`call-customer-${lead.id}`}
                >
                  <a href={`tel:${lead.phone}`} className="flex items-center justify-center gap-2">
                    <Phone className="h-4 w-4" />
                    Call
                  </a>
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1"
                  asChild
                  data-testid={`text-customer-${lead.id}`}
                >
                  <a href={`sms:${lead.phone}`} className="flex items-center justify-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Text
                  </a>
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1"
                  asChild
                  data-testid={`email-customer-${lead.id}`}
                >
                  <a href={`mailto:${lead.email}`} className="flex items-center justify-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email
                  </a>
                </Button>
              </div>
            )}

            {/* Details Preview */}
            {lead.details && (
              <div className="text-sm text-muted-foreground bg-muted/50 p-2 rounded">
                <p className="line-clamp-2">{lead.details}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function MobileLeadManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"available" | "accepted">("available");

  const { data: availableJobs = [], isLoading: availableLoading } = useQuery<Lead[]>({
    queryKey: ["/api/leads/available"],
  });

  const { data: myJobs = [], isLoading: myJobsLoading } = useQuery<Lead[]>({
    queryKey: ["/api/leads/my-jobs"],
  });

  const acceptJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const response = await apiRequest("POST", `/api/leads/${jobId}/accept`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads/available"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads/my-jobs"] });
      toast({
        title: "Job accepted! 🎉",
        description: "You can now view it in your accepted jobs.",
      });
    },
    onError: (error: Error) => {
      if (error.message.includes('401')) return;
      
      toast({
        title: "Already taken",
        description: "This job was accepted by another employee.",
        variant: "destructive",
      });
    },
  });

  const handleSwipeRight = (leadId: string) => {
    acceptJobMutation.mutate(leadId);
  };

  const handleSwipeLeft = (leadId: string) => {
    // Future: Maybe implement skip/dismiss functionality
    toast({
      title: "Job skipped",
      description: "Swipe right to accept jobs",
    });
  };

  const handleJobTap = (leadId: string) => {
    // Future: Open job details modal
    console.log("Job tapped:", leadId);
  };

  const handleNavigate = (leadId: string) => {
    const lead = [...availableJobs, ...myJobs].find(job => job.id === leadId);
    if (!lead) return;
    
    const address = lead.fromAddress;
    const encodedAddress = encodeURIComponent(address);
    window.open(`https://maps.google.com/?q=${encodedAddress}`, '_blank');
  };

  if (availableLoading || myJobsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">Loading jobs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Main Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-20">
        {activeTab === "available" ? (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold mb-2">Available Jobs</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Swipe right to accept • Tap for details
              </p>
              {availableJobs.length === 0 && (
                <div className="text-center py-12">
                  <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No jobs available right now</p>
                  <p className="text-sm text-muted-foreground mt-2">Check back later!</p>
                </div>
              )}
            </div>
            
            {availableJobs.map((job) => (
              <SwipeCard
                key={job.id}
                lead={job}
                onSwipeRight={handleSwipeRight}
                onSwipeLeft={handleSwipeLeft}
                onTap={handleJobTap}
                showAcceptActions={true}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold mb-2">My Jobs</h2>
              <p className="text-sm text-muted-foreground">
                {myJobs.length} accepted job{myJobs.length !== 1 ? 's' : ''}
              </p>
            </div>
            
            {myJobs.length === 0 ? (
              <div className="text-center py-12">
                <Briefcase className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No accepted jobs yet</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Check available jobs to get started!
                </p>
              </div>
            ) : (
              myJobs.map((job) => (
                <div key={job.id} className="relative">
                  <SwipeCard
                    lead={job}
                    onTap={handleJobTap}
                    showAcceptActions={false}
                  />
                  {/* Navigation Button */}
                  <Button
                    variant="default"
                    size="sm"
                    className="absolute top-4 right-4 p-2"
                    onClick={() => handleNavigate(job.id)}
                    data-testid={`navigate-to-job-${job.id}`}
                  >
                    <Navigation className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4">
        <div className="flex items-center justify-around max-w-md mx-auto">
          <Button
            variant={activeTab === "available" ? "default" : "ghost"}
            className="flex-1 mx-1"
            onClick={() => setActiveTab("available")}
            data-testid="tab-available-jobs"
          >
            <div className="flex flex-col items-center gap-1">
              <Briefcase className="h-5 w-5" />
              <span className="text-xs">Available</span>
              {availableJobs.length > 0 && (
                <Badge variant="secondary" className="text-xs px-1 py-0 min-w-[20px] h-5">
                  {availableJobs.length}
                </Badge>
              )}
            </div>
          </Button>
          
          <Button
            variant={activeTab === "accepted" ? "default" : "ghost"}
            className="flex-1 mx-1"
            onClick={() => setActiveTab("accepted")}
            data-testid="tab-my-jobs"
          >
            <div className="flex flex-col items-center gap-1">
              <User className="h-5 w-5" />
              <span className="text-xs">My Jobs</span>
              {myJobs.length > 0 && (
                <Badge variant="secondary" className="text-xs px-1 py-0 min-w-[20px] h-5">
                  {myJobs.length}
                </Badge>
              )}
            </div>
          </Button>
        </div>
      </div>
    </div>
  );
}