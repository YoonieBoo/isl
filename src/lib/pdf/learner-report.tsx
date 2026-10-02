import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { LEVEL_LABEL, type SkillLevel } from "@/lib/skills/frameworks";

// Plain nested Text/View only — react-pdf renders flex-row and wrapped Views
// unreliably (blank first page), so every line here is a stacked block.
const styles = StyleSheet.create({
  page: { padding: 44, fontSize: 10, fontFamily: "Helvetica", color: "#1f2937" },
  title: { fontSize: 20, fontFamily: "Helvetica-Bold", marginBottom: 3 },
  subtitle: { fontSize: 12, color: "#6b7280", marginBottom: 3 },
  environmentsLine: { fontSize: 9.5, color: "#9ca3af", marginBottom: 22 },
  sectionTitle: { fontSize: 13, fontFamily: "Helvetica-Bold", marginTop: 20, marginBottom: 6 },
  courseOverview: { fontSize: 9.5, color: "#4b5563", lineHeight: 1.5, marginBottom: 10 },
  skill: { marginBottom: 11 },
  skillName: { fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  skillSummary: { fontSize: 9.5, color: "#374151", lineHeight: 1.45 },
  quote: { fontSize: 9, color: "#6b7280", lineHeight: 1.45, marginTop: 2 },
  emptyText: { fontSize: 9.5, color: "#9ca3af", fontStyle: "italic" },
  overviewText: { fontSize: 10, lineHeight: 1.55, color: "#1f2937" },
});

const LEVEL_COLOR: Record<SkillLevel, string> = {
  strong: "#059669",
  developing: "#d97706",
  needs_support: "#dc2626",
  not_enough_evidence: "#9ca3af",
};

export type ReportSkill = { name: string; level: SkillLevel; summary: string; quote: string | null; form: string | null };
export type ReportCourse = { code: string; overview: string | null; skills: ReportSkill[] | null };

export type LearnerReportData = {
  learnerName: string;
  externalReference: string | null;
  courses: ReportCourse[];
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
          {data.courses.length > 0 ? data.courses.map((c) => c.code).join(", ") : "Not enrolled anywhere yet."}
        </Text>

        {data.overview && (
          <>
            <Text style={styles.sectionTitle}>Overview</Text>
            <Text style={styles.overviewText}>{data.overview}</Text>
          </>
        )}

        {data.courses.map((course) => (
          <View key={course.code}>
            <Text style={styles.sectionTitle}>
              <Text style={{ color: "#1656f5" }}>• </Text>
              {course.code} skills
            </Text>
            {/* With one course the top Overview already is this course's overview. */}
            {course.overview && data.courses.length > 1 && <Text style={styles.courseOverview}>{course.overview}</Text>}
            {course.skills ? (
              course.skills.map((skill) => (
                <View key={skill.name} style={styles.skill} wrap={false}>
                  <Text style={styles.skillName}>
                    {skill.name}
                    <Text style={{ color: "#9ca3af" }}>  —  </Text>
                    <Text style={{ color: LEVEL_COLOR[skill.level] }}>{LEVEL_LABEL[skill.level]}</Text>
                  </Text>
                  <Text style={styles.skillSummary}>{skill.summary}</Text>
                  {skill.quote && (
                    <Text style={styles.quote}>
                      &ldquo;{skill.quote}&rdquo;{skill.form ? `  (${skill.form})` : ""}
                    </Text>
                  )}
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>Not rated yet.</Text>
            )}
          </View>
        ))}
      </Page>
    </Document>
  );
}
