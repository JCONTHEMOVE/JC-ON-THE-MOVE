import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "wouter";
import { type Lead } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Users, ClipboardList, CheckCircle, DollarSign, Eye, Mail, Phone } from "lucide-react";

export default function Dashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [serviceFilter, setServiceFilter] = useState<string>("");

  const { data: leads = [], isLoading } = useQuery<Lead[]>({
    queryKey: ["/api/leads"],
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
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update lead status.",
        variant: "destructive",
      });
    },
  });

  const filteredLeads = leads.filter((lead) => {
    if (statusFilter && lead.status !== statusFilter) return false;
    if (serviceFilter && lead.serviceType !== serviceFilter) return false;
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
      default:
        return "secondary";
    }
  };

  const getServiceBadgeColor = (serviceType: string) => {
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
  };

  const stats = {
    newLeads: leads.filter(lead => lead.status === "new").length,
    pendingQuotes: leads.filter(lead => lead.status === "contacted").length,
    confirmedJobs: leads.filter(lead => lead.status === "confirmed").length,
    totalRevenue: 18450, // This would be calculated from actual data
  };

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

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-foreground">Lead Management Dashboard</h1>
            <Link href="/" data-testid="link-back-to-site">
              <Button variant="outline" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Site
              </Button>
            </Link>
          </div>
          <p className="text-muted-foreground mt-2">Manage and track all customer inquiries and quote requests</p>
        </div>

        {/* Stats Cards */}
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
          
          <Card data-testid="stat-revenue">
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="bg-yellow-500 text-white p-3 rounded-lg">
                  <DollarSign className="h-6 w-6" />
                </div>
                <div className="ml-4">
                  <p className="text-2xl font-bold text-foreground">${stats.totalRevenue.toLocaleString()}</p>
                  <p className="text-muted-foreground">Revenue</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

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
                      <SelectItem value="">All Services</SelectItem>
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
                      <SelectItem value="">All Statuses</SelectItem>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="contacted">Contacted</SelectItem>
                      <SelectItem value="quoted">Quoted</SelectItem>
                      <SelectItem value="confirmed">Confirmed</SelectItem>
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
                    <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-card divide-y divide-border">
                  {filteredLeads.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground" data-testid="no-leads">
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
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              data-testid={`view-button-${lead.id}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              asChild
                              data-testid={`email-button-${lead.id}`}
                            >
                              <a href={`mailto:${lead.email}`}>
                                <Mail className="h-4 w-4" />
                              </a>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              asChild
                              data-testid={`phone-button-${lead.id}`}
                            >
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
      </div>
    </div>
  );
}
