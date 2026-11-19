import { aliasesOf, canonicalSkill, containsTerm } from './skillCheck.js';

/**
 * "What the market wants from you": the skills that vacancies keep asking for and the user's
 * CV lacked, counted across all their analyses. Pure data work — no AI call.
 */

export interface AnalysisSkills {
  id: string;
  vacancyTitle: string;
  company: string;
  createdAt: string;
  /** `missingSkills[].skill` of that analysis. */
  missingSkills: string[];
}

export interface SkillGap {
  /** Display name: the spelling used most often (ties → most recent). */
  skill: string;
  /** In how many analyses this skill was missing. */
  count: number;
  /** Those analyses, newest first. */
  vacancies: { analysisId: string; title: string; company: string }[];
  /** Names of the user's current CVs that now mention the skill (added since the analysis). */
  inCvs: string[];
}

export interface SkillGapReport {
  /** How many analyses the report is based on. */
  analyses: number;
  skills: SkillGap[];
}

export function aggregateSkillGaps(
  analyses: AnalysisSkills[],
  cvs: { name: string; text: string }[],
): SkillGapReport {
  const sorted = [...analyses].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const groups = new Map<
    string,
    { spellings: Map<string, number>; vacancies: SkillGap['vacancies']; seen: Set<string> }
  >();

  for (const a of sorted) {
    for (const raw of a.missingSkills) {
      const skill = raw.trim();
      if (!skill) continue;
      const key = canonicalSkill(skill);
      let g = groups.get(key);
      if (!g) {
        g = { spellings: new Map(), vacancies: [], seen: new Set() };
        groups.set(key, g);
      }
      g.spellings.set(skill, (g.spellings.get(skill) ?? 0) + 1);
      if (g.seen.has(a.id)) continue; // the same skill twice in one analysis counts once
      g.seen.add(a.id);
      g.vacancies.push({ analysisId: a.id, title: a.vacancyTitle, company: a.company });
    }
  }

  const skills: SkillGap[] = [...groups.entries()].map(([key, g]) => {
    // Map keeps insertion order (newest analysis first), so ties go to the most recent spelling.
    let skill = '';
    let best = 0;
    for (const [s, n] of g.spellings) if (n > best) [skill, best] = [s, n];
    const spellings = [...new Set([...g.spellings.keys(), ...aliasesOf(key)])];
    return {
      skill,
      count: g.vacancies.length,
      vacancies: g.vacancies,
      inCvs: cvs.filter((cv) => spellings.some((s) => containsTerm(cv.text, s))).map((cv) => cv.name),
    };
  });

  skills.sort((a, b) => b.count - a.count || a.skill.localeCompare(b.skill));
  return { analyses: analyses.length, skills };
}
