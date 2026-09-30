// Recreated wordmark — the source logo file (an inline chat image) couldn't
// be extracted to a binary asset. Swap this for the real logo file by
// dropping it in /public and rendering it with next/image instead.
export function IslLogo({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-baseline font-extrabold tracking-tight lowercase text-isl-blue ${className}`}
      aria-label="ISL"
    >
      isl
      <span className="text-isl-blue" aria-hidden="true">
        .
      </span>
    </span>
  );
}
