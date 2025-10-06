import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Users, 
  FileText, 
  DollarSign, 
  Settings, 
  BarChart3, 
  Shield, 
  UserCog,
  Menu,
  X,
  Activity,
  Database,
  Mail,
  TrendingUp,
  Clock,
  AlertTriangle,
  CheckCircle,
  Building2,
  Briefcase
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "wouter";

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

const sidebarItems = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "users", label: "User Management", icon: Users },
  { id: "leads", label: "Lead Management", icon: FileText },
  { id: "employees", label: "Employee Management", icon: UserCog },
  { id: "treasury", label: "Treasury", icon: DollarSign },
  { id: "analytics", label: "Analytics", icon: TrendingUp },
  { id: "system", label: "System Health", icon: Activity },
  { id: "settings", label: "Settings", icon: Settings },
];

export default function AdminDashboardFull() {
  const { hasAdminAccess, isLoading: authLoading } = useAuth();
  const [activeSection, setActiveSection] = useState("treasury");
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          <p className="mt-4 text-muted-foreground">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  if (!hasAdminAccess) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="bg-destructive/10 rounded-lg p-6 mb-4">
            <Shield className="h-12 w-12 text-destructive mx-auto mb-3" />
            <h2 className="text-xl font-semibold text-destructive mb-2">Administrator Access Required</h2>
            <p className="text-muted-foreground mb-4">
              You need administrator or business owner privileges to access this dashboard.
            </p>
          </div>
          <div className="space-x-2">
            <Link href="/">
              <Button variant="outline" data-testid="button-back-to-main">
                Back to Main
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const renderOverview = () => (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalUsers || 0}</div>
            <p className="text-xs text-muted-foreground">Active registered users</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalLeads || 0}</div>
            <p className="text-xs text-muted-foreground">All time leads</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Jobs</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.activeJobs || 0}</div>
            <p className="text-xs text-muted-foreground">Currently in progress</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${(stats?.monthlyRevenue || 0).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Leads</CardTitle>
            <CardDescription>Latest customer inquiries</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {leads?.slice(0, 5).map((lead) => (
                <div key={lead.id} className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">{lead.firstName} {lead.lastName}</p>
                    <p className="text-sm text-muted-foreground">{lead.serviceType}</p>
                  </div>
                  <Badge variant={lead.status === 'new' ? 'default' : 'secondary'}>
                    {lead.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System Status</CardTitle>
            <CardDescription>Current system health</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span>Database</span>
                <Badge variant="default" className="bg-green-100 text-green-800">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Healthy
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span>Email Service</span>
                <Badge variant="default" className="bg-green-100 text-green-800">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Active
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span>Treasury System</span>
                <Badge variant="default" className="bg-green-100 text-green-800">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Online
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderUsers = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">User Management</h2>
        <Button data-testid="button-add-user">Add New User</Button>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>Manage user accounts and roles</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {usersLoading ? (
              <div className="text-center py-8">Loading users...</div>
            ) : (
              users?.map((user) => (
                <div key={user.id} className="flex justify-between items-center p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">{user.firstName} {user.lastName}</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Joined {new Date(user.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                      {user.role}
                    </Badge>
                    <Button variant="outline" size="sm" data-testid={`button-edit-user-${user.id}`}>
                      Edit
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderLeads = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Lead Management</h2>
        <Button data-testid="button-export-leads">Export Leads</Button>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>All Leads</CardTitle>
          <CardDescription>Manage customer inquiries and quotes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {leadsLoading ? (
              <div className="text-center py-8">Loading leads...</div>
            ) : (
              leads?.map((lead) => (
                <div key={lead.id} className="flex justify-between items-center p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">{lead.firstName} {lead.lastName}</p>
                    <p className="text-sm text-muted-foreground">{lead.email}</p>
                    <p className="text-sm">{lead.serviceType}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(lead.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={lead.status === 'new' ? 'default' : 'secondary'}>
                      {lead.status}
                    </Badge>
                    {lead.estimatedValue && (
                      <Badge variant="outline">${lead.estimatedValue}</Badge>
                    )}
                    <Button variant="outline" size="sm" data-testid={`button-view-lead-${lead.id}`}>
                      View
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const handleApprove = async (employeeId: string, approved: boolean) => {
    try {
      const response = await fetch(`/api/admin/employees/${employeeId}/approve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved }),
      });
      
      if (response.ok) {
        // Refetch employee lists
        queryClient.invalidateQueries({ queryKey: ["/api/admin/employees/pending"] });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/employees/approved"] });
      }
    } catch (error) {
      console.error('Error updating employee approval:', error);
    }
  };

  const renderEmployees = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Employee Management</h2>
        <Button data-testid="button-add-employee">Add Employee</Button>
      </div>
      
      {/* Pending Approvals Section */}
      {pendingEmployees && pendingEmployees.length > 0 && (
        <Card className="border-yellow-200 dark:border-yellow-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-600" />
              Pending Employee Approvals
            </CardTitle>
            <CardDescription>Review and approve new employee accounts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingEmployees.map((employee) => (
                <div key={employee.id} className="flex justify-between items-center p-3 border rounded-lg" data-testid={`pending-employee-${employee.id}`}>
                  <div>
                    <p className="font-medium" data-testid={`text-employee-name-${employee.id}`}>
                      {employee.firstName} {employee.lastName}
                    </p>
                    <p className="text-sm text-muted-foreground" data-testid={`text-employee-email-${employee.id}`}>
                      {employee.email}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Registered: {new Date(employee.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="default"
                      onClick={() => handleApprove(employee.id, true)}
                      data-testid={`button-approve-${employee.id}`}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Approve
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleApprove(employee.id, false)}
                      data-testid={`button-reject-${employee.id}`}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Approved Employees</CardTitle>
            <CardDescription>Active employees with full access</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {approvedEmployees?.map((employee) => (
                <div key={employee.id} className="flex justify-between items-center" data-testid={`approved-employee-${employee.id}`}>
                  <div>
                    <p className="font-medium">{employee.firstName} {employee.lastName}</p>
                    <p className="text-sm text-muted-foreground">{employee.email}</p>
                  </div>
                  <Badge variant="default" className="bg-green-500">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Approved
                  </Badge>
                </div>
              ))}
              {(!approvedEmployees || approvedEmployees.length === 0) && (
                <p className="text-sm text-muted-foreground">No approved employees</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Job Assignments</CardTitle>
            <CardDescription>Current employee workload</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {leads?.filter(lead => lead.assignedToUserId).slice(0, 5).map((lead) => (
                <div key={lead.id} className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">{lead.firstName} {lead.lastName}</p>
                    <p className="text-sm text-muted-foreground">{lead.serviceType}</p>
                  </div>
                  <Badge variant="outline">Assigned</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderTreasury = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Treasury Management</h2>
        <Button asChild data-testid="button-full-treasury">
          <Link href="/treasury">Open Full Treasury</Link>
        </Button>
      </div>
      
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Total Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$45,231.80</div>
            <p className="text-sm text-muted-foreground">+2.5% from last month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Moonshot Deposits</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1,245 JCM</div>
            <p className="text-sm text-muted-foreground">JC Moves Coins</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">23</div>
            <p className="text-sm text-muted-foreground">This week</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderAnalytics = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Analytics & Reports</h2>
      
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Lead Conversion Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">68%</div>
            <p className="text-sm text-muted-foreground">+5% from last month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Average Job Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">$1,250</div>
            <p className="text-sm text-muted-foreground">+12% from last month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Customer Satisfaction</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">4.8/5</div>
            <p className="text-sm text-muted-foreground">Based on 45 reviews</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Employee Utilization</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">85%</div>
            <p className="text-sm text-muted-foreground">Optimal range</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderSystem = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">System Health</h2>
      
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Server Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span>Uptime</span>
                <Badge variant="default" className="bg-green-100 text-green-800">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  99.9%
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span>Memory Usage</span>
                <Badge variant="outline">2.1GB / 4GB</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span>CPU Usage</span>
                <Badge variant="outline">45%</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Services</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span>Database</span>
                <Badge variant="default" className="bg-green-100 text-green-800">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Healthy
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span>Email Service</span>
                <Badge variant="default" className="bg-green-100 text-green-800">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Active
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span>Authentication</span>
                <Badge variant="default" className="bg-green-100 text-green-800">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Online
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">System Settings</h2>
      
      <div className="grid gap-6 md:grid-cols-1">
        <Card>
          <CardHeader>
            <CardTitle>Application Settings</CardTitle>
            <CardDescription>Configure system-wide settings</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium">Email Notifications</p>
                  <p className="text-sm text-muted-foreground">Send email alerts for new leads</p>
                </div>
                <Button variant="outline" size="sm">Configure</Button>
              </div>
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium">Treasury Settings</p>
                  <p className="text-sm text-muted-foreground">Manage Moonshot crypto integration</p>
                </div>
                <Button variant="outline" size="sm">Configure</Button>
              </div>
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium">User Permissions</p>
                  <p className="text-sm text-muted-foreground">Configure role-based access</p>
                </div>
                <Button variant="outline" size="sm">Configure</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeSection) {
      case "overview": return renderOverview();
      case "users": return renderUsers();
      case "leads": return renderLeads();
      case "employees": return renderEmployees();
      case "treasury": return renderTreasury();
      case "analytics": return renderAnalytics();
      case "system": return renderSystem();
      case "settings": return renderSettings();
      default: return renderOverview();
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden" 
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-card border-r transform transition-transform lg:translate-x-0 lg:static lg:inset-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex h-full flex-col">
          {/* Sidebar header */}
          <div className="flex h-16 items-center justify-between px-6 border-b">
            <h2 className="text-lg font-semibold">Admin Dashboard</h2>
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden"
              onClick={() => setSidebarOpen(false)}
              data-testid="button-close-sidebar"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Sidebar navigation */}
          <nav className="flex-1 p-4 space-y-2">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              return (
                <Button
                  key={item.id}
                  variant={activeSection === item.id ? "default" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => {
                    setActiveSection(item.id);
                    setSidebarOpen(false);
                  }}
                  data-testid={`button-nav-${item.id}`}
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {item.label}
                </Button>
              );
            })}
          </nav>

          {/* Sidebar footer */}
          <div className="p-4 border-t">
            <Button variant="outline" className="w-full" asChild>
              <Link href="/">Back to Main App</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top header */}
        <div className="sticky top-0 z-40 flex h-16 items-center gap-x-4 border-b bg-background px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
            data-testid="button-open-sidebar"
          >
            <Menu className="h-4 w-4" />
          </Button>

          <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
            <div className="flex items-center gap-x-4 lg:gap-x-6">
              <h1 className="text-xl font-semibold">
                {sidebarItems.find(item => item.id === activeSection)?.label || "Overview"}
              </h1>
            </div>
            <div className="flex flex-1 justify-end">
              <div className="flex items-center gap-x-4 lg:gap-x-6">
                <span className="text-sm text-muted-foreground">JC ON THE MOVE Admin</span>
              </div>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="p-4 sm:p-6 lg:p-8">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}