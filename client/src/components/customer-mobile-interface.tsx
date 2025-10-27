import QuoteForm from "@/components/quote-form";

export default function CustomerMobileInterface() {
  // Removed insecure tracking feature for security
  // Customers should log in to view their quotes at the customer portal

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">JC ON THE MOVE</h1>
            <p className="text-sm text-primary-foreground/80">Professional Moving Services</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 pb-20">
        <div>
          <div className="mb-6">
            <h2 className="text-2xl font-bold mb-2">Get Your Free Quote</h2>
            <p className="text-muted-foreground mb-4">
              Tell us about your move and we'll provide you with a detailed, 
              no-obligation quote within 24 hours.
            </p>
            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm">
              <p className="text-blue-900 dark:text-blue-100">
                Already have an account? <a href="/api/login?role=customer" className="font-semibold underline">Sign in</a> to track your quotes and manage your account.
              </p>
            </div>
          </div>
          <QuoteForm />
        </div>
      </div>
    </div>
  );
}