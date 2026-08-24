interface SkeletonTableProps {
  rows?: number;
  columns?: number;
}

export function SkeletonTable({ rows = 5, columns = 4 }: SkeletonTableProps) {
  return (
    <div className="w-full border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex bg-muted border-b">
        {Array.from({ length: columns }).map((_, i) => (
          <div
            key={`header-${i}`}
            className="flex-1 p-4 h-12 bg-muted animate-pulse"
          />
        ))}
      </div>

      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div key={`row-${rowIdx}`} className="flex border-b last:border-b-0">
          {Array.from({ length: columns }).map((_, colIdx) => (
            <div
              key={`cell-${rowIdx}-${colIdx}`}
              className="flex-1 p-4 h-16 flex items-center"
            >
              <div className="h-4 bg-muted rounded animate-pulse w-4/5" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
