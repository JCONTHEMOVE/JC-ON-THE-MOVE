import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft, Home, Building, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { insertLeadSchema, type InsertLead } from "@shared/schema";

export default function EmployeeAddJob() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedService, setSelectedService] = useState("");

  const serviceOptions = [
    { value: "residential", label: "Residential Moving", icon: Home },
    { value: "commercial", label: "Commercial Moving", icon: Building },
    { value: "junk", label: "Junk Removal", icon: Trash2 },
  ];

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

  const submitJob = useMutation({
    mutationFn: async (data: InsertLead) => {
      const response = await apiRequest("POST", "/api/leads/employee", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Job request submitted!",
        description: "The job has been added to the system. You'll earn rewards when it's confirmed and completed.",
      });
      form.reset();
      setSelectedService("");
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads/available"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads/my-jobs"] });
      setLocation("/dashboard");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit job request. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = form.handleSubmit((data) => {
    submitJob.mutate(data);
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
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
          <h1 className="text-3xl font-bold text-foreground">Add a Job</h1>
          <p className="text-muted-foreground mt-2">
            Submit a job request on behalf of a customer. You'll earn rewards when the job is confirmed and completed.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Job Request Details</CardTitle>
            <CardDescription>
              Fill out the customer's information and job details
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

              <div className="flex gap-4">
                <Button
                  type="submit"
                  disabled={submitJob.isPending}
                  className="flex-1"
                  data-testid="button-submit-job"
                >
                  {submitJob.isPending ? "Submitting..." : "Submit Job Request"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setLocation("/dashboard")}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="mt-6 bg-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-2">💰 Earn Rewards</h3>
            <p className="text-sm text-muted-foreground">
              When jobs you create are confirmed and completed, you'll earn JCMOVES tokens as a reward for bringing in business!
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
