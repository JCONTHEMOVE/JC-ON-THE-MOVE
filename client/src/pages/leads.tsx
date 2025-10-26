import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { ArrowLeft, Home, Building, Trash2, Mail, Phone, CircleDot, MessageCircle, FileText, CheckCircle, Clock, Play, Activity, CheckCheck, Settings, MapPin, Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { insertLeadSchema, type InsertLead, type Lead, type User } from "@shared/schema";
import { LeadQuoteDialog } from "@/components/LeadQuoteDialog";

export default function LeadsPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedService, setSelectedService] = useState("");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isQuickViewOpen, setIsQuickViewOpen] = useState(false);
  const [isManageDialogOpen, setIsManageDialogOpen] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState<Lead | null>(null);

  const serviceOptions = [
    { value: "residential", label: "Residential Moving", icon: Home },
    { value: "commercial", label: "Commercial Moving", icon: Building },
    { value: "junk", label: "Junk Removal", icon: Trash2 },
  ];

  // Fetch all leads (always fetch fresh to avoid showing deleted leads)
  const { data: leads = [], isLoading } = useQuery<Lead[]>({
    queryKey: ["/api/leads"],
    staleTime: 0, // Always fetch fresh data
    refetchOnMount: true,
  });

  // Fetch employees
  const { data: employees = [] } = useQuery<User[]>({
    queryKey: ["/api/employees"],
    enabled: isManageDialogOpen,
  });

  // Find created by user from employees list
  const createdByUser = employees.find(emp => emp.id === selectedLead?.createdByUserId);

  const form = useForm<InsertLead>({
    resolver: zodResolver(insertLeadSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      serviceType: "",
      fromAddress: "",
      toAddress: "",
      moveDate: "",
      propertySize: "",
      details: "",
    },
  });

  const submitLead = useMutation({
    mutationFn: async (data: InsertLead) => {
      const response = await apiRequest("POST", "/api/leads/employee", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Lead added successfully!",
        description: "The lead has been added to the system. You'll earn rewards when it's confirmed and completed.",
      });
      form.reset();
      setSelectedService("");
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads/available"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add lead. Please try again.",
        variant: "destructive",
      });
    },
  });

  const saveQuote = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("PATCH", `/api/leads/${selectedLead?.id}/quote`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Quote saved successfully!",
        description: "The quote has been updated for this lead.",
      });
      setIsManageDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads/status/quoted"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save quote. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteLead = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/leads/${id}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Lead deleted",
        description: "The lead has been permanently deleted.",
      });
      setLeadToDelete(null);
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete lead. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = form.handleSubmit((data) => {
    submitLead.mutate(data);
  });

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

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "new": return "default";
      case "contacted": return "secondary";
      case "quoted": return "secondary";
      case "confirmed": return "default";
      default: return "secondary";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "new": return <CircleDot className="h-4 w-4 text-blue-500" />;
      case "contacted": return <MessageCircle className="h-4 w-4 text-purple-500" />;
      case "quoted": return <FileText className="h-4 w-4 text-amber-500" />;
      case "confirmed": return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "available": return <Clock className="h-4 w-4 text-orange-500" />;
      case "accepted": return <Play className="h-4 w-4 text-teal-500" />;
      case "in_progress": return <Activity className="h-4 w-4 text-indigo-500" />;
      case "completed": return <CheckCheck className="h-4 w-4 text-emerald-500" />;
      default: return <CircleDot className="h-4 w-4 text-gray-500" />;
    }
  };

  const handleViewLead = (lead: Lead) => {
    setSelectedLead(lead);
    setIsQuickViewOpen(true);
  };

  const handleManageJob = (lead: Lead) => {
    setSelectedLead(lead);
    setIsQuickViewOpen(false);
    setIsManageDialogOpen(true);
  };

  const renderLeadCard = (lead: Lead) => (
    <Card key={lead.id} className="border" data-testid={`lead-card-${lead.id}`}>
      <CardContent className="p-6">
        <div className="flex justify-between items-start">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-3">
              {getStatusIcon(lead.status)}
              <h3 className="font-semibold text-lg">
                {lead.firstName} {lead.lastName}
              </h3>
              <Badge className={getServiceBadgeColor(lead.serviceType)}>
                {lead.serviceType === "residential" && "Residential"}
                {lead.serviceType === "commercial" && "Commercial"}
                {lead.serviceType === "junk" && "Junk Removal"}
              </Badge>
              <Badge variant={getStatusBadgeVariant(lead.status)}>
                {lead.status.charAt(0).toUpperCase() + lead.status.slice(1).replace("_", " ")}
              </Badge>
            </div>
            <div className="text-sm text-muted-foreground">
              <p>📧 {lead.email} • 📞 {lead.phone}</p>
              <p>📅 Move Date: {lead.moveDate || "Not specified"}</p>
              <p>📍 From: {lead.fromAddress}</p>
              {lead.toAddress && <p>📍 To: {lead.toAddress}</p>}
              {lead.details && <p>💬 {lead.details}</p>}
            </div>
            <p className="text-xs text-muted-foreground">
              Posted: {new Date(lead.createdAt).toLocaleString()}
            </p>
          </div>
          <div className="flex gap-2 ml-4">
            <Button 
              variant="default" 
              size="sm" 
              onClick={() => handleViewLead(lead)}
              data-testid={`manage-button-${lead.id}`}
            >
              Manage
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setLeadToDelete(lead)}
              data-testid={`delete-button-${lead.id}`}
              className="hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" asChild data-testid={`email-button-${lead.id}`}>
              <a href={`mailto:${lead.email}`}>
                <Mail className="h-4 w-4" />
              </a>
            </Button>
            <Button variant="ghost" size="sm" asChild data-testid={`phone-button-${lead.id}`}>
              <a href={`tel:${lead.phone}`}>
                <Phone className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Leads Management</h1>
              <p className="text-muted-foreground mt-2">
                View and manage customer leads
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

        <Tabs defaultValue="view" className="space-y-6">
          <TabsList>
            <TabsTrigger value="view" data-testid="tab-view-leads">View Leads</TabsTrigger>
            <TabsTrigger value="add" data-testid="tab-add-lead">Add a Lead</TabsTrigger>
          </TabsList>

          <TabsContent value="view">
            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-4 text-muted-foreground">Loading leads...</p>
              </div>
            ) : leads.length === 0 ? (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center">
                    <p className="text-muted-foreground">No leads at this time.</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>All Leads ({leads.length})</CardTitle>
                  <CardDescription>All customer leads organized by status</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {[...leads]
                      .sort((a, b) => {
                        // Sort by status priority (new → contacted → quoted → confirmed → available → accepted → in_progress → completed)
                        // Then by newest date first
                        const statusOrder = ["new", "contacted", "quoted", "confirmed", "available", "accepted", "in_progress", "completed"];
                        const aIndex = statusOrder.indexOf(a.status);
                        const bIndex = statusOrder.indexOf(b.status);
                        if (aIndex !== bIndex) return aIndex - bIndex;
                        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                      })
                      .map(renderLeadCard)}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="add">
            <Card>
              <CardHeader>
                <CardTitle>Add a New Lead</CardTitle>
                <CardDescription>
                  Submit a lead on behalf of a customer. You'll earn rewards when the job is confirmed and completed.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={onSubmit} className="space-y-6">
                  <div>
                    <Label className="block text-sm font-medium text-foreground mb-3">Service Type *</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {serviceOptions.map((service) => {
                        const IconComponent = service.icon;
                        return (
                          <label key={service.value} className="relative">
                            <input
                              type="radio"
                              value={service.value}
                              className="peer sr-only"
                              {...form.register("serviceType", { required: true })}
                              onChange={(e) => setSelectedService(e.target.value)}
                              data-testid={`radio-service-${service.value}`}
                            />
                            <div className="p-4 border-2 border-border rounded-lg cursor-pointer peer-checked:border-primary peer-checked:bg-primary/5 transition-colors">
                              <IconComponent className="text-primary text-2xl mb-2 mx-auto h-8 w-8" />
                              <span className="font-medium block text-center">{service.label}</span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                    {form.formState.errors.serviceType && (
                      <p className="text-destructive text-sm mt-1" data-testid="error-service-type">Service type is required</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label htmlFor="firstName">Customer First Name *</Label>
                      <Input
                        id="firstName"
                        placeholder="John"
                        {...form.register("firstName")}
                        data-testid="input-first-name"
                      />
                      {form.formState.errors.firstName && (
                        <p className="text-destructive text-sm mt-1" data-testid="error-first-name">{form.formState.errors.firstName.message}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="lastName">Customer Last Name *</Label>
                      <Input
                        id="lastName"
                        placeholder="Doe"
                        {...form.register("lastName")}
                        data-testid="input-last-name"
                      />
                      {form.formState.errors.lastName && (
                        <p className="text-destructive text-sm mt-1" data-testid="error-last-name">{form.formState.errors.lastName.message}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label htmlFor="email">Customer Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="customer@email.com"
                        {...form.register("email")}
                        data-testid="input-email"
                      />
                      {form.formState.errors.email && (
                        <p className="text-destructive text-sm mt-1" data-testid="error-email">{form.formState.errors.email.message}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="phone">Customer Phone *</Label>
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="(555) 123-4567"
                        {...form.register("phone")}
                        data-testid="input-phone"
                      />
                      {form.formState.errors.phone && (
                        <p className="text-destructive text-sm mt-1" data-testid="error-phone">{form.formState.errors.phone.message}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label htmlFor="fromAddress">From Address *</Label>
                      <Input
                        id="fromAddress"
                        placeholder="Current address"
                        {...form.register("fromAddress")}
                        data-testid="input-from-address"
                      />
                      {form.formState.errors.fromAddress && (
                        <p className="text-destructive text-sm mt-1" data-testid="error-from-address">{form.formState.errors.fromAddress.message}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="toAddress">To Address</Label>
                      <Input
                        id="toAddress"
                        placeholder="Destination address"
                        {...form.register("toAddress")}
                        data-testid="input-to-address"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label htmlFor="moveDate">Preferred Move Date</Label>
                      <Input
                        id="moveDate"
                        type="date"
                        {...form.register("moveDate")}
                        data-testid="input-move-date"
                      />
                    </div>
                    <div>
                      <Label htmlFor="propertySize">Property Size</Label>
                      <Input
                        id="propertySize"
                        placeholder="e.g., 2 bedroom, 1500 sq ft"
                        {...form.register("propertySize")}
                        data-testid="input-property-size"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="details">Additional Details</Label>
                    <Textarea
                      id="details"
                      placeholder="Any special requirements, items to move, or important notes..."
                      rows={4}
                      {...form.register("details")}
                      data-testid="textarea-details"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={submitLead.isPending}
                    className="w-full"
                    data-testid="button-submit-lead"
                  >
                    {submitLead.isPending ? "Submitting..." : "Add Lead"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="mt-6 bg-primary/5 border-primary/20">
              <CardContent className="pt-6">
                <h3 className="font-semibold mb-2">💰 Earn Rewards</h3>
                <p className="text-sm text-muted-foreground">
                  When leads you create are confirmed and completed, you'll earn 50% of the rewards when other employees complete the job. This encourages teamwork and business growth!
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Quick View Dialog */}
      <Dialog open={isQuickViewOpen} onOpenChange={setIsQuickViewOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Lead Details</DialogTitle>
            <DialogDescription>
              View lead information and take action
            </DialogDescription>
          </DialogHeader>
          {selectedLead && (
            <Card className="border" data-testid={`lead-quick-view-${selectedLead.id}`}>
              <CardContent className="p-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-lg">
                      {selectedLead.firstName} {selectedLead.lastName}
                    </h3>
                    <Badge
                      variant={selectedLead.status === 'completed' ? 'default' : 'secondary'}
                      className={selectedLead.status === 'completed' ? 'bg-green-600' : ''}
                    >
                      {selectedLead.status.charAt(0).toUpperCase() + selectedLead.status.slice(1).replace('_', ' ')}
                    </Badge>
                  </div>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Badge className={
                        selectedLead.serviceType === 'residential' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                        selectedLead.serviceType === 'commercial' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                        'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
                      }>
                        {selectedLead.serviceType === 'residential' ? 'Residential' : 
                         selectedLead.serviceType === 'commercial' ? 'Commercial' : 
                         'Junk Removal'}
                      </Badge>
                    </div>
                    <p className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      <a href={`tel:${selectedLead.phone}`} className="hover:underline">
                        {selectedLead.phone}
                      </a>
                    </p>
                    <p className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      <a href={`mailto:${selectedLead.email}`} className="hover:underline">
                        {selectedLead.email}
                      </a>
                    </p>
                    <p className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      {selectedLead.fromAddress}
                    </p>
                    {selectedLead.toAddress && (
                      <p className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        To: {selectedLead.toAddress}
                      </p>
                    )}
                    {selectedLead.moveDate && (
                      <p className="flex items-center gap-2">
                        <CalendarIcon className="h-4 w-4" />
                        Move Date: {new Date(selectedLead.moveDate).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  {selectedLead.details && (
                    <p className="text-sm mt-2 p-2 bg-muted rounded">
                      {selectedLead.details}
                    </p>
                  )}
                  <div className="flex gap-2 mt-3">
                    <Button 
                      size="sm" 
                      onClick={() => handleManageJob(selectedLead)}
                      data-testid={`button-manage-job-${selectedLead.id}`}
                    >
                      <Settings className="h-4 w-4 mr-1" />
                      Manage Job
                    </Button>
                    <Button variant="outline" size="sm" asChild data-testid={`button-call-${selectedLead.id}`}>
                      <a href={`tel:${selectedLead.phone}`}>
                        <Phone className="h-4 w-4 mr-1" />
                        Call
                      </a>
                    </Button>
                    <Button variant="outline" size="sm" asChild data-testid={`button-email-${selectedLead.id}`}>
                      <a href={`mailto:${selectedLead.email}`}>
                        <Mail className="h-4 w-4 mr-1" />
                        Email
                      </a>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </DialogContent>
      </Dialog>

      {/* Full Management Dialog */}
      <LeadQuoteDialog
        open={isManageDialogOpen}
        onOpenChange={setIsManageDialogOpen}
        lead={selectedLead}
        employees={employees}
        onSave={handleSaveQuote}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!leadToDelete} onOpenChange={(open) => !open && setLeadToDelete(null)}>
        <AlertDialogContent data-testid="dialog-delete-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the lead for{" "}
              <strong>{leadToDelete?.firstName} {leadToDelete?.lastName}</strong>.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => leadToDelete && deleteLead.mutate(leadToDelete.id)}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteLead.isPending ? "Deleting..." : "Delete Lead"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
