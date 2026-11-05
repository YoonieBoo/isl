// Overviews are written as short "Label: text" lines so instructors can scan
// them: course overviews use Doing well / Work on / Worth noting, weekly ones
// Pre → Post / Learning gap / Next action. Older paragraph overviews still
// render as a plain paragraph.
const LABELS = ["Doing well", "Work on", "Worth noting", "Pre → Post", "Learning gap", "Next action"];
const canonical = (label: string) => label.toLowerCase().replace(/\s+/g, " ").replace("->", "→");
export const OVERVIEW_LINE = /^(Doing well|Work on|Worth noting|Pre\s*(?:→|->)\s*Post|Learning gap|Next action)\s*:\s*(.+)$/i;

export function parseOverview(text: string): { label: string; text: string }[] | null {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const parsed = lines.map((l) => l.match(OVERVIEW_LINE)).filter((m): m is RegExpMatchArray => Boolean(m));
  if (parsed.length === 0 || parsed.length !== lines.length) return null;
  return parsed.map((m) => ({
    label: LABELS.find((l) => canonical(l) === canonical(m[1]).replace(/\s*→\s*/, " → ")) ?? m[1],
    text: m[2],
  }));
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
