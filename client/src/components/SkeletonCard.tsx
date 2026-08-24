import { Card, CardContent, CardHeader } from "@/components/ui/card";

interface SkeletonCardProps {
  lines?: number;
  showHeader?: boolean;
  showImage?: boolean;
}

export function SkeletonCard({
  lines = 3,
  showHeader = true,
  showImage = false,
}: SkeletonCardProps) {
  return (
    <Card className="overflow-hidden">
      {showImage && (
        <div className="w-full h-40 bg-muted animate-pulse" />
      )}
      
      {showHeader && (
        <CardHeader className="space-y-2">
          <div className="h-6 bg-muted rounded animate-pulse w-3/4" />
          <div className="h-4 bg-muted rounded animate-pulse w-1/2" />
        </CardHeader>
      )}
      
      <CardContent className="space-y-3">
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-4 bg-muted rounded animate-pulse w-full" />
            {i === lines - 1 && (
              <div className="h-4 bg-muted rounded animate-pulse w-2/3" />
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
