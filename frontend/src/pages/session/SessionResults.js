import { useState, useEffect, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";
import { sessionService } from "../../services/api";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import toast from "react-hot-toast";
import {
  TrophyIcon,
  ChartBarIcon,
  UserGroupIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  DocumentArrowDownIcon,
  ShareIcon,
  ArrowLeftIcon,
  StarIcon,
  CalendarIcon,
} from "@heroicons/react/24/outline";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const SessionResults = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // États
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [leaderboard, setLeaderboard] = useState([]);
  const [questionResults, setQuestionResults] = useState([]);
  const [stats, setStats] = useState({});
  const [activeTab, setActiveTab] = useState("leaderboard");

  // Charger les résultats de la session
  const loadSessionResults = useCallback(async () => {
    try {
      setLoading(true);
      const response = await sessionService.getSession(sessionId);
      const sessionData = response.session;

      setSession(sessionData);

      // Traiter les données pour l'affichage
      processSessionData(sessionData);
    } catch (error) {
      console.error("Erreur lors du chargement des résultats:", error);
      toast.error("Erreur lors du chargement des résultats");
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  }, [sessionId, navigate]);

  const processSessionData = (sessionData) => {
    // Générer le classement
    if (sessionData.participants) {
      const sortedParticipants = [...sessionData.participants]
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .map((participant, index) => ({
          ...participant,
          rank: index + 1,
        }));
      setLeaderboard(sortedParticipants);
    }

    // Traiter les résultats par question
    if (sessionData.quiz?.questions && sessionData.responses) {
      const questionResultsData = sessionData.quiz.questions.map(
        (question, index) => {
          const responses = sessionData.responses[question.id] || {};
          const responseEntries = Object.entries(responses);

          let correctCount = 0;
          let totalResponses = responseEntries.length;

          // Analyser les réponses
          const answerStats = {};
          responseEntries.forEach(([participantId, response]) => {
            const answer = response.answer;
            answerStats[answer] = (answerStats[answer] || 0) + 1;

            // Vérifier si la réponse est correcte
            if (question.type === "qcm") {
              const correctOption = question.options?.find(
                (opt) => opt.isCorrect
              );
              if (correctOption && answer === correctOption.text) {
                correctCount++;
              }
            } else if (question.type === "vrai_faux") {
              if (answer === question.correctAnswer) {
                correctCount++;
              }
            }
          });

          return {
            question,
            questionIndex: index + 1,
            totalResponses,
            correctCount,
            correctPercentage:
              totalResponses > 0
                ? Math.round((correctCount / totalResponses) * 100)
                : 0,
            answerStats,
            averageTime:
              responseEntries.length > 0
                ? Math.round(
                    responseEntries.reduce(
                      (sum, [, response]) => sum + (response.timeSpent || 0),
                      0
                    ) / responseEntries.length
                  )
                : 0,
          };
        }
      );
      setQuestionResults(questionResultsData);
    }

    // Calculer les statistiques générales
    const participants = sessionData.participants || [];
    const totalScore = participants.reduce((sum, p) => sum + (p.score || 0), 0);
    const averageScore =
      participants.length > 0
        ? Math.round(totalScore / participants.length)
        : 0;
    const duration =
      sessionData.startedAt && sessionData.endedAt
        ? Math.round(
            (new Date(sessionData.endedAt) - new Date(sessionData.startedAt)) /
              1000 /
              60
          )
        : 0;

    setStats({
      totalParticipants: participants.length,
      averageScore,
      highestScore: Math.max(...participants.map((p) => p.score || 0), 0),
      completionRate: Math.round(
        (participants.filter((p) => p.score !== undefined).length /
          Math.max(participants.length, 1)) *
          100
      ),
      duration,
    });
  };

  useEffect(() => {
    loadSessionResults();
  }, [loadSessionResults]);

  const handleExportResults = async () => {
    try {
      // Ici on peut implémenter l'export CSV/PDF
      toast.success("Export en cours de développement");
    } catch (error) {
      console.error("Erreur lors de l'export:", error);
      toast.error("Erreur lors de l'export");
    }
  };

  const handleShareResults = () => {
    const shareUrl = `${window.location.origin}/session/${sessionId}/results`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      toast.success("Lien des résultats copié !");
    });
  };

  const getRankColor = (rank) => {
    switch (rank) {
      case 1:
        return "text-yellow-600 dark:text-yellow-400";
      case 2:
        return "text-gray-600 dark:text-gray-400";
      case 3:
        return "text-orange-600 dark:text-orange-400";
      default:
        return "text-gray-500 dark:text-gray-500";
    }
  };

  const getRankIcon = (rank) => {
    if (rank <= 3) {
      return <TrophyIcon className={`h-6 w-6 ${getRankColor(rank)}`} />;
    }
    return <span className="text-gray-400 font-bold">#{rank}</span>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="text-center py-12">
        <ChartBarIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          Résultats non trouvés
        </h3>
        <p className="text-gray-500 dark:text-gray-400">
          Cette session n'existe pas ou vous n'avez pas les permissions pour
          voir ses résultats.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link
                to="/dashboard"
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <ArrowLeftIcon className="h-5 w-5" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Résultats de la session
                </h1>
                <div className="flex items-center mt-2 space-x-4 text-sm text-gray-500 dark:text-gray-400">
                  <span className="font-medium">{session.title}</span>
                  <span>•</span>
                  <span>{session.quiz.title}</span>
                  <span>•</span>
                  <span>Code: {session.code}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={handleShareResults}
                className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-md transition-colors"
              >
                <ShareIcon className="h-4 w-4 mr-2" />
                Partager
              </button>

              <button
                onClick={handleExportResults}
                className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-md transition-colors"
              >
                <DocumentArrowDownIcon className="h-4 w-4 mr-2" />
                Exporter
              </button>
            </div>
          </div>
        </div>

        {/* Statistiques rapides */}
        <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                {stats.totalParticipants}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Participants
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {stats.averageScore}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Score moyen
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                {stats.highestScore}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Meilleur score
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {stats.completionRate}%
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Taux de participation
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {stats.duration}min
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Durée
              </div>
            </div>
          </div>
        </div>

        {/* Onglets */}
        <div className="border-t border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex">
            {[
              { id: "leaderboard", name: "Classement", icon: TrophyIcon },
              {
                id: "questions",
                name: "Résultats par question",
                icon: ChartBarIcon,
              },
              { id: "participants", name: "Participants", icon: UserGroupIcon },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`group relative min-w-0 flex-1 overflow-hidden py-4 px-4 text-sm font-medium text-center hover:bg-gray-50 dark:hover:bg-gray-700 focus:z-10 ${
                  activeTab === tab.id
                    ? "text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
              >
                <tab.icon className="h-5 w-5 mx-auto mb-1" />
                {tab.name}
                {activeTab === tab.id && (
                  <span
                    aria-hidden="true"
                    className="bg-primary-500 absolute inset-x-0 bottom-0 h-0.5"
                  />
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Contenu des onglets */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
        {activeTab === "leaderboard" && (
          <div className="p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-6">
              Classement final
            </h3>

            {leaderboard.length === 0 ? (
              <div className="text-center py-8">
                <TrophyIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">
                  Aucun participant n'a terminé le quiz.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {leaderboard.map((participant) => (
                  <div
                    key={participant.id}
                    className={`flex items-center justify-between p-4 rounded-lg border ${
                      participant.rank === 1
                        ? "bg-gradient-to-r from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 border-yellow-200 dark:border-yellow-800"
                        : participant.rank === 2
                        ? "bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 border-gray-200 dark:border-gray-600"
                        : participant.rank === 3
                        ? "bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 border-orange-200 dark:border-orange-800"
                        : "bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600"
                    }`}
                  >
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center justify-center w-12 h-12">
                        {getRankIcon(participant.rank)}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="text-lg font-medium text-gray-900 dark:text-white">
                            {participant.name}
                          </h4>
                          {participant.rank <= 3 && (
                            <StarIcon
                              className={`h-5 w-5 ${getRankColor(
                                participant.rank
                              )}`}
                            />
                          )}
                        </div>
                        {participant.completedAt && (
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Terminé le{" "}
                            {format(
                              new Date(participant.completedAt),
                              "dd/MM/yyyy à HH:mm",
                              { locale: fr }
                            )}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      <div
                        className={`text-2xl font-bold ${
                          participant.rank === 1
                            ? "text-yellow-600 dark:text-yellow-400"
                            : participant.rank === 2
                            ? "text-gray-600 dark:text-gray-400"
                            : participant.rank === 3
                            ? "text-orange-600 dark:text-orange-400"
                            : "text-gray-900 dark:text-white"
                        }`}
                      >
                        {participant.score || 0}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        points
                      </div>
                      {participant.responseTime && (
                        <div className="text-xs text-gray-400">
                          {Math.round(participant.responseTime / 1000)}s moy.
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "questions" && (
          <div className="p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-6">
              Résultats par question
            </h3>

            {questionResults.length === 0 ? (
              <div className="text-center py-8">
                <ChartBarIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">
                  Aucune donnée de question disponible.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {questionResults.map((result) => (
                  <div
                    key={result.question.id}
                    className="border border-gray-200 dark:border-gray-600 rounded-lg p-6"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                          Question {result.questionIndex}:{" "}
                          {result.question.question}
                        </h4>
                        <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                          <span>
                            {result.totalResponses} réponse
                            {result.totalResponses !== 1 ? "s" : ""}
                          </span>
                          <span>
                            {result.correctCount} correcte
                            {result.correctCount !== 1 ? "s" : ""}
                          </span>
                          <span>{result.correctPercentage}% de réussite</span>
                          {result.averageTime > 0 && (
                            <span>{result.averageTime}s en moyenne</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div
                          className={`text-2xl font-bold ${
                            result.correctPercentage >= 80
                              ? "text-green-600 dark:text-green-400"
                              : result.correctPercentage >= 60
                              ? "text-yellow-600 dark:text-yellow-400"
                              : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          {result.correctPercentage}%
                        </div>
                      </div>
                    </div>

                    {/* Statistiques des réponses */}
                    {result.question.type === "qcm" &&
                      result.question.options && (
                        <div className="space-y-2">
                          {result.question.options.map((option, index) => {
                            const count = result.answerStats[option.text] || 0;
                            const percentage =
                              result.totalResponses > 0
                                ? Math.round(
                                    (count / result.totalResponses) * 100
                                  )
                                : 0;

                            return (
                              <div
                                key={index}
                                className={`flex items-center justify-between p-3 rounded-lg ${
                                  option.isCorrect
                                    ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
                                    : "bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600"
                                }`}
                              >
                                <div className="flex items-center space-x-3">
                                  <span
                                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                      option.isCorrect
                                        ? "bg-green-500 text-white"
                                        : "bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300"
                                    }`}
                                  >
                                    {String.fromCharCode(65 + index)}
                                  </span>
                                  <span
                                    className={
                                      option.isCorrect
                                        ? "text-green-800 dark:text-green-200 font-medium"
                                        : "text-gray-700 dark:text-gray-300"
                                    }
                                  >
                                    {option.text}
                                  </span>
                                  {option.isCorrect && (
                                    <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
                                  )}
                                </div>
                                <div className="flex items-center space-x-3">
                                  <span className="text-sm text-gray-600 dark:text-gray-400">
                                    {count} ({percentage}%)
                                  </span>
                                  <div className="w-20 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                                    <div
                                      className={`h-2 rounded-full ${
                                        option.isCorrect
                                          ? "bg-green-500"
                                          : "bg-gray-400"
                                      }`}
                                      style={{ width: `${percentage}%` }}
                                    />
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                    {result.question.type === "vrai_faux" && (
                      <div className="grid grid-cols-2 gap-4">
                        {["true", "false"].map((answer) => {
                          const count = result.answerStats[answer] || 0;
                          const percentage =
                            result.totalResponses > 0
                              ? Math.round(
                                  (count / result.totalResponses) * 100
                                )
                              : 0;
                          const isCorrect =
                            answer === result.question.correctAnswer;

                          return (
                            <div
                              key={answer}
                              className={`p-4 rounded-lg border ${
                                isCorrect
                                  ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                                  : "bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                  <span
                                    className={`text-lg ${
                                      isCorrect
                                        ? "text-green-600 dark:text-green-400"
                                        : "text-gray-600 dark:text-gray-400"
                                    }`}
                                  >
                                    {answer === "true" ? "✓ Vrai" : "✗ Faux"}
                                  </span>
                                  {isCorrect && (
                                    <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
                                  )}
                                </div>
                                <div className="text-right">
                                  <div className="font-medium text-gray-900 dark:text-white">
                                    {count} ({percentage}%)
                                  </div>
                                  <div className="w-16 bg-gray-200 dark:bg-gray-600 rounded-full h-2 mt-1">
                                    <div
                                      className={`h-2 rounded-full ${
                                        isCorrect
                                          ? "bg-green-500"
                                          : "bg-gray-400"
                                      }`}
                                      style={{ width: `${percentage}%` }}
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "participants" && (
          <div className="p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-6">
              Liste des participants ({leaderboard.length})
            </h3>

            {leaderboard.length === 0 ? (
              <div className="text-center py-8">
                <UserGroupIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">
                  Aucun participant pour cette session.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Rang
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Participant
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Score
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Réponses
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Temps moyen
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Statut
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {leaderboard.map((participant) => (
                      <tr
                        key={participant.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {getRankIcon(participant.rank)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center">
                              <span className="text-sm font-medium text-primary-600 dark:text-primary-400">
                                {participant.name?.charAt(0)?.toUpperCase()}
                              </span>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900 dark:text-white">
                                {participant.name}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-bold text-gray-900 dark:text-white">
                            {participant.score || 0} pts
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {participant.answeredQuestions || 0} /{" "}
                          {session.quiz.questions?.length || 0}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {participant.averageResponseTime
                            ? `${Math.round(
                                participant.averageResponseTime / 1000
                              )}s`
                            : "-"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              participant.completedAt
                                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                            }`}
                          >
                            {participant.completedAt ? "Terminé" : "Abandonné"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Informations de la session */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Informations de la session
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Quiz
            </dt>
            <dd className="mt-1 text-sm text-gray-900 dark:text-white">
              {session.quiz.title}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Hôte
            </dt>
            <dd className="mt-1 text-sm text-gray-900 dark:text-white">
              {session.host?.firstName && session.host?.lastName
                ? `${session.host.firstName} ${session.host.lastName}`
                : session.host?.username || "Hôte inconnu"}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Date de création
            </dt>
            <dd className="mt-1 text-sm text-gray-900 dark:text-white">
              {format(new Date(session.createdAt), "dd MMMM yyyy à HH:mm", {
                locale: fr,
              })}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Durée
            </dt>
            <dd className="mt-1 text-sm text-gray-900 dark:text-white">
              {session.startedAt && session.endedAt
                ? `${Math.round(
                    (new Date(session.endedAt) - new Date(session.startedAt)) /
                      1000 /
                      60
                  )} minutes`
                : "Non terminée"}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Code de session
            </dt>
            <dd className="mt-1 text-sm font-mono font-bold text-gray-900 dark:text-white">
              {session.code}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Statut
            </dt>
            <dd className="mt-1">
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  session.status === "finished"
                    ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                    : session.status === "active"
                    ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                    : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
                }`}
              >
                {session.status === "finished"
                  ? "Terminée"
                  : session.status === "active"
                  ? "En cours"
                  : session.status === "paused"
                  ? "En pause"
                  : "En attente"}
              </span>
            </dd>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SessionResults;
