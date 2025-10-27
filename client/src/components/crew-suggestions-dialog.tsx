import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Users, Star, Briefcase, TrendingUp, CheckCircle2, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface EmployeeWithStats {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  activeJobsCount: number;
  completedJobsCount: number;
  averageRating: number;
  totalReviews: number;
  isApproved: boolean;
}

interface CrewSuggestion {
  employee: EmployeeWithStats;
  score: number;
  reason: string;
}

interface CrewAssignmentSuggestion {
  jobId: string;
  jobType: string;
  crewSize: number;
  suggestions: CrewSuggestion[];
  recommendedCrew: CrewSuggestion[];
}

interface CrewSuggestionsDialogProps {
  jobId: string;
  jobTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CrewSuggestionsDialog({ jobId, jobTitle, open, onOpenChange }: CrewSuggestionsDialogProps) {
  const { toast } = useToast();
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set());

  const { data: suggestions, isLoading } = useQuery<CrewAssignmentSuggestion>({
    queryKey: ["/api/leads", jobId, "crew-suggestions"],
    queryFn: async () => {
      const res = await fetch(`/api/leads/${jobId}/crew-suggestions`, {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch crew suggestions: ${res.statusText}`);
      }
      return await res.json();
    },
    enabled: open && !!jobId,
  });

  const assignCrewMutation = useMutation({
    mutationFn: async (employeeIds: string[]) => {
      return await apiRequest("PATCH", `/api/leads/${jobId}`, {
        crewMembers: employeeIds,
      });
    },
    onSuccess: () => {
      toast({
        title: "Crew Assigned",
        description: "Crew members have been successfully assigned to this job.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/leads"] });
      onOpenChange(false);
      setSelectedEmployees(new Set());
    },
    onError: (error) => {
      toast({
        title: "Assignment Failed",
        description: error instanceof Error ? error.message : "Failed to assign crew members",
        variant: "destructive",
      });
    },
  });

  const toggleEmployee = (employeeId: string) => {
    const newSelected = new Set(selectedEmployees);
    if (newSelected.has(employeeId)) {
      newSelected.delete(employeeId);
    } else {
      newSelected.add(employeeId);
    }
    setSelectedEmployees(newSelected);
  };

  const applyRecommendations = () => {
    if (suggestions?.recommendedCrew) {
      const recommended = new Set(suggestions.recommendedCrew.map(s => s.employee.id));
      setSelectedEmployees(recommended);
    }
  };

  const handleAssign = () => {
    if (selectedEmployees.size === 0) {
      toast({
        title: "No Employees Selected",
        description: "Please select at least one employee to assign to this job.",
        variant: "destructive",
      });
      return;
    }
    assignCrewMutation.mutate(Array.from(selectedEmployees));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Crew Assignment Assistant
          </DialogTitle>
          <DialogDescription>
            Smart suggestions for {jobTitle} based on availability, performance, and experience
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : suggestions ? (
          <div className="space-y-6">
            {/* Job Info */}
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Crew Size Needed</p>
                  <p className="text-sm text-muted-foreground">{suggestions.crewSize} members</p>
                </div>
              </div>
              <Badge variant="outline">{suggestions.jobType}</Badge>
            </div>

            {/* Recommended Crew */}
            {suggestions.recommendedCrew.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    Recommended Crew
                  </h3>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={applyRecommendations}
                    data-testid="button-apply-recommendations"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Select All Recommended
                  </Button>
                </div>
                <div className="grid gap-3">
                  {suggestions.recommendedCrew.map((suggestion) => (
                    <SuggestionCard
                      key={suggestion.employee.id}
                      suggestion={suggestion}
                      isSelected={selectedEmployees.has(suggestion.employee.id)}
                      isRecommended={true}
                      onToggle={() => toggleEmployee(suggestion.employee.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Other Available Employees */}
            {suggestions.suggestions.length > suggestions.recommendedCrew.length && (
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  Other Available Employees
                </h3>
                <div className="grid gap-3">
                  {suggestions.suggestions
                    .slice(suggestions.crewSize)
                    .map((suggestion) => (
                      <SuggestionCard
                        key={suggestion.employee.id}
                        suggestion={suggestion}
                        isSelected={selectedEmployees.has(suggestion.employee.id)}
                        isRecommended={false}
                        onToggle={() => toggleEmployee(suggestion.employee.id)}
                      />
                    ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No suggestions available
          </div>
        )}

        <DialogFooter>
          <div className="flex items-center justify-between w-full">
            <p className="text-sm text-muted-foreground">
              {selectedEmployees.size} {selectedEmployees.size === 1 ? 'employee' : 'employees'} selected
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-assignment"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAssign}
                disabled={selectedEmployees.size === 0 || assignCrewMutation.isPending}
                data-testid="button-assign-crew"
              >
                {assignCrewMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Assign Crew
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface SuggestionCardProps {
  suggestion: CrewSuggestion;
  isSelected: boolean;
  isRecommended: boolean;
  onToggle: () => void;
}

function SuggestionCard({ suggestion, isSelected, isRecommended, onToggle }: SuggestionCardProps) {
  const { employee, score, reason } = suggestion;

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all hover:shadow-md",
        isSelected && "ring-2 ring-primary bg-primary/5",
        isRecommended && "border-primary/50"
      )}
      onClick={onToggle}
      data-testid={`crew-suggestion-${employee.id}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
              <span className="font-semibold text-primary">
                {employee.firstName?.[0]}{employee.lastName?.[0]}
              </span>
            </div>
            <div>
              <h4 className="font-semibold">
                {employee.firstName} {employee.lastName}
              </h4>
              <p className="text-sm text-muted-foreground">{employee.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isRecommended && (
              <Badge variant="default" className="bg-gradient-to-r from-primary to-primary/80">
                Recommended
              </Badge>
            )}
            <div className="text-right">
              <div className="text-2xl font-bold text-primary">{score}</div>
              <div className="text-xs text-muted-foreground">Score</div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-3 gap-4 mb-3">
          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-muted-foreground" />
            <div className="text-sm">
              <div className="font-medium">{employee.activeJobsCount}</div>
              <div className="text-xs text-muted-foreground">Active</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            <div className="text-sm">
              <div className="font-medium">{employee.completedJobsCount}</div>
              <div className="text-xs text-muted-foreground">Completed</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-muted-foreground" />
            <div className="text-sm">
              <div className="font-medium">
                {employee.totalReviews > 0 ? employee.averageRating.toFixed(1) : 'N/A'}
              </div>
              <div className="text-xs text-muted-foreground">
                {employee.totalReviews} {employee.totalReviews === 1 ? 'review' : 'reviews'}
              </div>
            </div>
          </div>
        </div>
        <div className="text-sm text-muted-foreground border-t pt-3">
          {reason}
        </div>
      </CardContent>
    </Card>
  );
}
