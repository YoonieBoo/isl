// Overviews are written as short "Label: text" lines (Doing well / Work on /
// Worth noting) so instructors can scan them; older paragraph overviews still
// render as a plain paragraph.
export const OVERVIEW_LINE = /^(Doing well|Work on|Worth noting)\s*:\s*(.+)$/i;

export function parseOverview(text: string): { label: string; text: string }[] | null {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const parsed = lines.map((l) => l.match(OVERVIEW_LINE)).filter((m): m is RegExpMatchArray => Boolean(m));
  if (parsed.length === 0 || parsed.length !== lines.length) return null;
  return parsed.map((m) => ({ label: m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase(), text: m[2] }));
}

export function OverviewText({ text }: { text: string }) {
  const lines = parseOverview(text);
  if (!lines) return <p className="text-sm leading-relaxed text-foreground">{text}</p>;
  return (
    <dl className="grid gap-2 text-sm sm:grid-cols-[8rem_1fr]">
      {lines.map((l) => (
        <div key={l.label} className="contents">
          <dt className="font-semibold text-foreground">{l.label}</dt>
          <dd className="text-foreground">{l.text}</dd>
        </div>
      ))}
    </dl>
  );
}
