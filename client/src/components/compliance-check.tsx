import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle } from "lucide-react";

export function ComplianceCheck({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const [showComplianceModal, setShowComplianceModal] = useState(false);
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [tosAccepted, setTosAccepted] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (user && !user.tosAccepted) {
      setShowComplianceModal(true);
    }
  }, [user]);

  const complianceMutation = useMutation({
    mutationFn: async (data: { dateOfBirth: string; tosAccepted: boolean }) => {
      const res = await apiRequest("POST", "/api/auth/user/compliance", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setShowComplianceModal(false);
      toast({
        title: "Account verified",
        description: "Your account has been successfully verified.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Verification failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!dateOfBirth) {
      toast({
        title: "Date of birth required",
        description: "Please enter your date of birth.",
        variant: "destructive",
      });
      return;
    }

    if (!tosAccepted) {
      toast({
        title: "Terms of Service required",
        description: "You must accept the Terms of Service to continue.",
        variant: "destructive",
      });
      return;
    }

    complianceMutation.mutate({ dateOfBirth, tosAccepted });
  };

  if (isLoading) {
    return children;
  }

  return (
    <>
      <Dialog open={showComplianceModal} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-[425px]" data-testid="dialog-compliance">
          <DialogHeader>
            <DialogTitle data-testid="text-compliance-title">Age Verification & Terms of Service</DialogTitle>
            <DialogDescription data-testid="text-compliance-description">
              To comply with USA federal and state laws, we need to verify your age and obtain your agreement to our Terms of Service.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="dob" data-testid="label-dob">
                  Date of Birth
                </Label>
                <Input
                  id="dob"
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  required
                  data-testid="input-dob"
                />
                <p className="text-sm text-muted-foreground" data-testid="text-age-requirement">
                  You must be 18 years or older to use this service.
                </p>
              </div>

              <div className="flex items-start space-x-3 space-y-0">
                <Checkbox
                  id="tos"
                  checked={tosAccepted}
                  onCheckedChange={(checked) => setTosAccepted(checked as boolean)}
                  required
                  data-testid="checkbox-tos"
                />
                <div className="space-y-1 leading-none">
                  <Label
                    htmlFor="tos"
                    className="text-sm font-normal cursor-pointer"
                    data-testid="label-tos"
                  >
                    I am 18 years of age or older and agree to the{" "}
                    <a
                      href="/terms"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline hover:no-underline"
                      data-testid="link-terms"
                    >
                      Terms of Service
                    </a>
                  </Label>
                </div>
              </div>

              <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-md border border-amber-200 dark:border-amber-800" data-testid="alert-legal-notice">
                <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-500 mt-0.5" />
                <p className="text-sm text-amber-800 dark:text-amber-300">
                  This verification is required by federal and state laws across all 50 states.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="submit"
                disabled={complianceMutation.isPending}
                data-testid="button-submit-compliance"
              >
                {complianceMutation.isPending ? "Verifying..." : "Verify & Continue"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {children}
    </>
  );
}
