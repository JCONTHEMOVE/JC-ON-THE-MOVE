import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { X, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { type Lead, type User } from "@shared/schema";
import { z } from "zod";

const quoteFormSchema = z.object({
  status: z.string().min(1, "Status is required"),
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
  quoteNotes: z.string().optional(),
});

type QuoteFormData = z.infer<typeof quoteFormSchema>;

interface LeadQuoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead | null;
  employees: User[];
  onSave: (data: QuoteFormData & { crewMembers: string[] }) => void;
}

export function LeadQuoteDialog({ open, onOpenChange, lead, employees, onSave }: LeadQuoteDialogProps) {
  const [selectedCrewMembers, setSelectedCrewMembers] = useState<string[]>([]);

  const [selectedStatus, setSelectedStatus] = useState<string>("");

  const quoteForm = useForm<QuoteFormData>({
    resolver: zodResolver(quoteFormSchema),
    defaultValues: {
      status: "",
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
      quoteNotes: "",
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
    if (lead) {
      quoteForm.reset({
        status: lead.status || "",
        confirmedDate: lead.confirmedDate || "",
        confirmedFromAddress: lead.confirmedFromAddress || lead.fromAddress,
        confirmedToAddress: lead.confirmedToAddress || lead.toAddress || "",
        basePrice: lead.basePrice?.toString() || "",
        crewMembers: lead.crewMembers || [],
        hasHotTub: lead.hasHotTub || false,
        hotTubWeight: lead.hotTubWeight || undefined,
        hasHeavySafe: lead.hasHeavySafe || false,
        heavySafeWeight: lead.heavySafeWeight || undefined,
        hasPoolTable: lead.hasPoolTable || false,
        poolTableWeight: lead.poolTableWeight || undefined,
        hasPiano: lead.hasPiano || false,
        pianoWeight: lead.pianoWeight || undefined,
        quoteNotes: lead.quoteNotes || "",
      });
      setSelectedCrewMembers(lead.crewMembers || []);
      setSelectedStatus(lead.status || "");
    }
  }, [lead]);

  const toggleCrewMember = (employeeId: string) => {
    setSelectedCrewMembers(prev => {
      const updated = prev.includes(employeeId) 
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId];
      quoteForm.setValue("crewMembers", updated);
      return updated;
    });
  };

  const onQuoteSubmit = quoteForm.handleSubmit((data) => {
    onSave({
      ...data,
      crewMembers: selectedCrewMembers,
    });
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

  // Fetch created by user from API
  const { data: createdByUser } = useQuery<User>({
    queryKey: ["/api/users", lead?.createdByUserId],
    enabled: !!lead?.createdByUserId,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="dialog-lead-details">
        <DialogHeader>
          <DialogTitle data-testid="dialog-title">Lead Details & Quote</DialogTitle>
          <DialogDescription>
            View customer information and create/edit quote
          </DialogDescription>
        </DialogHeader>

        {lead && (
          <div className="space-y-6">
            {/* Customer Details Section */}
            <div>
              <h3 className="text-lg font-semibold mb-4" data-testid="text-customer-details-title">Customer Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-muted/50 dark:bg-muted/30 p-4 rounded-lg">
                <div>
                  <Label className="text-muted-foreground">Name</Label>
                  <p className="font-medium" data-testid="text-customer-name">
                    {lead.firstName} {lead.lastName}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Email</Label>
                  <p className="font-medium" data-testid="text-customer-email">{lead.email}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Phone</Label>
                  <p className="font-medium" data-testid="text-customer-phone">{lead.phone}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Service Type</Label>
                  <Badge className={getServiceBadgeColor(lead.serviceType)} data-testid="badge-service-type">
                    {lead.serviceType === "residential" && "Residential"}
                    {lead.serviceType === "commercial" && "Commercial"}
                    {lead.serviceType === "junk" && "Junk Removal"}
                  </Badge>
                </div>
                <div>
                  <Label className="text-muted-foreground">From Address</Label>
                  <p className="font-medium" data-testid="text-from-address">{lead.fromAddress}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">To Address</Label>
                  <p className="font-medium" data-testid="text-to-address">{lead.toAddress || "Not specified"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Move Date</Label>
                  <p className="font-medium" data-testid="text-move-date">{lead.moveDate || "Not specified"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Property Size</Label>
                  <p className="font-medium" data-testid="text-property-size">{lead.propertySize || "Not specified"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <Select
                    value={selectedStatus}
                    onValueChange={(value) => {
                      setSelectedStatus(value);
                      quoteForm.setValue("status", value);
                    }}
                  >
                    <SelectTrigger className="w-[180px]" data-testid="select-status-badge">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new" data-testid="option-status-new">
                        New
                      </SelectItem>
                      <SelectItem value="contacted" data-testid="option-status-contacted">
                        Contacted
                      </SelectItem>
                      <SelectItem value="quoted" data-testid="option-status-quoted">
                        Quoted
                      </SelectItem>
                      <SelectItem value="confirmed" data-testid="option-status-confirmed">
                        Confirmed
                      </SelectItem>
                      <SelectItem value="available" data-testid="option-status-available">
                        Available
                      </SelectItem>
                      <SelectItem value="accepted" data-testid="option-status-accepted">
                        Accepted
                      </SelectItem>
                      <SelectItem value="in_progress" data-testid="option-status-in-progress">
                        In Progress
                      </SelectItem>
                      <SelectItem value="completed" data-testid="option-status-completed">
                        Completed
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {lead.createdByUserId && (
                  <div>
                    <Label className="text-muted-foreground">Created By</Label>
                    <p className="font-medium" data-testid="text-created-by">
                      {createdByUser ? `${createdByUser.firstName} ${createdByUser.lastName}` : "Loading..."}
                    </p>
                  </div>
                )}
                {lead.details && (
                  <div className="md:col-span-2">
                    <Label className="text-muted-foreground">Additional Details</Label>
                    <p className="font-medium" data-testid="text-additional-details">{lead.details}</p>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Edit Quote Section */}
            <form onSubmit={onQuoteSubmit} className="space-y-6">
              <h3 className="text-lg font-semibold" data-testid="text-edit-quote-title">Quote & Scheduling</h3>

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

              {/* Project Notes */}
              <div>
                <Label htmlFor="quoteNotes">Project Notes</Label>
                <Textarea
                  id="quoteNotes"
                  placeholder="Add any project-specific notes, updates, or special instructions..."
                  rows={4}
                  {...quoteForm.register("quoteNotes")}
                  data-testid="textarea-quote-notes"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  These notes will be visible to the team and can be updated anytime.
                </p>
              </div>

              <div className="flex gap-4 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  data-testid="button-cancel-quote"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  data-testid="button-save-quote"
                >
                  Save Quote
                </Button>
              </div>
            </form>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
