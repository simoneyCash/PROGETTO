// Skeleton mostrato durante il caricamento delle pagine coach (dentro il guscio).
export default function Loading() {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col gap-5 p-6">
      <div className="h-9 w-44 animate-pulse rounded-lg bg-white/5" />
      <div className="h-20 animate-pulse rounded-2xl bg-white/5" />
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-white/5" />
        ))}
      </div>
    </div>
  );
}
