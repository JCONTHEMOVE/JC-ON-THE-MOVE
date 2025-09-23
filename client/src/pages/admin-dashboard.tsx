import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Shield, 
  Server, 
  Database, 
  Mail, 
  Key, 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  MemoryStick,
  HardDrive
} from "lucide-react";
import { Link } from "wouter";

interface SystemConfig {
  environment: string;
  database: {
    status: 'configured' | 'missing';
    type: string;
  };
  email: {
    sendgrid: {
      status: 'configured' | 'missing';
      companyEmail: 'configured' | 'missing';
    };
  };
  authentication: {
    replit: {
      domains: 'configured' | 'missing';
      cluster: 'configured' | 'missing';
      devDomain: 'configured' | 'missing';
    };
  };
  crypto: {
    moonshot: {
      tokenAddress: 'configured' | 'missing';
    };
    requestTech: {
      apiKey: 'configured' | 'missing';
    };
    encryption: {
      key: 'configured' | 'missing';
    };
  };
  server: {
    port: string;
    sessionSecret: 'configured' | 'missing';
  };
  lastChecked: string;
}

interface SystemHealth {
  database: {
    status: string;
    connected: boolean;
    lastCheck: string;
  };
  services: {
    email: string;
    authentication: string;
    rewards: string;
    treasury: string;
  };
  security: {
    encryption: string;
    authentication: string;
    roleBasedAccess: string;
  };
  uptime: number;
  memoryUsage: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
    arrayBuffers: number;
  };
  version: string;
  platform: string;
  lastUpdated: string;
}

export default function AdminDashboard() {
  const { isAdmin, isLoading: authLoading } = useAuth();

  const { data: systemConfig, isLoading: configLoading } = useQuery<SystemConfig>({
    queryKey: ["/api/admin/system/config"],
    enabled: !!isAdmin,
  });

  const { data: systemHealth, isLoading: healthLoading } = useQuery<SystemHealth>({
    queryKey: ["/api/admin/system/health"],
    enabled: !!isAdmin,
    refetchInterval: 30000, // Refresh every 30 seconds
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

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="bg-destructive/10 rounded-lg p-6 mb-4">
            <Shield className="h-12 w-12 text-destructive mx-auto mb-3" />
            <h2 className="text-xl font-semibold text-destructive mb-2">Administrator Access Required</h2>
            <p className="text-muted-foreground mb-4">
              You need administrator privileges to access this dashboard.
            </p>
          </div>
          <div className="space-x-2">
            <Link href="/dashboard">
              <Button variant="outline" data-testid="button-back-to-dashboard">
                Back to Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'configured':
      case 'healthy':
      case 'active':
      case 'enabled':
      case 'available':
        return <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
          <CheckCircle className="h-3 w-3 mr-1" />
          {status}
        </Badge>;
      case 'missing':
      case 'disabled':
        return <Badge variant="destructive">
          <AlertTriangle className="h-3 w-3 mr-1" />
          {status}
        </Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatBytes = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="container mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2" data-testid="text-admin-dashboard-title">
            System Administration
          </h1>
          <p className="text-muted-foreground">
            Monitor and manage system configuration, health, and security
          </p>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="configuration" data-testid="tab-configuration">Configuration</TabsTrigger>
            <TabsTrigger value="health" data-testid="tab-health">System Health</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {(configLoading || healthLoading) ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto"></div>
                <p className="mt-4 text-muted-foreground">Loading system status...</p>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Environment</CardTitle>
                    <Server className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{systemConfig?.environment}</div>
                    <p className="text-xs text-muted-foreground">
                      Server running on port {systemConfig?.server.port}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Database</CardTitle>
                    <Database className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{systemConfig?.database.type}</div>
                    {getStatusBadge(systemConfig?.database.status || 'unknown')}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Uptime</CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {systemHealth ? formatUptime(systemHealth.uptime) : '—'}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Since last restart
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
                    <MemoryStick className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {systemHealth ? formatBytes(systemHealth.memoryUsage.heapUsed) : '—'}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      of {systemHealth ? formatBytes(systemHealth.memoryUsage.heapTotal) : '—'} heap
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Platform</CardTitle>
                    <Activity className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{systemHealth?.platform}</div>
                    <p className="text-xs text-muted-foreground">
                      Node.js {systemHealth?.version}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Security</CardTitle>
                    <Shield className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {getStatusBadge(systemHealth?.security.authentication || 'unknown')}
                      {getStatusBadge(systemHealth?.security.encryption || 'unknown')}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="configuration" className="space-y-6">
            {configLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto"></div>
                <p className="mt-4 text-muted-foreground">Loading configuration...</p>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Database className="h-5 w-5" />
                      Database Configuration
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span>Database URL</span>
                      {getStatusBadge(systemConfig?.database.status || 'unknown')}
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Type</span>
                      <Badge variant="outline">{systemConfig?.database.type}</Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Mail className="h-5 w-5" />
                      Email Configuration
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span>SendGrid API Key</span>
                      {getStatusBadge(systemConfig?.email.sendgrid.status || 'unknown')}
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Company Email</span>
                      {getStatusBadge(systemConfig?.email.sendgrid.companyEmail || 'unknown')}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5" />
                      Authentication Configuration
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span>Replit Domains</span>
                      {getStatusBadge(systemConfig?.authentication.replit.domains || 'unknown')}
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Replit Cluster</span>
                      {getStatusBadge(systemConfig?.authentication.replit.cluster || 'unknown')}
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Dev Domain</span>
                      {getStatusBadge(systemConfig?.authentication.replit.devDomain || 'unknown')}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Key className="h-5 w-5" />
                      Crypto & Security
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span>Encryption Key</span>
                      {getStatusBadge(systemConfig?.crypto.encryption.key || 'unknown')}
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Moonshot Token</span>
                      {getStatusBadge(systemConfig?.crypto.moonshot.tokenAddress || 'unknown')}
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Request Tech API</span>
                      {getStatusBadge(systemConfig?.crypto.requestTech.apiKey || 'unknown')}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="health" className="space-y-6">
            {healthLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto"></div>
                <p className="mt-4 text-muted-foreground">Loading health status...</p>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="h-5 w-5" />
                      Services Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span>Email Service</span>
                      {getStatusBadge(systemHealth?.services.email || 'unknown')}
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Authentication</span>
                      {getStatusBadge(systemHealth?.services.authentication || 'unknown')}
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Rewards System</span>
                      {getStatusBadge(systemHealth?.services.rewards || 'unknown')}
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Treasury System</span>
                      {getStatusBadge(systemHealth?.services.treasury || 'unknown')}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5" />
                      Security Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span>Data Encryption</span>
                      {getStatusBadge(systemHealth?.security.encryption || 'unknown')}
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Authentication</span>
                      {getStatusBadge(systemHealth?.security.authentication || 'unknown')}
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Role-Based Access</span>
                      {getStatusBadge(systemHealth?.security.roleBasedAccess || 'unknown')}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MemoryStick className="h-5 w-5" />
                      Memory Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span>RSS Memory</span>
                      <Badge variant="outline">{systemHealth ? formatBytes(systemHealth.memoryUsage.rss) : '—'}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Heap Total</span>
                      <Badge variant="outline">{systemHealth ? formatBytes(systemHealth.memoryUsage.heapTotal) : '—'}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Heap Used</span>
                      <Badge variant="outline">{systemHealth ? formatBytes(systemHealth.memoryUsage.heapUsed) : '—'}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>External</span>
                      <Badge variant="outline">{systemHealth ? formatBytes(systemHealth.memoryUsage.external) : '—'}</Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Database className="h-5 w-5" />
                      Database Health
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span>Connection Status</span>
                      {getStatusBadge(systemHealth?.database.status || 'unknown')}
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Connected</span>
                      <Badge variant="outline">
                        {systemHealth?.database.connected ? 'Yes' : 'No'}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Last Check</span>
                      <Badge variant="outline">
                        {systemHealth?.database.lastCheck ? 
                          new Date(systemHealth.database.lastCheck).toLocaleTimeString() : '—'}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {(systemConfig || systemHealth) && (
          <Alert className="mt-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              System information is automatically refreshed every 30 seconds. 
              Last updated: {systemHealth?.lastUpdated ? 
                new Date(systemHealth.lastUpdated).toLocaleString() : 
                new Date(systemConfig?.lastChecked || '').toLocaleString()}
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}