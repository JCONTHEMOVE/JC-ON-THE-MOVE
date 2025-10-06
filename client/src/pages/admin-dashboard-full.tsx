import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  FileText, 
  DollarSign, 
  Settings, 
  BarChart3, 
  Shield, 
  UserCog,
  Activity,
  TrendingUp,
  Clock,
  CheckCircle,
  Building2,
  Briefcase,
  X,
  ChevronRight,
  Home
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Link, useLocation } from "wouter";

interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  serviceType: string;
  status: string;
  createdAt: string;
  assignedToUserId?: string;
  estimatedValue?: number;
}

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  createdAt: string;
  referralCount: number;
}

interface AdminStats {
  totalUsers: number;
  totalLeads: number;
  activeJobs: number;
  monthlyRevenue: number;
  completedJobs: number;
  pendingLeads: number;
}

const navigationItems = [
  { id: "overview", label: "Overview", icon: Home },
  { id: "leads", label: "Leads", icon: FileText },
  { id: "employees", label: "Employees", icon: UserCog },
  { id: "treasury", label: "Treasury", icon: DollarSign },
  { id: "more", label: "More", icon: Settings },
];

export default function AdminDashboardFull() {
  const { hasAdminAccess, isLoading: authLoading } = useAuth();
  const [activeSection, setActiveSection] = useState("overview");
  const [, navigate] = useLocation();

  // Data queries
  const { data: leads, isLoading: leadsLoading } = useQuery<Lead[]>({
    queryKey: ["/api/admin/leads"],
    enabled: !!hasAdminAccess,
  });

  const { data: users, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    enabled: !!hasAdminAccess,
  });

  const { data: stats, isLoading: statsLoading } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
    enabled: !!hasAdminAccess,
  });

  // Employee approval queries
  const { data: pendingEmployees, isLoading: pendingLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/employees/pending"],
    enabled: !!hasAdminAccess && activeSection === 'employees',
  });

  const { data: approvedEmployees, isLoading: approvedLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/employees/approved"],
    enabled: !!hasAdminAccess && activeSection === 'employees',
  });

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!hasAdminAccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="bg-destructive/10 rounded-lg p-6 mb-4">
            <Shield className="h-12 w-12 text-destructive mx-auto mb-3" />
            <h2 className="text-xl font-semibold text-destructive mb-2">Access Denied</h2>
            <p className="text-muted-foreground mb-4">
              Administrator privileges required
            </p>
          </div>
          <Link href="/">
            <Button variant="outline" data-testid="button-back-to-main">
              Back to Main
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const handleApprove = async (employeeId: string, approved: boolean) => {
    try {
      const response = await fetch(`/api/admin/employees/${employeeId}/approve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved }),
      });
      
      if (response.ok) {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/employees/pending"] });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/employees/approved"] });
      }
    } catch (error) {
      console.error('Error updating employee approval:', error);
    }
  };

  const renderOverview = () => (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">{stats?.totalUsers || 0}</div>
            <p className="text-xs text-blue-700 dark:text-blue-300">Total Users</p>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <FileText className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div className="text-2xl font-bold text-green-900 dark:text-green-100">{stats?.totalLeads || 0}</div>
            <p className="text-xs text-green-700 dark:text-green-300">Leads</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Briefcase className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">{stats?.activeJobs || 0}</div>
            <p className="text-xs text-purple-700 dark:text-purple-300">Active Jobs</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900 border-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <DollarSign className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-amber-900 dark:text-amber-100">${(stats?.monthlyRevenue || 0).toLocaleString()}</div>
            <p className="text-xs text-amber-700 dark:text-amber-300">Revenue</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Recent Leads</CardTitle>
          <CardDescription>Latest customer inquiries</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {leads?.slice(0, 5).map((lead) => (
            <div 
              key={lead.id} 
              className="flex items-center justify-between p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors"
              onClick={() => navigate(`/job/${lead.id}`)}
              data-testid={`lead-card-${lead.id}`}
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{lead.firstName} {lead.lastName}</p>
                <p className="text-sm text-muted-foreground truncate">{lead.serviceType}</p>
              </div>
              <div className="flex items-center gap-2 ml-2">
                <Badge variant={lead.status === 'new' ? 'default' : 'secondary'} className="text-xs">
                  {lead.status}
                </Badge>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* System Status */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">System Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm">Database</span>
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400">
              <CheckCircle className="h-3 w-3 mr-1" />
              Healthy
            </Badge>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm">Email Service</span>
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400">
              <CheckCircle className="h-3 w-3 mr-1" />
              Active
            </Badge>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm">Treasury</span>
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400">
              <CheckCircle className="h-3 w-3 mr-1" />
              Online
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderLeads = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Lead Management</h2>
        <Button size="sm" data-testid="button-export-leads">Export</Button>
      </div>
      
      <div className="space-y-3">
        {leadsLoading ? (
          <div className="text-center py-8">Loading...</div>
        ) : (
          leads?.map((lead) => (
            <Card 
              key={lead.id} 
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(`/job/${lead.id}`)}
              data-testid={`lead-card-${lead.id}`}
            >
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-lg">{lead.firstName} {lead.lastName}</p>
                    <p className="text-sm text-muted-foreground truncate">{lead.email}</p>
                  </div>
                  <Badge variant={lead.status === 'new' ? 'default' : 'secondary'}>
                    {lead.status}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{lead.serviceType}</span>
                  <div className="flex items-center gap-2">
                    {lead.estimatedValue && (
                      <Badge variant="outline">${lead.estimatedValue}</Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {new Date(lead.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );

  const renderEmployees = () => (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Employee Management</h2>
      
      {/* Pending Approvals */}
      {pendingEmployees && pendingEmployees.length > 0 && (
        <Card className="border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              Pending Approvals
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingEmployees.map((employee) => (
              <div key={employee.id} className="bg-background p-3 rounded-lg" data-testid={`pending-employee-${employee.id}`}>
                <div className="mb-3">
                  <p className="font-medium" data-testid={`text-employee-name-${employee.id}`}>
                    {employee.firstName} {employee.lastName}
                  </p>
                  <p className="text-sm text-muted-foreground" data-testid={`text-employee-email-${employee.id}`}>
                    {employee.email}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    className="flex-1"
                    onClick={() => handleApprove(employee.id, true)}
                    data-testid={`button-approve-${employee.id}`}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Approve
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="flex-1"
                    onClick={() => handleApprove(employee.id, false)}
                    data-testid={`button-reject-${employee.id}`}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      
      {/* Approved Employees */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Approved Employees</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {approvedEmployees?.map((employee) => (
            <div 
              key={employee.id} 
              className="flex justify-between items-center p-3 bg-muted/50 rounded-lg" 
              data-testid={`approved-employee-${employee.id}`}
            >
              <div>
                <p className="font-medium">{employee.firstName} {employee.lastName}</p>
                <p className="text-sm text-muted-foreground">{employee.email}</p>
              </div>
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400">
                <CheckCircle className="h-3 w-3 mr-1" />
                Active
              </Badge>
            </div>
          ))}
          {(!approvedEmployees || approvedEmployees.length === 0) && (
            <p className="text-sm text-muted-foreground text-center py-4">No approved employees</p>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const renderTreasury = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Treasury</h2>
        <Button asChild size="sm" data-testid="button-full-treasury">
          <Link href="/treasury">Open Full</Link>
        </Button>
      </div>
      
      <div className="grid gap-3">
        <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900 border-0">
          <CardContent className="p-4">
            <div className="text-sm text-emerald-700 dark:text-emerald-300 mb-1">Total Balance</div>
            <div className="text-3xl font-bold text-emerald-900 dark:text-emerald-100">$45,231.80</div>
            <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-1">+2.5% from last month</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground mb-1">Moonshot Deposits</div>
            <div className="text-2xl font-bold">1,245 JCM</div>
            <p className="text-sm text-muted-foreground mt-1">JC Moves Coins</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground mb-1">Recent Transactions</div>
            <div className="text-2xl font-bold">23</div>
            <p className="text-sm text-muted-foreground mt-1">This week</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderMore = () => (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">More Options</h2>
      
      <Card>
        <CardContent className="p-0">
          <Link href="/admin/users">
            <div className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors cursor-pointer border-b last:border-0">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">User Management</p>
                  <p className="text-sm text-muted-foreground">Manage all users</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </Link>
          
          <div className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors cursor-pointer border-b last:border-0">
            <div className="flex items-center gap-3">
              <BarChart3 className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Analytics</p>
                <p className="text-sm text-muted-foreground">View reports</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </div>
          
          <div className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors cursor-pointer border-b last:border-0">
            <div className="flex items-center gap-3">
              <Activity className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">System Health</p>
                <p className="text-sm text-muted-foreground">Monitor status</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </div>
          
          <div className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors cursor-pointer">
            <div className="flex items-center gap-3">
              <Settings className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Settings</p>
                <p className="text-sm text-muted-foreground">Configure system</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>

      <Link href="/">
        <Button variant="outline" className="w-full" data-testid="button-back-main">
          Back to Main App
        </Button>
      </Link>
    </div>
  );

  const renderContent = () => {
    switch (activeSection) {
      case "overview": return renderOverview();
      case "leads": return renderLeads();
      case "employees": return renderEmployees();
      case "treasury": return renderTreasury();
      case "more": return renderMore();
      default: return renderOverview();
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-6">
      {/* Mobile Header */}
      <div className="sticky top-0 z-40 bg-background border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold">Admin Dashboard</h1>
          <span className="text-sm text-muted-foreground">JC ON THE MOVE</span>
        </div>
      </div>

      {/* Main Content */}
      <main className="px-4 py-4 max-w-2xl mx-auto">
        {renderContent()}
      </main>

      {/* Bottom Navigation - Mobile */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t md:hidden">
        <nav className="flex justify-around items-center h-16">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={cn(
                  "flex flex-col items-center justify-center flex-1 h-full transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
                data-testid={`button-nav-${item.id}`}
              >
                <Icon className="h-5 w-5 mb-1" />
                <span className="text-xs">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tablet/Desktop Navigation */}
      <div className="hidden md:block fixed bottom-0 left-0 right-0 z-50 bg-background border-t">
        <nav className="flex justify-center items-center h-14 gap-2 px-4 max-w-4xl mx-auto">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <Button
                key={item.id}
                variant={isActive ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveSection(item.id)}
                className="flex items-center gap-2"
                data-testid={`button-nav-${item.id}`}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{item.label}</span>
              </Button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
