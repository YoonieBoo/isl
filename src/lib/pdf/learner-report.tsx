import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

// The built-in Helvetica font has no arrow glyphs, which learners often type
// in step-by-step workflow answers ("Step 1 → Step 2").
function pdfSafe(text: string): string {
  return text.replace(/[→⇒➔➜]/g, "->").replace(/[←⇐]/g, "<-");
}

// Mirrors the "label: quote" bullet format used everywhere else in the app
// (see BulletList in profiles/[learnerId]/page.tsx) so the PDF reads the
// same way the on-screen report card does.
function splitBullet(raw: string): { label: string; quote: string | null } {
  const item = pdfSafe(raw);
  const separatorIndex = item.indexOf(": ");
  if (separatorIndex === -1) return { label: item, quote: null };
  return { label: item.slice(0, separatorIndex), quote: item.slice(separatorIndex + 2) };
}

const styles = StyleSheet.create({
  page: { padding: 44, fontSize: 10, fontFamily: "Helvetica", color: "#1f2937" },
  title: { fontSize: 20, fontFamily: "Helvetica-Bold", marginBottom: 3 },
  subtitle: { fontSize: 12, color: "#6b7280", marginBottom: 3 },
  environmentsLine: { fontSize: 9.5, color: "#9ca3af", marginBottom: 22 },
  cardTitle: { fontSize: 12, fontFamily: "Helvetica-Bold", marginTop: 18, marginBottom: 9 },
  bullet: { marginBottom: 10 },
  bulletLabel: { fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 3 },
  bulletQuote: { fontSize: 9.5, color: "#4b5563", lineHeight: 1.45 },
  emptyText: { fontSize: 9.5, color: "#9ca3af", fontStyle: "italic" },
  overviewText: { fontSize: 10, lineHeight: 1.55, color: "#1f2937" },
});

const ACCENT = {
  strengths: "#1656f5",
  development: "#f59e0b",
  preferences: "#8b5cf6",
};

function BulletSection({ items }: { items: string[] }) {
  if (items.length === 0) return <Text style={styles.emptyText}>Needs further evidence.</Text>;
  return (
    <View>
      {items.map((item, i) => {
        const { label, quote } = splitBullet(item);
        return (
          <View key={i} style={styles.bullet}>
            <Text style={styles.bulletLabel}>• {label}</Text>
            {quote && <Text style={styles.bulletQuote}>&ldquo;{quote}&rdquo;</Text>}
          </View>
        );
      })}
    </View>
  );
}

export type LearnerReportData = {
  learnerName: string;
  externalReference: string | null;
  strengths: string[];
  developmentNeeds: string[];
  learningPreferences: string[];
  environments: string[];
  overview: string | null;
};

export function LearnerReportDocument({ data }: { data: LearnerReportData }) {
  return (
    <Document title={`Approved Insights — ${data.learnerName}`}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Approved Insights</Text>
        <Text style={styles.subtitle}>
          {data.learnerName}
          {data.externalReference ? ` (${data.externalReference})` : ""}
        </Text>
        <Text style={styles.environmentsLine}>
          {data.environments.length > 0 ? data.environments.join(", ") : "Not enrolled anywhere yet."}
        </Text>

        {data.overview && (
          <>
            <Text style={styles.cardTitle}>Overview</Text>
            <Text style={styles.overviewText}>{data.overview}</Text>
          </>
        )}

        <Text style={styles.cardTitle}>
          <Text style={{ color: ACCENT.strengths }}>• </Text>
          Strengths
        </Text>
        <BulletSection items={data.strengths} />

        <Text style={styles.cardTitle}>
          <Text style={{ color: ACCENT.development }}>• </Text>
          Development Focus
        </Text>
        <BulletSection items={data.developmentNeeds} />

        <Text style={styles.cardTitle}>
          <Text style={{ color: ACCENT.preferences }}>• </Text>
          Learning Preferences
        </Text>
        <BulletSection items={data.learningPreferences} />
      </Page>
    </Document>
  );
}
