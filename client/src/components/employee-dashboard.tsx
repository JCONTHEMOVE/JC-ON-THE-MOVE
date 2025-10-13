import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { type Lead } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Briefcase, Clock, Plus } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import MobileLeadManager from "@/components/mobile-lead-manager";

export default function EmployeeDashboard() {
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
      if (error.message.includes('401')) return;
      
      toast({
        title: "Error",
        description: "Failed to accept job. It may have been assigned to another employee.",
        variant: "destructive",
      });
    },
  });

  const completeJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const response = await apiRequest("POST", `/api/leads/${jobId}/complete`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads/my-jobs"] });
      toast({
        title: "Job completed",
        description: "You have successfully marked this job as completed.",
      });
    },
    onError: (error: Error) => {
      if (error.message.includes('401')) return;
      
      toast({
        title: "Error",
        description: "Failed to complete job. Please try again.",
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
          <p className="text-muted-foreground mt-2">View and manage your jobs</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5" />
                  Available Jobs ({availableJobs.length})
                </CardTitle>
                <Link href="/employee/add-job">
                  <Button variant="default" size="sm" className="flex items-center gap-2" data-testid="button-add-job">
                    <Plus className="h-4 w-4" />
                    Add a Job
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {availableJobs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No available jobs at this time
                </div>
              ) : (
                <div className="space-y-3">
                  {availableJobs.slice(0, 3).map((job) => (
                    <div key={job.id} className="p-3 border rounded-lg">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">{job.firstName} {job.lastName}</p>
                          <p className="text-sm text-muted-foreground">{job.serviceType}</p>
                          <p className="text-sm text-muted-foreground">{job.moveDate ? new Date(job.moveDate).toLocaleDateString() : 'No date set'}</p>
                        </div>
                        <Button 
                          size="sm" 
                          onClick={() => acceptJobMutation.mutate(job.id)}
                          disabled={acceptJobMutation.isPending}
                        >
                          Accept
                        </Button>
                      </div>
                    </div>
                  ))}
                  {availableJobs.length > 3 && (
                    <Link href="/jobs">
                      <Button variant="outline" className="w-full">View All Jobs</Button>
                    </Link>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                My Jobs ({myJobs.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {myJobs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  You have no assigned jobs
                </div>
              ) : (
                <div className="space-y-3">
                  {myJobs.slice(0, 3).map((job) => (
                    <div key={job.id} className="p-3 border rounded-lg">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-medium">{job.firstName} {job.lastName}</p>
                          <p className="text-sm text-muted-foreground">{job.serviceType}</p>
                          <Badge variant={getStatusBadgeVariant(job.status)}>{job.status}</Badge>
                        </div>
                        {(job.status === "accepted" || job.status === "in_progress") && (
                          <Button 
                            size="sm" 
                            variant="default"
                            onClick={() => completeJobMutation.mutate(job.id)}
                            disabled={completeJobMutation.isPending}
                            data-testid={`button-complete-job-${job.id}`}
                          >
                            Complete
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                  {myJobs.length > 3 && (
                    <Link href="/jobs">
                      <Button variant="outline" className="w-full">View All My Jobs</Button>
                    </Link>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
