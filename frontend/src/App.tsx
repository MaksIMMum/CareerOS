import { useTranslation } from 'react-i18next';

export function App() {
  const { t, i18n } = useTranslation();

  const toggleLanguage = () => {
    const nextLang = i18n.language === 'uk' ? 'en' : 'uk';
    i18n.changeLanguage(nextLang);
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-2xl font-bold tracking-tight text-blue-600">CareerOS</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
              v0.1
            </span>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={toggleLanguage}
              className="px-3 py-1.5 text-sm font-medium border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors"
            >
              🌐 {i18n.language === 'uk' ? 'English' : 'Українська'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-12 flex-1 flex flex-col justify-center">
        <div className="text-center max-w-2xl mx-auto">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight">
            {t('tagline')}
          </h1>
          <p className="mt-4 text-lg text-slate-600">
            {t('subtitle')}
          </p>

          <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-sm">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            {t('status')}
          </div>
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-3xl mb-3">📄</div>
            <h3 className="font-semibold text-lg text-slate-800 mb-2">CV Analysis</h3>
            <p className="text-sm text-slate-600">{t('features.analysis')}</p>
          </div>
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-3xl mb-3">📊</div>
            <h3 className="font-semibold text-lg text-slate-800 mb-2">Application Tracker</h3>
            <p className="text-sm text-slate-600">{t('features.tracker')}</p>
          </div>
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-3xl mb-3">💬</div>
            <h3 className="font-semibold text-lg text-slate-800 mb-2">Mock Interview</h3>
            <p className="text-sm text-slate-600">{t('features.interview')}</p>
          </div>
        </div>

        <div className="mt-10 p-4 bg-blue-50 border border-blue-200 rounded-lg text-center text-sm text-blue-900">
          {t('placeholderNotice')}
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white py-6">
        <div className="max-w-5xl mx-auto px-4 text-center text-xs text-slate-500">
          CareerOS — Built with React, AWS Serverless, and Google Gemini API (AWS Free Tier).
        </div>
      </footer>
    </div>
  );
}

export default App;
