import { skillKey } from "@/lib/skills/frameworks";

const MAX_SKILLS = 10;

// Reads the skill rows from the skills editor (course or workshop). Keys of
// skills that already existed are kept so existing ratings still match.
export function parseSkillsForm(
  formData: FormData,
): { skills: { key: string; name: string; description: string }[] } | { error: string } {
  const names = formData.getAll("skill_name").map((v) => String(v).trim());
  const descriptions = formData.getAll("skill_description").map((v) => String(v).trim());
  const keys = formData.getAll("skill_key").map((v) => String(v).trim());

  const skills: { key: string; name: string; description: string }[] = [];
  const usedKeys = new Set<string>();
  names.forEach((name, i) => {
    if (!name) return;
    let key = keys[i] || skillKey(name);
    while (usedKeys.has(key)) key = `${key}_2`;
    usedKeys.add(key);
    skills.push({ key, name, description: descriptions[i] ?? "" });
  });

  if (skills.length === 0) return { error: "Add at least one skill." };
  if (skills.length > MAX_SKILLS) return { error: `Keep it to ${MAX_SKILLS} skills or fewer.` };
  const lower = skills.map((s) => s.name.toLowerCase());
  if (new Set(lower).size !== lower.length) return { error: "Two skills have the same name." };
  return { skills };
}
