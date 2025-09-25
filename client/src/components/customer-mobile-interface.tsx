import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { type Lead } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Search, 
  Plus, 
  Clock, 
  CheckCircle, 
  Phone, 
  Mail, 
  Calendar,
  MapPin,
  Package,
  Home,
  Building,
  Trash2,
  ArrowLeft
} from "lucide-react";
import QuoteForm from "@/components/quote-form";

export default function CustomerMobileInterface() {
  const [activeTab, setActiveTab] = useState<"request" | "track">("request");
  const [trackingEmail, setTrackingEmail] = useState("");
  const [isTracking, setIsTracking] = useState(false);

  // Query for tracking customer leads
  const { data: customerLeads = [], isLoading: trackingLoading, refetch } = useQuery<Lead[]>({
    queryKey: ["/api/leads/track", trackingEmail],
    enabled: isTracking && trackingEmail.length > 0,
    queryFn: async () => {
      const response = await fetch(`/api/leads/track/${encodeURIComponent(trackingEmail)}`);
      if (!response.ok) {
        throw new Error("Failed to fetch your quote requests");
      }
      return response.json();
    },
  });

  const handleTrackQuotes = () => {
    if (trackingEmail.trim()) {
      setIsTracking(true);
      refetch();
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "new":
        return <Clock className="h-4 w-4 text-orange-500" />;
      case "contacted":
        return <Phone className="h-4 w-4 text-blue-500" />;
      case "quoted":
        return <Mail className="h-4 w-4 text-purple-500" />;
      case "confirmed":
      case "accepted":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "in_progress":
        return <Package className="h-4 w-4 text-yellow-500" />;
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "new":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
      case "contacted":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "quoted":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
      case "confirmed":
      case "accepted":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "in_progress":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "completed":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  const getServiceIcon = (serviceType: string) => {
    switch (serviceType) {
      case "residential":
        return <Home className="h-4 w-4" />;
      case "commercial":
        return <Building className="h-4 w-4" />;
      case "junk":
        return <Trash2 className="h-4 w-4" />;
      default:
        return <Package className="h-4 w-4" />;
    }
  };

  const formatStatus = (status: string) => {
    const statusMap: Record<string, string> = {
      "new": "Quote Received",
      "contacted": "We Called You",
      "quoted": "Quote Provided",
      "confirmed": "Quote Confirmed",
      "accepted": "Job Scheduled",
      "in_progress": "Work in Progress",
      "completed": "Job Complete"
    };
    return statusMap[status] || status.charAt(0).toUpperCase() + status.slice(1);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">JC ON THE MOVE</h1>
            <p className="text-sm text-primary-foreground/80">Professional Moving Services</p>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-background border-b border-border">
        <div className="flex">
          <Button
            variant={activeTab === "request" ? "default" : "ghost"}
            className="flex-1 rounded-none border-0"
            onClick={() => setActiveTab("request")}
            data-testid="tab-request-quote"
          >
            <Plus className="h-4 w-4 mr-2" />
            Request Quote
          </Button>
          <Button
            variant={activeTab === "track" ? "default" : "ghost"}
            className="flex-1 rounded-none border-0"
            onClick={() => setActiveTab("track")}
            data-testid="tab-track-quotes"
          >
            <Search className="h-4 w-4 mr-2" />
            Track Quotes
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 pb-20">
        {activeTab === "request" ? (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-2">Get Your Free Quote</h2>
              <p className="text-muted-foreground">
                Tell us about your move and we'll provide you with a detailed, 
                no-obligation quote within 24 hours.
              </p>
            </div>
            <QuoteForm />
          </div>
        ) : (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-2">Track Your Quotes</h2>
              <p className="text-muted-foreground mb-4">
                Enter your email address to see all your quote requests and their current status.
              </p>
              
              <div className="flex gap-2 mb-4">
                <Input
                  type="email"
                  placeholder="Enter your email address"
                  value={trackingEmail}
                  onChange={(e) => setTrackingEmail(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleTrackQuotes()}
                  data-testid="input-tracking-email"
                  className="flex-1"
                />
                <Button 
                  onClick={handleTrackQuotes}
                  disabled={!trackingEmail.trim() || trackingLoading}
                  data-testid="button-track-quotes"
                >
                  {trackingLoading ? "Searching..." : "Track"}
                </Button>
              </div>
            </div>

            {isTracking && (
              <div>
                {trackingLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    <p className="mt-2 text-muted-foreground">Loading your quotes...</p>
                  </div>
                ) : customerLeads.length === 0 ? (
                  <Card>
                    <CardContent className="text-center py-8">
                      <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No quotes found</h3>
                      <p className="text-muted-foreground">
                        We couldn't find any quote requests for <strong>{trackingEmail}</strong>.
                        Make sure you entered the correct email address.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    <div className="text-sm text-muted-foreground">
                      Found {customerLeads.length} quote{customerLeads.length !== 1 ? 's' : ''} for <strong>{trackingEmail}</strong>
                    </div>
                    
                    {customerLeads.map((lead) => (
                      <Card key={lead.id} data-testid={`quote-${lead.id}`}>
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              {getServiceIcon(lead.serviceType)}
                              <div>
                                <CardTitle className="text-lg">
                                  {lead.serviceType === "residential" && "Residential Moving"}
                                  {lead.serviceType === "commercial" && "Commercial Moving"}
                                  {lead.serviceType === "junk" && "Junk Removal"}
                                </CardTitle>
                                <p className="text-sm text-muted-foreground">
                                  Quote #{lead.id.slice(-8)}
                                </p>
                              </div>
                            </div>
                            <Badge className={getStatusColor(lead.status)}>
                              <div className="flex items-center gap-1">
                                {getStatusIcon(lead.status)}
                                {formatStatus(lead.status)}
                              </div>
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="grid grid-cols-1 gap-2 text-sm">
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-muted-foreground" />
                              <span>From: {lead.fromAddress}</span>
                            </div>
                            {lead.toAddress && (
                              <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-muted-foreground" />
                                <span>To: {lead.toAddress}</span>
                              </div>
                            )}
                            {lead.moveDate && (
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                <span>Move Date: {lead.moveDate}</span>
                              </div>
                            )}
                          </div>
                          
                          {lead.details && (
                            <div className="bg-muted p-3 rounded-lg">
                              <p className="text-sm">{lead.details}</p>
                            </div>
                          )}
                          
                          <div className="pt-2 border-t border-border">
                            <p className="text-xs text-muted-foreground">
                              Submitted: {new Date(lead.createdAt).toLocaleDateString()} at {new Date(lead.createdAt).toLocaleTimeString()}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}