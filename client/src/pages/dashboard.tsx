import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { type Lead, type User } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Users, ClipboardList, CheckCircle, UserPlus, Wallet } from "lucide-react";
import EmployeeDashboard from "@/components/employee-dashboard";

// Business Owner Dashboard Component
function BusinessOwnerDashboard() {
  const { data: leads = [] } = useQuery<Lead[]>({
    queryKey: ["/api/leads"],
  });

  const { data: employees = [] } = useQuery<User[]>({
    queryKey: ["/api/employees"],
  });

  const stats = {
    allLeads: leads.length,
    pendingQuotes: leads.filter(lead => lead.status === "quoted").length,
    confirmedJobs: leads.filter(lead => lead.status === "confirmed").length,
    totalEmployees: employees.length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-cyan-600 dark:from-blue-900 dark:to-cyan-900">
      <div className="min-h-screen bg-white/10 dark:bg-black/20 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <div className="flex justify-between items-center flex-wrap gap-4">
              <h1 className="text-4xl font-bold text-white drop-shadow-lg">Business Owner Dashboard</h1>
              <Link href="/" data-testid="link-back-to-site">
                <Button variant="outline" className="flex items-center gap-2 bg-white/90 hover:bg-white">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Site
                </Button>
              </Link>
            </div>
            <p className="text-white/90 mt-2 text-lg">Quick access to all business operations</p>
        </div>

        {/* Navigation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Link href="/leads">
            <Card 
              data-testid="stat-all-leads" 
              className="cursor-pointer hover:shadow-lg transition-all hover:scale-105 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm"
            >
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="bg-primary text-primary-foreground p-3 rounded-lg">
                    <Users className="h-6 w-6" />
                  </div>
                  <div className="ml-4">
                    <p className="text-2xl font-bold text-foreground">{stats.allLeads}</p>
                    <p className="text-muted-foreground">All Leads</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
          
          <Link href="/pending-quotes">
            <Card 
              data-testid="stat-pending-quotes"
              className="cursor-pointer hover:shadow-lg transition-all hover:scale-105 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm"
            >
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="bg-orange-500 text-white p-3 rounded-lg">
                    <ClipboardList className="h-6 w-6" />
                  </div>
                  <div className="ml-4">
                    <p className="text-2xl font-bold text-foreground">{stats.pendingQuotes}</p>
                    <p className="text-muted-foreground">Pending Quotes</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
          
          <Link href="/leads">
            <Card 
              data-testid="stat-confirmed-jobs"
              className="cursor-pointer hover:shadow-lg transition-all hover:scale-105 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm"
            >
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
          </Link>
          
          <Link href="/employees">
            <Card 
              data-testid="stat-employees"
              className="cursor-pointer hover:shadow-lg transition-all hover:scale-105 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm"
            >
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
          </Link>
        </div>

        {/* Additional Navigation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link href="/treasury">
            <Card className="cursor-pointer hover:shadow-lg transition-all hover:scale-105 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="bg-purple-500 text-white p-3 rounded-lg">
                      <Wallet className="h-6 w-6" />
                    </div>
                    <div className="ml-4">
                      <p className="text-xl font-semibold text-foreground">Treasury Management</p>
                      <p className="text-sm text-muted-foreground">View funding, deposits & transactions</p>
                    </div>
                  </div>
                  <ArrowLeft className="h-5 w-5 text-muted-foreground rotate-180" />
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Quick Stats Summary */}
        <Card className="mt-8 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-4">Quick Overview</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-3xl font-bold text-primary">{stats.allLeads}</p>
                <p className="text-sm text-muted-foreground">Total Leads</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-orange-500">{stats.pendingQuotes}</p>
                <p className="text-sm text-muted-foreground">Quoted</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-green-500">{stats.confirmedJobs}</p>
                <p className="text-sm text-muted-foreground">Confirmed</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-blue-500">{stats.totalEmployees}</p>
                <p className="text-sm text-muted-foreground">Team Members</p>
              </div>
            </div>
          </CardContent>
        </Card>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();

  if (user?.role === 'admin') {
    return <BusinessOwnerDashboard />;
  }

  return <EmployeeDashboard />;
}
