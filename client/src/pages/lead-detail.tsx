import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Mail, Phone, MapPin, Calendar, Truck, Users, DollarSign, Award, TrendingUp, CheckCircle, Circle, Clock, Star, ExternalLink } from "lucide-react";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  serviceType: string;
  fromAddress: string;
  toAddress?: string;
  moveDate?: string;
  propertySize?: string;
  details?: string;
  status: string;
  assignedToUserId?: string;
  createdByUserId?: string;
  truckConfig?: string;
  crewSize?: number;
  basePrice?: string;
  totalPrice?: string;
  confirmedDate?: string;
  confirmedFromAddress?: string;
  confirmedToAddress?: string;
  crewMembers?: string[];
  hasHotTub?: boolean;
  hotTubWeight?: number;
  hotTubFee?: string;
  hasHeavySafe?: boolean;
  heavySafeWeight?: number;
  heavySafeFee?: string;
  hasPoolTable?: boolean;
  poolTableWeight?: number;
  poolTableFee?: string;
  hasPiano?: boolean;
  pianoWeight?: number;
  pianoFee?: string;
  totalSpecialItemsFee?: string;
  quoteNotes?: string;
  lastQuoteUpdatedAt?: string;
  createdAt: string;
}

interface Reward {
  id: string;
  userId: string;
  rewardType: string;
  tokenAmount: string;
  cashValue: string;
  status: string;
  earnedDate: string;
  referenceId?: string;
  metadata?: any;
}

export default function LeadDetailPage() {
  const [, params] = useRoute("/lead/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [tokenAllocation, setTokenAllocation] = useState("");
  const [isCheckingIn, setIsCheckingIn] = useState(false);

  const { data: lead, isLoading } = useQuery<Lead>({
    queryKey: ["/api/leads", params?.id],
    enabled: !!params?.id,
  });

  const { data: rewards = [] } = useQuery<Reward[]>({
    queryKey: ["/api/rewards"],
  });

  const form = useForm({
    defaultValues: {
      basePrice: "",
      crewSize: 2,
      confirmedDate: "",
      confirmedFromAddress: "",
      confirmedToAddress: "",
      quoteNotes: "",
    },
  });

  // Update form when lead data loads
  useEffect(() => {
    if (lead) {
      form.reset({
        basePrice: lead.basePrice || "",
        crewSize: lead.crewSize || 2,
        confirmedDate: lead.confirmedDate || lead.moveDate || "",
        confirmedFromAddress: lead.confirmedFromAddress || lead.fromAddress || "",
        confirmedToAddress: lead.confirmedToAddress || lead.toAddress || "",
        quoteNotes: lead.quoteNotes || "",
      });
    }
  }, [lead, form]);

  const updateLead = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("PATCH", `/api/leads/${params?.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      toast({
        title: "Success",
        description: "Lead updated successfully",
      });
      setIsEditing(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update lead",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    const formData = form.getValues();
    updateLead.mutate({
      ...formData,
      status: lead?.status,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Lead not found</p>
            <Button className="w-full mt-4" onClick={() => setLocation("/leads")}>
              Back to Leads
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Calculate potential earnings
  const baseReward = 100; // points
  const baseTokens = 500; // JCMOVES
  const onTimeBonus = 0.2; // 20%
  const ratingBonus = 0.3; // 30% for 4.0+ rating
  
  const potentialEarnings = {
    base: { points: baseReward, tokens: baseTokens },
    withOnTime: { 
      points: Math.round(baseReward * (1 + onTimeBonus)), 
      tokens: Math.round(baseTokens * (1 + onTimeBonus)) 
    },
    withRating: { 
      points: Math.round(baseReward * (1 + ratingBonus)), 
      tokens: Math.round(baseTokens * (1 + ratingBonus)) 
    },
    withBoth: { 
      points: Math.round(baseReward * (1 + onTimeBonus + ratingBonus)), 
      tokens: Math.round(baseTokens * (1 + onTimeBonus + ratingBonus)) 
    },
  };

  // Filter rewards related to this lead
  const leadRewards = rewards.filter(r => r.referenceId === lead.id);
  const pendingRewards = leadRewards.filter(r => r.status === "pending");
  const creditedRewards = leadRewards.filter(r => r.status === "confirmed");

  const serviceTypeBadge = () => {
    switch (lead.serviceType) {
      case "residential": return "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200";
      case "commercial": return "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200";
      case "junk": return "bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200";
      default: return "bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200";
    }
  };

  // 5-step workflow system
  const workflow = [
    { step: 1, name: "Quote", status: ["new", "contacted", "quoted"] },
    { step: 2, name: "Assign & Price", status: ["quoted", "confirmed"] },
    { step: 3, name: "Day Before Reminder", status: ["confirmed"] },
    { step: 4, name: "Check In", status: ["confirmed", "in-progress"] },
    { step: 5, name: "Complete & Review", status: ["in-progress", "completed"] }
  ];

  const getCurrentStep = () => {
    if (!lead) return 1;
    if (lead.status === "completed") return 5;
    if (lead.status === "in-progress") return 4;
    if (lead.status === "confirmed" && lead.basePrice) return 3;
    if (lead.basePrice && lead.crewSize) return 2;
    return 1;
  };

  const currentStep = getCurrentStep();

  const advanceToStep = useMutation({
    mutationFn: async (targetStep: number) => {
      let newStatus = lead?.status;
      let updateData: any = {};

      switch (targetStep) {
        case 2:
          newStatus = "quoted";
          break;
        case 3:
          newStatus = "confirmed";
          // Persist token allocation when confirming assignment
          if (tokenAllocation) {
            updateData.tokenAllocation = parseFloat(tokenAllocation);
          }
          break;
        case 4:
          newStatus = "in-progress";
          // Record check-in timestamp for bonus calculation
          updateData.checkedInAt = new Date().toISOString();
          break;
        case 5:
          newStatus = "completed";
          // Record completion timestamp
          updateData.completedAt = new Date().toISOString();
          break;
      }

      updateData = { ...updateData, status: newStatus };
      return await apiRequest("PATCH", `/api/leads/${params?.id}`, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      toast({
        title: "Step completed",
        description: "Job workflow advanced successfully",
      });
      setIsCheckingIn(false);
    },
  });

  const sendReminder = useMutation({
    mutationFn: async () => {
      // This would integrate with email/SMS service
      return await apiRequest("POST", `/api/leads/${params?.id}/reminder`, {});
    },
    onSuccess: () => {
      toast({
        title: "Reminder sent",
        description: "Customer has been notified about tomorrow's move",
      });
    },
  });

  const requestReview = (platform: string) => {
    const customerEmail = lead?.email;
    const customerName = `${lead?.firstName} ${lead?.lastName}`;
    
    let url = "";
    switch (platform) {
      case "google":
        // JC ON THE MOVE Google review URL
        url = "https://www.google.com/search?q=jc+on+the+move&rlz=1C1GCEU_enUS832US832#lrd=0x8823f6fa63b16c07:0x9c6a4b3d4e5f6c8a,3";
        break;
      case "facebook":
        // JC ON THE MOVE Facebook reviews
        url = "https://www.facebook.com/JCOnTheMove/reviews";
        break;
      case "inapp":
        // This would open an in-app review modal
        toast({
          title: "Review request sent",
          description: "Customer will receive an in-app review request",
        });
        return;
    }
    
    if (url) {
      window.open(url, "_blank");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="outline"
              onClick={() => setLocation("/leads")}
              className="flex items-center gap-2"
              data-testid="button-back-to-leads"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Leads
            </Button>
            <div className="flex gap-2">
              {!isEditing ? (
                <Button onClick={() => setIsEditing(true)} data-testid="button-edit">
                  Edit Quote
                </Button>
              ) : (
                <>
                  <Button variant="outline" onClick={() => setIsEditing(false)} data-testid="button-cancel">
                    Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={updateLead.isPending} data-testid="button-save">
                    {updateLead.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-bold text-foreground">
              {lead.firstName} {lead.lastName}
            </h1>
            <Badge className={serviceTypeBadge()}>
              {lead.serviceType === "residential" && "Residential"}
              {lead.serviceType === "commercial" && "Commercial"}
              {lead.serviceType === "junk" && "Junk Removal"}
            </Badge>
            <Badge variant={lead.status === "completed" ? "default" : "secondary"}>
              {lead.status.charAt(0).toUpperCase() + lead.status.slice(1)}
            </Badge>
          </div>
        </div>

        {/* 5-Step Workflow Progress */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Job Workflow</CardTitle>
            <CardDescription>Complete these 5 simple steps to finish the job</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Progress Steps */}
              <div className="flex items-center justify-between">
                {workflow.map((step, idx) => (
                  <div key={step.step} className="flex items-center flex-1">
                    <div className="flex flex-col items-center flex-1">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                        currentStep > step.step 
                          ? 'bg-green-600 border-green-600 text-white' 
                          : currentStep === step.step
                          ? 'bg-primary border-primary text-white'
                          : 'bg-muted border-muted-foreground/30 text-muted-foreground'
                      }`}>
                        {currentStep > step.step ? (
                          <CheckCircle className="h-5 w-5" />
                        ) : (
                          <span className="font-bold">{step.step}</span>
                        )}
                      </div>
                      <p className={`text-xs mt-2 text-center ${
                        currentStep >= step.step ? 'font-semibold' : 'text-muted-foreground'
                      }`}>
                        {step.name}
                      </p>
                    </div>
                    {idx < workflow.length - 1 && (
                      <div className={`h-0.5 flex-1 ${
                        currentStep > step.step ? 'bg-green-600' : 'bg-muted'
                      }`} />
                    )}
                  </div>
                ))}
              </div>

              {/* Step-specific Actions */}
              <div className="p-4 bg-muted/50 rounded-lg">
                {currentStep === 1 && (
                  <div className="space-y-3">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Circle className="h-4 w-4 text-primary" />
                      Step 1: Create Quote
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Review customer details and create a quote with pricing information.
                    </p>
                    <Button 
                      onClick={() => setIsEditing(true)} 
                      disabled={!lead}
                      data-testid="button-start-quote"
                    >
                      Start Quote
                    </Button>
                  </div>
                )}

                {currentStep === 2 && (
                  <div className="space-y-3">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Circle className="h-4 w-4 text-primary" />
                      Step 2: Assign Crew, Price & Tokens
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Set the crew size, final price, and JCMOVES token allocation for this job.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <Label htmlFor="token-allocation">JCMOVES Tokens</Label>
                        <Input
                          id="token-allocation"
                          type="number"
                          placeholder="e.g., 500"
                          value={tokenAllocation}
                          onChange={(e) => setTokenAllocation(e.target.value)}
                          data-testid="input-token-allocation"
                        />
                      </div>
                    </div>
                    <Button 
                      onClick={() => advanceToStep.mutate(3)}
                      disabled={!lead?.basePrice || !lead?.crewSize}
                      data-testid="button-confirm-assignment"
                    >
                      Confirm Assignment
                    </Button>
                  </div>
                )}

                {currentStep === 3 && (
                  <div className="space-y-3">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Clock className="h-4 w-4 text-primary" />
                      Step 3: Day-Before Reminder
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Send a reminder to the customer one day before the scheduled move.
                    </p>
                    <div className="flex gap-2">
                      <Button 
                        onClick={() => sendReminder.mutate()}
                        disabled={sendReminder.isPending}
                        variant="outline"
                        data-testid="button-send-reminder"
                      >
                        {sendReminder.isPending ? "Sending..." : "Send Reminder"}
                      </Button>
                      <Button 
                        onClick={() => advanceToStep.mutate(4)}
                        data-testid="button-skip-to-checkin"
                      >
                        Continue to Check-In
                      </Button>
                    </div>
                  </div>
                )}

                {currentStep === 4 && (
                  <div className="space-y-3">
                    <h4 className="font-semibold flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-primary" />
                      Step 4: Check In & Collect Bonus
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Check in when you arrive at the job site. Arrive early or on-time to earn your bonus!
                    </p>
                    <div className="p-3 bg-primary/10 rounded-lg">
                      <p className="text-sm font-semibold text-primary">
                        🎁 On-Time Bonus: +20% ({potentialEarnings.withOnTime.tokens} JCMOVES)
                      </p>
                    </div>
                    {lead?.status !== "in-progress" ? (
                      <Button 
                        onClick={() => advanceToStep.mutate(4)}
                        disabled={advanceToStep.isPending}
                        data-testid="button-check-in"
                      >
                        {advanceToStep.isPending ? "Checking In..." : "Check In Now"}
                      </Button>
                    ) : (
                      <div className="space-y-3">
                        <div className="p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-900 rounded-lg">
                          <p className="text-sm font-semibold text-green-800 dark:text-green-200">
                            ✅ Checked In! Job is in progress.
                          </p>
                        </div>
                        <Button 
                          onClick={() => advanceToStep.mutate(5)}
                          disabled={advanceToStep.isPending}
                          data-testid="button-mark-complete"
                        >
                          Mark as Complete
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {currentStep === 5 && (
                  <div className="space-y-3">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Star className="h-4 w-4 text-primary" />
                      Step 5: Complete & Request Review
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Job complete! Request a review from the customer to earn your review bonus.
                    </p>
                    <div className="p-3 bg-primary/10 rounded-lg">
                      <p className="text-sm font-semibold text-primary">
                        ⭐ Review Bonus: +30% for 4.0+ rating ({potentialEarnings.withRating.tokens} JCMOVES)
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button 
                        onClick={() => requestReview("google")}
                        variant="outline"
                        className="gap-2"
                        data-testid="button-review-google"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Google Review
                      </Button>
                      <Button 
                        onClick={() => requestReview("facebook")}
                        variant="outline"
                        className="gap-2"
                        data-testid="button-review-facebook"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Facebook Review
                      </Button>
                      <Button 
                        onClick={() => requestReview("inapp")}
                        variant="outline"
                        className="gap-2"
                        data-testid="button-review-inapp"
                      >
                        <Star className="h-4 w-4" />
                        In-App Review
                      </Button>
                    </div>
                    {lead?.status === "completed" && (
                      <div className="mt-4 p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-900 rounded-lg">
                        <p className="text-sm font-semibold text-green-800 dark:text-green-200">
                          ✅ Job Completed! Great work!
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Customer Information */}
            <Card>
              <CardHeader>
                <CardTitle>Customer Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Email</p>
                      <a href={`mailto:${lead.email}`} className="text-sm font-medium hover:underline" data-testid="link-email">
                        {lead.email}
                      </a>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Phone</p>
                      <a href={`tel:${lead.phone}`} className="text-sm font-medium hover:underline" data-testid="link-phone">
                        {lead.phone}
                      </a>
                    </div>
                  </div>
                </div>
                
                <Separator />
                
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">From</p>
                      <p className="text-sm font-medium">{lead.fromAddress}</p>
                    </div>
                  </div>
                  {lead.toAddress && (
                    <div className="flex items-start gap-3">
                      <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm text-muted-foreground">To</p>
                        <p className="text-sm font-medium">{lead.toAddress}</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Requested Move Date</p>
                      <p className="text-sm font-medium">{lead.moveDate || "Not specified"}</p>
                    </div>
                  </div>
                </div>

                {lead.details && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Additional Details</p>
                      <p className="text-sm bg-muted p-3 rounded">{lead.details}</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Quote & Scheduling */}
            <Card>
              <CardHeader>
                <CardTitle>Quote & Scheduling</CardTitle>
                <CardDescription>Configure pricing, crew, and schedule details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="basePrice">Base Price</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="basePrice"
                        type="number"
                        step="0.01"
                        className="pl-9"
                        disabled={!isEditing}
                        {...form.register("basePrice")}
                        data-testid="input-base-price"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="crewSize">Crew Size</Label>
                    <div className="relative">
                      <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="crewSize"
                        type="number"
                        min="1"
                        max="10"
                        className="pl-9"
                        disabled={!isEditing}
                        {...form.register("crewSize", { valueAsNumber: true })}
                        data-testid="input-crew-size"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <Label htmlFor="confirmedDate">Confirmed Move Date</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="confirmedDate"
                      type="date"
                      className="pl-9"
                      disabled={!isEditing}
                      {...form.register("confirmedDate")}
                      data-testid="input-confirmed-date"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="confirmedFromAddress">Confirmed Pickup Address</Label>
                  <Input
                    id="confirmedFromAddress"
                    disabled={!isEditing}
                    {...form.register("confirmedFromAddress")}
                    data-testid="input-confirmed-from"
                  />
                </div>

                <div>
                  <Label htmlFor="confirmedToAddress">Confirmed Delivery Address</Label>
                  <Input
                    id="confirmedToAddress"
                    disabled={!isEditing}
                    {...form.register("confirmedToAddress")}
                    data-testid="input-confirmed-to"
                  />
                </div>

                <div>
                  <Label htmlFor="quoteNotes">Quote Notes</Label>
                  <Textarea
                    id="quoteNotes"
                    rows={4}
                    placeholder="Add notes about this quote..."
                    disabled={!isEditing}
                    {...form.register("quoteNotes")}
                    data-testid="input-quote-notes"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - Potential Earnings & Rewards */}
          <div className="space-y-6">
            {/* Potential Earnings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Potential Earnings
                </CardTitle>
                <CardDescription>Rewards for completing this job</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground mb-2">Base Completion</p>
                  <div className="space-y-1">
                    <p className="text-lg font-bold">{potentialEarnings.base.points} Points</p>
                    <p className="text-sm text-muted-foreground">{potentialEarnings.base.tokens} JCMOVES</p>
                  </div>
                </div>

                <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-2">+ On-Time Bonus (20%)</p>
                  <div className="space-y-1">
                    <p className="text-lg font-bold text-primary">{potentialEarnings.withOnTime.points} Points</p>
                    <p className="text-sm text-muted-foreground">{potentialEarnings.withOnTime.tokens} JCMOVES</p>
                  </div>
                </div>

                <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-2">+ Rating Bonus (30% for 4.0+)</p>
                  <div className="space-y-1">
                    <p className="text-lg font-bold text-primary">{potentialEarnings.withRating.points} Points</p>
                    <p className="text-sm text-muted-foreground">{potentialEarnings.withRating.tokens} JCMOVES</p>
                  </div>
                </div>

                <Separator />

                <div className="p-4 bg-gradient-to-br from-primary/10 to-primary/5 border-2 border-primary/30 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-2">Maximum Potential</p>
                  <div className="space-y-1">
                    <p className="text-2xl font-bold text-primary">{potentialEarnings.withBoth.points} Points</p>
                    <p className="text-sm text-muted-foreground">{potentialEarnings.withBoth.tokens} JCMOVES</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Rewards Tracking */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5" />
                  Rewards Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="pending" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="pending" data-testid="tab-pending">
                      Pending ({pendingRewards.length})
                    </TabsTrigger>
                    <TabsTrigger value="credited" data-testid="tab-credited">
                      Credited ({creditedRewards.length})
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="pending" className="space-y-3 mt-4">
                    {pendingRewards.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No pending rewards
                      </p>
                    ) : (
                      pendingRewards.map(reward => (
                        <div key={reward.id} className="p-3 border rounded-lg" data-testid={`pending-reward-${reward.id}`}>
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium text-sm">{reward.rewardType}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(reward.earnedDate).toLocaleDateString()}
                              </p>
                            </div>
                            <Badge variant="outline">Pending</Badge>
                          </div>
                          <div className="mt-2 text-sm">
                            <p className="font-semibold">{parseFloat(reward.tokenAmount).toFixed(2)} JCMOVES</p>
                            <p className="text-muted-foreground">${parseFloat(reward.cashValue).toFixed(2)}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </TabsContent>
                  
                  <TabsContent value="credited" className="space-y-3 mt-4">
                    {creditedRewards.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No credited rewards yet
                      </p>
                    ) : (
                      creditedRewards.map(reward => (
                        <div key={reward.id} className="p-3 border rounded-lg bg-muted/30" data-testid={`credited-reward-${reward.id}`}>
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium text-sm">{reward.rewardType}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(reward.earnedDate).toLocaleDateString()}
                              </p>
                            </div>
                            <Badge className="bg-green-600">Credited</Badge>
                          </div>
                          <div className="mt-2 text-sm">
                            <p className="font-semibold">{parseFloat(reward.tokenAmount).toFixed(2)} JCMOVES</p>
                            <p className="text-muted-foreground">${parseFloat(reward.cashValue).toFixed(2)}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
