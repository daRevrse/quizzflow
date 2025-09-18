import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";
import { useSocket } from "../../contexts/SocketContext";
import { sessionService } from "../../services/api";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import toast from "react-hot-toast";
import {
  PlayIcon,
  PauseIcon,
  StopIcon,
  UserGroupIcon,
  ChartBarIcon,
  QrCodeIcon,
  ShareIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  EyeIcon,
  Cog6ToothIcon,
  QuestionMarkCircleIcon,
} from "@heroicons/react/24/outline";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const SessionHost = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { socket, isConnected } = useSocket();

  // États
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [responses, setResponses] = useState({});
  const [leaderboard, setLeaderboard] = useState([]);
  const [timer, setTimer] = useState(null);
  const [showQRCode, setShowQRCode] = useState(false);
  const [showResults, setShowResults] = useState(false);

  // Charger la session
  const loadSession = useCallback(async () => {
    try {
      setLoading(true);
      const response = await sessionService.getSession(sessionId);
      const sessionData = response.session;

      // Vérifier les permissions
      const canHost =
        sessionData.hostId === user.id ||
        sessionData.quiz?.creatorId === user.id ||
        user.role === "admin";

      if (!canHost) {
        toast.error("Vous n'avez pas les permissions pour gérer cette session");
        navigate("/dashboard");
        return;
      }

      setSession(sessionData);
      setParticipants(sessionData.participants || []);
      setResponses(sessionData.responses || {});

      // Définir la question courante
      if (sessionData.currentQuestionIndex !== undefined) {
        const question =
          sessionData.quiz.questions?.[sessionData.currentQuestionIndex];
        setCurrentQuestion(question);
      }

      // Rejoindre la room de la session
      if (socket && isConnected) {
        socket.emit("host_join_session", { sessionId });
      }
    } catch (error) {
      console.error("Erreur lors du chargement de la session:", error);
      toast.error("Erreur lors du chargement de la session");
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  }, [sessionId, user, socket, isConnected, navigate]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  // Événements Socket.IO
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleParticipantJoined = (data) => {
      setParticipants((prev) => [...prev, data.participant]);
      toast.success(`${data.participant.name} a rejoint la session`);
    };

    const handleParticipantLeft = (data) => {
      setParticipants((prev) =>
        prev.filter((p) => p.id !== data.participantId)
      );
      toast.info(`Un participant a quitté la session`);
    };

    const handleNewResponse = (data) => {
      setResponses((prev) => ({
        ...prev,
        [data.questionId]: {
          ...prev[data.questionId],
          [data.participantId]: data.response,
        },
      }));
    };

    const handleLeaderboardUpdate = (data) => {
      setLeaderboard(data.leaderboard);
    };

    socket.on("participant_joined", handleParticipantJoined);
    socket.on("participant_left", handleParticipantLeft);
    socket.on("new_response", handleNewResponse);
    socket.on("leaderboard_updated", handleLeaderboardUpdate);

    return () => {
      socket.off("participant_joined", handleParticipantJoined);
      socket.off("participant_left", handleParticipantLeft);
      socket.off("new_response", handleNewResponse);
      socket.off("leaderboard_updated", handleLeaderboardUpdate);
    };
  }, [socket, isConnected]);

  // Actions de session
  const handleStartSession = async () => {
    try {
      setActionLoading(true);
      await sessionService.startSession(sessionId);

      if (socket) {
        socket.emit("start_session", { sessionId });
      }

      setSession((prev) => ({ ...prev, status: "active" }));
      toast.success("Session démarrée !");
    } catch (error) {
      console.error("Erreur lors du démarrage:", error);
      toast.error("Erreur lors du démarrage de la session");
    } finally {
      setActionLoading(false);
    }
  };

  const handlePauseSession = async () => {
    try {
      setActionLoading(true);
      await sessionService.pauseSession(sessionId);

      if (socket) {
        socket.emit("pause_session", { sessionId });
      }

      setSession((prev) => ({ ...prev, status: "paused" }));
      toast.success("Session mise en pause");
    } catch (error) {
      console.error("Erreur lors de la pause:", error);
      toast.error("Erreur lors de la pause de la session");
    } finally {
      setActionLoading(false);
    }
  };

  const handleResumeSession = async () => {
    try {
      setActionLoading(true);
      await sessionService.resumeSession(sessionId);

      if (socket) {
        socket.emit("resume_session", { sessionId });
      }

      setSession((prev) => ({ ...prev, status: "active" }));
      toast.success("Session reprise");
    } catch (error) {
      console.error("Erreur lors de la reprise:", error);
      toast.error("Erreur lors de la reprise de la session");
    } finally {
      setActionLoading(false);
    }
  };

  const handleEndSession = async () => {
    if (!window.confirm("Êtes-vous sûr de vouloir terminer cette session ?")) {
      return;
    }

    try {
      setActionLoading(true);
      await sessionService.endSession(sessionId);

      if (socket) {
        socket.emit("end_session", { sessionId });
      }

      setSession((prev) => ({ ...prev, status: "finished" }));
      toast.success("Session terminée");

      // Rediriger vers les résultats après un délai
      setTimeout(() => {
        navigate(`/session/${sessionId}/results`);
      }, 2000);
    } catch (error) {
      console.error("Erreur lors de la fin:", error);
      toast.error("Erreur lors de la fin de la session");
    } finally {
      setActionLoading(false);
    }
  };

  const handleNextQuestion = () => {
    if (!session || !session.quiz.questions) return;

    const nextIndex = (session.currentQuestionIndex || 0) + 1;
    if (nextIndex >= session.quiz.questions.length) {
      toast.info("C'était la dernière question");
      return;
    }

    const nextQuestion = session.quiz.questions[nextIndex];
    setCurrentQuestion(nextQuestion);
    setSession((prev) => ({ ...prev, currentQuestionIndex: nextIndex }));

    if (socket) {
      socket.emit("next_question", {
        sessionId,
        questionIndex: nextIndex,
        question: nextQuestion,
      });
    }

    setShowResults(false);
    toast.success("Question suivante affichée");
  };

  const handlePreviousQuestion = () => {
    if (!session || !session.quiz.questions) return;

    const prevIndex = (session.currentQuestionIndex || 0) - 1;
    if (prevIndex < 0) {
      toast.info("C'était la première question");
      return;
    }

    const prevQuestion = session.quiz.questions[prevIndex];
    setCurrentQuestion(prevQuestion);
    setSession((prev) => ({ ...prev, currentQuestionIndex: prevIndex }));

    if (socket) {
      socket.emit("previous_question", {
        sessionId,
        questionIndex: prevIndex,
        question: prevQuestion,
      });
    }

    setShowResults(false);
    toast.success("Question précédente affichée");
  };

  const handleShowResults = () => {
    setShowResults(true);

    if (socket) {
      socket.emit("show_question_results", {
        sessionId,
        questionId: currentQuestion?.id,
        results: responses[currentQuestion?.id] || {},
      });
    }
  };

  const handleShareSession = () => {
    const shareUrl = `${window.location.origin}/join/${session.code}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      toast.success("Lien de participation copié !");
    });
  };

  // Calculer les statistiques des réponses
  const getQuestionStats = () => {
    if (!currentQuestion || !responses[currentQuestion.id]) {
      return { total: 0, answers: {} };
    }

    const questionResponses = responses[currentQuestion.id];
    const total = Object.keys(questionResponses).length;
    const answers = {};

    Object.values(questionResponses).forEach((response) => {
      const answer = response.answer;
      answers[answer] = (answers[answer] || 0) + 1;
    });

    return { total, answers };
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
        <ExclamationTriangleIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          Session non trouvée
        </h3>
        <p className="text-gray-500 dark:text-gray-400">
          Cette session n'existe pas ou vous n'avez pas les permissions pour y
          accéder.
        </p>
      </div>
    );
  }

  const questionStats = getQuestionStats();

  return (
    <div className="space-y-6">
      {/* Header de session */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-3">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {session.title}
                </h1>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                    session.status
                  )}`}
                >
                  {session.status === "waiting"
                    ? "En attente"
                    : session.status === "active"
                    ? "En cours"
                    : session.status === "paused"
                    ? "En pause"
                    : "Terminée"}
                </span>
              </div>
              <div className="flex items-center mt-2 space-x-4 text-sm text-gray-500 dark:text-gray-400">
                <span>
                  Code:{" "}
                  <span className="font-mono font-bold text-lg">
                    {session.code}
                  </span>
                </span>
                <span>
                  {participants.length} participant
                  {participants.length !== 1 ? "s" : ""}
                </span>
                <span>{session.quiz.title}</span>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={handleShareSession}
                className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-md transition-colors"
              >
                <ShareIcon className="h-4 w-4 mr-2" />
                Partager
              </button>

              {session.status === "waiting" && (
                <button
                  onClick={handleStartSession}
                  disabled={actionLoading || participants.length === 0}
                  className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium rounded-md transition-colors"
                >
                  <PlayIcon className="h-4 w-4 mr-2" />
                  Démarrer
                </button>
              )}

              {session.status === "active" && (
                <>
                  <button
                    onClick={handlePauseSession}
                    disabled={actionLoading}
                    className="inline-flex items-center px-3 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-sm font-medium rounded-md transition-colors"
                  >
                    <PauseIcon className="h-4 w-4 mr-2" />
                    Pause
                  </button>
                  <button
                    onClick={handleEndSession}
                    disabled={actionLoading}
                    className="inline-flex items-center px-3 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium rounded-md transition-colors"
                  >
                    <StopIcon className="h-4 w-4 mr-2" />
                    Terminer
                  </button>
                </>
              )}

              {session.status === "paused" && (
                <button
                  onClick={handleResumeSession}
                  disabled={actionLoading}
                  className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium rounded-md transition-colors"
                >
                  <PlayIcon className="h-4 w-4 mr-2" />
                  Reprendre
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Question courante */}
        <div className="lg:col-span-2 space-y-6">
          {currentQuestion ? (
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                  Question {(session.currentQuestionIndex || 0) + 1} /{" "}
                  {session.quiz.questions?.length || 0}
                </h2>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handlePreviousQuestion}
                    disabled={session.currentQuestionIndex === 0}
                    className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                    title="Question précédente"
                  >
                    <ArrowLeftIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={handleNextQuestion}
                    disabled={
                      session.currentQuestionIndex >=
                      (session.quiz.questions?.length || 1) - 1
                    }
                    className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                    title="Question suivante"
                  >
                    <ArrowRightIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="text-lg font-medium text-gray-900 dark:text-white">
                  {currentQuestion.question}
                </div>

                {currentQuestion.media && (
                  <div>
                    <img
                      src={currentQuestion.media.url}
                      alt="Media de la question"
                      className="max-w-md h-auto rounded-lg"
                    />
                  </div>
                )}

                {/* Options pour QCM */}
                {currentQuestion.type === "qcm" && currentQuestion.options && (
                  <div className="space-y-2">
                    {currentQuestion.options.map((option, index) => (
                      <div
                        key={index}
                        className={`p-3 rounded-lg border ${
                          showResults && option.isCorrect
                            ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                            : "bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`${
                              showResults && option.isCorrect
                                ? "text-green-800 dark:text-green-200 font-medium"
                                : "text-gray-700 dark:text-gray-300"
                            }`}
                          >
                            {String.fromCharCode(65 + index)}. {option.text}
                          </span>
                          {showResults && (
                            <div className="flex items-center space-x-2">
                              <span className="text-sm text-gray-600 dark:text-gray-400">
                                {questionStats.answers[option.text] || 0}{" "}
                                réponse
                                {(questionStats.answers[option.text] || 0) !== 1
                                  ? "s"
                                  : ""}
                              </span>
                              {option.isCorrect && (
                                <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Réponse correcte pour Vrai/Faux */}
                {currentQuestion.type === "vrai_faux" && showResults && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center space-x-2">
                      <CheckCircleIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      <span className="text-blue-800 dark:text-blue-200 font-medium">
                        Réponse correcte :{" "}
                        {currentQuestion.correctAnswer === "true"
                          ? "Vrai"
                          : "Faux"}
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {questionStats.total} réponse
                    {questionStats.total !== 1 ? "s" : ""} reçue
                    {questionStats.total !== 1 ? "s" : ""}
                  </div>
                  <div className="flex items-center space-x-3">
                    {!showResults ? (
                      <button
                        onClick={handleShowResults}
                        disabled={questionStats.total === 0}
                        className="inline-flex items-center px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-sm font-medium rounded-md transition-colors"
                      >
                        <EyeIcon className="h-4 w-4 mr-2" />
                        Afficher les résultats
                      </button>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-green-600 dark:text-green-400 font-medium">
                          Résultats affichés
                        </span>
                        <CheckCircleIcon className="h-4 w-4 text-green-600 dark:text-green-400" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
              <div className="text-center py-8">
                <QuestionMarkCircleIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Aucune question sélectionnée
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  Démarrez la session pour afficher la première question.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Participants */}
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Participants ({participants.length})
              </h3>
              <UserGroupIcon className="h-5 w-5 text-gray-400" />
            </div>

            {participants.length === 0 ? (
              <div className="text-center py-4">
                <UserGroupIcon className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Aucun participant pour le moment
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Partagez le code:{" "}
                  <span className="font-mono font-bold">{session.code}</span>
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {participants.map((participant) => (
                  <div
                    key={participant.id}
                    className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-lg"
                  >
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center">
                        <span className="text-xs font-medium text-primary-600 dark:text-primary-400">
                          {participant.name?.charAt(0)?.toUpperCase()}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {participant.name}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      {participant.score !== undefined && (
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {participant.score} pts
                        </span>
                      )}
                      <div
                        className={`w-2 h-2 rounded-full ${
                          participant.isConnected
                            ? "bg-green-400"
                            : "bg-gray-400"
                        }`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Classement */}
          {leaderboard.length > 0 && (
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Classement
                </h3>
                <ChartBarIcon className="h-5 w-5 text-gray-400" />
              </div>

              <div className="space-y-2">
                {leaderboard.slice(0, 5).map((entry, index) => (
                  <div
                    key={entry.id}
                    className={`flex items-center justify-between p-2 rounded-lg ${
                      index === 0
                        ? "bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800"
                        : "bg-gray-50 dark:bg-gray-700"
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <span
                        className={`text-sm font-bold ${
                          index === 0
                            ? "text-yellow-600 dark:text-yellow-400"
                            : "text-gray-600 dark:text-gray-400"
                        }`}
                      >
                        #{entry.rank}
                      </span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {entry.name}
                      </span>
                    </div>
                    <span className="text-sm font-bold text-gray-900 dark:text-white">
                      {entry.score} pts
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Statistiques */}
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Statistiques
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Durée
                </span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {session.startedAt
                    ? Math.floor(
                        (Date.now() - new Date(session.startedAt)) / 1000 / 60
                      )
                    : 0}{" "}
                  min
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Questions
                </span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {(session.currentQuestionIndex || 0) + 1} /{" "}
                  {session.quiz.questions?.length || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Taux de participation
                </span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {participants.length > 0
                    ? Math.round(
                        (questionStats.total / participants.length) * 100
                      )
                    : 0}
                  %
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SessionHost;
