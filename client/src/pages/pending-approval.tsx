import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Clock, Mail } from "lucide-react";

export default function PendingApprovalPage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-lg w-full" data-testid="card-pending-approval">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center">
            <Clock className="h-8 w-8 text-yellow-600 dark:text-yellow-500" data-testid="icon-pending" />
          </div>
          <CardTitle className="text-2xl" data-testid="text-title">Account Pending Approval</CardTitle>
          <CardDescription data-testid="text-description">
            Your employee account is awaiting administrator approval
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert data-testid="alert-info">
            <Mail className="h-4 w-4" />
            <AlertDescription data-testid="text-alert-description">
              Your account has been created successfully. An administrator will review and approve your account shortly.
            </AlertDescription>
          </Alert>

          <div className="bg-muted rounded-lg p-4 space-y-2" data-testid="container-account-details">
            <p className="text-sm text-muted-foreground" data-testid="text-account-info">Account Details:</p>
            <p className="font-medium" data-testid="text-user-name">{user?.firstName} {user?.lastName}</p>
            <p className="text-sm text-muted-foreground" data-testid="text-user-email">{user?.email}</p>
          </div>

          <div className="border-t pt-4 space-y-2" data-testid="container-next-steps">
            <p className="font-medium text-sm" data-testid="text-next-steps">What happens next?</p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li data-testid="text-step-1">An administrator will review your account request</li>
              <li data-testid="text-step-2">You'll receive access once approved</li>
              <li data-testid="text-step-3">You can close this page and check back later</li>
            </ul>
          </div>

          <div className="border-t pt-4 mt-4">
            <p className="text-sm font-medium text-center mb-2" data-testid="text-contact-heading">
              Need Help?
            </p>
            <p className="text-xs text-center text-muted-foreground" data-testid="text-contact-info">
              Contact: <strong>upmichiganstatemovers@gmail.com</strong>
            </p>
            <p className="text-xs text-center text-muted-foreground" data-testid="text-contact-phone">
              Phone: <strong>(906) 285-9312</strong>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
