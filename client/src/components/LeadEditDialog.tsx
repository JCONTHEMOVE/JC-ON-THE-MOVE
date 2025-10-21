import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import type { Lead, User } from "@shared/schema";
import { Home, Building, Trash2 } from "lucide-react";

const leadEditSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(1, "Phone number is required"),
  serviceType: z.enum(["residential", "commercial", "junk"]),
  fromAddress: z.string().min(1, "From address is required"),
  toAddress: z.string().optional(),
  moveDate: z.string().optional(),
  propertySize: z.string().optional(),
  details: z.string().optional(),
  status: z.string().optional(),
  confirmedDate: z.string().optional(),
  confirmedFromAddress: z.string().optional(),
  confirmedToAddress: z.string().optional(),
  basePrice: z.string().optional(),
  crewSize: z.coerce.number().optional(),
  truckConfig: z.string().optional(),
  quoteNotes: z.string().optional(),
  createdByUserId: z.string().optional(),
  hasHotTub: z.boolean().optional(),
  hotTubWeight: z.coerce.number().optional(),
  hasHeavySafe: z.boolean().optional(),
  heavySafeWeight: z.coerce.number().optional(),
  hasPoolTable: z.boolean().optional(),
  poolTableWeight: z.coerce.number().optional(),
  hasPiano: z.boolean().optional(),
  pianoWeight: z.coerce.number().optional(),
});

type LeadEditData = z.infer<typeof leadEditSchema>;

interface LeadEditDialogProps {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: any) => void;
  isPending?: boolean;
}

export function LeadEditDialog({ lead, open, onOpenChange, onSave, isPending }: LeadEditDialogProps) {
  // Fetch employees for job creator selection
  const { data: employees = [] } = useQuery<User[]>({
    queryKey: ["/api/employees"],
    enabled: open,
  });

  const form = useForm<LeadEditData>({
    resolver: zodResolver(leadEditSchema),
    defaultValues: lead ? {
      firstName: lead.firstName || "",
      lastName: lead.lastName || "",
      email: lead.email || "",
      phone: lead.phone || "",
      serviceType: lead.serviceType as "residential" | "commercial" | "junk",
      fromAddress: lead.fromAddress || "",
      toAddress: lead.toAddress || "",
      moveDate: lead.moveDate || "",
      propertySize: lead.propertySize || "",
      details: lead.details || "",
      status: lead.status || "new",
      confirmedDate: lead.confirmedDate || "",
      confirmedFromAddress: lead.confirmedFromAddress || "",
      confirmedToAddress: lead.confirmedToAddress || "",
      basePrice: lead.basePrice?.toString() || "",
      crewSize: lead.crewSize || 2,
      truckConfig: lead.truckConfig || "",
      quoteNotes: lead.quoteNotes || "",
      createdByUserId: lead.createdByUserId || "",
      hasHotTub: lead.hasHotTub || false,
      hotTubWeight: lead.hotTubWeight || undefined,
      hasHeavySafe: lead.hasHeavySafe || false,
      heavySafeWeight: lead.heavySafeWeight || undefined,
      hasPoolTable: lead.hasPoolTable || false,
      poolTableWeight: lead.poolTableWeight || undefined,
      hasPiano: lead.hasPiano || false,
      pianoWeight: lead.pianoWeight || undefined,
    } : {},
  });

  // Reset form when lead changes
  useEffect(() => {
    if (lead && open) {
      form.reset({
        firstName: lead.firstName || "",
        lastName: lead.lastName || "",
        email: lead.email || "",
        phone: lead.phone || "",
        serviceType: lead.serviceType as "residential" | "commercial" | "junk",
        fromAddress: lead.fromAddress || "",
        toAddress: lead.toAddress || "",
        moveDate: lead.moveDate || "",
        propertySize: lead.propertySize || "",
        details: lead.details || "",
        status: lead.status || "new",
        confirmedDate: lead.confirmedDate || "",
        confirmedFromAddress: lead.confirmedFromAddress || "",
        confirmedToAddress: lead.confirmedToAddress || "",
        basePrice: lead.basePrice?.toString() || "",
        crewSize: lead.crewSize || 2,
        truckConfig: lead.truckConfig || "",
        quoteNotes: lead.quoteNotes || "",
        createdByUserId: lead.createdByUserId || "",
        hasHotTub: lead.hasHotTub || false,
        hotTubWeight: lead.hotTubWeight || undefined,
        hasHeavySafe: lead.hasHeavySafe || false,
        heavySafeWeight: lead.heavySafeWeight || undefined,
        hasPoolTable: lead.hasPoolTable || false,
        poolTableWeight: lead.poolTableWeight || undefined,
        hasPiano: lead.hasPiano || false,
        pianoWeight: lead.pianoWeight || undefined,
      });
    }
  }, [lead, open, form]);

  const serviceOptions = [
    { value: "residential", label: "Residential Moving", icon: Home },
    { value: "commercial", label: "Commercial Moving", icon: Building },
    { value: "junk", label: "Junk Removal", icon: Trash2 },
  ];

  const statusOptions = [
    { value: "new", label: "New" },
    { value: "edited", label: "Edited" },
    { value: "contacted", label: "Contacted" },
    { value: "quoted", label: "Quoted" },
    { value: "confirmed", label: "Confirmed" },
    { value: "available", label: "Available" },
    { value: "accepted", label: "Accepted" },
    { value: "in_progress", label: "In Progress" },
    { value: "completed", label: "Completed" },
  ];

  const onSubmit = form.handleSubmit((data) => {
    onSave(data);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent key={lead?.id} className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Lead Details</DialogTitle>
          <DialogDescription>
            Make changes to the lead information. All fields are editable.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={onSubmit} className="space-y-6">
          {/* Customer Information */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Customer Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  {...form.register("firstName")}
                  data-testid="input-edit-first-name"
                />
                {form.formState.errors.firstName && (
                  <p className="text-destructive text-sm mt-1">{form.formState.errors.firstName.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  {...form.register("lastName")}
                  data-testid="input-edit-last-name"
                />
                {form.formState.errors.lastName && (
                  <p className="text-destructive text-sm mt-1">{form.formState.errors.lastName.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  {...form.register("email")}
                  data-testid="input-edit-email"
                />
                {form.formState.errors.email && (
                  <p className="text-destructive text-sm mt-1">{form.formState.errors.email.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="phone">Phone *</Label>
                <Input
                  id="phone"
                  {...form.register("phone")}
                  data-testid="input-edit-phone"
                />
                {form.formState.errors.phone && (
                  <p className="text-destructive text-sm mt-1">{form.formState.errors.phone.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Service Details */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Service Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="serviceType">Service Type *</Label>
                <Select 
                  onValueChange={(value) => form.setValue("serviceType", value as "residential" | "commercial" | "junk")}
                  defaultValue={form.watch("serviceType")}
                >
                  <SelectTrigger data-testid="select-edit-service-type">
                    <SelectValue placeholder="Select service type" />
                  </SelectTrigger>
                  <SelectContent>
                    {serviceOptions.map((service) => (
                      <SelectItem key={service.value} value={service.value}>
                        {service.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="status">Status</Label>
                <Select 
                  onValueChange={(value) => form.setValue("status", value)}
                  defaultValue={form.watch("status")}
                >
                  <SelectTrigger data-testid="select-edit-status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="moveDate">Move Date</Label>
                <Input
                  id="moveDate"
                  type="date"
                  {...form.register("moveDate")}
                  data-testid="input-edit-move-date"
                />
              </div>
              <div>
                <Label htmlFor="propertySize">Property Size</Label>
                <Input
                  id="propertySize"
                  {...form.register("propertySize")}
                  placeholder="e.g., 2 bedroom apartment"
                  data-testid="input-edit-property-size"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="fromAddress">From Address *</Label>
              <Input
                id="fromAddress"
                {...form.register("fromAddress")}
                data-testid="input-edit-from-address"
              />
            </div>

            <div>
              <Label htmlFor="toAddress">To Address</Label>
              <Input
                id="toAddress"
                {...form.register("toAddress")}
                data-testid="input-edit-to-address"
              />
            </div>

            <div>
              <Label htmlFor="details">Additional Details</Label>
              <Textarea
                id="details"
                {...form.register("details")}
                placeholder="Any special requirements or notes..."
                rows={3}
                data-testid="textarea-edit-details"
              />
            </div>
          </div>

          {/* Quote Information */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Quote Information</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="confirmedDate">Confirmed Date</Label>
                <Input
                  id="confirmedDate"
                  type="date"
                  {...form.register("confirmedDate")}
                  data-testid="input-edit-confirmed-date"
                />
              </div>
              <div>
                <Label htmlFor="basePrice">Base Price ($)</Label>
                <Input
                  id="basePrice"
                  type="number"
                  step="0.01"
                  {...form.register("basePrice")}
                  data-testid="input-edit-base-price"
                />
              </div>
              <div>
                <Label htmlFor="crewSize">Crew Size</Label>
                <Input
                  id="crewSize"
                  type="number"
                  {...form.register("crewSize", { valueAsNumber: true })}
                  data-testid="input-edit-crew-size"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="createdByUserId">Job Creator (for bonus rewards)</Label>
              <Select 
                onValueChange={(value) => form.setValue("createdByUserId", value, { shouldDirty: true })}
                value={form.watch("createdByUserId") || ""}
              >
                <SelectTrigger data-testid="select-edit-job-creator">
                  <SelectValue placeholder="Select employee who created this job" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {employees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.username || employee.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground mt-1">
                Creator earns 50% bonus when other employees complete this job
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="confirmedFromAddress">Confirmed From Address</Label>
                <Input
                  id="confirmedFromAddress"
                  {...form.register("confirmedFromAddress")}
                  data-testid="input-edit-confirmed-from"
                />
              </div>
              <div>
                <Label htmlFor="confirmedToAddress">Confirmed To Address</Label>
                <Input
                  id="confirmedToAddress"
                  {...form.register("confirmedToAddress")}
                  data-testid="input-edit-confirmed-to"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="truckConfig">Truck Configuration</Label>
              <Select 
                onValueChange={(value) => form.setValue("truckConfig", value)}
                defaultValue={form.watch("truckConfig")}
              >
                <SelectTrigger data-testid="select-edit-truck-config">
                  <SelectValue placeholder="Select truck config" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer_truck">Customer's Truck</SelectItem>
                  <SelectItem value="company_truck">Company Truck</SelectItem>
                  <SelectItem value="no_truck">No Truck Needed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="quoteNotes">Quote Notes</Label>
              <Textarea
                id="quoteNotes"
                {...form.register("quoteNotes")}
                placeholder="Internal notes about the quote..."
                rows={2}
                data-testid="textarea-edit-quote-notes"
              />
            </div>
          </div>

          {/* Special Items */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Special Items</h3>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="hasHotTub"
                    checked={form.watch("hasHotTub")}
                    onCheckedChange={(checked) => form.setValue("hasHotTub", checked as boolean)}
                    data-testid="checkbox-edit-hot-tub"
                  />
                  <Label htmlFor="hasHotTub">Hot Tub</Label>
                </div>
                {form.watch("hasHotTub") && (
                  <Input
                    type="number"
                    placeholder="Weight (lbs)"
                    {...form.register("hotTubWeight", { valueAsNumber: true })}
                    data-testid="input-edit-hot-tub-weight"
                  />
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="hasHeavySafe"
                    checked={form.watch("hasHeavySafe")}
                    onCheckedChange={(checked) => form.setValue("hasHeavySafe", checked as boolean)}
                    data-testid="checkbox-edit-heavy-safe"
                  />
                  <Label htmlFor="hasHeavySafe">Heavy Safe</Label>
                </div>
                {form.watch("hasHeavySafe") && (
                  <Input
                    type="number"
                    placeholder="Weight (lbs)"
                    {...form.register("heavySafeWeight", { valueAsNumber: true })}
                    data-testid="input-edit-safe-weight"
                  />
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="hasPoolTable"
                    checked={form.watch("hasPoolTable")}
                    onCheckedChange={(checked) => form.setValue("hasPoolTable", checked as boolean)}
                    data-testid="checkbox-edit-pool-table"
                  />
                  <Label htmlFor="hasPoolTable">Pool Table</Label>
                </div>
                {form.watch("hasPoolTable") && (
                  <Input
                    type="number"
                    placeholder="Weight (lbs)"
                    {...form.register("poolTableWeight", { valueAsNumber: true })}
                    data-testid="input-edit-pool-table-weight"
                  />
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="hasPiano"
                    checked={form.watch("hasPiano")}
                    onCheckedChange={(checked) => form.setValue("hasPiano", checked as boolean)}
                    data-testid="checkbox-edit-piano"
                  />
                  <Label htmlFor="hasPiano">Piano</Label>
                </div>
                {form.watch("hasPiano") && (
                  <Input
                    type="number"
                    placeholder="Weight (lbs)"
                    {...form.register("pianoWeight", { valueAsNumber: true })}
                    data-testid="input-edit-piano-weight"
                  />
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={isPending}
              data-testid="button-cancel-edit"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isPending}
              data-testid="button-save-edit"
            >
              {isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
