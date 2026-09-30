export function PageStub({
  title,
  phase,
  description,
}: {
  title: string;
  phase: string;
  description: string;
}) {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
      <div className="mt-6 rounded-xl border border-dashed border-border bg-surface p-8 text-center">
        <span className="inline-block rounded-full bg-isl-blue-pale px-3 py-1 text-xs font-semibold text-isl-blue-dark">
          Not built yet — {phase}
        </span>
        <p className="mx-auto mt-3 max-w-md text-sm text-foreground-muted">
          {description}
        </p>
      </div>
    </div>
  );
}
