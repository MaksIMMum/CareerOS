import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchAdminMetrics, type AdminMetrics } from '../lib/api.js';
import { fillDays } from '../lib/adminChart.js';

export const AdminPage: React.FC = () => {
  const { t } = useTranslation();
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [excludeTeam, setExcludeTeam] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAdminMetrics()
      .then(setMetrics)
      .catch((err) => {
        setError(err.status === 403 ? t('adminPage.forbidden') : err.message);
      })
      .finally(() => setLoading(false));
  }, [t]);

  // Filter cohort based on excludeTeam toggle
  const filtered = useMemo(() => {
    if (!metrics) return null;

    const users = metrics.users.filter((u) => (excludeTeam ? !u.isTeam : true));
    const feedback = metrics.feedback.filter((f) => (excludeTeam ? !f.isTeam : true));
    const donations = metrics.donations.filter((d) => (excludeTeam ? !d.isTeam : true));

    const totalSignups = users.length;
    const realUseCount = users.filter((u) => u.hasRealUse).length;
    const returnCount = users.filter((u) => u.hasReturn).length;

    const realUsePercent = totalSignups > 0 ? Math.round((realUseCount / totalSignups) * 100) : 0;
    const returnPercent = totalSignups > 0 ? Math.round((returnCount / totalSignups) * 100) : 0;

    const signupsByDay: Record<string, number> = {};
    const signupsBySource: Record<string, number> = {};
    const signupsBySrc: Record<string, number> = {};

    for (const u of users) {
      const day = u.createdAt ? u.createdAt.slice(0, 10) : 'unknown';
      signupsByDay[day] = (signupsByDay[day] || 0) + 1;

      const srcAnswer = u.source || 'unknown';
      signupsBySource[srcAnswer] = (signupsBySource[srcAnswer] || 0) + 1;

      if (u.src) {
        signupsBySrc[u.src] = (signupsBySrc[u.src] || 0) + 1;
      }
    }

    const totalDonated = donations.reduce((sum, d) => sum + (d.amount || 0), 0);

    return {
      users,
      feedback,
      donations,
      totals: {
        signups: totalSignups,
        realUse: realUseCount,
        realUsePercent,
        returnUsers: returnCount,
        returnPercent,
        donationClicks: metrics.totals.donationClicks,
        donationsReported: donations.length,
        totalDonatedAmount: totalDonated,
        feedbackCount: feedback.length,
      },
      signupsByDay,
      signupsBySource,
      signupsBySrc,
    };
  }, [metrics, excludeTeam]);

  const handleExportCsv = () => {
    if (!filtered) return;

    const headers = [
      'user_id',
      'created_at',
      'source_answer',
      'src_campaign',
      'analyses_count',
      'interviews_count',
      'applications_count',
      'days_active',
      'has_real_use',
      'has_return',
      'is_team',
    ];

    const rows = filtered.users.map((u) => [
      u.id,
      u.createdAt,
      `"${u.source}"`,
      `"${u.src || ''}"`,
      u.analysesCount,
      u.interviewsCount,
      u.applicationsCount,
      u.daysActive,
      u.hasRealUse ? '1' : '0',
      u.hasReturn ? '1' : '0',
      u.isTeam ? '1' : '0',
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `careeros-user-cohort-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-8">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-xs text-slate-500">{t('adminPage.loading')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-xl mx-auto p-8 text-center">
        <span className="text-4xl block mb-3">🔒</span>
        <h2 className="text-lg font-bold text-slate-900 mb-2">{t('adminPage.forbidden')}</h2>
        <p className="text-xs text-slate-500">{error}</p>
      </div>
    );
  }

  if (!filtered) return null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 sm:py-10 space-y-8">
      {/* Top Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[11px] font-semibold mb-2">
            <span>📊</span> {t('adminPage.badge')}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            {t('adminPage.title')}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer bg-slate-100 hover:bg-slate-200/80 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 transition-colors">
            <input
              type="checkbox"
              checked={excludeTeam}
              onChange={(e) => setExcludeTeam(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span>{t('adminPage.excludeTeam')}</span>
          </label>

          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors shadow-sm"
          >
            <span>📥</span> {t('adminPage.exportCsv')}
          </button>
        </div>
      </div>

      {/* Product Signals (One-Pager targets comparison) */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">
          {t('adminPage.signalsTitle')}
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500">{t('adminPage.signupsCard')}</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                {t('adminPage.targetSignups')}
              </span>
            </div>
            <div className="text-3xl font-extrabold text-slate-900">{filtered.totals.signups}</div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500">{t('adminPage.realUseCard')}</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                {t('adminPage.targetRealUse')}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-900">{filtered.totals.realUsePercent}%</span>
              <span className="text-xs text-slate-500 font-medium">{t('adminPage.usersCount', { count: filtered.totals.realUse })}</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">{t('adminPage.realUseSub')}</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500">{t('adminPage.returnCard')}</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                {t('adminPage.targetReturn')}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-900">{filtered.totals.returnPercent}%</span>
              <span className="text-xs text-slate-500 font-medium">{t('adminPage.usersCount', { count: filtered.totals.returnUsers })}</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">{t('adminPage.returnSub')}</p>
          </div>
        </div>
      </div>

      {/* Donations and Feedback Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="bg-gradient-to-br from-amber-50/70 to-yellow-50/40 p-5 rounded-2xl border border-amber-200 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">💛</span>
            <h3 className="font-bold text-slate-900 text-sm">{t('adminPage.donationsTitle')}</h3>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-white/80 p-3 rounded-xl border border-amber-200/60">
              <span className="block text-[11px] text-slate-500 mb-1">{t('adminPage.clicks')}</span>
              <span className="text-lg font-bold text-slate-900">{filtered.totals.donationClicks}</span>
            </div>
            <div className="bg-white/80 p-3 rounded-xl border border-amber-200/60">
              <span className="block text-[11px] text-slate-500 mb-1">{t('adminPage.reported')}</span>
              <span className="text-lg font-bold text-emerald-700">{filtered.totals.donationsReported}</span>
            </div>
            <div className="bg-white/80 p-3 rounded-xl border border-amber-200/60">
              <span className="block text-[11px] text-slate-500 mb-1">{t('adminPage.totalAmount')}</span>
              <span className="text-lg font-bold text-slate-900">{filtered.totals.totalDonatedAmount} ₴</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">💬</span>
              <h3 className="font-bold text-slate-900 text-sm">{t('adminPage.feedbackTitle')}</h3>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
              {filtered.feedback.length} items
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/60">
              <span className="block text-[11px] text-slate-500 mb-1">{t('adminPage.avgRating')}</span>
              <span className="text-lg font-bold text-slate-900">
                {filtered.feedback.length > 0
                  ? (filtered.feedback.reduce((sum, f) => sum + f.rating, 0) / filtered.feedback.length).toFixed(1)
                  : '—'}{' '}
                / 5
              </span>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/60">
              <span className="block text-[11px] text-slate-500 mb-1">{t('adminPage.callRequested')}</span>
              <span className="text-lg font-bold text-blue-600">
                {filtered.feedback.filter((f) => f.callRequested).length}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Sign-ups per day */}
      <SignupsChart byDay={filtered.signupsByDay} />

      {/* Attribution: Source & Campaign breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-3">
            {t('adminPage.byAnswer')}
          </h3>
          <div className="space-y-2">
            {Object.entries(filtered.signupsBySource).map(([src, count]) => (
              <div key={src} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100 last:border-none">
                <span className="font-medium text-slate-700 capitalize">{src}</span>
                <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-lg">{count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-3">
            {t('adminPage.byCampaign')}
          </h3>
          <div className="space-y-2">
            {Object.keys(filtered.signupsBySrc).length === 0 ? (
              <p className="text-xs text-slate-400 py-2">{t('adminPage.noData')}</p>
            ) : (
              Object.entries(filtered.signupsBySrc).map(([tag, count]) => (
                <div key={tag} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100 last:border-none">
                  <span className="font-mono text-blue-600">{tag}</span>
                  <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-lg">{count}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Feedback Messages List */}
      {filtered.feedback.length > 0 && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-900 text-sm mb-4">
            {t('adminPage.feedbackTitle')}
          </h3>
          <div className="space-y-3">
            {filtered.feedback.map((f) => (
              <div key={f.id} className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-500">{'★'.repeat(f.rating)}</span>
                  <span className="text-slate-400 text-[11px]">{new Date(f.createdAt).toLocaleDateString()}</span>
                </div>
                {f.useful && (
                  <p className="text-slate-700">
                    <strong className="text-slate-900">{t('adminPage.useful')}:</strong> {f.useful}
                  </p>
                )}
                {f.confusing && (
                  <p className="text-slate-700">
                    <strong className="text-slate-900">{t('adminPage.confusing')}:</strong> {f.confusing}
                  </p>
                )}
                {f.callRequested && (
                  <div className="mt-2 inline-flex items-center gap-1.5 bg-blue-100 text-blue-900 px-2.5 py-1 rounded-lg font-semibold text-[11px]">
                    <span>📞 {t('adminPage.callRequested')}:</span>
                    <span>{f.contact || 'No contact provided'}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Anonymized User Cohort Table for Report */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-sm">
            {t('adminPage.usersTableTitle')}
          </h3>
          <span className="text-xs font-semibold text-slate-500">
            {filtered.users.length} cohort users
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
              <tr>
                <th className="px-4 py-3">{t('adminPage.userCol')}</th>
                <th className="px-4 py-3">{t('adminPage.joinedCol')}</th>
                <th className="px-4 py-3 text-center">{t('adminPage.analysesCol')}</th>
                <th className="px-4 py-3 text-center">{t('adminPage.interviewsCol')}</th>
                <th className="px-4 py-3 text-center">{t('adminPage.trackerCol')}</th>
                <th className="px-4 py-3 text-center">{t('adminPage.activeDaysCol')}</th>
                <th className="px-4 py-3 text-center">{t('adminPage.realUseCol')}</th>
                <th className="px-4 py-3 text-center">{t('adminPage.returnCol')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3 font-mono text-slate-700 font-medium">
                    {u.id}
                    {u.isTeam && (
                      <span className="ml-1.5 text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-semibold">
                        {t('adminPage.teamBadge')}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {u.createdAt ? u.createdAt.slice(0, 10) : '—'}
                  </td>
                  <td className="px-4 py-3 text-center font-bold text-slate-800">{u.analysesCount}</td>
                  <td className="px-4 py-3 text-center font-bold text-slate-800">{u.interviewsCount}</td>
                  <td className="px-4 py-3 text-center font-bold text-slate-800">{u.applicationsCount}</td>
                  <td className="px-4 py-3 text-center text-slate-600">{u.daysActive}</td>
                  <td className="px-4 py-3 text-center">
                    {u.hasRealUse ? (
                      <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full text-[11px]">
                        ✓ Yes
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {u.hasReturn ? (
                      <span className="text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded-full text-[11px]">
                        ✓ Return
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

/** Horizontal bars, one row per day: readable on a phone and accessible as a plain list. */
const SignupsChart: React.FC<{ byDay: Record<string, number> }> = ({ byDay }) => {
  const { t, i18n } = useTranslation();
  const rows = fillDays(byDay);
  const max = Math.max(1, ...rows.map((r) => r.count));
  const fmt = (ymd: string) =>
    new Date(`${ymd}T00:00:00Z`).toLocaleDateString(i18n.language === 'en' ? 'en-GB' : 'uk-UA', {
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    });
  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
      <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-3">{t('adminPage.dayTimeline')}</h3>
      {rows.length === 0 ? (
        <p className="text-xs text-slate-400 py-2">{t('adminPage.noData')}</p>
      ) : (
        <ul className="space-y-1.5 max-h-[420px] overflow-y-auto">
          {rows.map((r) => (
            <li key={r.day} className="flex items-center gap-3 text-xs">
              <span className="w-16 shrink-0 text-slate-500 tabular-nums">{fmt(r.day)}</span>
              <span className="flex-1 h-4 rounded bg-slate-100 overflow-hidden" aria-hidden="true">
                <span className="block h-full rounded bg-blue-600" style={{ width: `${(r.count / max) * 100}%` }} />
              </span>
              <span className="w-8 shrink-0 text-right font-bold text-slate-900 tabular-nums">{r.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
