import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft, Calendar, MapPin, DollarSign, FileText, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { type Lead, type User } from "@shared/schema";
import { LeadQuoteDialog } from "@/components/LeadQuoteDialog";
import { formatDistanceToNow } from "date-fns";

export default function PendingQuotesPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Fetch quoted leads
  const { data: quotedLeads = [], isLoading } = useQuery<Lead[]>({
    queryKey: ["/api/leads/status/quoted"],
  });

  // Fetch employees for the dialog
  const { data: employees = [] } = useQuery<User[]>({
    queryKey: ["/api/employees"],
    enabled: isDialogOpen,
  });

  const saveQuote = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("PATCH", `/api/leads/${selectedLead?.id}/quote`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Quote updated successfully!",
        description: "The quote has been updated for this lead.",
      });
      setIsDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/leads/status/quoted"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save quote. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleEditQuote = (lead: Lead) => {
    setSelectedLead(lead);
    setIsDialogOpen(true);
  };

  const handleSaveQuote = (data: any) => {
    saveQuote.mutate(data);
  };

  const getServiceBadgeColor = (serviceType: string) => {
    switch (serviceType) {
      case "residential": return "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200";
      case "commercial": return "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200";
      case "junk": return "bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200";
      default: return "bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200";
    }
  };

  const formatServiceType = (serviceType: string) => {
    switch (serviceType) {
      case "residential": return "Residential";
      case "commercial": return "Commercial";
      case "junk": return "Junk Removal";
      default: return serviceType;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Pending Quotes</h1>
              <p className="text-muted-foreground mt-2">
                Manage and review quotes for customer leads
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => setLocation("/dashboard")}
              className="flex items-center gap-2"
              data-testid="button-back-to-dashboard"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground" data-testid="text-loading">Loading quotes...</p>
          </div>
        ) : quotedLeads.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground" data-testid="text-no-quotes">No pending quotes at this time.</p>
              <Button
                variant="outline"
                onClick={() => setLocation("/leads")}
                className="mt-4"
                data-testid="button-view-leads"
              >
                View All Leads
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {quotedLeads.map((lead) => (
              <Card key={lead.id} className="flex flex-col" data-testid={`quote-card-${lead.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg" data-testid={`text-customer-name-${lead.id}`}>
                        {lead.firstName} {lead.lastName}
                      </CardTitle>
                      <Badge className={getServiceBadgeColor(lead.serviceType)} data-testid={`badge-service-${lead.id}`}>
                        {formatServiceType(lead.serviceType)}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-start gap-2 text-sm">
                      <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-muted-foreground text-xs">From</p>
                        <p className="font-medium truncate" data-testid={`text-from-address-${lead.id}`}>
                          {lead.confirmedFromAddress || lead.fromAddress}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 text-sm">
                      <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-muted-foreground text-xs">To</p>
                        <p className="font-medium truncate" data-testid={`text-to-address-${lead.id}`}>
                          {lead.confirmedToAddress || lead.toAddress || "Not specified"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-muted-foreground text-xs">Move Date</p>
                      <p className="font-medium" data-testid={`text-move-date-${lead.id}`}>
                        {lead.confirmedDate || lead.moveDate || "Not specified"}
                      </p>
                    </div>
                  </div>

                  <div className="border-t pt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Base Price:</span>
                      <span className="font-semibold" data-testid={`text-base-price-${lead.id}`}>
                        ${lead.basePrice ? parseFloat(lead.basePrice).toFixed(2) : "0.00"}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total Price:</span>
                      <span className="font-bold text-primary" data-testid={`text-total-price-${lead.id}`}>
                        ${lead.totalPrice ? parseFloat(lead.totalPrice).toFixed(2) : lead.basePrice ? parseFloat(lead.basePrice).toFixed(2) : "0.00"}
                      </span>
                    </div>
                  </div>

                  {lead.quoteNotes && (
                    <div className="border-t pt-4">
                      <div className="flex items-start gap-2">
                        <FileText className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-muted-foreground text-xs mb-1">Notes</p>
                          <p className="text-sm line-clamp-2" data-testid={`text-quote-notes-${lead.id}`}>
                            {lead.quoteNotes}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="text-xs text-muted-foreground pt-2">
                    <p data-testid={`text-last-updated-${lead.id}`}>
                      Updated {lead.lastQuoteUpdatedAt ? formatDistanceToNow(new Date(lead.lastQuoteUpdatedAt), { addSuffix: true }) : "recently"}
                    </p>
                  </div>

                  <Button
                    onClick={() => handleEditQuote(lead)}
                    className="w-full mt-4"
                    variant="outline"
                    data-testid={`button-edit-quote-${lead.id}`}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Quote
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Lead Quote Dialog */}
      <LeadQuoteDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        lead={selectedLead}
        employees={employees}
        onSave={handleSaveQuote}
      />
    </div>
  );
}
