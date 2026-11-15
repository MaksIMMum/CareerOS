import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext.js';
import { PublicHeader } from '../components/Navbar.js';
import { Icon } from '../components/ui.js';

const h2 = 'font-display font-extrabold text-[28px] sm:text-[36px] leading-[1.15] tracking-[-0.02em]';

/** Illustrative result card in the hero (static example, labelled as such). */
const ExampleCard: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="flex-[1_1_420px] min-w-0 bg-white border border-line rounded-[20px] p-5 sm:p-7 shadow-float">
      <div className="flex justify-between items-start gap-4 mb-6">
        <div className="min-w-0">
          <p className="eyebrow mb-1">{t('landing.example.label')}</p>
          <p className="font-display font-bold text-lg leading-snug">Junior Backend Developer (Node.js)</p>
        </div>
        <span className="chip-neutral shrink-0">Backend CV</span>
      </div>
      <div className="flex flex-wrap items-center gap-4 sm:gap-5 p-5 rounded-[14px] bg-canvas mb-6">
        <div className="text-center">
          <p className="font-mono font-bold text-[40px] leading-none text-ink-faint">58</p>
          <p className="mt-1.5 text-[13px] text-ink-muted">{t('landing.example.before')}</p>
        </div>
        <Icon.arrowRight className="w-8 h-8 text-ink-faint" />
        <div className="text-center">
          <p className="font-mono font-bold text-[56px] leading-none text-accent">81</p>
          <p className="mt-1.5 text-[13px] text-ink-muted">{t('landing.example.after')}</p>
        </div>
        <div className="flex-[1_1_120px] min-w-0">
          <div className="h-2.5 rounded-full bg-line overflow-hidden">
            <div className="h-full bg-accent" style={{ width: '81%' }} />
          </div>
          <p className="mt-2 text-[13px] text-ink-muted">{t('landing.example.scale')}</p>
        </div>
      </div>
      <p className="mb-2.5 text-sm font-semibold">{t('landing.example.matched')}</p>
      <div className="flex flex-wrap gap-2 mb-5">
        {['Node.js', 'REST API', 'PostgreSQL', 'Git'].map((s) => (
          <span key={s} className="chip-ok">{s}</span>
        ))}
      </div>
      <p className="mb-2.5 text-sm font-semibold">{t('landing.example.missing')}</p>
      <div className="flex flex-wrap gap-2">
        {['Docker', t('landing.example.unitTests'), 'AWS'].map((s) => (
          <span key={s} className="chip-miss">{s}</span>
        ))}
      </div>
    </div>
  );
};

export const LandingPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const startTo = user ? '/app/analyses/new' : '/signup';

  const steps = [
    ['01', t('landing.how.s1Title'), t('landing.how.s1Text')],
    ['02', t('landing.how.s2Title'), t('landing.how.s2Text')],
    ['03', t('landing.how.s3Title'), t('landing.how.s3Text')],
  ];
  const features: Array<[React.ReactNode, string, string, boolean]> = [
    [<Icon.search className="w-10 h-10" />, t('landing.features.analysisTitle'), t('landing.features.analysisText'), false],
    [<Icon.columns className="w-10 h-10" />, t('landing.features.trackerTitle'), t('landing.features.trackerText'), true],
    [<Icon.chat className="w-10 h-10" />, t('landing.features.interviewTitle'), t('landing.features.interviewText'), true],
  ];

  return (
    <div className="min-h-screen bg-canvas">
      <PublicHeader />

      {/* Hero */}
      <section className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-12 pb-14 sm:pt-[88px] sm:pb-[72px] flex flex-wrap gap-10 lg:gap-14 items-center">
        <div className="flex-[1_1_480px] min-w-0">
          <p className="mb-5 inline-flex items-center px-3.5 py-2 rounded-full bg-white border border-line font-mono text-[13px] font-medium leading-none text-ink-soft">
            {t('landing.badge')}
          </p>
          <h1 className="mb-6 font-display font-extrabold text-[40px] sm:text-[60px] leading-[1.05] tracking-[-0.035em]">{t('landing.title')}</h1>
          <p className="mb-8 text-[17px] sm:text-[19px] leading-[1.55] text-ink-soft max-w-[540px]">{t('landing.lead')}</p>
          <div className="flex flex-col sm:flex-row flex-wrap gap-3 mb-5">
            <Link to={startTo} className="btn-primary btn-lg">{t('landing.ctaPrimary')}</Link>
            {user ? (
              <Link to="/app" className="btn-secondary btn-lg font-sans font-semibold">{t('landing.ctaDashboard')}</Link>
            ) : (
              <Link to="/signin" className="btn-secondary btn-lg font-sans font-semibold">{t('landing.ctaSecondary')}</Link>
            )}
          </div>
          <p className="text-sm text-ink-muted">{t('landing.note')}</p>
        </div>
        <ExampleCard />
      </section>

      {/* How it works */}
      <section id="how" className="bg-white border-y border-line scroll-mt-4">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <h2 className={`${h2} mb-10`}>{t('landing.how.title')}</h2>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-6">
            {steps.map(([n, title, text]) => (
              <div key={n} className="p-7 rounded-2xl bg-canvas">
                <p className="mb-5 font-mono font-bold text-sm text-accent">{n}</p>
                <h3 className="mb-2.5 font-display font-bold text-[21px] leading-snug">{title}</h3>
                <p className="text-base leading-[1.55] text-ink-soft">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-[1200px] mx-auto px-4 sm:px-6 py-16 sm:py-20 scroll-mt-4">
        <h2 className={`${h2} mb-3`}>{t('landing.features.title')}</h2>
        <p className="mb-10 text-lg text-ink-soft max-w-[640px]">{t('landing.features.lead')}</p>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] gap-6">
          {features.map(([icon, title, text, soon]) => (
            <div key={title} className="p-8 rounded-2xl bg-white border border-line">
              <div className="mb-5 flex items-start justify-between gap-3 text-accent">
                {icon}
                {soon && <span className="chip-neutral font-mono text-xs uppercase tracking-wider">{t('common.soon')}</span>}
              </div>
              <h3 className="mb-2.5 font-display font-bold text-[22px] leading-snug">{title}</h3>
              <p className="text-base leading-[1.55] text-ink-soft">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Honesty */}
      <section id="privacy" className="max-w-[1200px] mx-auto px-4 sm:px-6 pb-16 sm:pb-20 scroll-mt-4">
        <div className="flex flex-wrap gap-10 items-center p-7 sm:p-12 rounded-[20px] bg-night text-white">
          <div className="flex-[1_1_420px] min-w-0">
            <h2 className="mb-4 font-display font-extrabold text-[26px] sm:text-[32px] leading-[1.2] tracking-[-0.02em]">{t('landing.honesty.title')}</h2>
            <p className="text-[17px] leading-relaxed text-night-text">{t('landing.honesty.text')}</p>
          </div>
          <div className="flex-[1_1_360px] min-w-0 p-6 rounded-[14px] bg-night-card border border-night-line">
            <p className="eyebrow mb-3 text-night-muted">{t('landing.honesty.checkLabel')}</p>
            <div className="flex gap-3 items-start p-3.5 rounded-[10px] bg-[#3A2214] border border-[#7C3A16]">
              <Icon.warn className="w-5 h-5 shrink-0 mt-0.5 text-warn-light" />
              <p className="text-[15px] leading-normal text-[#FFE4D3]">{t('landing.honesty.example')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-white border-t border-line">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-14 sm:py-[72px] flex flex-wrap gap-8 items-center justify-between">
          <div className="flex-[1_1_480px] min-w-0">
            <h2 className={`${h2} mb-3`}>{t('landing.final.title')}</h2>
            <p className="text-[17px] text-ink-soft">{t('landing.final.text')}</p>
          </div>
          <Link to={startTo} className="btn-primary btn-lg w-full sm:w-auto">{t('landing.final.cta')}</Link>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-7 flex flex-wrap gap-4 justify-between text-sm text-ink-muted">
          <p>© 2026 CareerOS · {t('landing.footer.team')}</p>
          <nav aria-label={t('nav.footerNav')} className="flex gap-6">
            <a href="#privacy" className="text-accent">{t('nav.privacy')}</a>
          </nav>
        </div>
      </footer>
    </div>
  );
};
