import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StarRating } from "@/components/star-rating";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, Award, MessageSquare } from "lucide-react";

interface Review {
  id: string;
  leadId: string;
  userId: string;
  employeeId: string;
  rating: number;
  comment: string | null;
  rewardedAt: string | null;
  createdAt: string;
}

interface EmployeeReviewsProps {
  employeeId: string;
  limit?: number;
  showStats?: boolean;
}

export function EmployeeReviews({ employeeId, limit = 10, showStats = true }: EmployeeReviewsProps) {
  const { data: reviews = [], isLoading: reviewsLoading } = useQuery<Review[]>({
    queryKey: ["/api/reviews", { employeeId, limit }],
  });

  const { data: stats, isLoading: statsLoading } = useQuery<{
    averageRating: number;
    totalReviews: number;
    ratingDistribution: Record<string, number>;
  }>({
    queryKey: ["/api/reviews/employee", employeeId, "stats"],
    enabled: showStats,
  });

  if (reviewsLoading || (showStats && statsLoading)) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Statistics Card */}
      {showStats && stats && stats.totalReviews > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Review Statistics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-primary">
                  {stats.averageRating.toFixed(1)}
                </div>
                <div className="flex items-center justify-center mt-1">
                  <StarRating rating={Math.round(stats.averageRating)} readonly size="sm" />
                </div>
                <p className="text-sm text-muted-foreground mt-1">Average Rating</p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-primary">{stats.totalReviews}</div>
                <p className="text-sm text-muted-foreground mt-1">Total Reviews</p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-primary">
                  {((stats.ratingDistribution['5'] || 0) / stats.totalReviews * 100).toFixed(0)}%
                </div>
                <p className="text-sm text-muted-foreground mt-1">5-Star Reviews</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reviews List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Customer Feedback
          </CardTitle>
          <CardDescription>
            {reviews.length === 0 ? "No reviews yet" : `Showing ${reviews.length} recent review${reviews.length === 1 ? '' : 's'}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {reviews.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                Complete jobs to start receiving customer reviews
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map((review) => (
                <div
                  key={review.id}
                  className="border border-border rounded-lg p-4 space-y-3"
                  data-testid={`review-${review.id}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <StarRating rating={review.rating} readonly />
                      <span className="text-sm text-muted-foreground">
                        {new Date(review.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    {review.rewardedAt && (
                      <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                        <Award className="h-3 w-3 mr-1" />
                        Bonus Earned
                      </Badge>
                    )}
                  </div>

                  {review.comment && (
                    <p className="text-sm text-foreground leading-relaxed">
                      "{review.comment}"
                    </p>
                  )}

                  {!review.comment && (
                    <p className="text-sm text-muted-foreground italic">
                      No written feedback provided
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
