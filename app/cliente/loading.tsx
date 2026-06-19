// Skeleton mostrato durante il caricamento delle pagine cliente (tema chiaro).
const shimmer =
  "animate-pulse bg-[color-mix(in_srgb,var(--foreground)_6%,transparent)]";

export default function Loading() {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col gap-6 px-4 pb-10 pt-4">
      <div className={`h-8 w-44 rounded-xl ${shimmer}`} />
      <div className={`h-28 rounded-3xl ${shimmer}`} />
      <div className={`h-40 rounded-3xl ${shimmer}`} />
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={`h-24 rounded-3xl ${shimmer}`} />
        ))}
      </div>
    </div>
  );
}
