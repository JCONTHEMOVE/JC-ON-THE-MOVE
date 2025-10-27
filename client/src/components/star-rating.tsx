import { Star } from "lucide-react";

interface StarRatingProps {
  rating: number;
  onRatingChange?: (rating: number) => void;
  readonly?: boolean;
  size?: "sm" | "md" | "lg";
}

export function StarRating({ rating, onRatingChange, readonly = false, size = "md" }: StarRatingProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6",
  };

  const handleClick = (index: number) => {
    if (!readonly && onRatingChange) {
      onRatingChange(index + 1);
    }
  };

  return (
    <div className="flex gap-1">
      {[...Array(5)].map((_, index) => (
        <Star
          key={index}
          className={`${sizeClasses[size]} ${
            !readonly ? "cursor-pointer hover:scale-110 transition-transform" : ""
          } ${
            index < rating
              ? "fill-yellow-400 text-yellow-400"
              : "fill-muted text-muted-foreground/30"
          }`}
          onClick={() => handleClick(index)}
          data-testid={`star-${index + 1}`}
        />
      ))}
    </div>
  );
}
