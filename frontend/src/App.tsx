import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.js';
import { Navbar } from './components/Navbar.js';
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

export function App() {
  return (
    <AuthProvider>
      <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans">
        <Navbar />
        <div className="flex-1 flex flex-col">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/signup" element={<SignUpPage />} />
            <Route path="/confirm" element={<ConfirmCodePage />} />
            <Route path="/signin" element={<SignInPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            {/* Public share card — no login */}
            <Route path="/s/:shareId" element={<SharePage />} />
            <Route
              path="/app"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/cvs"
              element={
                <ProtectedRoute>
                  <CvsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/analyses"
              element={
                <ProtectedRoute>
                  <HistoryPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/analyses/new"
              element={
                <ProtectedRoute>
                  <NewAnalysisPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/analyses/:id"
              element={
                <ProtectedRoute>
                  <AnalysisResultPage />
                </ProtectedRoute>
              }
            />
            {/* Any other /app/* path still requires a session, then lands on the dashboard */}
            <Route
              path="/app/*"
              element={
                <ProtectedRoute>
                  <Navigate to="/app" replace />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </AuthProvider>
  );
}

export default App;
