import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "wouter";
import { type Lead, type User } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Users, ClipboardList, CheckCircle, DollarSign, Eye, Mail, Phone, UserCheck, Briefcase, Clock, UserPlus, Wallet, TrendingUp, AlertTriangle, Activity, PiggyBank } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import MobileLeadManager from "@/components/mobile-lead-manager";

// Employee Dashboard Component
function EmployeeDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const { data: availableJobs = [], isLoading: availableLoading } = useQuery<Lead[]>({
    queryKey: ["/api/leads/available"],
  });

  const { data: myJobs = [], isLoading: myJobsLoading } = useQuery<Lead[]>({
    queryKey: ["/api/leads/my-jobs"],
  });

  const acceptJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const response = await apiRequest("POST", `/api/leads/${jobId}/accept`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads/available"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads/my-jobs"] });
      toast({
        title: "Job accepted",
        description: "You have successfully accepted this job.",
      });
    },
    onError: (error: Error) => {
      // Don't show error messages for authentication failures
      if (error.message.includes('401')) return;
      
      toast({
        title: "Error",
        description: "Failed to accept job. It may have been assigned to another employee.",
        variant: "destructive",
      });
    },
  });

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "accepted":
        return "default";
      case "in_progress":
        return "secondary";
      case "completed":
        return "default";
      default:
        return "secondary";
    }
  };

  if (availableLoading || myJobsLoading) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          <p className="mt-4 text-muted-foreground">Loading employee dashboard...</p>
        </div>
      </div>
    );
  }

  // Return mobile interface for mobile devices
  if (isMobile) {
    return <MobileLeadManager />;
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-foreground">Employee Dashboard</h1>
            <Link href="/" data-testid="link-back-to-site">
              <Button variant="outline" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Site
              </Button>
            </Link>
          </div>
          <p className="text-muted-foreground mt-2">View and accept available jobs</p>
        </div>

        <Tabs defaultValue="available" className="space-y-8">
          <TabsList data-testid="employee-dashboard-tabs">
            <TabsTrigger value="available">Available Jobs</TabsTrigger>
            <TabsTrigger value="my-jobs">My Jobs</TabsTrigger>
          </TabsList>

          <TabsContent value="available">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5" />
                  Available Jobs ({availableJobs.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {availableJobs.length === 0 ? (
                  <div className="text-center py-12">
                    <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No jobs available at this time.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {availableJobs.map((job) => (
                      <Card key={job.id} className="border" data-testid={`available-job-${job.id}`}>
                        <CardContent className="p-6">
                          <div className="flex justify-between items-start">
                            <div className="space-y-2 flex-1">
                              <div className="flex items-center gap-3">
                                <h3 className="font-semibold text-lg">
                                  {job.firstName} {job.lastName}
                                </h3>
                                <Badge className={getServiceBadgeColor(job.serviceType)}>
                                  {job.serviceType === "residential" && "Residential"}
                                  {job.serviceType === "commercial" && "Commercial"}
                                  {job.serviceType === "junk" && "Junk Removal"}
                                </Badge>
                              </div>
                              <div className="text-sm text-muted-foreground">
                                <p>📧 {job.email} • 📞 {job.phone}</p>
                                <p>📅 Move Date: {job.moveDate || "Not specified"}</p>
                                <p>📍 From: {job.fromAddress}</p>
                                {job.toAddress && <p>📍 To: {job.toAddress}</p>}
                                {job.details && <p>💬 {job.details}</p>}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Posted: {new Date(job.createdAt).toLocaleString()}
                              </p>
                            </div>
                            <Button 
                              onClick={() => acceptJobMutation.mutate(job.id)}
                              disabled={acceptJobMutation.isPending}
                              data-testid={`accept-job-${job.id}`}
                              className="ml-4"
                            >
                              {acceptJobMutation.isPending ? "Accepting..." : "Accept Job"}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="my-jobs">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5" />
                  My Jobs ({myJobs.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {myJobs.length === 0 ? (
                  <div className="text-center py-12">
                    <Briefcase className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">You haven't accepted any jobs yet.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {myJobs.map((job) => (
                      <Card key={job.id} className="border" data-testid={`my-job-${job.id}`}>
                        <CardContent className="p-6">
                          <div className="flex justify-between items-start">
                            <div className="space-y-2 flex-1">
                              <div className="flex items-center gap-3">
                                <h3 className="font-semibold text-lg">
                                  {job.firstName} {job.lastName}
                                </h3>
                                <Badge variant={getStatusBadgeVariant(job.status)}>
                                  {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                                </Badge>
                                <Badge className={getServiceBadgeColor(job.serviceType)}>
                                  {job.serviceType === "residential" && "Residential"}
                                  {job.serviceType === "commercial" && "Commercial"}
                                  {job.serviceType === "junk" && "Junk Removal"}
                                </Badge>
                              </div>
                              <div className="text-sm text-muted-foreground">
                                <p>📧 {job.email} • 📞 {job.phone}</p>
                                <p>📅 Move Date: {job.moveDate || "Not specified"}</p>
                                <p>📍 From: {job.fromAddress}</p>
                                {job.toAddress && <p>📍 To: {job.toAddress}</p>}
                                {job.details && <p>💬 {job.details}</p>}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Accepted: {new Date(job.createdAt).toLocaleString()}
                              </p>
                            </div>
                            <div className="flex gap-2 ml-4">
                              <Button variant="ghost" size="sm" asChild>
                                <a href={`mailto:${job.email}`}>
                                  <Mail className="h-4 w-4" />
                                </a>
                              </Button>
                              <Button variant="ghost" size="sm" asChild>
                                <a href={`tel:${job.phone}`}>
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
        </Tabs>
      </div>
    </div>
  );
}

// Business Owner Dashboard Component  
function BusinessOwnerDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [serviceFilter, setServiceFilter] = useState<string>("all");

  const { data: leads = [], isLoading: leadsLoading } = useQuery<Lead[]>({
    queryKey: ["/api/leads"],
  });

  const { data: employees = [], isLoading: employeesLoading } = useQuery<User[]>({
    queryKey: ["/api/employees"],
  });

  // Treasury data
  const { data: treasuryStatus, isLoading: treasuryLoading } = useQuery({
    queryKey: ["/api/treasury/status"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: depositsData, isLoading: depositsLoading } = useQuery({
    queryKey: ["/api/treasury/deposits"],
    refetchInterval: 30000,
  });

  const { data: transactionsData, isLoading: transactionsLoading } = useQuery({
    queryKey: ["/api/treasury/transactions"],
    refetchInterval: 30000,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await apiRequest("PATCH", `/api/leads/${id}/status`, { status });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      toast({
        title: "Status updated",
        description: "Lead status has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      // Don't show error messages for authentication failures
      if (error.message.includes('401')) return;
      
      toast({
        title: "Error",
        description: "Failed to update lead status.",
        variant: "destructive",
      });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      const response = await apiRequest("PATCH", `/api/employees/${id}/role`, { role });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      toast({
        title: "Role updated",
        description: "Employee role has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      // Don't show error messages for authentication failures
      if (error.message.includes('401')) return;
      
      toast({
        title: "Error",
        description: "Failed to update employee role.",
        variant: "destructive",
      });
    },
  });

  const filteredLeads = leads.filter((lead) => {
    if (statusFilter && statusFilter !== "all" && lead.status !== statusFilter) return false;
    if (serviceFilter && serviceFilter !== "all" && lead.serviceType !== serviceFilter) return false;
    return true;
  });

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "new":
        return "secondary";
      case "contacted":
        return "outline";
      case "quoted":
        return "default";
      case "confirmed":
        return "default";
      case "accepted":
        return "default";
      default:
        return "secondary";
    }
  };

  const stats = {
    newLeads: leads.filter(lead => lead.status === "new").length,
    pendingQuotes: leads.filter(lead => lead.status === "contacted").length,
    confirmedJobs: leads.filter(lead => lead.status === "confirmed").length,
    totalEmployees: employees.length,
  };

  // Treasury stats
  const treasuryStats = treasuryStatus?.stats || {};
  const recentDeposits = depositsData?.deposits?.slice(0, 5) || [];
  const recentTransactions = transactionsData?.transactions?.slice(0, 5) || [];

  if (leadsLoading || employeesLoading) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          <p className="mt-4 text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-foreground">Business Owner Dashboard</h1>
            <Link href="/" data-testid="link-back-to-site">
              <Button variant="outline" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Site
              </Button>
            </Link>
          </div>
          <p className="text-muted-foreground mt-2">Manage leads, employees, and business operations</p>
        </div>

        {/* Business Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card data-testid="stat-new-leads">
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="bg-primary text-primary-foreground p-3 rounded-lg">
                  <Users className="h-6 w-6" />
                </div>
                <div className="ml-4">
                  <p className="text-2xl font-bold text-foreground">{stats.newLeads}</p>
                  <p className="text-muted-foreground">New Leads</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card data-testid="stat-pending-quotes">
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="bg-secondary text-secondary-foreground p-3 rounded-lg">
                  <ClipboardList className="h-6 w-6" />
                </div>
                <div className="ml-4">
                  <p className="text-2xl font-bold text-foreground">{stats.pendingQuotes}</p>
                  <p className="text-muted-foreground">Pending Quotes</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card data-testid="stat-confirmed-jobs">
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="bg-green-500 text-white p-3 rounded-lg">
                  <CheckCircle className="h-6 w-6" />
                </div>
                <div className="ml-4">
                  <p className="text-2xl font-bold text-foreground">{stats.confirmedJobs}</p>
                  <p className="text-muted-foreground">Confirmed Jobs</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card data-testid="stat-employees">
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="bg-blue-500 text-white p-3 rounded-lg">
                  <UserPlus className="h-6 w-6" />
                </div>
                <div className="ml-4">
                  <p className="text-2xl font-bold text-foreground">{stats.totalEmployees}</p>
                  <p className="text-muted-foreground">Employees</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Treasury Stats Cards */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-foreground mb-4 flex items-center gap-2">
            <Wallet className="h-6 w-6" />
            Treasury Overview
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card data-testid="treasury-available-funding">
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="bg-green-500 text-white p-3 rounded-lg">
                    <DollarSign className="h-6 w-6" />
                  </div>
                  <div className="ml-4">
                    <p className="text-2xl font-bold text-foreground">
                      ${parseFloat(treasuryStats.availableFunding || '0').toFixed(2)}
                    </p>
                    <p className="text-muted-foreground">Available Funding</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card data-testid="treasury-token-reserve">
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="bg-purple-500 text-white p-3 rounded-lg">
                    <PiggyBank className="h-6 w-6" />
                  </div>
                  <div className="ml-4">
                    <p className="text-2xl font-bold text-foreground">
                      {parseFloat(treasuryStats.tokenReserve || '0').toFixed(0)}
                    </p>
                    <p className="text-muted-foreground">JC MOVES Tokens</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card data-testid="treasury-total-funding">
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="bg-blue-500 text-white p-3 rounded-lg">
                    <TrendingUp className="h-6 w-6" />
                  </div>
                  <div className="ml-4">
                    <p className="text-2xl font-bold text-foreground">
                      ${parseFloat(treasuryStats.totalFunding || '0').toFixed(2)}
                    </p>
                    <p className="text-muted-foreground">Total Funding</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card data-testid="treasury-distributed">
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="bg-orange-500 text-white p-3 rounded-lg">
                    <Activity className="h-6 w-6" />
                  </div>
                  <div className="ml-4">
                    <p className="text-2xl font-bold text-foreground">
                      ${parseFloat(treasuryStats.totalDistributed || '0').toFixed(2)}
                    </p>
                    <p className="text-muted-foreground">Total Distributed</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Treasury Health Status */}
          {treasuryStatus?.health && (
            <div className="mt-4">
              <Card data-testid="treasury-health">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        treasuryStatus.health.status === 'healthy' ? 'bg-green-100 dark:bg-green-900/20' :
                        treasuryStatus.health.status === 'warning' ? 'bg-yellow-100 dark:bg-yellow-900/20' :
                        'bg-red-100 dark:bg-red-900/20'
                      }`}>
                        <AlertTriangle className={`h-5 w-5 ${
                          treasuryStatus.health.status === 'healthy' ? 'text-green-600 dark:text-green-400' :
                          treasuryStatus.health.status === 'warning' ? 'text-yellow-600 dark:text-yellow-400' :
                          'text-red-600 dark:text-red-400'
                        }`} />
                      </div>
                      <div>
                        <h3 className="font-semibold">Treasury Health: {treasuryStatus.health.status}</h3>
                        <p className="text-sm text-muted-foreground">{treasuryStatus.health.message}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Link href="/admin-moonshot">
                        <Button data-testid="button-add-funding">Add Funding</Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        <Tabs defaultValue="leads" className="space-y-8">
          <TabsList data-testid="dashboard-tabs">
            <TabsTrigger value="leads">Lead Management</TabsTrigger>
            <TabsTrigger value="employees">Employee Management</TabsTrigger>
            <TabsTrigger value="treasury">Treasury Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="leads">
            {/* Lead Management Table */}
            <Card className="shadow-sm" data-testid="leads-table">
              <CardContent className="p-0">
                <div className="p-6 border-b border-border">
                  <div className="flex justify-between items-center">
                    <h2 className="text-xl font-semibold text-foreground">Recent Leads</h2>
                    <div className="flex space-x-2">
                      <Select value={serviceFilter} onValueChange={setServiceFilter} data-testid="filter-service">
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder="All Services" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Services</SelectItem>
                          <SelectItem value="residential">Residential Moving</SelectItem>
                          <SelectItem value="commercial">Commercial Moving</SelectItem>
                          <SelectItem value="junk">Junk Removal</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={statusFilter} onValueChange={setStatusFilter} data-testid="filter-status">
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder="All Statuses" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Statuses</SelectItem>
                          <SelectItem value="new">New</SelectItem>
                          <SelectItem value="contacted">Contacted</SelectItem>
                          <SelectItem value="quoted">Quoted</SelectItem>
                          <SelectItem value="confirmed">Confirmed</SelectItem>
                          <SelectItem value="accepted">Accepted</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Customer</th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Service</th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Date</th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Assigned To</th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-card divide-y divide-border">
                      {filteredLeads.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground" data-testid="no-leads">
                            No leads found matching the current filters.
                          </td>
                        </tr>
                      ) : (
                        filteredLeads.map((lead) => (
                          <tr key={lead.id} data-testid={`lead-row-${lead.id}`}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div>
                                  <div className="text-sm font-medium text-foreground">
                                    {lead.firstName} {lead.lastName}
                                  </div>
                                  <div className="text-sm text-muted-foreground">{lead.email}</div>
                                  <div className="text-sm text-muted-foreground">{lead.phone}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <Badge className={getServiceBadgeColor(lead.serviceType)} data-testid={`service-badge-${lead.id}`}>
                                {lead.serviceType === "residential" && "Residential Moving"}
                                {lead.serviceType === "commercial" && "Commercial Moving"}
                                {lead.serviceType === "junk" && "Junk Removal"}
                              </Badge>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                              {new Date(lead.createdAt).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <Select
                                value={lead.status}
                                onValueChange={(value) => updateStatusMutation.mutate({ id: lead.id, status: value })}
                                data-testid={`status-select-${lead.id}`}
                              >
                                <SelectTrigger className="w-32">
                                  <SelectValue>
                                    <Badge variant={getStatusBadgeVariant(lead.status)}>
                                      {lead.status.charAt(0).toUpperCase() + lead.status.slice(1)}
                                    </Badge>
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="new">New</SelectItem>
                                  <SelectItem value="contacted">Contacted</SelectItem>
                                  <SelectItem value="quoted">Quoted</SelectItem>
                                  <SelectItem value="confirmed">Confirmed</SelectItem>
                                  <SelectItem value="accepted">Accepted</SelectItem>
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <div className="flex space-x-2">
                                <Button variant="ghost" size="sm" data-testid={`view-button-${lead.id}`}>
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
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                
                {filteredLeads.length > 0 && (
                  <div className="px-6 py-4 border-t border-border">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground" data-testid="pagination-info">
                        Showing 1 to {filteredLeads.length} of {leads.length} results
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="employees">
            {/* Employee Management */}
            <Card className="shadow-sm" data-testid="employees-table">
              <CardContent className="p-0">
                <div className="p-6 border-b border-border">
                  <h2 className="text-xl font-semibold text-foreground">Employee Management</h2>
                  <p className="text-sm text-muted-foreground mt-1">Manage employee roles and permissions</p>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Employee</th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Role</th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Joined</th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-card divide-y divide-border">
                      {employees.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground" data-testid="no-employees">
                            No employees found. Employees will appear here once they log in.
                          </td>
                        </tr>
                      ) : (
                        employees.map((employee) => (
                          <tr key={employee.id} data-testid={`employee-row-${employee.id}`}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div>
                                  <div className="text-sm font-medium text-foreground">
                                    {employee.firstName} {employee.lastName}
                                  </div>
                                  <div className="text-sm text-muted-foreground">{employee.email}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <Select
                                value={employee.role}
                                onValueChange={(value) => updateRoleMutation.mutate({ id: employee.id, role: value })}
                                data-testid={`role-select-${employee.id}`}
                              >
                                <SelectTrigger className="w-40">
                                  <SelectValue>
                                    <Badge variant={(employee.role === 'business_owner' || employee.role === 'admin') ? 'default' : 'secondary'}>
                                      {employee.role === 'business_owner' ? 'Owner' : employee.role === 'admin' ? 'Admin' : 'Employee'}
                                    </Badge>
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="employee">Employee</SelectItem>
                                  <SelectItem value="business_owner">Business Owner</SelectItem>
                                  <SelectItem value="admin">Administrator</SelectItem>
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                              {employee.createdAt ? new Date(employee.createdAt).toLocaleDateString() : 'Unknown'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <Button variant="ghost" size="sm" asChild data-testid={`email-employee-${employee.id}`}>
                                <a href={`mailto:${employee.email}`}>
                                  <Mail className="h-4 w-4" />
                                </a>
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="treasury">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Recent Deposits */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Recent Deposits
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {depositsLoading ? (
                    <div className="space-y-3">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="w-3/4 h-4 bg-muted rounded animate-pulse"></div>
                          <div className="w-1/4 h-4 bg-muted rounded animate-pulse"></div>
                        </div>
                      ))}
                    </div>
                  ) : recentDeposits.length > 0 ? (
                    <div className="space-y-3">
                      {recentDeposits.map((deposit: any) => (
                        <div key={deposit.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`deposit-${deposit.id}`}>
                          <div>
                            <p className="font-medium">${parseFloat(deposit.depositAmount).toFixed(2)}</p>
                            <p className="text-sm text-muted-foreground">
                              {deposit.depositMethod} • {new Date(deposit.createdAt).toLocaleDateString()}
                            </p>
                            {deposit.notes && (
                              <p className="text-xs text-muted-foreground">{deposit.notes}</p>
                            )}
                          </div>
                          <Badge variant="outline">{deposit.status}</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <DollarSign className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">No recent deposits</p>
                    </div>
                  )}
                  <div className="mt-4 text-center">
                    <Link href="/admin-moonshot">
                      <Button variant="outline" size="sm" data-testid="button-view-all-deposits">
                        Add Moonshot Funding
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>

              {/* Recent Transactions */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Recent Transactions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {transactionsLoading ? (
                    <div className="space-y-3">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="w-3/4 h-4 bg-muted rounded animate-pulse"></div>
                          <div className="w-1/4 h-4 bg-muted rounded animate-pulse"></div>
                        </div>
                      ))}
                    </div>
                  ) : recentTransactions.length > 0 ? (
                    <div className="space-y-3">
                      {recentTransactions.map((transaction: any) => (
                        <div key={transaction.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`transaction-${transaction.id}`}>
                          <div>
                            <p className="font-medium">{transaction.description}</p>
                            <p className="text-sm text-muted-foreground">
                              {new Date(transaction.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">{transaction.tokenAmount} tokens</p>
                            <p className="text-sm text-muted-foreground">${parseFloat(transaction.cashValue).toFixed(2)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">No recent transactions</p>
                    </div>
                  )}
                  <div className="mt-4 text-center">
                    <Link href="/treasury">
                      <Button variant="outline" size="sm" data-testid="button-view-all-transactions">
                        View Full Treasury
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// Helper function
function getServiceBadgeColor(serviceType: string) {
  switch (serviceType) {
    case "residential":
      return "bg-primary/10 text-primary";
    case "commercial":
      return "bg-secondary/10 text-secondary";
    case "junk":
      return "bg-green-100 text-green-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

// Main Dashboard Component
export default function Dashboard() {
  const { hasAdminAccess, isEmployee, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          <p className="mt-4 text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (hasAdminAccess) {
    return <BusinessOwnerDashboard />;
  }

  if (isEmployee) {
    return <EmployeeDashboard />;
  }

  // Default fallback (shouldn't happen with proper authentication)
  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-foreground mb-4">Access Denied</h1>
        <p className="text-muted-foreground">You don't have permission to access this dashboard.</p>
        <Link href="/">
          <Button className="mt-4">Return Home</Button>
        </Link>
      </div>
    </div>
  );
}