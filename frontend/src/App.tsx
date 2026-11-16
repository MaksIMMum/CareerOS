import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.js';
import { AppHeader } from './components/Navbar.js';
import { ProtectedRoute } from './components/ProtectedRoute.js';
import { LandingPage } from './pages/LandingPage.js';
import { SignUpPage } from './pages/SignUpPage.js';
import { ConfirmCodePage } from './pages/ConfirmCodePage.js';
import { SignInPage } from './pages/SignInPage.js';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { CvsPage } from './pages/CvsPage.js';
import { NewAnalysisPage } from './pages/NewAnalysisPage.js';
import { AnalysisResultPage } from './pages/AnalysisResultPage.js';
import { HistoryPage } from './pages/HistoryPage.js';
import { SharePage } from './pages/SharePage.js';
import { TrackerPage } from './pages/TrackerPage.js';
import { InterviewsPage } from './pages/InterviewsPage.js';
import { NewInterviewPage } from './pages/NewInterviewPage.js';
import { InterviewPage } from './pages/InterviewPage.js';

/** Every /app page: requires a session, shares the app header. */
function AppLayout() {
  return (
    <ProtectedRoute>
      <div className="min-h-screen flex flex-col bg-canvas">
        <AppHeader />
        <div className="flex-1 flex flex-col">
          <Outlet />
        </div>
      </div>
    </ProtectedRoute>
  );
}

export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/signup" element={<SignUpPage />} />
        <Route path="/confirm" element={<ConfirmCodePage />} />
        <Route path="/signin" element={<SignInPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        {/* Public share card — no login */}
        <Route path="/s/:shareId" element={<SharePage />} />
        <Route path="/app" element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="cvs" element={<CvsPage />} />
          <Route path="analyses" element={<HistoryPage />} />
          <Route path="analyses/new" element={<NewAnalysisPage />} />
          <Route path="analyses/:id" element={<AnalysisResultPage />} />
          <Route path="tracker" element={<TrackerPage />} />
          <Route path="interviews" element={<InterviewsPage />} />
          <Route path="interviews/new" element={<NewInterviewPage />} />
          <Route path="interviews/:id" element={<InterviewPage />} />
          {/* Any other /app/* path still requires a session, then lands on the overview */}
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
