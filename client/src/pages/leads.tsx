import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft, Home, Building, Trash2, Eye, Mail, Phone, X, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { insertLeadSchema, type InsertLead, type Lead, type User } from "@shared/schema";
import { z } from "zod";

const quoteFormSchema = z.object({
  confirmedDate: z.string().min(1, "Date is required"),
  confirmedFromAddress: z.string().min(1, "From address is required"),
  confirmedToAddress: z.string().min(1, "To address is required"),
  basePrice: z.string().min(1, "Base price is required"),
  crewMembers: z.array(z.string()).min(1, "At least one crew member is required"),
  hasHotTub: z.boolean(),
  hotTubWeight: z.number().optional(),
  hasHeavySafe: z.boolean(),
  heavySafeWeight: z.number().optional(),
  hasPoolTable: z.boolean(),
  poolTableWeight: z.number().optional(),
  hasPiano: z.boolean(),
  pianoWeight: z.number().optional(),
});

type QuoteFormData = z.infer<typeof quoteFormSchema>;

export default function LeadsPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedService, setSelectedService] = useState("");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCrewMembers, setSelectedCrewMembers] = useState<string[]>([]);

  const serviceOptions = [
    { value: "residential", label: "Residential Moving", icon: Home },
    { value: "commercial", label: "Commercial Moving", icon: Building },
    { value: "junk", label: "Junk Removal", icon: Trash2 },
  ];

  // Fetch all leads
  const { data: leads = [], isLoading } = useQuery<Lead[]>({
    queryKey: ["/api/leads"],
  });

  // Fetch employees
  const { data: employees = [] } = useQuery<User[]>({
    queryKey: ["/api/employees"],
    enabled: isDialogOpen,
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

  const quoteForm = useForm<QuoteFormData>({
    resolver: zodResolver(quoteFormSchema),
    defaultValues: {
      confirmedDate: "",
      confirmedFromAddress: "",
      confirmedToAddress: "",
      basePrice: "",
      crewMembers: [],
      hasHotTub: false,
      hotTubWeight: undefined,
      hasHeavySafe: false,
      heavySafeWeight: undefined,
      hasPoolTable: false,
      poolTableWeight: undefined,
      hasPiano: false,
      pianoWeight: undefined,
    },
  });

  // Watch form values for calculations
  const watchedValues = quoteForm.watch();
  const basePrice = parseFloat(watchedValues.basePrice) || 0;

  // Calculate heavy item fee: $200 base + $150 per 100 lbs (max 1000 lbs)
  const calculateHeavyItemFee = (weight: number | undefined): number => {
    if (!weight || weight <= 0) return 0;
    const cappedWeight = Math.min(weight, 1000);
    const hundredPounds = Math.floor(cappedWeight / 100);
    return 200 + (hundredPounds * 150);
  };

  const hotTubFee = watchedValues.hasHotTub ? calculateHeavyItemFee(watchedValues.hotTubWeight) : 0;
  const heavySafeFee = watchedValues.hasHeavySafe ? calculateHeavyItemFee(watchedValues.heavySafeWeight) : 0;
  const poolTableFee = watchedValues.hasPoolTable ? calculateHeavyItemFee(watchedValues.poolTableWeight) : 0;
  const pianoFee = watchedValues.hasPiano ? calculateHeavyItemFee(watchedValues.pianoWeight) : 0;

  const totalSpecialItemsFee = hotTubFee + heavySafeFee + poolTableFee + pianoFee;
  const totalPrice = basePrice + totalSpecialItemsFee;

  // Update form when lead is selected
  useEffect(() => {
    if (selectedLead) {
      quoteForm.reset({
        confirmedDate: selectedLead.confirmedDate || "",
        confirmedFromAddress: selectedLead.confirmedFromAddress || selectedLead.fromAddress,
        confirmedToAddress: selectedLead.confirmedToAddress || selectedLead.toAddress || "",
        basePrice: selectedLead.basePrice?.toString() || "",
        crewMembers: selectedLead.crewMembers || [],
        hasHotTub: selectedLead.hasHotTub || false,
        hotTubWeight: selectedLead.hotTubWeight || undefined,
        hasHeavySafe: selectedLead.hasHeavySafe || false,
        heavySafeWeight: selectedLead.heavySafeWeight || undefined,
        hasPoolTable: selectedLead.hasPoolTable || false,
        poolTableWeight: selectedLead.poolTableWeight || undefined,
        hasPiano: selectedLead.hasPiano || false,
        pianoWeight: selectedLead.pianoWeight || undefined,
      });
      setSelectedCrewMembers(selectedLead.crewMembers || []);
    }
  }, [selectedLead]);

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
    mutationFn: async (data: QuoteFormData) => {
      const response = await apiRequest("PATCH", `/api/leads/${selectedLead?.id}/quote`, {
        ...data,
        crewMembers: selectedCrewMembers,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Quote saved successfully!",
        description: "The quote has been updated for this lead.",
      });
      setIsDialogOpen(false);
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

  const onSubmit = form.handleSubmit((data) => {
    submitLead.mutate(data);
  });

  const onQuoteSubmit = quoteForm.handleSubmit((data) => {
    saveQuote.mutate(data);
  });

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

  const toggleCrewMember = (employeeId: string) => {
    setSelectedCrewMembers(prev => {
      const updated = prev.includes(employeeId) 
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId];
      quoteForm.setValue("crewMembers", updated);
      return updated;
    });
  };

  const handleViewLead = (lead: Lead) => {
    setSelectedLead(lead);
    setIsDialogOpen(true);
  };

  // Filter to show only new leads
  const newLeads = leads.filter(lead => lead.status === "new");

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
            <Card>
              <CardHeader>
                <CardTitle>New Leads ({newLeads.length})</CardTitle>
                <CardDescription>Recent customer inquiries awaiting contact</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    <p className="mt-4 text-muted-foreground">Loading leads...</p>
                  </div>
                ) : newLeads.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">No new leads at this time.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {newLeads.map((lead) => (
                      <Card key={lead.id} className="border" data-testid={`lead-card-${lead.id}`}>
                        <CardContent className="p-6">
                          <div className="flex justify-between items-start">
                            <div className="space-y-2 flex-1">
                              <div className="flex items-center gap-3">
                                <h3 className="font-semibold text-lg">
                                  {lead.firstName} {lead.lastName}
                                </h3>
                                <Badge className={getServiceBadgeColor(lead.serviceType)}>
                                  {lead.serviceType === "residential" && "Residential"}
                                  {lead.serviceType === "commercial" && "Commercial"}
                                  {lead.serviceType === "junk" && "Junk Removal"}
                                </Badge>
                                <Badge variant={getStatusBadgeVariant(lead.status)}>
                                  {lead.status.charAt(0).toUpperCase() + lead.status.slice(1)}
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
                                variant="ghost" 
                                size="sm" 
                                onClick={() => handleViewLead(lead)}
                                data-testid={`view-button-${lead.id}`}
                              >
                                <Eye className="h-4 w-4" />
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
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
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

      {/* Lead Detail and Quote Modal */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="dialog-lead-details">
          <DialogHeader>
            <DialogTitle data-testid="dialog-title">Lead Details & Quote</DialogTitle>
            <DialogDescription>
              View customer information and create/edit quote
            </DialogDescription>
          </DialogHeader>

          {selectedLead && (
            <div className="space-y-6">
              {/* Customer Details Section */}
              <div>
                <h3 className="text-lg font-semibold mb-4" data-testid="text-customer-details-title">Customer Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-muted/50 dark:bg-muted/30 p-4 rounded-lg">
                  <div>
                    <Label className="text-muted-foreground">Name</Label>
                    <p className="font-medium" data-testid="text-customer-name">
                      {selectedLead.firstName} {selectedLead.lastName}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Email</Label>
                    <p className="font-medium" data-testid="text-customer-email">{selectedLead.email}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Phone</Label>
                    <p className="font-medium" data-testid="text-customer-phone">{selectedLead.phone}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Service Type</Label>
                    <Badge className={getServiceBadgeColor(selectedLead.serviceType)} data-testid="badge-service-type">
                      {selectedLead.serviceType === "residential" && "Residential"}
                      {selectedLead.serviceType === "commercial" && "Commercial"}
                      {selectedLead.serviceType === "junk" && "Junk Removal"}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">From Address</Label>
                    <p className="font-medium" data-testid="text-from-address">{selectedLead.fromAddress}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">To Address</Label>
                    <p className="font-medium" data-testid="text-to-address">{selectedLead.toAddress || "Not specified"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Move Date</Label>
                    <p className="font-medium" data-testid="text-move-date">{selectedLead.moveDate || "Not specified"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Property Size</Label>
                    <p className="font-medium" data-testid="text-property-size">{selectedLead.propertySize || "Not specified"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Status</Label>
                    <Badge variant={getStatusBadgeVariant(selectedLead.status)} data-testid="badge-status">
                      {selectedLead.status.charAt(0).toUpperCase() + selectedLead.status.slice(1)}
                    </Badge>
                  </div>
                  {selectedLead.createdByUserId && (
                    <div>
                      <Label className="text-muted-foreground">Created By</Label>
                      <p className="font-medium" data-testid="text-created-by">
                        {createdByUser ? `${createdByUser.firstName} ${createdByUser.lastName}` : "Loading..."}
                      </p>
                    </div>
                  )}
                  {selectedLead.details && (
                    <div className="md:col-span-2">
                      <Label className="text-muted-foreground">Additional Details</Label>
                      <p className="font-medium" data-testid="text-additional-details">{selectedLead.details}</p>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Edit Quote Section */}
              <form onSubmit={onQuoteSubmit} className="space-y-6">
                <h3 className="text-lg font-semibold" data-testid="text-edit-quote-title">Edit Quote</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="confirmedDate">Confirmed Date *</Label>
                    <Input
                      id="confirmedDate"
                      type="date"
                      {...quoteForm.register("confirmedDate")}
                      data-testid="input-confirmed-date"
                    />
                    {quoteForm.formState.errors.confirmedDate && (
                      <p className="text-destructive text-sm mt-1" data-testid="error-confirmed-date">
                        {quoteForm.formState.errors.confirmedDate.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="basePrice">Base Price ($) *</Label>
                    <Input
                      id="basePrice"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      {...quoteForm.register("basePrice")}
                      data-testid="input-base-price"
                    />
                    {quoteForm.formState.errors.basePrice && (
                      <p className="text-destructive text-sm mt-1" data-testid="error-base-price">
                        {quoteForm.formState.errors.basePrice.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="confirmedFromAddress">Confirmed From Address *</Label>
                    <Input
                      id="confirmedFromAddress"
                      placeholder="Pickup address"
                      {...quoteForm.register("confirmedFromAddress")}
                      data-testid="input-confirmed-from-address"
                    />
                    {quoteForm.formState.errors.confirmedFromAddress && (
                      <p className="text-destructive text-sm mt-1" data-testid="error-confirmed-from-address">
                        {quoteForm.formState.errors.confirmedFromAddress.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="confirmedToAddress">Confirmed To Address *</Label>
                    <Input
                      id="confirmedToAddress"
                      placeholder="Delivery address"
                      {...quoteForm.register("confirmedToAddress")}
                      data-testid="input-confirmed-to-address"
                    />
                    {quoteForm.formState.errors.confirmedToAddress && (
                      <p className="text-destructive text-sm mt-1" data-testid="error-confirmed-to-address">
                        {quoteForm.formState.errors.confirmedToAddress.message}
                      </p>
                    )}
                  </div>
                </div>

                {/* Crew Members Selection */}
                <div>
                  <Label className="flex items-center gap-2 mb-2">
                    <Users className="h-4 w-4" />
                    Crew Members *
                  </Label>
                  <div className="border border-border rounded-lg p-4 space-y-2 max-h-48 overflow-y-auto" data-testid="crew-members-list">
                    {employees.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Loading employees...</p>
                    ) : (
                      employees.map((employee) => (
                        <div key={employee.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`crew-${employee.id}`}
                            checked={selectedCrewMembers.includes(employee.id)}
                            onCheckedChange={() => toggleCrewMember(employee.id)}
                            data-testid={`checkbox-crew-${employee.id}`}
                          />
                          <label
                            htmlFor={`crew-${employee.id}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            {employee.firstName} {employee.lastName} ({employee.email})
                          </label>
                        </div>
                      ))
                    )}
                  </div>
                  {selectedCrewMembers.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2" data-testid="selected-crew-members">
                      {selectedCrewMembers.map((memberId) => {
                        const employee = employees.find(e => e.id === memberId);
                        return employee ? (
                          <Badge key={memberId} variant="secondary" className="flex items-center gap-1">
                            {employee.firstName} {employee.lastName}
                            <X
                              className="h-3 w-3 cursor-pointer"
                              onClick={() => toggleCrewMember(memberId)}
                            />
                          </Badge>
                        ) : null;
                      })}
                    </div>
                  )}
                  {quoteForm.formState.errors.crewMembers && (
                    <p className="text-destructive text-sm mt-1" data-testid="error-crew-members">
                      {quoteForm.formState.errors.crewMembers.message}
                    </p>
                  )}
                </div>

                <Separator />

                {/* Special Moving Items */}
                <div>
                  <h4 className="font-semibold mb-4" data-testid="text-special-items-title">
                    Special Moving Items
                    <span className="text-sm font-normal text-muted-foreground ml-2">
                      ($200 base + $150 per 100 lbs, max 1000 lbs)
                    </span>
                  </h4>

                  <div className="space-y-4">
                    {/* Hot Tub */}
                    <div className="flex items-start gap-4">
                      <Checkbox
                        id="hasHotTub"
                        checked={watchedValues.hasHotTub}
                        onCheckedChange={(checked) => quoteForm.setValue("hasHotTub", checked as boolean)}
                        data-testid="checkbox-hot-tub"
                      />
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Label htmlFor="hasHotTub" className="font-medium cursor-pointer">
                          Hot Tub
                        </Label>
                        {watchedValues.hasHotTub && (
                          <div>
                            <Input
                              type="number"
                              placeholder="Weight in lbs"
                              {...quoteForm.register("hotTubWeight", { valueAsNumber: true })}
                              data-testid="input-hot-tub-weight"
                            />
                            <p className="text-sm text-muted-foreground mt-1" data-testid="text-hot-tub-fee">
                              Fee: ${hotTubFee.toFixed(2)}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Heavy Safe */}
                    <div className="flex items-start gap-4">
                      <Checkbox
                        id="hasHeavySafe"
                        checked={watchedValues.hasHeavySafe}
                        onCheckedChange={(checked) => quoteForm.setValue("hasHeavySafe", checked as boolean)}
                        data-testid="checkbox-heavy-safe"
                      />
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Label htmlFor="hasHeavySafe" className="font-medium cursor-pointer">
                          Heavy Safe
                        </Label>
                        {watchedValues.hasHeavySafe && (
                          <div>
                            <Input
                              type="number"
                              placeholder="Weight in lbs"
                              {...quoteForm.register("heavySafeWeight", { valueAsNumber: true })}
                              data-testid="input-heavy-safe-weight"
                            />
                            <p className="text-sm text-muted-foreground mt-1" data-testid="text-heavy-safe-fee">
                              Fee: ${heavySafeFee.toFixed(2)}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Pool Table */}
                    <div className="flex items-start gap-4">
                      <Checkbox
                        id="hasPoolTable"
                        checked={watchedValues.hasPoolTable}
                        onCheckedChange={(checked) => quoteForm.setValue("hasPoolTable", checked as boolean)}
                        data-testid="checkbox-pool-table"
                      />
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Label htmlFor="hasPoolTable" className="font-medium cursor-pointer">
                          Pool Table
                        </Label>
                        {watchedValues.hasPoolTable && (
                          <div>
                            <Input
                              type="number"
                              placeholder="Weight in lbs"
                              {...quoteForm.register("poolTableWeight", { valueAsNumber: true })}
                              data-testid="input-pool-table-weight"
                            />
                            <p className="text-sm text-muted-foreground mt-1" data-testid="text-pool-table-fee">
                              Fee: ${poolTableFee.toFixed(2)}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Piano */}
                    <div className="flex items-start gap-4">
                      <Checkbox
                        id="hasPiano"
                        checked={watchedValues.hasPiano}
                        onCheckedChange={(checked) => quoteForm.setValue("hasPiano", checked as boolean)}
                        data-testid="checkbox-piano"
                      />
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Label htmlFor="hasPiano" className="font-medium cursor-pointer">
                          Piano
                        </Label>
                        {watchedValues.hasPiano && (
                          <div>
                            <Input
                              type="number"
                              placeholder="Weight in lbs"
                              {...quoteForm.register("pianoWeight", { valueAsNumber: true })}
                              data-testid="input-piano-weight"
                            />
                            <p className="text-sm text-muted-foreground mt-1" data-testid="text-piano-fee">
                              Fee: ${pianoFee.toFixed(2)}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Price Summary */}
                <div className="bg-primary/5 dark:bg-primary/10 p-4 rounded-lg space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Base Price:</span>
                    <span className="font-semibold" data-testid="text-summary-base-price">${basePrice.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Total Special Items Fee:</span>
                    <span className="font-semibold" data-testid="text-summary-special-items-fee">${totalSpecialItemsFee.toFixed(2)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total Price:</span>
                    <span className="text-primary" data-testid="text-summary-total-price">${totalPrice.toFixed(2)}</span>
                  </div>
                </div>

                <div className="flex gap-4 justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                    data-testid="button-cancel-quote"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={saveQuote.isPending}
                    data-testid="button-save-quote"
                  >
                    {saveQuote.isPending ? "Saving..." : "Save Quote"}
                  </Button>
                </div>
              </form>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
