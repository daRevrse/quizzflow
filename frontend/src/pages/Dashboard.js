import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import { quizService, sessionService } from "../services/api";
import LoadingSpinner from "../components/common/LoadingSpinner";
import {
  PlusIcon,
  PuzzlePieceIcon,
  UserGroupIcon,
  ChartBarIcon,
  PlayIcon,
  EyeIcon,
  CalendarIcon,
  ClockIcon,
  TrophyIcon,
  FireIcon,
} from "@heroicons/react/24/outline";
import { format, isToday, isYesterday, subDays } from "date-fns";
import { fr } from "date-fns/locale";

const Dashboard = () => {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalQuizzes: 0,
    totalSessions: 0,
    totalParticipants: 0,
    averageScore: 0,
  });
  const [recentQuizzes, setRecentQuizzes] = useState([]);
  const [recentSessions, setRecentSessions] = useState([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Charger les quiz récents
      const quizzesResponse = await quizService.getMyQuizzes({ limit: 5 });
      setRecentQuizzes(quizzesResponse.quizzes || []);

      // Charger les sessions récentes (si formateur ou admin)
      if (user?.role === "formateur" || user?.role === "admin") {
        const sessionsResponse = await sessionService.getSessions({
          my: true,
          limit: 5,
        });
        setRecentSessions(sessionsResponse.sessions || []);

        // Calculer les statistiques
        setStats({
          totalQuizzes: quizzesResponse.pagination?.total || 0,
          totalSessions: sessionsResponse.pagination?.total || 0,
          totalParticipants:
            sessionsResponse.sessions?.reduce(
              (total, session) => total + (session.participantCount || 0),
              0
            ) || 0,
          averageScore: 85, // Placeholder, à calculer depuis les vraies données
        });
      } else {
        // Statistiques pour les étudiants
        setStats({
          totalQuizzes: 0, // Quiz auxquels il a participé
          totalSessions: 0, // Sessions auxquelles il a participé
          totalParticipants: 0,
          averageScore: 0, // Son score moyen
        });
      }
    } catch (error) {
      console.error("Erreur lors du chargement du dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    if (isToday(date)) {
      return "Aujourd'hui";
    } else if (isYesterday(date)) {
      return "Hier";
    } else {
      return format(date, "dd MMM yyyy", { locale: fr });
    }
  };

  const getSessionStatusBadge = (status) => {
    const badges = {
      waiting: "badge-warning",
      active: "badge-success",
      paused: "badge-warning",
      finished: "badge-gray",
      cancelled: "badge-danger",
    };

    const labels = {
      waiting: "En attente",
      active: "Active",
      paused: "En pause",
      finished: "Terminée",
      cancelled: "Annulée",
    };

    return (
      <span className={`badge ${badges[status] || "badge-gray"}`}>
        {labels[status] || status}
      </span>
    );
  };

  const quickActions =
    user?.role === "formateur" || user?.role === "admin"
      ? [
          {
            name: "Créer un Quiz",
            description: "Nouveau quiz interactif",
            href: "/quiz/create",
            icon: PlusIcon,
            color: "bg-primary-500 hover:bg-primary-600",
          },
          {
            name: "Lancer une Session",
            description: "Session en temps réel",
            href: "/session/create",
            icon: PlayIcon,
            color: "bg-secondary-500 hover:bg-secondary-600",
          },
          {
            name: "Mes Quiz",
            description: "Gérer mes quiz",
            href: "/quiz",
            icon: PuzzlePieceIcon,
            color: "bg-success-500 hover:bg-success-600",
          },
        ]
      : [
          {
            name: "Rejoindre",
            description: "Rejoindre un quiz",
            href: "/join",
            icon: UserGroupIcon,
            color: "bg-primary-500 hover:bg-primary-600",
          },
          {
            name: "Mes Résultats",
            description: "Voir mes scores",
            href: "/results",
            icon: TrophyIcon,
            color: "bg-secondary-500 hover:bg-secondary-600",
          },
        ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <LoadingSpinner size="lg" text="Chargement du dashboard..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Bonjour {user?.firstName || user?.username} 👋
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {user?.role === "formateur"
              ? "Voici un aperçu de vos activités pédagogiques"
              : user?.role === "admin"
              ? "Vue d'ensemble de la plateforme"
              : "Bienvenue sur votre espace personnel"}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {format(new Date(), "EEEE d MMMM yyyy", { locale: fr })}
          </span>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <PuzzlePieceIcon className="h-8 w-8 text-primary-600 dark:text-primary-400" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                  {user?.role === "etudiant" ? "Quiz Participés" : "Quiz Créés"}
                </dt>
                <dd className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats.totalQuizzes}
                </dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <UserGroupIcon className="h-8 w-8 text-secondary-600 dark:text-secondary-400" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                  Sessions
                </dt>
                <dd className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats.totalSessions}
                </dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <FireIcon className="h-8 w-8 text-warning-600 dark:text-warning-400" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                  Participants
                </dt>
                <dd className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats.totalParticipants}
                </dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <TrophyIcon className="h-8 w-8 text-success-600 dark:text-success-400" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                  Score Moyen
                </dt>
                <dd className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats.averageScore}%
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      {/* Actions rapides */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">
            Actions rapides
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {quickActions.map((action) => {
            const IconComponent = action.icon;
            return (
              <Link
                key={action.name}
                to={action.href}
                className="group relative rounded-lg p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all duration-200"
              >
                <div>
                  <span
                    className={`rounded-lg inline-flex p-3 text-white ${action.color} group-hover:scale-105 transition-transform duration-200`}
                  >
                    <IconComponent className="h-6 w-6" />
                  </span>
                </div>
                <div className="mt-4">
                  <h3 className="text-base font-medium text-gray-900 dark:text-white">
                    {action.name}
                  </h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {action.description}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Contenu récent */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Quiz récents */}
        <div className="card">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                {user?.role === "etudiant"
                  ? "Quiz Récents"
                  : "Mes Quiz Récents"}
              </h2>
              <Link
                to="/quiz"
                className="text-sm font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400"
              >
                Voir tout
              </Link>
            </div>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {recentQuizzes.length === 0 ? (
              <div className="px-6 py-8 text-center">
                <PuzzlePieceIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {user?.role === "etudiant"
                    ? "Aucun quiz participé"
                    : "Aucun quiz créé"}
                </p>
                {(user?.role === "formateur" || user?.role === "admin") && (
                  <Link
                    to="/quiz/create"
                    className="mt-2 inline-flex items-center text-sm font-medium text-primary-600 hover:text-primary-500"
                  >
                    <PlusIcon className="h-4 w-4 mr-1" />
                    Créer votre premier quiz
                  </Link>
                )}
              </div>
            ) : (
              recentQuizzes.map((quiz) => (
                <div
                  key={quiz.id}
                  className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <Link
                        to={`/quiz/${quiz.id}`}
                        className="text-sm font-medium text-gray-900 dark:text-white hover:text-primary-600 truncate"
                      >
                        {quiz.title}
                      </Link>
                      <div className="flex items-center mt-1 text-xs text-gray-500 dark:text-gray-400">
                        <span>{quiz.questionCount} questions</span>
                        <span className="mx-1">•</span>
                        <span>{quiz.category || "Sans catégorie"}</span>
                        <span className="mx-1">•</span>
                        <span>{formatDate(quiz.createdAt)}</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {quiz.stats?.totalSessions > 0 && (
                        <span className="text-xs text-success-600 dark:text-success-400">
                          {quiz.stats.totalSessions} sessions
                        </span>
                      )}
                      <Link
                        to={`/quiz/${quiz.id}`}
                        className="text-gray-400 hover:text-gray-500"
                      >
                        <EyeIcon className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Sessions récentes */}
        {(user?.role === "formateur" || user?.role === "admin") && (
          <div className="card">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                  Sessions Récentes
                </h2>
                <Link
                  to="/sessions"
                  className="text-sm font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400"
                >
                  Voir tout
                </Link>
              </div>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {recentSessions.length === 0 ? (
                <div className="px-6 py-8 text-center">
                  <PlayIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Aucune session lancée
                  </p>
                  <Link
                    to="/session/create"
                    className="mt-2 inline-flex items-center text-sm font-medium text-primary-600 hover:text-primary-500"
                  >
                    <PlayIcon className="h-4 w-4 mr-1" />
                    Lancer votre première session
                  </Link>
                </div>
              ) : (
                recentSessions.map((session) => (
                  <div
                    key={session.id}
                    className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {session.title}
                          </span>
                          {getSessionStatusBadge(session.status)}
                        </div>
                        <div className="flex items-center mt-1 text-xs text-gray-500 dark:text-gray-400">
                          <CalendarIcon className="h-3 w-3 mr-1" />
                          <span>{formatDate(session.createdAt)}</span>
                          <span className="mx-1">•</span>
                          <UserGroupIcon className="h-3 w-3 mr-1" />
                          <span>
                            {session.participantCount || 0} participants
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-mono bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                          {session.code}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Section vide pour les étudiants */}
      {user?.role === "etudiant" && (
        <div className="card p-6 text-center">
          <UserGroupIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Prêt à apprendre ?
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Rejoignez un quiz interactif avec le code fourni par votre formateur
          </p>
          <Link to="/join" className="btn-primary">
            Rejoindre un Quiz
          </Link>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
