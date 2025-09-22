import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { insertLeadSchema, type InsertLead } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Home, Building, Trash2, Send } from "lucide-react";

export default function QuoteForm() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedService, setSelectedService] = useState<string>("");

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
      const response = await apiRequest("POST", "/api/leads", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Quote request submitted!",
        description: "We will contact you within 24 hours with your quote.",
      });
      form.reset();
      setSelectedService("");
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
    },
    onError: (error: Error) => {
      // Don't show error messages for authentication failures
      if (error.message.includes('401')) return;
      
      toast({
        title: "Error",
        description: "Failed to submit quote request. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertLead) => {
    submitLead.mutate(data);
  };

  const serviceOptions = [
    { value: "residential", label: "Residential Moving", icon: Home },
    { value: "commercial", label: "Commercial Moving", icon: Building },
    { value: "junk", label: "Junk Removal", icon: Trash2 },
  ];

  return (
    <section id="quote" className="py-20 bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-foreground mb-4">Get Your Free Quote</h2>
          <p className="text-xl text-muted-foreground">
            Tell us about your move and we'll provide you with a detailed, no-obligation quote within 24 hours.
          </p>
        </div>
        
        <Card className="shadow-xl">
          <CardContent className="p-8">
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Service Selection */}
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
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input
                    id="firstName"
                    placeholder="Enter your first name"
                    {...form.register("firstName")}
                    data-testid="input-first-name"
                  />
                  {form.formState.errors.firstName && (
                    <p className="text-destructive text-sm mt-1" data-testid="error-first-name">{form.formState.errors.firstName.message}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input
                    id="lastName"
                    placeholder="Enter your last name"
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
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    {...form.register("email")}
                    data-testid="input-email"
                  />
                  {form.formState.errors.email && (
                    <p className="text-destructive text-sm mt-1" data-testid="error-email">{form.formState.errors.email.message}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="phone">Phone Number *</Label>
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
                  <Select onValueChange={(value) => form.setValue("propertySize", value)} data-testid="select-property-size">
                    <SelectTrigger>
                      <SelectValue placeholder="Select size" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="studio">Studio/1 BR</SelectItem>
                      <SelectItem value="2br">2-3 Bedroom</SelectItem>
                      <SelectItem value="4br">4+ Bedroom</SelectItem>
                      <SelectItem value="office">Small Office</SelectItem>
                      <SelectItem value="large-office">Large Office</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="details">Additional Details</Label>
                <Textarea
                  id="details"
                  rows={4}
                  placeholder="Tell us more about your move... (special items, stairs, parking, etc.)"
                  {...form.register("details")}
                  data-testid="textarea-details"
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-4 text-lg font-semibold"
                disabled={submitLead.isPending}
                data-testid="button-submit-quote"
              >
                <Send className="mr-2 h-5 w-5" />
                {submitLead.isPending ? "Submitting..." : "Request Free Quote"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
