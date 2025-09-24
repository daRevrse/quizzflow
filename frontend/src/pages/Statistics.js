import { useState, useEffect, useMemo } from "react";
import { useAuthStore } from "../stores/authStore";
import { quizService, sessionService } from "../services/api";
import LoadingSpinner from "../components/common/LoadingSpinner";
import {
  ChartBarIcon,
  PuzzlePieceIcon,
  UserGroupIcon,
  ClockIcon,
  TrophyIcon,
  FireIcon,
  StarIcon,
  CalendarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  PlayIcon,
  AcademicCapIcon,
  LightBulbIcon,
  EyeIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";
import {
  format,
  subDays,
  startOfMonth,
  endOfMonth,
  isToday,
  isYesterday,
} from "date-fns";
import { fr } from "date-fns/locale";

const Statistics = () => {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [timeFrame, setTimeFrame] = useState("7days");
  const [activeView, setActiveView] = useState("overview"); // overview, detailed, insights
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    overview: {
      totalQuizzes: 0,
      totalSessions: 0,
      totalParticipants: 0,
      totalQuestions: 0,
      averageScore: 0,
      averageParticipantsPerSession: 0,
      completionRate: 0,
      averageSessionDuration: 0,
      totalTimeSpent: 0,
      successRate: 0,
    },
    trends: {
      quizzesGrowth: 0,
      sessionsGrowth: 0,
      participantsGrowth: 0,
      scoreGrowth: 0,
    },
    topQuizzes: [],
    recentSessions: [],
    categoryBreakdown: [],
    difficultyBreakdown: [],
    dailyActivity: [],
    performanceMetrics: {},
  });

  useEffect(() => {
    loadStatistics();
  }, [timeFrame]);

  const loadStatistics = async () => {
    try {
      setLoading(true);
      setError(null);

      const now = new Date();
      let startDate, previousStartDate;

      switch (timeFrame) {
        case "7days":
          startDate = subDays(now, 7);
          previousStartDate = subDays(now, 14);
          break;
        case "30days":
          startDate = subDays(now, 30);
          previousStartDate = subDays(now, 60);
          break;
        case "6months":
          startDate = subDays(now, 180);
          previousStartDate = subDays(now, 360);
          break;
        case "1year":
          startDate = subDays(now, 365);
          previousStartDate = subDays(now, 730);
          break;
        default:
          startDate = subDays(now, 7);
          previousStartDate = subDays(now, 14);
      }

      const [quizzesResponse, sessionsResponse] = await Promise.all([
        quizService.getMyQuizzes({ limit: 1000 }),
        sessionService.getSessions({ limit: 1000 }),
      ]);

      const quizzes = quizzesResponse.quizzes || [];
      const sessions = sessionsResponse.sessions || [];

      // Calculs de base
      const totalParticipants = sessions.reduce(
        (total, session) => total + (session.participantCount || 0),
        0
      );

      const totalQuestions = quizzes.reduce(
        (total, quiz) => total + (quiz.questionCount || 0),
        0
      );

      const completedSessions = sessions.filter((s) => s.status === "finished");
      const averageScore =
        completedSessions.length > 0
          ? completedSessions.reduce(
              (sum, session) => sum + (session.stats?.averageScore || 0),
              0
            ) / completedSessions.length
          : 0;

      const averageParticipantsPerSession =
        sessions.length > 0 ? totalParticipants / sessions.length : 0;
      const completionRate =
        sessions.length > 0
          ? (completedSessions.length / sessions.length) * 100
          : 0;

      // Calcul durée totale et moyenne
      const sessionsWithDuration = sessions.filter(
        (s) => s.startedAt && (s.endedAt || s.status === "active")
      );
      const totalTimeSpent = sessionsWithDuration.reduce((sum, session) => {
        const start = new Date(session.startedAt);
        const end = session.endedAt ? new Date(session.endedAt) : new Date();
        return sum + (end - start) / (1000 * 60);
      }, 0);

      const averageSessionDuration =
        sessionsWithDuration.length > 0
          ? totalTimeSpent / sessionsWithDuration.length
          : 0;
      const successRate =
        completedSessions.length > 0
          ? (completedSessions.filter((s) => (s.stats?.averageScore || 0) >= 60)
              .length /
              completedSessions.length) *
            100
          : 0;

      // Top quizzes avec plus de détails
      const topQuizzes = quizzes
        .filter((quiz) => quiz.stats?.totalSessions > 0)
        .sort(
          (a, b) =>
            (b.stats?.totalSessions || 0) - (a.stats?.totalSessions || 0)
        )
        .slice(0, 5)
        .map((quiz) => ({
          id: quiz.id,
          title: quiz.title,
          category: quiz.category,
          difficulty: quiz.difficulty,
          totalSessions: quiz.stats?.totalSessions || 0,
          totalParticipants: quiz.stats?.totalParticipants || 0,
          averageScore: Math.round(quiz.stats?.averageScore || 0),
          questionCount: quiz.questionCount || 0,
          lastUsed: quiz.stats?.lastUsed,
          engagementRate:
            quiz.stats?.totalParticipants > 0
              ? Math.round(
                  (quiz.stats.totalParticipants /
                    (quiz.stats.totalSessions * 10)) *
                    100
                )
              : 0,
        }));

      // Sessions récentes avec plus d'informations
      const recentSessions = sessions
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 8)
        .map((session) => ({
          id: session.id,
          title: session.title,
          quizTitle: session.quiz?.title || "Quiz supprimé",
          status: session.status,
          participantCount: session.participantCount || 0,
          createdAt: session.createdAt,
          startedAt: session.startedAt,
          endedAt: session.endedAt,
          averageScore: Math.round(session.stats?.averageScore || 0),
          duration:
            session.startedAt && session.endedAt
              ? Math.round(
                  (new Date(session.endedAt) - new Date(session.startedAt)) /
                    (1000 * 60)
                )
              : null,
          isRecent:
            isToday(new Date(session.createdAt)) ||
            isYesterday(new Date(session.createdAt)),
        }));

      // Répartitions améliorées
      const categoryMap = {};
      const difficultyMap = {};

      quizzes.forEach((quiz) => {
        const category = quiz.category || "Sans catégorie";
        const difficulty = quiz.difficulty || "moyen";

        if (!categoryMap[category]) {
          categoryMap[category] = {
            count: 0,
            sessions: 0,
            participants: 0,
            avgScore: 0,
          };
        }
        if (!difficultyMap[difficulty]) {
          difficultyMap[difficulty] = {
            count: 0,
            sessions: 0,
            participants: 0,
            avgScore: 0,
          };
        }

        categoryMap[category].count += 1;
        categoryMap[category].sessions += quiz.stats?.totalSessions || 0;
        categoryMap[category].participants +=
          quiz.stats?.totalParticipants || 0;
        categoryMap[category].avgScore += quiz.stats?.averageScore || 0;

        difficultyMap[difficulty].count += 1;
        difficultyMap[difficulty].sessions += quiz.stats?.totalSessions || 0;
        difficultyMap[difficulty].participants +=
          quiz.stats?.totalParticipants || 0;
        difficultyMap[difficulty].avgScore += quiz.stats?.averageScore || 0;
      });

      const categoryBreakdown = Object.entries(categoryMap)
        .map(([name, data]) => ({
          name,
          count: data.count,
          sessions: data.sessions,
          participants: data.participants,
          avgScore: data.count > 0 ? Math.round(data.avgScore / data.count) : 0,
          percentage: Math.round((data.count / quizzes.length) * 100),
        }))
        .sort((a, b) => b.count - a.count);

      const difficultyBreakdown = Object.entries(difficultyMap)
        .map(([name, data]) => ({
          name,
          count: data.count,
          sessions: data.sessions,
          participants: data.participants,
          avgScore: data.count > 0 ? Math.round(data.avgScore / data.count) : 0,
          percentage: Math.round((data.count / quizzes.length) * 100),
        }))
        .sort((a, b) => {
          const order = { facile: 0, moyen: 1, difficile: 2 };
          return (order[a.name] || 1) - (order[b.name] || 1);
        });

      // Calcul des tendances
      const currentPeriodQuizzes = quizzes.filter(
        (q) =>
          new Date(q.createdAt) >= startDate && new Date(q.createdAt) <= now
      );
      const previousPeriodQuizzes = quizzes.filter(
        (q) =>
          new Date(q.createdAt) >= previousStartDate &&
          new Date(q.createdAt) < startDate
      );

      const currentPeriodSessions = sessions.filter(
        (s) =>
          new Date(s.createdAt) >= startDate && new Date(s.createdAt) <= now
      );
      const previousPeriodSessions = sessions.filter(
        (s) =>
          new Date(s.createdAt) >= previousStartDate &&
          new Date(s.createdAt) < startDate
      );

      const calculateGrowth = (current, previous) => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return Math.round(((current - previous) / previous) * 100);
      };

      const currentParticipants = currentPeriodSessions.reduce(
        (sum, s) => sum + (s.participantCount || 0),
        0
      );
      const previousParticipants = previousPeriodSessions.reduce(
        (sum, s) => sum + (s.participantCount || 0),
        0
      );

      const currentAvgScore =
        currentPeriodSessions.length > 0
          ? currentPeriodSessions.reduce(
              (sum, s) => sum + (s.stats?.averageScore || 0),
              0
            ) / currentPeriodSessions.length
          : 0;
      const previousAvgScore =
        previousPeriodSessions.length > 0
          ? previousPeriodSessions.reduce(
              (sum, s) => sum + (s.stats?.averageScore || 0),
              0
            ) / previousPeriodSessions.length
          : 0;

      const trends = {
        quizzesGrowth: calculateGrowth(
          currentPeriodQuizzes.length,
          previousPeriodQuizzes.length
        ),
        sessionsGrowth: calculateGrowth(
          currentPeriodSessions.length,
          previousPeriodSessions.length
        ),
        participantsGrowth: calculateGrowth(
          currentParticipants,
          previousParticipants
        ),
        scoreGrowth: calculateGrowth(currentAvgScore, previousAvgScore),
      };

      // Métriques de performance avancées
      const performanceMetrics = {
        mostActiveDay: getMostActiveDay(sessions),
        peakHour: getPeakHour(sessions),
        averageQuestionDifficulty: getAverageQuestionDifficulty(quizzes),
        retentionRate: getRetentionRate(sessions),
        engagementScore: getEngagementScore(sessions, totalParticipants),
      };

      setStats({
        overview: {
          totalQuizzes: quizzes.length,
          totalSessions: sessions.length,
          totalParticipants,
          totalQuestions,
          averageScore: Math.round(averageScore),
          averageParticipantsPerSession:
            Math.round(averageParticipantsPerSession * 10) / 10,
          completionRate: Math.round(completionRate),
          averageSessionDuration: Math.round(averageSessionDuration),
          totalTimeSpent: Math.round(totalTimeSpent),
          successRate: Math.round(successRate),
        },
        trends,
        topQuizzes,
        recentSessions,
        categoryBreakdown,
        difficultyBreakdown,
        performanceMetrics,
      });
    } catch (error) {
      console.error("Erreur lors du chargement des statistiques:", error);
      setError("Impossible de charger les statistiques. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  };

  // Fonctions utilitaires pour les métriques avancées
  const getMostActiveDay = (sessions) => {
    const dayCount = {};
    const days = [
      "dimanche",
      "lundi",
      "mardi",
      "mercredi",
      "jeudi",
      "vendredi",
      "samedi",
    ];

    sessions.forEach((session) => {
      if (session.createdAt) {
        const day = new Date(session.createdAt).getDay();
        dayCount[days[day]] = (dayCount[days[day]] || 0) + 1;
      }
    });

    const mostActive = Object.entries(dayCount).sort((a, b) => b[1] - a[1])[0];
    return mostActive ? { day: mostActive[0], count: mostActive[1] } : null;
  };

  const getPeakHour = (sessions) => {
    const hourCount = {};

    sessions.forEach((session) => {
      if (session.startedAt) {
        const hour = new Date(session.startedAt).getHours();
        hourCount[hour] = (hourCount[hour] || 0) + 1;
      }
    });

    const peakHour = Object.entries(hourCount).sort((a, b) => b[1] - a[1])[0];
    return peakHour
      ? { hour: parseInt(peakHour[0]), count: peakHour[1] }
      : null;
  };

  const getAverageQuestionDifficulty = (quizzes) => {
    const difficultyValues = { facile: 1, moyen: 2, difficile: 3 };
    const total = quizzes.reduce(
      (sum, quiz) => sum + (difficultyValues[quiz.difficulty] || 2),
      0
    );
    const avg = total / (quizzes.length || 1);

    if (avg <= 1.3) return "facile";
    if (avg <= 2.3) return "moyen";
    return "difficile";
  };

  const getRetentionRate = (sessions) => {
    const completedSessions = sessions.filter((s) => s.status === "finished");
    return sessions.length > 0
      ? Math.round((completedSessions.length / sessions.length) * 100)
      : 0;
  };

  const getEngagementScore = (sessions, totalParticipants) => {
    if (sessions.length === 0) return 0;

    const avgParticipants = totalParticipants / sessions.length;
    const completionRate =
      (sessions.filter((s) => s.status === "finished").length /
        sessions.length) *
      100;

    // Score d'engagement basé sur la participation moyenne et le taux de completion
    return Math.round((avgParticipants * 2 + completionRate) / 3);
  };

  // Fonctions utilitaires
  const getTimeFrameLabel = () => {
    switch (timeFrame) {
      case "7days":
        return "7 derniers jours";
      case "30days":
        return "30 derniers jours";
      case "6months":
        return "6 derniers mois";
      case "1year":
        return "Dernière année";
      default:
        return "7 derniers jours";
    }
  };

  const getTrendIcon = (growth) => {
    if (growth > 0)
      return <ArrowTrendingUpIcon className="h-4 w-4 text-green-500" />;
    if (growth < 0)
      return <ArrowTrendingDownIcon className="h-4 w-4 text-red-500" />;
    return <div className="h-4 w-4" />;
  };

  const getTrendColor = (growth) => {
    if (growth > 0) return "text-green-600 dark:text-green-400";
    if (growth < 0) return "text-red-600 dark:text-red-400";
    return "text-gray-500 dark:text-gray-400";
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "waiting":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "active":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "paused":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
      case "finished":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case "facile":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "moyen":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "difficile":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  const formatRelativeTime = (date) => {
    if (isToday(new Date(date))) return "Aujourd'hui";
    if (isYesterday(new Date(date))) return "Hier";
    return format(new Date(date), "dd/MM/yyyy", { locale: fr });
  };

  // Calculs dérivés avec useMemo pour optimiser les performances
  const insights = useMemo(() => {
    const { overview, trends, performanceMetrics } = stats;

    return {
      engagement: {
        level:
          overview.averageParticipantsPerSession >= 20
            ? "excellent"
            : overview.averageParticipantsPerSession >= 10
            ? "bon"
            : "faible",
        message:
          overview.averageParticipantsPerSession >= 20
            ? "Excellent engagement ! Vos sessions attirent beaucoup de participants."
            : overview.averageParticipantsPerSession >= 10
            ? "Bon engagement. Essayez de promouvoir davantage vos sessions."
            : "Participation faible. Considérez des quiz plus interactifs ou une meilleure promotion.",
      },
      performance: {
        level:
          overview.averageScore >= 80
            ? "excellent"
            : overview.averageScore >= 60
            ? "correct"
            : "à améliorer",
        message:
          overview.averageScore >= 80
            ? "Excellents résultats ! Vos participants maîtrisent bien les sujets."
            : overview.averageScore >= 60
            ? "Résultats corrects. Considérez ajuster la difficulté de certaines questions."
            : "Résultats à améliorer. Vos quiz sont peut-être trop difficiles.",
      },
      activity: {
        level:
          trends.sessionsGrowth > 20
            ? "forte"
            : trends.sessionsGrowth > 0
            ? "modérée"
            : trends.sessionsGrowth === 0
            ? "stable"
            : "baisse",
        message:
          trends.sessionsGrowth > 20
            ? "Croissance forte ! Continuez sur cette lancée."
            : trends.sessionsGrowth > 0
            ? "Croissance modérée. Bon travail !"
            : trends.sessionsGrowth === 0
            ? "Activité stable. Pensez à créer de nouveaux contenus."
            : "Baisse d'activité. Il est temps de relancer vos quiz !",
      },
    };
  }, [stats]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            Chargement des statistiques...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mb-4">
            <ChartBarIcon className="h-8 w-8 text-red-600 dark:text-red-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Erreur de chargement
          </h3>
          <p className="text-red-600 dark:text-red-400 mb-6">{error}</p>
          <button
            onClick={loadStatistics}
            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* En-tête avec navigation améliorée */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg mb-6">
          <div className="px-6 py-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between space-y-4 lg:space-y-0">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Tableau de bord analytique
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Analysez vos performances et optimisez l'engagement de vos
                  participants
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
                {/* Navigation par onglets */}
                <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                  {[
                    {
                      key: "overview",
                      label: "Vue d'ensemble",
                      icon: ChartBarIcon,
                    },
                    {
                      key: "detailed",
                      label: "Détaillé",
                      icon: DocumentTextIcon,
                    },
                    { key: "insights", label: "Insights", icon: LightBulbIcon },
                  ].map(({ key, label, icon: Icon }) => (
                    <button
                      key={key}
                      onClick={() => setActiveView(key)}
                      className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                        activeView === key
                          ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm"
                          : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                      }`}
                    >
                      <Icon className="h-4 w-4 mr-2" />
                      {label}
                    </button>
                  ))}
                </div>

                {/* Sélecteur de période */}
                <div className="flex items-center space-x-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Période :
                  </label>
                  <select
                    value={timeFrame}
                    onChange={(e) => setTimeFrame(e.target.value)}
                    className="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="7days">7 derniers jours</option>
                    <option value="30days">30 derniers jours</option>
                    <option value="6months">6 derniers mois</option>
                    <option value="1year">Dernière année</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Vue d'ensemble */}
        {activeView === "overview" && (
          <>
            {/* Statistiques principales avec design amélioré */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {[
                {
                  title: "Quiz créés",
                  value: stats.overview.totalQuizzes,
                  trend: stats.trends.quizzesGrowth,
                  icon: PuzzlePieceIcon,
                  color: "blue",
                  subtitle: `${stats.overview.totalQuestions} questions au total`,
                },
                {
                  title: "Sessions lancées",
                  value: stats.overview.totalSessions,
                  trend: stats.trends.sessionsGrowth,
                  icon: PlayIcon,
                  color: "green",
                  subtitle: `${stats.overview.completionRate}% terminées`,
                },
                {
                  title: "Participants totaux",
                  value: stats.overview.totalParticipants,
                  trend: stats.trends.participantsGrowth,
                  icon: UserGroupIcon,
                  color: "purple",
                  subtitle: `${stats.overview.averageParticipantsPerSession}/session en moyenne`,
                },
                {
                  title: "Score moyen",
                  value: `${stats.overview.averageScore}%`,
                  trend: stats.trends.scoreGrowth,
                  icon: TrophyIcon,
                  color: "yellow",
                  subtitle: `${stats.overview.successRate}% de réussite`,
                },
              ].map((metric, index) => (
                <div
                  key={index}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-shadow"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div
                      className={`p-3 rounded-lg bg-${metric.color}-100 dark:bg-${metric.color}-900`}
                    >
                      <metric.icon
                        className={`h-6 w-6 text-${metric.color}-600 dark:text-${metric.color}-400`}
                      />
                    </div>
                    <div
                      className={`flex items-center text-sm font-medium ${getTrendColor(
                        metric.trend
                      )}`}
                    >
                      {getTrendIcon(metric.trend)}
                      <span className="ml-1">
                        {metric.trend > 0 ? "+" : ""}
                        {metric.trend}%
                      </span>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                      {metric.title}
                    </p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                      {metric.value}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {metric.subtitle}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Métriques avancées */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between mb-4">
                  <ClockIcon className="h-8 w-8 text-blue-200" />
                  <span className="text-blue-100 text-sm font-medium">
                    Temps total
                  </span>
                </div>
                <p className="text-3xl font-bold mb-1">
                  {Math.floor(stats.overview.totalTimeSpent / 60)}h
                </p>
                <p className="text-blue-200 text-sm">
                  {stats.overview.averageSessionDuration}min par session
                </p>
              </div>

              <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between mb-4">
                  <AcademicCapIcon className="h-8 w-8 text-green-200" />
                  <span className="text-green-100 text-sm font-medium">
                    Engagement
                  </span>
                </div>
                <p className="text-3xl font-bold mb-1">
                  {stats.performanceMetrics.engagementScore || 0}
                </p>
                <p className="text-green-200 text-sm">Score d'engagement</p>
              </div>

              <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between mb-4">
                  <StarIcon className="h-8 w-8 text-purple-200" />
                  <span className="text-purple-100 text-sm font-medium">
                    Rétention
                  </span>
                </div>
                <p className="text-3xl font-bold mb-1">
                  {stats.performanceMetrics.retentionRate || 0}%
                </p>
                <p className="text-purple-200 text-sm">Taux de rétention</p>
              </div>

              <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between mb-4">
                  <FireIcon className="h-8 w-8 text-orange-200" />
                  <span className="text-orange-100 text-sm font-medium">
                    Activité
                  </span>
                </div>
                <p className="text-2xl font-bold mb-1">
                  {stats.performanceMetrics.mostActiveDay?.day || "N/A"}
                </p>
                <p className="text-orange-200 text-sm">Jour le plus actif</p>
              </div>
            </div>

            {/* Graphiques principaux */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              {/* Top Quiz amélioré */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Quiz les plus populaires
                    </h3>
                    <TrophyIcon className="h-5 w-5 text-yellow-500" />
                  </div>
                </div>
                <div className="p-6">
                  {stats.topQuizzes.length === 0 ? (
                    <div className="text-center py-8">
                      <PuzzlePieceIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500 dark:text-gray-400 font-medium">
                        Aucune donnée disponible
                      </p>
                      <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
                        Lancez quelques sessions pour voir vos statistiques
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {stats.topQuizzes.map((quiz, index) => (
                        <div
                          key={quiz.id}
                          className="flex items-center space-x-4 p-3 rounded-lg border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                        >
                          <div className="flex-shrink-0">
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                                index === 0
                                  ? "bg-yellow-100 text-yellow-800 ring-2 ring-yellow-400"
                                  : index === 1
                                  ? "bg-gray-100 text-gray-800 ring-2 ring-gray-400"
                                  : index === 2
                                  ? "bg-orange-100 text-orange-800 ring-2 ring-orange-400"
                                  : "bg-blue-100 text-blue-800"
                              }`}
                            >
                              {index + 1}
                            </div>
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                              {quiz.title}
                            </p>
                            <div className="flex items-center space-x-3 mt-2">
                              <span
                                className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(
                                  quiz.difficulty
                                )}`}
                              >
                                {quiz.difficulty}
                              </span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {quiz.questionCount} questions
                              </span>
                              {quiz.category && (
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  {quiz.category}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="text-right">
                            <p className="text-sm font-bold text-gray-900 dark:text-white">
                              {quiz.totalSessions}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              sessions
                            </p>
                            <div className="flex items-center justify-end mt-1">
                              <div className="flex items-center space-x-1">
                                <UserGroupIcon className="h-3 w-3 text-gray-400" />
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  {quiz.totalParticipants}
                                </span>
                              </div>
                              {quiz.averageScore > 0 && (
                                <div className="ml-2 flex items-center space-x-1">
                                  <TrophyIcon className="h-3 w-3 text-gray-400" />
                                  <span className="text-xs text-gray-500 dark:text-gray-400">
                                    {quiz.averageScore}%
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Sessions récentes améliorées */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Activité récente
                    </h3>
                    <CalendarIcon className="h-5 w-5 text-blue-500" />
                  </div>
                </div>
                <div className="p-6">
                  {stats.recentSessions.length === 0 ? (
                    <div className="text-center py-8">
                      <CalendarIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500 dark:text-gray-400 font-medium">
                        Aucune activité récente
                      </p>
                      <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
                        Créez votre première session pour commencer
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {stats.recentSessions.slice(0, 6).map((session) => (
                        <div
                          key={session.id}
                          className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-1">
                              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                {session.title}
                              </p>
                              {session.isRecent && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                  Nouveau
                                </span>
                              )}
                            </div>

                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate mb-2">
                              {session.quizTitle}
                            </p>

                            <div className="flex items-center space-x-3">
                              <span
                                className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                                  session.status
                                )}`}
                              >
                                {session.status === "waiting"
                                  ? "En attente"
                                  : session.status === "active"
                                  ? "Active"
                                  : session.status === "paused"
                                  ? "En pause"
                                  : session.status === "finished"
                                  ? "Terminée"
                                  : session.status}
                              </span>

                              <div className="flex items-center space-x-1">
                                <UserGroupIcon className="h-3 w-3 text-gray-400" />
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  {session.participantCount}
                                </span>
                              </div>

                              {session.duration && (
                                <div className="flex items-center space-x-1">
                                  <ClockIcon className="h-3 w-3 text-gray-400" />
                                  <span className="text-xs text-gray-500 dark:text-gray-400">
                                    {session.duration}min
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="text-right ml-4 flex-shrink-0">
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                              {formatRelativeTime(session.createdAt)}
                            </p>
                            {session.status === "finished" &&
                              session.averageScore > 0 && (
                                <div className="flex items-center justify-end space-x-1">
                                  <TrophyIcon className="h-3 w-3 text-gray-400" />
                                  <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                                    {session.averageScore}%
                                  </span>
                                </div>
                              )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Vue détaillée */}
        {activeView === "detailed" && (
          <>
            {/* Répartitions détaillées */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Répartition par catégorie
                  </h3>
                </div>
                <div className="p-6">
                  {stats.categoryBreakdown.length === 0 ? (
                    <div className="text-center py-8">
                      <ChartBarIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500 dark:text-gray-400">
                        Aucune donnée disponible
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {stats.categoryBreakdown.map((category, index) => (
                        <div key={category.name} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div
                                className={`w-4 h-4 rounded-full bg-blue-${
                                  ((index * 100) % 600) + 400
                                }`}
                              />
                              <span className="text-sm font-medium text-gray-900 dark:text-white">
                                {category.name}
                              </span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                ({category.percentage}%)
                              </span>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                {category.count} quiz
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {category.sessions} sessions •{" "}
                                {category.participants} participants
                              </p>
                            </div>
                          </div>

                          {/* Barre de progression */}
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div
                              className={`bg-blue-${
                                ((index * 100) % 600) + 400
                              } h-2 rounded-full transition-all duration-300`}
                              style={{ width: `${category.percentage}%` }}
                            />
                          </div>

                          {category.avgScore > 0 && (
                            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                              <span>Score moyen: {category.avgScore}%</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Répartition par difficulté
                  </h3>
                </div>
                <div className="p-6">
                  {stats.difficultyBreakdown.length === 0 ? (
                    <div className="text-center py-8">
                      <StarIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500 dark:text-gray-400">
                        Aucune donnée disponible
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {stats.difficultyBreakdown.map((difficulty) => (
                        <div key={difficulty.name} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <span
                                className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getDifficultyColor(
                                  difficulty.name
                                )}`}
                              >
                                {difficulty.name}
                              </span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                ({difficulty.percentage}%)
                              </span>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                {difficulty.count} quiz
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {difficulty.sessions} sessions
                              </p>
                            </div>
                          </div>

                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all duration-300 ${
                                difficulty.name === "facile"
                                  ? "bg-green-500"
                                  : difficulty.name === "difficile"
                                  ? "bg-red-500"
                                  : "bg-yellow-500"
                              }`}
                              style={{ width: `${difficulty.percentage}%` }}
                            />
                          </div>

                          {difficulty.avgScore > 0 && (
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              Score moyen: {difficulty.avgScore}% •{" "}
                              {difficulty.participants} participants
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Métriques de performance détaillées */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 mb-8">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Métriques de performance avancées
                </h3>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-2">
                      {stats.performanceMetrics.mostActiveDay?.day || "N/A"}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                      Jour le plus actif
                    </div>
                    <div className="text-xs text-gray-400 dark:text-gray-500">
                      {stats.performanceMetrics.mostActiveDay?.count || 0}{" "}
                      sessions
                    </div>
                  </div>

                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-2">
                      {stats.performanceMetrics.peakHour?.hour || 0}h
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                      Heure de pointe
                    </div>
                    <div className="text-xs text-gray-400 dark:text-gray-500">
                      {stats.performanceMetrics.peakHour?.count || 0} sessions
                    </div>
                  </div>

                  <div className="text-center">
                    <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400 mb-2">
                      {stats.performanceMetrics.averageQuestionDifficulty ||
                        "N/A"}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                      Difficulté moyenne
                    </div>
                    <div className="text-xs text-gray-400 dark:text-gray-500">
                      de vos quiz
                    </div>
                  </div>

                  <div className="text-center">
                    <div className="text-3xl font-bold text-purple-600 dark:text-purple-400 mb-2">
                      {stats.performanceMetrics.engagementScore || 0}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                      Score d'engagement
                    </div>
                    <div className="text-xs text-gray-400 dark:text-gray-500">
                      sur 100
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Vue Insights */}
        {activeView === "insights" && (
          <>
            {/* Insights et recommandations améliorés */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 mb-8">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center space-x-2">
                  <LightBulbIcon className="h-6 w-6 text-yellow-500" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Insights et recommandations
                  </h3>
                </div>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <div className="border border-blue-200 dark:border-blue-800 rounded-xl p-6 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20">
                    <div className="flex items-center mb-4">
                      <div className="p-3 rounded-lg bg-blue-500 text-white mr-3">
                        <FireIcon className="h-6 w-6" />
                      </div>
                      <div>
                        <h4 className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                          Engagement
                        </h4>
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            insights.engagement.level === "excellent"
                              ? "bg-green-100 text-green-800"
                              : insights.engagement.level === "bon"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {insights.engagement.level}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-blue-800 dark:text-blue-200 leading-relaxed">
                      {insights.engagement.message}
                    </p>
                  </div>

                  <div className="border border-green-200 dark:border-green-800 rounded-xl p-6 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20">
                    <div className="flex items-center mb-4">
                      <div className="p-3 rounded-lg bg-green-500 text-white mr-3">
                        <TrophyIcon className="h-6 w-6" />
                      </div>
                      <div>
                        <h4 className="text-lg font-semibold text-green-900 dark:text-green-100">
                          Performance
                        </h4>
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            insights.performance.level === "excellent"
                              ? "bg-green-100 text-green-800"
                              : insights.performance.level === "correct"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {insights.performance.level}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-green-800 dark:text-green-200 leading-relaxed">
                      {insights.performance.message}
                    </p>
                  </div>

                  <div className="border border-purple-200 dark:border-purple-800 rounded-xl p-6 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20">
                    <div className="flex items-center mb-4">
                      <div className="p-3 rounded-lg bg-purple-500 text-white mr-3">
                        <ChartBarIcon className="h-6 w-6" />
                      </div>
                      <div>
                        <h4 className="text-lg font-semibold text-purple-900 dark:text-purple-100">
                          Activité
                        </h4>
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            insights.activity.level === "forte"
                              ? "bg-green-100 text-green-800"
                              : insights.activity.level === "modérée"
                              ? "bg-blue-100 text-blue-800"
                              : insights.activity.level === "stable"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {insights.activity.level}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-purple-800 dark:text-purple-200 leading-relaxed">
                      {insights.activity.message}
                    </p>
                  </div>
                </div>

                {/* Actions recommandées */}
                <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                    Plan d'action recommandé
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {[
                      {
                        icon: PuzzlePieceIcon,
                        color: "blue",
                        title: "Diversifiez vos contenus",
                        description:
                          "Créez des quiz dans de nouvelles catégories pour attirer plus de participants et maintenir l'intérêt.",
                        priority: "Haute",
                      },
                      {
                        icon: TrophyIcon,
                        color: "green",
                        title: "Optimisez la difficulté",
                        description:
                          "Analysez les scores pour ajuster le niveau de vos questions et améliorer les résultats.",
                        priority: "Moyenne",
                      },
                      {
                        icon: CalendarIcon,
                        color: "yellow",
                        title: "Planifiez régulièrement",
                        description:
                          "Programmez des sessions récurrentes pour maintenir l'engagement et créer une habitude.",
                        priority: "Moyenne",
                      },
                      {
                        icon: ChartBarIcon,
                        color: "purple",
                        title: "Analysez les tendances",
                        description:
                          "Consultez régulièrement ces statistiques pour identifier les opportunités d'amélioration.",
                        priority: "Faible",
                      },
                    ].map((action, index) => (
                      <div
                        key={index}
                        className="flex items-start space-x-4 p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                      >
                        <div
                          className={`flex-shrink-0 p-2 rounded-lg bg-${action.color}-100 dark:bg-${action.color}-900`}
                        >
                          <action.icon
                            className={`h-5 w-5 text-${action.color}-600 dark:text-${action.color}-400`}
                          />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <h5 className="text-sm font-semibold text-gray-900 dark:text-white">
                              {action.title}
                            </h5>
                            <span
                              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                action.priority === "Haute"
                                  ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                                  : action.priority === "Moyenne"
                                  ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                                  : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
                              }`}
                            >
                              {action.priority}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                            {action.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Note sur les données */}
        <div className="text-center py-6">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Données calculées pour la période : {getTimeFrameLabel()} • Dernière
            mise à jour :{" "}
            {format(new Date(), "dd/MM/yyyy 'à' HH:mm", { locale: fr })}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Statistics;
