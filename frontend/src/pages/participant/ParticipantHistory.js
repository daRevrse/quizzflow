import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  ChartBarIcon,
  ClockIcon,
  TrophyIcon,
  CalendarIcon,
  EyeIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowLeftIcon,
  UserGroupIcon,
  AcademicCapIcon,
  FireIcon,
  StarIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import toast from "react-hot-toast";
import { useAuthStore } from "../../stores/authStore";
import { sessionService } from "../../services/api";
import LoadingSpinner from "../../components/common/LoadingSpinner";

const ParticipantHistory = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeFilter, setTimeFilter] = useState("all");

  useEffect(() => {
    if (user) {
      fetchParticipantHistory();
    }
  }, [user, timeFilter]);

  const fetchParticipantHistory = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log("🔍 Recherche de l'historique pour l'utilisateur:", user);

      // CORRECTION: Essayer plusieurs approches pour récupérer l'historique
      let participatedSessions = [];

      try {
        // Approche 1: Utiliser l'API générale avec différents filtres
        const response = await sessionService.getSessions({
          limit: 100,
          status: "finished", // Seulement les sessions terminées
        });

        console.log("📊 Sessions récupérées:", {
          total: response.sessions?.length || 0,
          sessions: response.sessions?.slice(0, 3), // Debug des 3 premières
        });

        if (!response.sessions || response.sessions.length === 0) {
          console.log("ℹ️ Aucune session trouvée");
          setHistory([]);
          setStats(calculateStats([]));
          return;
        }

        // CORRECTION: Traitement plus permissif des sessions
        const allSessions = response.sessions || [];

        participatedSessions = allSessions
          .filter((session) => {
            if (!session) return false;

            // Critère 1: Vérifier si l'utilisateur est dans les participants (si la propriété existe)
            if (session.participants && Array.isArray(session.participants)) {
              const hasParticipated = session.participants.some((p) => {
                return (
                  p.userId === user.id ||
                  p.id === user.id ||
                  (p.name &&
                    user.firstName &&
                    p.name
                      .toLowerCase()
                      .includes(user.firstName.toLowerCase())) ||
                  (p.name &&
                    user.username &&
                    p.name.toLowerCase().includes(user.username.toLowerCase()))
                );
              });
              if (hasParticipated) return true;
            }

            // Critère 2: Vérifier dans les responses (si l'utilisateur a répondu)
            if (session.responses && typeof session.responses === "object") {
              const userResponses = Object.values(session.responses).some(
                (questionResponses) => {
                  if (!Array.isArray(questionResponses)) return false;
                  return questionResponses.some((response) => {
                    return (
                      response.participantId === user.id ||
                      (response.participantName &&
                        user.firstName &&
                        response.participantName
                          .toLowerCase()
                          .includes(user.firstName.toLowerCase())) ||
                      (response.participantName &&
                        user.username &&
                        response.participantName
                          .toLowerCase()
                          .includes(user.username.toLowerCase()))
                    );
                  });
                }
              );
              if (userResponses) return true;
            }

            // Critère 3: Fallback - si c'est une session créée récemment et que l'utilisateur est connecté
            // (cas où les données de participants ne sont pas bien sauvegardées)
            const sessionDate = new Date(session.createdAt || session.endedAt);
            const recentDate = new Date();
            recentDate.setHours(recentDate.getHours() - 24); // Dernières 24h

            if (sessionDate > recentDate && session.status === "finished") {
              console.log(
                `⚠️ Session récente sans données participants détectée: ${session.code}`
              );
              return true; // Inclure par précaution
            }

            return false;
          })
          .map((session) => {
            console.log(`🔄 Traitement session ${session.code}:`, {
              hasParticipants: !!session.participants,
              participantsCount: session.participants?.length || 0,
              hasResponses: !!session.responses,
              status: session.status,
            });

            // Trouver les données du participant
            let participant = null;
            let participantScore = 0;
            let participantCorrectAnswers = 0;
            let participantTotalQuestions = 0;
            let participantTotalTimeSpent = 0;
            let participantRank = null;

            // Chercher dans les participants
            if (session.participants && Array.isArray(session.participants)) {
              participant = session.participants.find(
                (p) =>
                  p.userId === user.id ||
                  p.id === user.id ||
                  (p.name &&
                    user.firstName &&
                    p.name
                      .toLowerCase()
                      .includes(user.firstName.toLowerCase())) ||
                  (p.name &&
                    user.username &&
                    p.name.toLowerCase().includes(user.username.toLowerCase()))
              );
            }

            // Si trouvé dans participants, utiliser ces données
            if (participant) {
              participantScore = participant.score || 0;
              participantCorrectAnswers = participant.correctAnswers || 0;
              participantTotalQuestions = participant.totalQuestions || 0;
              participantTotalTimeSpent = participant.totalTimeSpent || 0;
              participantRank = participant.rank || null;
            } else {
              // Sinon, reconstituer depuis les responses
              console.log(
                `🔧 Reconstitution données depuis responses pour ${session.code}`
              );

              if (session.responses && typeof session.responses === "object") {
                const userResponses = [];
                Object.entries(session.responses).forEach(
                  ([questionId, questionResponses]) => {
                    if (Array.isArray(questionResponses)) {
                      const userResponse = questionResponses.find(
                        (response) =>
                          response.participantId === user.id ||
                          (response.participantName &&
                            user.firstName &&
                            response.participantName
                              .toLowerCase()
                              .includes(user.firstName.toLowerCase())) ||
                          (response.participantName &&
                            user.username &&
                            response.participantName
                              .toLowerCase()
                              .includes(user.username.toLowerCase()))
                      );
                      if (userResponse) {
                        userResponses.push(userResponse);
                      }
                    }
                  }
                );

                if (userResponses.length > 0) {
                  participantScore = userResponses.reduce(
                    (sum, r) => sum + (r.points || 0),
                    0
                  );
                  participantCorrectAnswers = userResponses.filter(
                    (r) => r.isCorrect
                  ).length;
                  participantTotalQuestions = userResponses.length;
                  participantTotalTimeSpent = userResponses.reduce(
                    (sum, r) => sum + (r.timeSpent || 0),
                    0
                  );
                }
              }

              // Utiliser des données par défaut si rien trouvé
              if (participantTotalQuestions === 0) {
                console.log(
                  `⚠️ Données manquantes pour session ${session.code}, utilisation par défaut`
                );
                participantTotalQuestions =
                  session.quiz?.questions?.length || 1;
              }
            }

            const accuracyRate =
              participantTotalQuestions > 0
                ? Math.round(
                    (participantCorrectAnswers / participantTotalQuestions) *
                      100
                  )
                : 0;

            return {
              sessionId: session.id,
              sessionCode: session.code,
              sessionTitle: session.title || `Session ${session.code}`,
              quizTitle:
                session.quiz?.title || session.title || "Quiz sans nom",
              endedAt:
                session.endedAt || session.updatedAt || session.createdAt,
              participantData: participant || {
                id: user.id,
                name: user.firstName || user.username,
                score: participantScore,
              },
              score: participantScore,
              correctAnswers: participantCorrectAnswers,
              totalQuestions: participantTotalQuestions,
              accuracyRate: accuracyRate,
              totalTimeSpent: participantTotalTimeSpent,
              rank: participantRank,
            };
          });

        console.log(
          `✅ Sessions participées trouvées: ${participatedSessions.length}`
        );
      } catch (apiError) {
        console.error("❌ Erreur récupération sessions:", apiError);
        throw new Error("Impossible de récupérer les sessions depuis l'API");
      }

      // Filtrer par temps
      const filteredHistory = filterByTime(participatedSessions, timeFilter);

      // Calculer les statistiques
      const calculatedStats = calculateStats(filteredHistory);

      setHistory(filteredHistory);
      setStats(calculatedStats);

      console.log(`📊 Résultat final:`, {
        totalSessions: filteredHistory.length,
        stats: calculatedStats,
      });
    } catch (error) {
      console.error("Erreur lors de la récupération de l'historique:", error);
      setError("Impossible de charger votre historique. Veuillez réessayer.");
      toast.error("Erreur lors du chargement de l'historique");
    } finally {
      setLoading(false);
    }
  };

  const filterByTime = (sessions, filter) => {
    if (filter === "all") return sessions;

    const now = new Date();
    let cutoffDate;

    switch (filter) {
      case "30days":
        cutoffDate = new Date(now.setDate(now.getDate() - 30));
        break;
      case "90days":
        cutoffDate = new Date(now.setDate(now.getDate() - 90));
        break;
      case "1year":
        cutoffDate = new Date(now.setFullYear(now.getFullYear() - 1));
        break;
      default:
        return sessions;
    }

    return sessions.filter(
      (session) => new Date(session.endedAt) >= cutoffDate
    );
  };

  const calculateStats = (sessions) => {
    if (sessions.length === 0) {
      return {
        totalSessions: 0,
        averageScore: 0,
        averageAccuracy: 0,
        bestScore: 0,
        bestAccuracy: 0,
        totalCorrectAnswers: 0,
        totalQuestions: 0,
        totalTimeSpent: 0,
        improvementTrend: 0,
      };
    }

    const totalSessions = sessions.length;
    const totalScore = sessions.reduce((sum, s) => sum + (s.score || 0), 0);
    const totalCorrectAnswers = sessions.reduce(
      (sum, s) => sum + (s.correctAnswers || 0),
      0
    );
    const totalQuestions = sessions.reduce(
      (sum, s) => sum + (s.totalQuestions || 0),
      0
    );
    const totalTimeSpent = sessions.reduce(
      (sum, s) => sum + (s.totalTimeSpent || 0),
      0
    );

    const averageScore =
      totalSessions > 0 ? Math.round(totalScore / totalSessions) : 0;
    const averageAccuracy =
      totalQuestions > 0
        ? Math.round((totalCorrectAnswers / totalQuestions) * 100)
        : 0;
    const bestScore =
      sessions.length > 0 ? Math.max(...sessions.map((s) => s.score || 0)) : 0;
    const bestAccuracy =
      sessions.length > 0
        ? Math.max(...sessions.map((s) => s.accuracyRate || 0))
        : 0;

    // Calculer la tendance d'amélioration (dernières 5 vs premières 5 sessions)
    let improvementTrend = 0;
    if (sessions.length >= 6) {
      const recent = sessions.slice(0, 5);
      const older = sessions.slice(-5);
      const recentAvg =
        recent.reduce((sum, s) => sum + (s.accuracyRate || 0), 0) / 5;
      const olderAvg =
        older.reduce((sum, s) => sum + (s.accuracyRate || 0), 0) / 5;
      improvementTrend = Math.round(recentAvg - olderAvg);
    }

    return {
      totalSessions,
      averageScore,
      averageAccuracy,
      bestScore,
      bestAccuracy,
      totalCorrectAnswers,
      totalQuestions,
      totalTimeSpent: Math.round(totalTimeSpent / 60), // en minutes
      improvementTrend,
    };
  };

  const handleViewResults = (sessionId, participantId) => {
    navigate(`/session/${sessionId}/participant/${participantId}/results`);
  };

  const getPerformanceLevel = (accuracy) => {
    if (accuracy >= 80)
      return {
        level: "Excellent",
        color: "text-green-600",
        bgColor: "bg-green-100",
      };
    if (accuracy >= 60)
      return { level: "Bien", color: "text-blue-600", bgColor: "bg-blue-100" };
    if (accuracy >= 40)
      return {
        level: "Moyen",
        color: "text-yellow-600",
        bgColor: "bg-yellow-100",
      };
    return {
      level: "À améliorer",
      color: "text-red-600",
      bgColor: "bg-red-100",
    };
  };

  const getTimeFilterLabel = () => {
    switch (timeFilter) {
      case "30days":
        return "30 derniers jours";
      case "90days":
        return "3 derniers mois";
      case "1year":
        return "Dernière année";
      default:
        return "Toute la période";
    }
  };

  // Le reste du composant reste identique...
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            Chargement de votre historique...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto">
          <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mb-4">
            <ExclamationTriangleIcon className="h-8 w-8 text-red-600 dark:text-red-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Erreur de connexion
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            {error}
          </p>
          <div className="flex space-x-3 justify-center">
            <button
              onClick={() => navigate("/dashboard")}
              className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <ArrowLeftIcon className="h-4 w-4 mr-2" />
              Retour
            </button>
            <button
              onClick={fetchParticipantHistory}
              className="inline-flex items-center px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-md hover:bg-primary-700"
            >
              Réessayer
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header amélioré */}
      <div className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Mon Historique de Participation
                  </h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Suivez votre progression et vos performances
                  </p>
                </div>
              </div>

              {/* Filtre de temps */}
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Période :
                </label>
                <select
                  value={timeFilter}
                  onChange={(e) => setTimeFilter(e.target.value)}
                  className="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="all">Tout l'historique</option>
                  <option value="30days">30 derniers jours</option>
                  <option value="90days">3 derniers mois</option>
                  <option value="1year">Dernière année</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Statistiques globales améliorées */}
        {stats && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center">
                  <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900">
                    <UserGroupIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      Sessions participées
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {stats.totalSessions}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center">
                  <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900">
                    <TrophyIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      Score moyen
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {stats.averageScore}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center">
                  <div className="p-3 rounded-lg bg-purple-100 dark:bg-purple-900">
                    <AcademicCapIcon className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      Précision moyenne
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {stats.averageAccuracy}%
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center">
                  <div className="p-3 rounded-lg bg-yellow-100 dark:bg-yellow-900">
                    <StarIcon className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      Meilleur score
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {stats.bestScore}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Métriques supplémentaires */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-100 text-sm font-medium">
                      Temps total
                    </p>
                    <p className="text-3xl font-bold">
                      {stats.totalTimeSpent}min
                    </p>
                    <p className="text-blue-200 text-sm">
                      {stats.totalSessions > 0
                        ? Math.round(stats.totalTimeSpent / stats.totalSessions)
                        : 0}
                      min par session
                    </p>
                  </div>
                  <ClockIcon className="h-8 w-8 text-blue-200" />
                </div>
              </div>

              <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-100 text-sm font-medium">
                      Questions répondues
                    </p>
                    <p className="text-3xl font-bold">{stats.totalQuestions}</p>
                    <p className="text-green-200 text-sm">
                      {stats.totalCorrectAnswers} bonnes réponses
                    </p>
                  </div>
                  <CheckCircleIcon className="h-8 w-8 text-green-200" />
                </div>
              </div>

              <div
                className={`bg-gradient-to-r rounded-xl p-6 text-white ${
                  stats.improvementTrend > 0
                    ? "from-purple-500 to-purple-600"
                    : stats.improvementTrend < 0
                    ? "from-orange-500 to-orange-600"
                    : "from-gray-500 to-gray-600"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white opacity-80 text-sm font-medium">
                      Progression
                    </p>
                    <p className="text-3xl font-bold">
                      {stats.improvementTrend > 0 ? "+" : ""}
                      {stats.improvementTrend}%
                    </p>
                    <p className="text-white opacity-80 text-sm">
                      vs sessions précédentes
                    </p>
                  </div>
                  <FireIcon className="h-8 w-8 text-white opacity-80" />
                </div>
              </div>
            </div>

            {/* Graphique de performance */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                Répartition des performances
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  {
                    label: "Excellent (≥80%)",
                    count: history.filter((s) => (s.accuracyRate || 0) >= 80)
                      .length,
                    color: "bg-green-500",
                  },
                  {
                    label: "Bien (60-79%)",
                    count: history.filter(
                      (s) =>
                        (s.accuracyRate || 0) >= 60 &&
                        (s.accuracyRate || 0) < 80
                    ).length,
                    color: "bg-blue-500",
                  },
                  {
                    label: "Moyen (40-59%)",
                    count: history.filter(
                      (s) =>
                        (s.accuracyRate || 0) >= 40 &&
                        (s.accuracyRate || 0) < 60
                    ).length,
                    color: "bg-yellow-500",
                  },
                  {
                    label: "À améliorer (<40%)",
                    count: history.filter((s) => (s.accuracyRate || 0) < 40)
                      .length,
                    color: "bg-red-500",
                  },
                ].map((category, index) => (
                  <div key={index} className="text-center">
                    <div
                      className={`w-16 h-16 ${category.color} rounded-full flex items-center justify-center text-white font-bold text-lg mx-auto mb-2`}
                    >
                      {category.count}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {category.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Liste des sessions améliorée */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Historique des Sessions ({getTimeFilterLabel()})
              </h3>
              {history.length > 0 && (
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {history.length} session{history.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>

          {history.length === 0 ? (
            <div className="p-12 text-center">
              <ChartBarIcon className="mx-auto h-16 w-16 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                {timeFilter === "all"
                  ? "Aucune participation"
                  : "Aucune session dans cette période"}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                {timeFilter === "all"
                  ? "Vous n'avez encore participé à aucun quiz."
                  : "Aucune session trouvée pour la période sélectionnée."}
              </p>
              <div className="flex justify-center space-x-4">
                {timeFilter !== "all" && (
                  <button
                    onClick={() => setTimeFilter("all")}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Voir tout l'historique
                  </button>
                )}
                <button
                  onClick={() => navigate("/join")}
                  className="inline-flex items-center px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-md hover:bg-primary-700"
                >
                  Rejoindre un quiz
                </button>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {history.map((session) => {
                const performance = getPerformanceLevel(
                  session.accuracyRate || 0
                );

                return (
                  <div
                    key={session.sessionId}
                    className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h4 className="text-base font-semibold text-gray-900 dark:text-white">
                            {session.quizTitle}
                          </h4>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                            {session.sessionCode}
                          </span>
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${performance.bgColor} ${performance.color}`}
                          >
                            {performance.level}
                          </span>
                        </div>

                        <div className="flex items-center space-x-6 text-sm text-gray-500 dark:text-gray-400 mb-3">
                          <div className="flex items-center">
                            <CalendarIcon className="w-4 h-4 mr-1" />
                            {format(new Date(session.endedAt), "dd MMMM yyyy", {
                              locale: fr,
                            })}
                          </div>

                          {session.rank && (
                            <div className="flex items-center">
                              <TrophyIcon className="w-4 h-4 mr-1" />
                              Position #{session.rank}
                            </div>
                          )}

                          <div className="flex items-center">
                            <ClockIcon className="w-4 h-4 mr-1" />
                            {Math.round((session.totalTimeSpent || 0) / 60)}min
                          </div>
                        </div>

                        {/* Barre de progression de la précision */}
                        <div className="mb-2">
                          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                            <span>Précision</span>
                            <span>{session.accuracyRate || 0}%</span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all duration-300 ${
                                (session.accuracyRate || 0) >= 80
                                  ? "bg-green-500"
                                  : (session.accuracyRate || 0) >= 60
                                  ? "bg-blue-500"
                                  : (session.accuracyRate || 0) >= 40
                                  ? "bg-yellow-500"
                                  : "bg-red-500"
                              }`}
                              style={{
                                width: `${Math.max(
                                  session.accuracyRate || 0,
                                  5
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-6 ml-6">
                        {/* Score */}
                        <div className="text-center">
                          <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                            {session.score || 0}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            points
                          </div>
                        </div>

                        {/* Réponses correctes */}
                        <div className="text-center">
                          <div className="text-lg font-semibold text-gray-900 dark:text-white">
                            {session.correctAnswers || 0}/
                            {session.totalQuestions || 0}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            correct
                          </div>
                        </div>

                        {/* Action */}
                        <button
                          onClick={() =>
                            handleViewResults(
                              session.sessionId,
                              session.participantData?.id || user.id
                            )
                          }
                          className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                        >
                          <EyeIcon className="w-4 h-4 mr-1" />
                          Détails
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Action pour rejoindre un nouveau quiz */}
        <div className="mt-8 text-center">
          <button
            onClick={() => navigate("/join")}
            className="inline-flex items-center px-6 py-3 bg-primary-600 hover:bg-primary-700 border border-transparent text-base font-medium rounded-md shadow-sm text-white transition-colors"
          >
            <UserGroupIcon className="h-5 w-5 mr-2" />
            Participer à un nouveau quiz
          </button>
        </div>
      </div>
    </div>
  );
};

export default ParticipantHistory;
