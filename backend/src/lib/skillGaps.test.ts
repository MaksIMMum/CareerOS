import { describe, expect, it } from 'vitest';
import { aggregateSkillGaps, type AnalysisSkills } from './skillGaps.js';

const a = (id: string, createdAt: string, missingSkills: string[], vacancyTitle = `Job ${id}`): AnalysisSkills => ({
  id,
  vacancyTitle,
  company: 'Acme',
  createdAt,
  missingSkills,
});

describe('aggregateSkillGaps', () => {
  it('counts each skill once per analysis and sorts by count', () => {
    const report = aggregateSkillGaps(
      [
        a('1', '2026-11-01', ['Docker', 'PostgreSQL']),
        a('2', '2026-11-02', ['Docker', 'Kubernetes']),
        a('3', '2026-11-03', ['Docker', 'docker', 'PostgreSQL']),
      ],
      [],
    );
    expect(report.analyses).toBe(3);
    expect(report.skills.map((s) => [s.skill, s.count])).toEqual([
      ['Docker', 3],
      ['PostgreSQL', 2],
      ['Kubernetes', 1],
    ]);
  });

  it('groups aliases and shows the most common spelling', () => {
    const report = aggregateSkillGaps(
      [
        a('1', '2026-11-01', ['Postgres']),
        a('2', '2026-11-02', ['PostgreSQL']),
        a('3', '2026-11-03', ['PostgreSQL']),
        a('4', '2026-11-04', ['K8s']),
        a('5', '2026-11-05', ['Kubernetes']),
      ],
      [],
    );
    expect(report.skills.map((s) => [s.skill, s.count])).toEqual([
      ['PostgreSQL', 3],
      ['Kubernetes', 2], // tie between spellings → the most recent one
    ]);
  });

  it('lists the vacancies newest first', () => {
    const report = aggregateSkillGaps(
      [a('old', '2026-10-01', ['SQL'], 'Old job'), a('new', '2026-11-01', ['SQL'], 'New job')],
      [],
    );
    expect(report.skills[0]!.vacancies).toEqual([
      { analysisId: 'new', title: 'New job', company: 'Acme' },
      { analysisId: 'old', title: 'Old job', company: 'Acme' },
    ]);
  });

  it('marks skills that a current CV now mentions (any spelling)', () => {
    const report = aggregateSkillGaps(
      [a('1', '2026-11-01', ['Docker', 'PostgreSQL', 'C#'])],
      [
        { name: 'Backend CV', text: 'Node.js, Docker, Git' },
        { name: 'Data CV', text: 'SQL, Postgres, Python' },
      ],
    );
    const by = Object.fromEntries(report.skills.map((s) => [s.skill, s.inCvs]));
    expect(by).toEqual({ Docker: ['Backend CV'], PostgreSQL: ['Data CV'], 'C#': [] });
  });

  it('handles no analyses and blank skills', () => {
    expect(aggregateSkillGaps([], [])).toEqual({ analyses: 0, skills: [] });
    expect(aggregateSkillGaps([a('1', '2026-11-01', ['  ', ''])], []).skills).toEqual([]);
  });
});
