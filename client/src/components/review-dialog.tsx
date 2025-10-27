import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StarRating } from "@/components/star-rating";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface ReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  jobServiceType: string;
  onReviewSubmitted?: () => void;
}

export function ReviewDialog({ open, onOpenChange, jobId, jobServiceType, onReviewSubmitted }: ReviewDialogProps) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const { toast } = useToast();

  const submitReviewMutation = useMutation({
    mutationFn: async () => {
      if (rating === 0) {
        throw new Error("Please select a star rating");
      }

      return await apiRequest("/api/reviews", "POST", {
        leadId: jobId,
        rating,
        comment: comment.trim() || null,
      });
    },
    onSuccess: () => {
      toast({
        title: "Review Submitted!",
        description: rating >= 4 
          ? `Thank you for your ${rating}-star review! The employee will receive bonus tokens.` 
          : "Thank you for your feedback. We'll use it to improve our service.",
      });
      
      // Reset form
      setRating(0);
      setComment("");
      
      // Close dialog
      onOpenChange(false);
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/leads/my-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reviews"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reviews/my-reviews"] });
      
      if (onReviewSubmitted) {
        onReviewSubmitted();
      }
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Submit Review",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitReviewMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" data-testid="dialog-review">
        <DialogHeader>
          <DialogTitle>Rate Your Experience</DialogTitle>
          <DialogDescription>
            How was your {jobServiceType} service? Your feedback helps us improve and rewards great employees.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 pt-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Your Rating</label>
            <div className="flex items-center gap-4">
              <StarRating rating={rating} onRatingChange={setRating} size="lg" />
              {rating > 0 && (
                <span className="text-sm text-muted-foreground">
                  {rating === 5 ? "Excellent!" : rating === 4 ? "Great!" : rating === 3 ? "Good" : rating === 2 ? "Fair" : "Needs Improvement"}
                </span>
              )}
            </div>
            {rating >= 4 && (
              <p className="text-xs text-green-600 dark:text-green-400">
                ⭐ {rating === 5 ? "50" : "25"} bonus tokens will be awarded to the employee!
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="comment" className="text-sm font-medium">
              Additional Comments <span className="text-muted-foreground">(optional)</span>
            </label>
            <Textarea
              id="comment"
              placeholder="Tell us about your experience..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              maxLength={1000}
              data-testid="textarea-comment"
            />
            <p className="text-xs text-muted-foreground text-right">
              {comment.length}/1000 characters
            </p>
          </div>

          <div className="flex gap-3 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitReviewMutation.isPending}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={rating === 0 || submitReviewMutation.isPending}
              data-testid="button-submit-review"
            >
              {submitReviewMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Review
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
