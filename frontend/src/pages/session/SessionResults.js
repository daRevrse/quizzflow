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
            stats: (() => {
              const participants = sessionData.participants || [];
              const validScores = participants
                .map((p) => p.score || 0)
                .filter((score) => typeof score === "number");

              return {
                totalParticipants: participants.length,
                averageScore:
                  validScores.length > 0
                    ? validScores.reduce((sum, score) => sum + score, 0) /
                      validScores.length
                    : 0,
                completionRate:
                  sessionData.participantCount > 0
                    ? (participants.length / sessionData.participantCount) * 100
                    : 0,
              };
            })(),
          },

          // CORRECTION: Participants avec toutes les réponses
          participants: (sessionData.participants || []).map((participant) => {
            // Récupérer toutes les réponses de ce participant
            const participantResponses = {};
            const responses = sessionData.responses || {};

            Object.keys(responses).forEach((questionId) => {
              const questionResponses = responses[questionId] || [];
              const participantResponse = questionResponses.find(
                (r) => r.participantId === participant.id
              );

              if (participantResponse) {
                participantResponses[questionId] = {
                  answer: participantResponse.answer,
                  isCorrect: participantResponse.isCorrect || false,
                  points: participantResponse.points || 0,
                  timeSpent: participantResponse.timeSpent || 0,
                  submittedAt: participantResponse.submittedAt,
                };
              }
            });

            return {
              id: participant.id,
              name: participant.name,
              isAnonymous: participant.isAnonymous || false,
              score: participant.score || 0,
              joinedAt: participant.joinedAt,
              lastSeen: participant.lastSeen,
              isConnected: participant.isConnected || false,
              responses: participantResponses, // Réponses structurées
              userId: participant.userId,
              // Statistiques calculées
              correctAnswers: Object.values(participantResponses).filter(
                (r) => r.isCorrect
              ).length,
              totalResponses: Object.keys(participantResponses).length,
              averageTimePerQuestion:
                Object.keys(participantResponses).length > 0
                  ? Math.round(
                      Object.values(participantResponses).reduce(
                        (sum, r) => sum + (r.timeSpent || 0),
                        0
                      ) / Object.keys(participantResponses).length
                    )
                  : 0,
            };
          }),

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

          // CORRECTION: Construire les résultats par question avec les vraies réponses
          questionResults: (() => {
            const responses = sessionData.responses || {};
            const results = {};
            const participants = sessionData.participants || [];

            // CORRECTION: Pour chaque question du quiz, chercher les réponses correspondantes
            if (sessionData.quiz?.questions) {
              sessionData.quiz.questions.forEach((question, questionIndex) => {
                // CORRECTION: Essayer plusieurs variantes d'ID pour matcher les réponses
                const possibleQuestionIds = [
                  question.id,
                  `q_${questionIndex}`,
                  `question_${questionIndex}`,
                  questionIndex.toString(),
                  (questionIndex + 1).toString(),
                  question.order?.toString(),
                  `q_${question.order}`,
                ].filter(Boolean);

                console.log(
                  `🔍 Recherche réponses pour question ${questionIndex + 1}:`,
                  {
                    questionTitle: question.question?.substring(0, 50) + "...",
                    possibleIds: possibleQuestionIds,
                    availableResponseIds: Object.keys(responses),
                  }
                );

                // Trouver l'ID qui correspond aux réponses disponibles
                let matchingQuestionId = null;
                let questionResponses = [];

                for (const testId of possibleQuestionIds) {
                  if (responses[testId] && responses[testId].length > 0) {
                    matchingQuestionId = testId;
                    questionResponses = responses[testId];
                    console.log(
                      `✅ Trouvé correspondance avec ID: ${testId} (${questionResponses.length} réponses)`
                    );
                    break;
                  }
                }

                // Si aucune correspondance directe, prendre la première clé disponible non encore utilisée
                if (
                  !matchingQuestionId &&
                  Object.keys(responses).length > questionIndex
                ) {
                  const unusedResponseKeys = Object.keys(responses).filter(
                    (key) => !results[key]
                  );
                  if (unusedResponseKeys[0]) {
                    matchingQuestionId = unusedResponseKeys[0];
                    questionResponses = responses[matchingQuestionId];
                    console.log(
                      `🔄 Utilisation ID disponible: ${matchingQuestionId} (${questionResponses.length} réponses)`
                    );
                  }
                }

                // Utiliser l'ID de la question comme clé finale, même s'il n'y a pas de réponses
                const finalQuestionId = question.id || `q_${questionIndex}`;

                // Enrichir chaque réponse avec le nom du participant
                const enrichedResponses = questionResponses.map((response) => {
                  const participant = participants.find(
                    (p) => p.id === response.participantId
                  );
                  return {
                    participantId: response.participantId,
                    participantName:
                      participant?.name ||
                      `Participant ${response.participantId}`,
                    answer: response.answer,
                    isCorrect: response.isCorrect || false,
                    points: response.points || 0,
                    timeSpent: response.timeSpent || 0,
                    submittedAt: response.submittedAt,
                    // NOUVEAU: Ajouter le texte de la réponse formaté
                    answerText: (() => {
                      if (typeof response.answer === "string") {
                        return response.answer;
                      } else if (typeof response.answer === "number") {
                        // Pour les QCM, convertir l'index en lettre
                        if (
                          question.type === "qcm" &&
                          question.options &&
                          question.options[response.answer]
                        ) {
                          return `${String.fromCharCode(
                            65 + response.answer
                          )} - ${question.options[response.answer].text}`;
                        }
                        return `Option ${response.answer + 1}`;
                      } else if (typeof response.answer === "boolean") {
                        return response.answer ? "Vrai" : "Faux";
                      } else {
                        return String(response.answer || "Pas de réponse");
                      }
                    })(),
                  };
                });

                results[finalQuestionId] = {
                  questionId: finalQuestionId,
                  originalQuestionId: matchingQuestionId, // Garder trace de l'ID original
                  question: question, // CORRECTION: Inclure l'objet question complet
                  totalResponses: questionResponses.length,
                  totalParticipants: participants.length,
                  responses: enrichedResponses,
                  stats: {
                    correctAnswers: questionResponses.filter((r) => r.isCorrect)
                      .length,
                    incorrectAnswers: questionResponses.filter(
                      (r) => !r.isCorrect
                    ).length,
                    averageTimeSpent:
                      questionResponses.length > 0
                        ? Math.round(
                            questionResponses.reduce(
                              (sum, r) => sum + (r.timeSpent || 0),
                              0
                            ) / questionResponses.length
                          )
                        : 0,
                    responseRate:
                      participants.length > 0
                        ? Math.round(
                            (questionResponses.length / participants.length) *
                              100
                          )
                        : 0,
                    successRate:
                      questionResponses.length > 0
                        ? Math.round(
                            (questionResponses.filter((r) => r.isCorrect)
                              .length /
                              questionResponses.length) *
                              100
                          )
                        : 0,
                  },
                };

                console.log(`📊 Question ${questionIndex + 1} configurée:`, {
                  finalId: finalQuestionId,
                  responses: enrichedResponses.length,
                  successRate: results[finalQuestionId].stats.successRate,
                });
              });
            }

            console.log("🎯 QuestionResults finaux:", {
              totalQuestions: Object.keys(results).length,
              questionsWithResponses: Object.values(results).filter(
                (q) => q.totalResponses > 0
              ).length,
              availableIds: Object.keys(results),
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

  useEffect(() => {
    if (results && process.env.NODE_ENV === "development") {
      console.log("🔍 DEBUG SessionResults:", {
        session: results.session,
        participants: results.participants,
        participantCount: results.participants?.length,
        questionResults: results.questionResults,
        firstParticipant: results.participants?.[0],
        firstParticipantResponses: results.participants?.[0]?.responses,
        rawResponses: results.questionResults,
      });
    }
  }, [results]);

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
                      {quiz?.questions?.map((question, index) => {
                        // CORRECTION: Utiliser l'ID cohérent avec questionResults
                        const questionId = question.id || `q_${index}`;
                        const questionResult = questionResults[questionId];
                        const responseCount =
                          questionResult?.totalResponses || 0;
                        const successRate =
                          questionResult?.stats?.successRate || 0;

                        return (
                          <button
                            key={questionId}
                            onClick={() => setSelectedQuestion(question)}
                            className={`w-full text-left p-3 rounded-lg border transition-colors ${
                              selectedQuestion?.id === question.id ||
                              (selectedQuestion?.question ===
                                question.question &&
                                !selectedQuestion?.id)
                                ? "bg-primary-50 border-primary-200 text-primary-900 dark:bg-primary-900 dark:border-primary-700 dark:text-primary-100"
                                : "bg-gray-50 border-gray-200 hover:bg-gray-100 dark:bg-gray-700 dark:border-gray-600 dark:hover:bg-gray-600"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium">
                                Question {index + 1}
                              </span>
                              <div className="flex items-center space-x-2 text-xs">
                                <span className="text-gray-600 dark:text-gray-400">
                                  {responseCount} réponses
                                </span>
                                {responseCount > 0 && (
                                  <span
                                    className={`px-2 py-1 rounded-full ${
                                      successRate >= 70
                                        ? "bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300"
                                        : successRate >= 40
                                        ? "bg-yellow-100 text-yellow-600 dark:bg-yellow-900 dark:text-yellow-300"
                                        : "bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300"
                                    }`}
                                  >
                                    {successRate}%
                                  </span>
                                )}
                              </div>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 truncate">
                              {question.question}
                            </p>
                          </button>
                        );
                      })}
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
                              Temps: {selectedQuestion.timeLimit || 30}s
                            </span>
                          </div>

                          {/* Afficher les options pour les QCM */}
                          {selectedQuestion.type === "qcm" &&
                            selectedQuestion.options && (
                              <div className="mt-3">
                                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                  Options:
                                </p>
                                <div className="grid grid-cols-1 gap-2">
                                  {selectedQuestion.options.map(
                                    (option, idx) => (
                                      <div
                                        key={idx}
                                        className={`px-3 py-2 rounded text-sm ${
                                          option.isCorrect
                                            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 font-medium"
                                            : "bg-gray-100 text-gray-700 dark:bg-gray-600 dark:text-gray-300"
                                        }`}
                                      >
                                        {String.fromCharCode(65 + idx)} -{" "}
                                        {option.text}
                                        {option.isCorrect && (
                                          <span className="ml-2">✓</span>
                                        )}
                                      </div>
                                    )
                                  )}
                                </div>
                              </div>
                            )}
                        </div>

                        {/* CORRECTION: Utiliser l'ID cohérent pour trouver les résultats */}
                        {(() => {
                          const questionId =
                            selectedQuestion.id ||
                            `q_${
                              quiz?.questions?.indexOf(selectedQuestion) || 0
                            }`;
                          const questionResult = questionResults[questionId];

                          console.log("🔍 Debug question sélectionnée:", {
                            selectedQuestion:
                              selectedQuestion.question?.substring(0, 50),
                            questionId,
                            questionResult: questionResult
                              ? {
                                  responses: questionResult.responses?.length,
                                  stats: questionResult.stats,
                                }
                              : "null",
                            availableResults: Object.keys(questionResults),
                          });

                          if (!questionResult) {
                            return (
                              <div className="text-center py-8 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                                <div className="text-yellow-600 dark:text-yellow-400 mb-2">
                                  ⚠️ Aucune réponse trouvée
                                </div>
                                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                                  Les participants n'ont pas encore répondu à
                                  cette question, ou il y a un problème de
                                  correspondance des données.
                                </p>
                                <details className="mt-3 text-xs">
                                  <summary className="cursor-pointer text-yellow-600 hover:text-yellow-800">
                                    Informations de debug
                                  </summary>
                                  <div className="mt-2 text-left bg-yellow-100 dark:bg-yellow-900/40 p-2 rounded">
                                    <div>ID recherché: {questionId}</div>
                                    <div>
                                      IDs disponibles:{" "}
                                      {Object.keys(questionResults).join(", ")}
                                    </div>
                                    <div>
                                      Total questions:{" "}
                                      {quiz?.questions?.length || 0}
                                    </div>
                                  </div>
                                </details>
                              </div>
                            );
                          }

                          return (
                            <div>
                              {/* Statistiques de la question */}
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg text-center">
                                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                                    {questionResult.totalResponses}
                                  </div>
                                  <div className="text-sm text-blue-800 dark:text-blue-300">
                                    Réponses
                                  </div>
                                </div>
                                <div className="bg-green-50 dark:bg-green-900/30 p-3 rounded-lg text-center">
                                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                                    {questionResult.stats.successRate}%
                                  </div>
                                  <div className="text-sm text-green-800 dark:text-green-300">
                                    Réussite
                                  </div>
                                </div>
                                <div className="bg-orange-50 dark:bg-orange-900/30 p-3 rounded-lg text-center">
                                  <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                                    {questionResult.stats.averageTimeSpent}s
                                  </div>
                                  <div className="text-sm text-orange-800 dark:text-orange-300">
                                    Temps moyen
                                  </div>
                                </div>
                                <div className="bg-purple-50 dark:bg-purple-900/30 p-3 rounded-lg text-center">
                                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                                    {questionResult.stats.responseRate}%
                                  </div>
                                  <div className="text-sm text-purple-800 dark:text-purple-300">
                                    Participation
                                  </div>
                                </div>
                              </div>

                              {/* Réponses des participants */}
                              <div>
                                <h4 className="font-medium text-gray-900 dark:text-white mb-4">
                                  Réponses des participants (
                                  {questionResult.responses.length})
                                </h4>

                                {questionResult.responses.length > 0 ? (
                                  <div className="space-y-3 max-h-96 overflow-y-auto">
                                    {questionResult.responses.map(
                                      (response, responseIndex) => (
                                        <div
                                          key={`${response.participantId}-${questionId}`}
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
                                                {/* CORRECTION: Utiliser answerText formaté */}
                                                <span className="font-mono bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded text-xs">
                                                  {response.answerText ||
                                                    response.answer ||
                                                    "Pas de réponse"}
                                                </span>
                                              </p>
                                            </div>
                                          </div>
                                          <div className="text-right">
                                            <p
                                              className={`font-bold ${
                                                response.isCorrect
                                                  ? "text-green-600 dark:text-green-400"
                                                  : "text-red-600 dark:text-red-400"
                                              }`}
                                            >
                                              {response.points || 0} pts
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                              {response.timeSpent || 0}s
                                            </p>
                                          </div>
                                        </div>
                                      )
                                    )}
                                  </div>
                                ) : (
                                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                                    <div className="text-4xl mb-2">🤷‍♀️</div>
                                    <p>
                                      Aucune réponse enregistrée pour cette
                                      question
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })()}
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
                                  Détails des réponses (
                                  {Object.keys(participant.responses).length}):
                                </p>
                                <div className="space-y-1">
                                  {Object.entries(participant.responses).map(
                                    ([questionId, response], index) => {
                                      // Trouver la question correspondante
                                      const question = quiz?.questions?.find(
                                        (q) =>
                                          q.id == questionId ||
                                          q.id === `q_${index}` ||
                                          (typeof q.order === "number" &&
                                            q.order === index + 1)
                                      );

                                      const questionNumber = question
                                        ? question.order ||
                                          quiz.questions.indexOf(question) + 1
                                        : index + 1;

                                      return (
                                        <div
                                          key={questionId}
                                          className="flex items-center justify-between text-xs p-2 bg-white dark:bg-gray-800 rounded"
                                        >
                                          <div className="flex-1">
                                            <span className="text-gray-600 dark:text-gray-400">
                                              Q{questionNumber}:
                                            </span>
                                            <span className="text-gray-800 dark:text-gray-200 ml-1 font-mono text-xs">
                                              {typeof response.answer ===
                                              "string"
                                                ? response.answer.substring(
                                                    0,
                                                    20
                                                  )
                                                : response.answer}
                                              {typeof response.answer ===
                                                "string" &&
                                                response.answer.length > 20 &&
                                                "..."}
                                            </span>
                                          </div>
                                          <div className="flex items-center space-x-2">
                                            <span className="text-xs text-gray-500">
                                              {response.timeSpent || 0}s
                                            </span>
                                            <div className="flex items-center space-x-1">
                                              {response.isCorrect ? (
                                                <CheckCircleIcon className="h-3 w-3 text-green-500" />
                                              ) : (
                                                <XCircleIcon className="h-3 w-3 text-red-500" />
                                              )}
                                              <span
                                                className={`font-medium text-xs ${
                                                  response.isCorrect
                                                    ? "text-green-600 dark:text-green-400"
                                                    : "text-red-600 dark:text-red-400"
                                                }`}
                                              >
                                                {response.points || 0} pts
                                              </span>
                                            </div>
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
