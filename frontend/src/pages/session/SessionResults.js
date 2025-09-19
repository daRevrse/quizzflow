// Page de résultats de session - frontend/src/pages/session/SessionResults.js

import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";
import { sessionService } from "../../services/api";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import toast from "react-hot-toast";
import {
  ArrowLeftIcon,
  UsersIcon,
  ClockIcon,
  TrophyIcon,
  ChartBarIcon,
  DocumentArrowDownIcon,
  EyeIcon,
  CheckCircleIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";

const SessionResults = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // États
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedQuestion, setSelectedQuestion] = useState(null);

  // Charger les résultats
  useEffect(() => {
    const loadResults = async () => {
      try {
        setLoading(true);

        // Utiliser getSession au lieu de getSessionResults
        const response = await sessionService.getSession(sessionId);
        const sessionData = response.session;

        if (!sessionData) {
          throw new Error("Session non trouvée");
        }

        // Transformer les données de session en format de résultats
        const transformedResults = {
          session: {
            id: sessionData.id,
            code: sessionData.code,
            title: sessionData.title,
            status: sessionData.status,
            startedAt: sessionData.startedAt,
            endedAt: sessionData.endedAt,
            createdAt: sessionData.createdAt,
            updatedAt: sessionData.updatedAt,
            stats: sessionData.stats || {
              totalParticipants: sessionData.participantCount || 0,
              averageScore: 0,
              completionRate: 0,
            },
          },

          // Participants avec formatage pour les résultats
          participants: (sessionData.participants || []).map((participant) => ({
            id: participant.id,
            name: participant.name,
            isAnonymous: participant.isAnonymous || false,
            score: participant.score || 0,
            joinedAt: participant.joinedAt,
            lastSeen: participant.lastSeen,
            isConnected: participant.isConnected || false,
            responses: participant.responses || {},
            userId: participant.userId,
          })),

          // Créer le classement basé sur les participants
          leaderboard: (sessionData.participants || [])
            .filter((p) => p && typeof p.score === "number")
            .sort((a, b) => (b.score || 0) - (a.score || 0))
            .map((participant, index) => ({
              rank: index + 1,
              id: participant.id,
              name: participant.name,
              score: participant.score || 0,
              isAnonymous: participant.isAnonymous || false,
              isConnected: participant.isConnected || false,
            })),

          // Quiz associé
          quiz: sessionData.quiz || null,

          // Construire les résultats par question à partir des réponses
          questionResults: (() => {
            const responses = sessionData.responses || {};
            const results = {};

            Object.keys(responses).forEach((questionId) => {
              const questionResponses = responses[questionId] || [];

              results[questionId] = {
                questionId: questionId,
                totalResponses: questionResponses.length,
                totalParticipants: sessionData.participantCount || 0,
                responses: questionResponses.map((response) => ({
                  participantId: response.participantId,
                  participantName:
                    (sessionData.participants || []).find(
                      (p) => p.id === response.participantId
                    )?.name || "Participant inconnu",
                  answer: response.answer,
                  isCorrect: response.isCorrect || false,
                  points: response.points || 0,
                  timeSpent: response.timeSpent || 0,
                  submittedAt: response.submittedAt,
                })),
                stats: {
                  correctAnswers: questionResponses.filter((r) => r.isCorrect)
                    .length,
                  averageTimeSpent:
                    questionResponses.length > 0
                      ? questionResponses.reduce(
                          (sum, r) => sum + (r.timeSpent || 0),
                          0
                        ) / questionResponses.length
                      : 0,
                  responseRate:
                    sessionData.participantCount > 0
                      ? Math.round(
                          (questionResponses.length /
                            sessionData.participantCount) *
                            100
                        )
                      : 0,
                },
              };
            });

            return results;
          })(),
        };

        setResults(transformedResults);

        // Sélectionner la première question par défaut
        if (transformedResults.quiz?.questions?.length > 0) {
          setSelectedQuestion(transformedResults.quiz.questions[0]);
        }
      } catch (error) {
        console.error("Erreur lors du chargement des résultats:", error);

        if (
          error.message?.includes("non trouvée") ||
          error.response?.status === 404
        ) {
          toast.error("Session non trouvée");
          navigate("/sessions");
        } else if (error.response?.status === 403) {
          toast.error("Vous n'avez pas accès à cette session");
          navigate("/sessions");
        } else {
          toast.error("Erreur lors du chargement des résultats");
        }
      } finally {
        setLoading(false);
      }
    };

    if (sessionId) {
      loadResults();
    }
  }, [sessionId, navigate]);

  // Fonction d'export (simple - peut être améliorée)
  const handleExport = () => {
    if (!results) return;

    const data = {
      session: results.session,
      participants: results.participants,
      leaderboard: results.leaderboard,
      questionResults: results.questionResults,
      quiz: results.quiz,
      exportedAt: new Date().toISOString(),
      exportedBy: user?.username || user?.firstName || "Utilisateur inconnu",
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `session-${results.session.code}-results.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success("Résultats exportés avec succès");
  };

  // Utilitaires
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString("fr-FR");
  };

  const formatDuration = (start, end) => {
    if (!start) return "N/A";
    const startDate = new Date(start);
    const endDate = end ? new Date(end) : new Date();
    const duration = endDate - startDate;
    const minutes = Math.floor(duration / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    return hours > 0 ? `${hours}h ${minutes % 60}min` : `${minutes}min`;
  };

  const getScoreColor = (score, maxScore) => {
    const percentage = (score / maxScore) * 100;
    if (percentage >= 80) return "text-green-600 dark:text-green-400";
    if (percentage >= 60) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="xl" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            Chargement des résultats...
          </p>
        </div>
      </div>
    );
  }

  if (!results) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Résultats non trouvés
          </h2>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Les résultats de cette session ne sont pas disponibles.
          </p>
          <Link
            to="/sessions"
            className="mt-4 inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
          >
            <ArrowLeftIcon className="h-5 w-5 mr-2" />
            Retour aux sessions
          </Link>
        </div>
      </div>
    );
  }

  const { session, participants, leaderboard, questionResults, quiz } = results;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Link
                  to="/sessions"
                  className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <ArrowLeftIcon className="h-6 w-6" />
                </Link>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                    Résultats - {session.title}
                  </h1>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Code: {session.code} • Quiz: {quiz?.title}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <button
                  onClick={handleExport}
                  className="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 transition-colors"
                >
                  <DocumentArrowDownIcon className="h-5 w-5 mr-2" />
                  Exporter
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Statistiques générales */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <UsersIcon className="h-8 w-8 text-blue-500" />
              <div className="ml-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Participants
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {participants?.length || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <ClockIcon className="h-8 w-8 text-green-500" />
              <div className="ml-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Durée
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatDuration(session.startedAt, session.endedAt)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <TrophyIcon className="h-8 w-8 text-yellow-500" />
              <div className="ml-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Score moyen
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {session.stats?.averageScore?.toFixed(1) || "0"} pts
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <ChartBarIcon className="h-8 w-8 text-purple-500" />
              <div className="ml-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Taux de complétion
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {session.stats?.completionRate?.toFixed(0) || "0"}%
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Onglets */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-8">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="flex space-x-8 px-6">
              {[
                { id: "overview", name: "Vue d'ensemble", icon: EyeIcon },
                { id: "leaderboard", name: "Classement", icon: TrophyIcon },
                { id: "questions", name: "Questions", icon: ChartBarIcon },
                { id: "participants", name: "Participants", icon: UsersIcon },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? "border-primary-500 text-primary-600 dark:text-primary-400"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
                  }`}
                >
                  <tab.icon className="h-5 w-5 mr-2" />
                  {tab.name}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {/* Onglet Vue d'ensemble */}
            {activeTab === "overview" && (
              <div className="space-y-6">
                {/* Informations de session */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                      Informations de la session
                    </h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">
                          Statut:
                        </span>
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${
                            session.status === "finished"
                              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                              : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
                          }`}
                        >
                          {session.status === "finished"
                            ? "Terminée"
                            : session.status}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">
                          Créée le:
                        </span>
                        <span className="text-gray-900 dark:text-white">
                          {formatDate(session.createdAt)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">
                          Démarrée le:
                        </span>
                        <span className="text-gray-900 dark:text-white">
                          {formatDate(session.startedAt)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">
                          Terminée le:
                        </span>
                        <span className="text-gray-900 dark:text-white">
                          {formatDate(session.endedAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                      Quiz associé
                    </h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">
                          Titre:
                        </span>
                        <span className="text-gray-900 dark:text-white font-medium">
                          {quiz?.title}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">
                          Catégorie:
                        </span>
                        <span className="text-gray-900 dark:text-white">
                          {quiz?.category || "Non définie"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">
                          Difficulté:
                        </span>
                        <span className="text-gray-900 dark:text-white">
                          {quiz?.difficulty || "Non définie"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">
                          Questions:
                        </span>
                        <span className="text-gray-900 dark:text-white">
                          {quiz?.questions?.length || 0}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Top 3 du classement */}
                {leaderboard && leaderboard.length > 0 && (
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                      Top 3 du classement
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {leaderboard.slice(0, 3).map((participant, index) => (
                        <div
                          key={participant.id}
                          className={`p-4 rounded-lg border-2 ${
                            index === 0
                              ? "bg-yellow-50 border-yellow-200 dark:bg-yellow-900 dark:border-yellow-700"
                              : index === 1
                              ? "bg-gray-50 border-gray-200 dark:bg-gray-800 dark:border-gray-600"
                              : "bg-orange-50 border-orange-200 dark:bg-orange-900 dark:border-orange-700"
                          }`}
                        >
                          <div className="text-center">
                            <div
                              className={`w-12 h-12 mx-auto mb-2 rounded-full flex items-center justify-center text-white font-bold text-xl ${
                                index === 0
                                  ? "bg-yellow-500"
                                  : index === 1
                                  ? "bg-gray-400"
                                  : "bg-orange-500"
                              }`}
                            >
                              {index + 1}
                            </div>
                            <h4 className="font-semibold text-gray-900 dark:text-white">
                              {participant.name}
                            </h4>
                            <p className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                              {participant.score} pts
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Onglet Classement */}
            {activeTab === "leaderboard" && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-6">
                  Classement final ({leaderboard?.length || 0} participant
                  {(leaderboard?.length || 0) !== 1 ? "s" : ""})
                </h3>

                {leaderboard && leaderboard.length > 0 ? (
                  <div className="space-y-2">
                    {leaderboard.map((participant) => (
                      <div
                        key={participant.id}
                        className={`flex items-center justify-between p-4 rounded-lg ${
                          participant.rank <= 3
                            ? "bg-gradient-to-r from-primary-50 to-primary-100 border border-primary-200 dark:from-primary-900 dark:to-primary-800 dark:border-primary-700"
                            : "bg-gray-50 border border-gray-200 dark:bg-gray-700 dark:border-gray-600"
                        }`}
                      >
                        <div className="flex items-center space-x-4">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                              participant.rank === 1
                                ? "bg-yellow-500"
                                : participant.rank === 2
                                ? "bg-gray-400"
                                : participant.rank === 3
                                ? "bg-orange-500"
                                : "bg-gray-500"
                            }`}
                          >
                            {participant.rank}
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-900 dark:text-white">
                              {participant.name}
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {participant.isConnected
                                ? "Connecté"
                                : "Déconnecté"}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold text-primary-600 dark:text-primary-400">
                            {participant.score} pts
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-600 dark:text-gray-400 text-center py-8">
                    Aucun participant n'a de score enregistré.
                  </p>
                )}
              </div>
            )}

            {/* Onglet Questions */}
            {activeTab === "questions" && (
              <div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Liste des questions */}
                  <div className="lg:col-span-1">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                      Questions ({quiz?.questions?.length || 0})
                    </h3>
                    <div className="space-y-2">
                      {quiz?.questions?.map((question, index) => (
                        <button
                          key={question.order}
                          onClick={() => setSelectedQuestion(question)}
                          className={`w-full text-left p-3 rounded-lg border transition-colors ${
                            selectedQuestion?.id === question.id
                              ? "bg-primary-50 border-primary-200 text-primary-900 dark:bg-primary-900 dark:border-primary-700 dark:text-primary-100"
                              : "bg-gray-50 border-gray-200 hover:bg-gray-100 dark:bg-gray-700 dark:border-gray-600 dark:hover:bg-gray-600"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">
                              Question {index + 1}
                            </span>
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              {questionResults[question.id]?.totalResponses ||
                                0}{" "}
                              réponses
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 truncate">
                            {question.question}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Détails de la question sélectionnée */}
                  <div className="lg:col-span-2">
                    {selectedQuestion ? (
                      <div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                          Détails de la question
                        </h3>

                        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-6">
                          <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                            {selectedQuestion.question}
                          </h4>
                          <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
                            <span>Type: {selectedQuestion.type}</span>
                            <span>Points: {selectedQuestion.points || 1}</span>
                            <span>
                              Réponses:{" "}
                              {questionResults[selectedQuestion.id]
                                ?.totalResponses || 0}
                              /{participants?.length || 0}
                            </span>
                          </div>
                        </div>

                        {/* Réponses */}
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-white mb-4">
                            Réponses des participants
                          </h4>

                          {questionResults[selectedQuestion.id]?.responses
                            ?.length > 0 ? (
                            <div className="space-y-3">
                              {questionResults[
                                selectedQuestion.id
                              ].responses.map((response) => (
                                <div
                                  key={`${response.participantId}-${selectedQuestion.id}`}
                                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                                >
                                  <div className="flex items-center space-x-3">
                                    {response.isCorrect ? (
                                      <CheckCircleIcon className="h-5 w-5 text-green-500" />
                                    ) : (
                                      <XCircleIcon className="h-5 w-5 text-red-500" />
                                    )}
                                    <div>
                                      <p className="font-medium text-gray-900 dark:text-white">
                                        {response.participantName}
                                      </p>
                                      <p className="text-sm text-gray-600 dark:text-gray-400">
                                        Réponse:{" "}
                                        <span className="font-mono">
                                          {response.answer}
                                        </span>
                                      </p>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <p className="font-bold text-primary-600 dark:text-primary-400">
                                      {response.points || 0} pts
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                      {response.timeSpent || 0}s
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-gray-600 dark:text-gray-400 text-center py-8">
                              Aucune réponse pour cette question.
                            </p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <ChartBarIcon className="mx-auto h-12 w-12 text-gray-400" />
                        <p className="mt-4 text-gray-600 dark:text-gray-400">
                          Sélectionnez une question pour voir les détails
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Onglet Participants */}
            {activeTab === "participants" && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-6">
                  Liste des participants ({participants?.length || 0})
                </h3>

                {participants && participants.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {participants.map((participant) => (
                      <div
                        key={participant.id}
                        className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-semibold text-gray-900 dark:text-white">
                            {participant.name}
                          </h4>
                          <div
                            className={`w-3 h-3 rounded-full ${
                              participant.isConnected
                                ? "bg-green-400"
                                : "bg-gray-400"
                            }`}
                          />
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">
                              Score final:
                            </span>
                            <span className="font-bold text-primary-600 dark:text-primary-400">
                              {participant.score || 0} pts
                            </span>
                          </div>

                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">
                              Réponses données:
                            </span>
                            <span className="text-gray-900 dark:text-white">
                              {Object.keys(participant.responses || {}).length}{" "}
                              / {quiz?.questions?.length || 0}
                            </span>
                          </div>

                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">
                              Rejoint le:
                            </span>
                            <span className="text-gray-900 dark:text-white">
                              {participant.joinedAt
                                ? new Date(
                                    participant.joinedAt
                                  ).toLocaleTimeString("fr-FR")
                                : "N/A"}
                            </span>
                          </div>

                          {participant.lastSeen && (
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600 dark:text-gray-400">
                                Dernière activité:
                              </span>
                              <span className="text-gray-900 dark:text-white">
                                {new Date(
                                  participant.lastSeen
                                ).toLocaleTimeString("fr-FR")}
                              </span>
                            </div>
                          )}

                          {/* Détails des réponses */}
                          {participant.responses &&
                            Object.keys(participant.responses).length > 0 && (
                              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                                <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                                  Détails des réponses:
                                </p>
                                <div className="space-y-1">
                                  {Object.entries(participant.responses).map(
                                    ([questionId, response]) => {
                                      const questionIndex =
                                        quiz?.questions?.findIndex(
                                          (q) => q.id == questionId
                                        ) + 1;
                                      return (
                                        <div
                                          key={questionId}
                                          className="flex items-center justify-between text-xs"
                                        >
                                          <span className="text-gray-600 dark:text-gray-400">
                                            Q{questionIndex || "?"}:
                                          </span>
                                          <div className="flex items-center space-x-1">
                                            {response.isCorrect ? (
                                              <CheckCircleIcon className="h-3 w-3 text-green-500" />
                                            ) : (
                                              <XCircleIcon className="h-3 w-3 text-red-500" />
                                            )}
                                            <span
                                              className={`font-medium ${
                                                response.isCorrect
                                                  ? "text-green-600 dark:text-green-400"
                                                  : "text-red-600 dark:text-red-400"
                                              }`}
                                            >
                                              {response.points || 0} pts
                                            </span>
                                          </div>
                                        </div>
                                      );
                                    }
                                  )}
                                </div>
                              </div>
                            )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <UsersIcon className="mx-auto h-12 w-12 text-gray-400" />
                    <p className="mt-4 text-gray-600 dark:text-gray-400">
                      Aucun participant dans cette session.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SessionResults;
