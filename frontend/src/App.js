import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { useAuthStore } from "./stores/authStore";
import { useThemeStore } from "./stores/themeStore";
import { SocketProvider } from "./contexts/SocketContext";
import { useEffect } from "react";

// Layout components
import Navbar from "./components/layout/Navbar";
import Sidebar from "./components/layout/Sidebar";
import LoadingSpinner from "./components/common/LoadingSpinner";

// Page components
import Home from "./pages/Home";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import Dashboard from "./pages/Dashboard";
import QuizList from "./pages/quiz/QuizList";
import QuizCreate from "./pages/quiz/QuizCreate";
import QuizEdit from "./pages/quiz/QuizEdit";
import QuizView from "./pages/quiz/QuizView";
import SessionCreate from "./pages/session/SessionCreate";
import SessionHost from "./pages/session/SessionHost";
import SessionJoin from "./pages/session/SessionJoin";
import SessionPlay from "./pages/session/SessionPlay";
import SessionResults from "./pages/session/SessionResults";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import AdminDashboard from "./pages/AdminDashboard";
import NotFound from "./pages/NotFound";

// Route guards
import ProtectedRoute from "./components/auth/ProtectedRoute";
import PublicOnlyRoute from "./components/auth/PublicOnlyRoute";
import SessionsList from "./pages/session/SessionsList";
import ParticipantResults from "./pages/session/ParticipantResults";
import ParticipantHistory from "./pages/participant/ParticipantHistory";
import Statistics from "./pages/Statistics";
import QuizPublicView from "./pages/quiz/QuizPublicView";

function App() {
  const { user, isLoading, initializeAuth } = useAuthStore();
  const { theme, initializeTheme } = useThemeStore();

  // Initialisation de l'application
  useEffect(() => {
    initializeAuth();
    initializeTheme();
  }, [initializeAuth, initializeTheme]);

  // Appliquer le thème sur l'élément racine
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme]);

  // Affichage du loader pendant l'initialisation
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            Chargement de l'application...
          </p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <SocketProvider>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
          <Routes>
            {/* Routes publiques (pages sans layout) */}
            <Route
              path="/login"
              element={
                <PublicOnlyRoute>
                  <Login />
                </PublicOnlyRoute>
              }
            />
            <Route
              path="/register"
              element={
                <PublicOnlyRoute>
                  <Register />
                </PublicOnlyRoute>
              }
            />

            {/* Routes avec layout principal */}
            <Route path="/*" element={<MainLayout />} />
          </Routes>

          {/* Toast notifications */}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: theme === "dark" ? "#374151" : "#ffffff",
                color: theme === "dark" ? "#f3f4f6" : "#1f2937",
                border: `1px solid ${theme === "dark" ? "#4b5563" : "#e5e7eb"}`,
                borderRadius: "8px",
                fontSize: "14px",
              },
              success: {
                iconTheme: {
                  primary: "#10b981",
                  secondary: "#ffffff",
                },
              },
              error: {
                iconTheme: {
                  primary: "#ef4444",
                  secondary: "#ffffff",
                },
              },
            }}
          />
        </div>
      </SocketProvider>
    </Router>
  );
}

// Layout principal avec navigation
function MainLayout() {
  const { user } = useAuthStore();

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar pour les utilisateurs connectés */}
      {user && (
        <div className="hidden lg:flex lg:w-64 lg:flex-col">
          <Sidebar />
        </div>
      )}

      {/* Contenu principal */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Navbar */}
        <Navbar />

        {/* Contenu de la page */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <Routes>
              {/* Page d'accueil */}
              <Route path="/" element={<Home />} />

              {/* Routes protégées */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />

              {/* Administration (Admin uniquement) */}
              <Route
                path="/admin"
                element={
                  <ProtectedRoute roles={["admin"]}>
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />

              {/* Gestion des quiz */}
              <Route
                path="/quiz"
                element={
                  <ProtectedRoute>
                    <QuizList />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/quiz/create"
                element={
                  <ProtectedRoute roles={["formateur", "admin"]}>
                    <QuizCreate />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/quiz/:id/edit"
                element={
                  <ProtectedRoute roles={["formateur", "admin"]}>
                    <QuizEdit />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/quiz/:id"
                element={
                  <ProtectedRoute>
                    <QuizView />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/quiz/:id/public"
                element={
                  <ProtectedRoute>
                    <QuizPublicView />
                  </ProtectedRoute>
                }
              />

              {/* Gestion des sessions */}
              <Route
                path="/session/create"
                element={
                  <ProtectedRoute roles={["formateur", "admin"]}>
                    <SessionCreate />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/session/:sessionId/host"
                element={
                  <ProtectedRoute roles={["formateur", "admin"]}>
                    <SessionHost />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/sessions"
                element={
                  <ProtectedRoute roles={["formateur", "admin"]}>
                    <SessionsList />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/session/:sessionId/results"
                element={
                  <ProtectedRoute roles={["formateur", "admin"]}>
                    <SessionResults />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/join/:code?"
                element={
                  <ProtectedRoute>
                    <SessionJoin />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/session/:sessionId/play"
                element={
                  <ProtectedRoute>
                    <SessionPlay />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/session/:sessionId/participant/:participantId/results"
                element={
                  <ProtectedRoute>
                    <ParticipantResults />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/results"
                element={
                  <ProtectedRoute>
                    <ParticipantHistory />
                  </ProtectedRoute>
                }
              />

              {/* Profil et paramètres */}
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <ProtectedRoute>
                    <Settings />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/stats"
                element={
                  <ProtectedRoute>
                    <Statistics />
                  </ProtectedRoute>
                }
              />

              {/* Page 404 */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
