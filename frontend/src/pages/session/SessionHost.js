// SessionHost corrigé - frontend/src/pages/session/SessionHost.js

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";
import { useSocket } from "../../contexts/SocketContext";
import { sessionService } from "../../services/api";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import toast from "react-hot-toast";

const SessionHost = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { socket, isConnected, hostSession } = useSocket();

  // États principaux
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [responses, setResponses] = useState({});
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [actionLoading, setActionLoading] = useState(false);

  // Refs pour éviter les actions multiples
  const isInitializedRef = useRef(false);
  const isLoadingRef = useRef(false);
  const lastActionRef = useRef(null);

  // Fonction pour charger la session - OPTIMISÉE
  const loadSession = useCallback(async () => {
    if (isLoadingRef.current) return;

    try {
      isLoadingRef.current = true;
      setLoading(true);

      const response = await sessionService.getSession(sessionId);
      const sessionData = response.session;

      // Vérifications de sécurité
      if (!sessionData) {
        throw new Error("Session non trouvée");
      }

      if (!response.permissions?.canControl) {
        toast.error(
          "Vous n'avez pas les permissions pour contrôler cette session"
        );
        navigate("/dashboard");
        return;
      }

      // Mettre à jour les états
      setSession(sessionData);
      setParticipants(sessionData.participants || []);
      setResponses(sessionData.responses || {});
      setLeaderboard(sessionData.stats?.leaderboard || []);

      // Question actuelle
      if (sessionData.quiz?.questions) {
        const question =
          sessionData.quiz.questions[sessionData.currentQuestionIndex];
        setCurrentQuestion(question);
      }

      // Connexion socket UNE SEULE FOIS
      if (socket && isConnected && !isInitializedRef.current) {
        console.log("🔌 Connexion socket hôte pour session:", sessionId);
        hostSession(sessionId);
        isInitializedRef.current = true;
      }
    } catch (error) {
      console.error("Erreur lors du chargement de la session:", error);
      toast.error("Erreur lors du chargement de la session");
      navigate("/dashboard");
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  }, [sessionId, user, socket, isConnected, navigate, hostSession]);

  // Chargement initial
  useEffect(() => {
    if (sessionId && user) {
      loadSession();
    }
  }, [sessionId, user, loadSession]);

  // Événements Socket.IO avec nettoyage strict
  useEffect(() => {
    if (!socket || !isConnected || !isInitializedRef.current) return;

    let isComponentMounted = true;

    const handleParticipantJoined = (data) => {
      if (!isComponentMounted) return;
      console.log("👤 Participant rejoint:", data);

      setParticipants((prev) => {
        // Éviter les doublons
        const exists = prev.some((p) => p.id === data.participantId);
        if (exists) return prev;

        const newParticipant = {
          id: data.participantId,
          name: data.participantName,
          joinedAt: new Date(),
          isConnected: true,
          score: 0,
        };
        return [...prev, newParticipant];
      });

      toast.success(`${data.participantName} a rejoint la session`);
    };

    const handleParticipantLeft = (data) => {
      if (!isComponentMounted) return;
      console.log("👤 Participant parti:", data);

      setParticipants((prev) =>
        prev.filter((p) => p.id !== data.participantId)
      );
      toast.info(`Un participant a quitté la session`);
    };

    const handleNewResponse = (data) => {
      if (!isComponentMounted) return;
      console.log("📝 Nouvelle réponse:", data);

      setResponses((prev) => ({
        ...prev,
        [data.questionId]: {
          ...prev[data.questionId],
          [data.participantId]: data.response,
        },
      }));
    };

    const handleNewResponsesBatch = (data) => {
      if (!isComponentMounted) return;
      console.log("📝 Lot de réponses:", data);

      // Traitement groupé des réponses pour optimiser les performances
      setResponses((prev) => {
        const updated = { ...prev };
        data.responses.forEach((response) => {
          if (!updated[response.questionId]) {
            updated[response.questionId] = {};
          }
          updated[response.questionId][response.participantId] = response;
        });
        return updated;
      });
    };

    const handleLeaderboardUpdate = (data) => {
      if (!isComponentMounted) return;
      setLeaderboard(data.leaderboard || []);
    };

    const handleHostConnected = (data) => {
      if (!isComponentMounted) return;
      console.log("🎯 Hôte connecté confirmé:", data.sessionId);

      // Synchroniser les données si nécessaire
      if (data.session) {
        setSession((prevSession) => ({ ...prevSession, ...data.session }));
        setParticipants(data.session.participants || []);
        setResponses(data.session.responses || {});
      }
    };

    const handleError = (error) => {
      if (!isComponentMounted) return;
      console.error("❌ Erreur socket:", error);
      toast.error(error.message || "Erreur de connexion");
    };

    // Enregistrement des événements
    socket.on("participant_joined", handleParticipantJoined);
    socket.on("participant_left", handleParticipantLeft);
    socket.on("new_response", handleNewResponse);
    socket.on("new_responses_batch", handleNewResponsesBatch);
    socket.on("leaderboard_updated", handleLeaderboardUpdate);
    socket.on("host_connected", handleHostConnected);
    socket.on("error", handleError);

    return () => {
      isComponentMounted = false;
      socket.off("participant_joined", handleParticipantJoined);
      socket.off("participant_left", handleParticipantLeft);
      socket.off("new_response", handleNewResponse);
      socket.off("new_responses_batch", handleNewResponsesBatch);
      socket.off("leaderboard_updated", handleLeaderboardUpdate);
      socket.off("host_connected", handleHostConnected);
      socket.off("error", handleError);
    };
  }, [socket, isConnected]);

  // Actions de session avec protection contre les doubles clics
  const executeAction = useCallback(
    async (actionName, actionFn) => {
      const now = Date.now();
      const actionKey = `${actionName}_${sessionId}`;

      // Empêcher les actions multiples
      if (
        lastActionRef.current === actionKey &&
        now - lastActionRef.current < 2000
      ) {
        console.warn("Action déjà en cours:", actionName);
        return;
      }

      lastActionRef.current = actionKey;

      try {
        setActionLoading(true);
        await actionFn();
      } catch (error) {
        console.error(`Erreur lors de ${actionName}:`, error);
        toast.error(`Erreur lors de ${actionName}`);
      } finally {
        setActionLoading(false);
        // Reset après délai
        setTimeout(() => {
          if (lastActionRef.current === actionKey) {
            lastActionRef.current = null;
          }
        }, 2000);
      }
    },
    [sessionId]
  );

  const handleStartSession = useCallback(() => {
    executeAction("démarrage", async () => {
      await sessionService.startSession(sessionId);
      setSession((prev) => ({ ...prev, status: "active" }));
      toast.success("Session démarrée !");
    });
  }, [sessionId, executeAction]);

  const handlePauseSession = useCallback(() => {
    executeAction("pause", async () => {
      await sessionService.pauseSession(sessionId);
      setSession((prev) => ({ ...prev, status: "paused" }));
      toast.success("Session mise en pause");
    });
  }, [sessionId, executeAction]);

  const handleResumeSession = useCallback(() => {
    executeAction("reprise", async () => {
      await sessionService.resumeSession(sessionId);
      setSession((prev) => ({ ...prev, status: "active" }));
      toast.success("Session reprise");
    });
  }, [sessionId, executeAction]);

  const handleEndSession = useCallback(() => {
    if (!window.confirm("Êtes-vous sûr de vouloir terminer cette session ?")) {
      return;
    }

    executeAction("fin", async () => {
      await sessionService.endSession(sessionId);
      setSession((prev) => ({ ...prev, status: "finished" }));
      toast.success("Session terminée");
      setTimeout(() => navigate("/dashboard"), 2000);
    });
  }, [sessionId, executeAction, navigate]);

  const handleNextQuestion = useCallback(() => {
    if (!socket || !isConnected) return;

    const totalQuestions = session?.quiz?.questions?.length || 0;
    const currentIndex = session?.currentQuestionIndex || 0;

    if (currentIndex >= totalQuestions - 1) {
      toast.error("C'est déjà la dernière question");
      return;
    }

    socket.emit("next_question");
    const nextIndex = currentIndex + 1;
    const nextQuestion = session.quiz.questions[nextIndex];

    setSession((prev) => ({ ...prev, currentQuestionIndex: nextIndex }));
    setCurrentQuestion(nextQuestion);
    toast.success("Question suivante");
  }, [socket, isConnected, session]);

  const handlePreviousQuestion = useCallback(() => {
    if (!socket || !isConnected) return;

    const currentIndex = session?.currentQuestionIndex || 0;

    if (currentIndex <= 0) {
      toast.error("C'est déjà la première question");
      return;
    }

    socket.emit("previous_question");
    const prevIndex = currentIndex - 1;
    const prevQuestion = session.quiz.questions[prevIndex];

    setSession((prev) => ({ ...prev, currentQuestionIndex: prevIndex }));
    setCurrentQuestion(prevQuestion);
    toast.success("Question précédente");
  }, [socket, isConnected, session]);

  // Rendu conditionnel
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="xl" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            Chargement de la session...
          </p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Session non trouvée
          </h2>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            La session demandée n'existe pas ou vous n'y avez pas accès.
          </p>
          <button
            onClick={() => navigate("/dashboard")}
            className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
          >
            Retour au tableau de bord
          </button>
        </div>
      </div>
    );
  }

  const totalQuestions = session.quiz?.questions?.length || 0;
  const currentIndex = session.currentQuestionIndex || 0;
  const progress =
    totalQuestions > 0 ? ((currentIndex + 1) / totalQuestions) * 100 : 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-4 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {session.title}
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Code:{" "}
                <span className="font-mono font-bold">{session.code}</span>
              </p>
            </div>

            <div className="flex items-center space-x-4">
              <div
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  session.status === "waiting"
                    ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                    : session.status === "active"
                    ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                    : session.status === "paused"
                    ? "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
                    : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
                }`}
              >
                {session.status === "waiting"
                  ? "En attente"
                  : session.status === "active"
                  ? "En cours"
                  : session.status === "paused"
                  ? "En pause"
                  : session.status}
              </div>

              <div className="text-sm text-gray-600 dark:text-gray-400">
                {participants.length} participant
                {participants.length !== 1 ? "s" : ""}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Contrôles de session */}
          <div className="lg:col-span-2 space-y-6">
            {/* Barre de progression */}
            {totalQuestions > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    Progression
                  </h3>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {currentIndex + 1} / {totalQuestions}
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Question actuelle */}
            {currentQuestion && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  Question actuelle
                </h3>
                <div className="space-y-4">
                  <p className="text-gray-900 dark:text-white font-medium">
                    {currentQuestion.question}
                  </p>

                  {currentQuestion.type === "qcm" &&
                    currentQuestion.options && (
                      <div className="space-y-2">
                        {currentQuestion.options.map((option, index) => (
                          <div
                            key={index}
                            className={`p-3 rounded border ${
                              currentQuestion.correctAnswer === index
                                ? "bg-green-50 border-green-200 dark:bg-green-900 dark:border-green-700"
                                : "bg-gray-50 border-gray-200 dark:bg-gray-700 dark:border-gray-600"
                            }`}
                          >
                            <span className="font-medium mr-2">
                              {String.fromCharCode(65 + index)}.
                            </span>
                            {option}
                            {currentQuestion.correctAnswer === index && (
                              <span className="text-green-600 dark:text-green-400 ml-2">
                                ✓ Bonne réponse
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                  {currentQuestion.type === "vrai_faux" && (
                    <div className="flex space-x-4">
                      <div
                        className={`px-4 py-2 rounded ${
                          currentQuestion.correctAnswer === true
                            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                            : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                        }`}
                      >
                        Vrai {currentQuestion.correctAnswer === true && "✓"}
                      </div>
                      <div
                        className={`px-4 py-2 rounded ${
                          currentQuestion.correctAnswer === false
                            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                            : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                        }`}
                      >
                        Faux {currentQuestion.correctAnswer === false && "✓"}
                      </div>
                    </div>
                  )}

                  {currentQuestion.type === "reponse_libre" && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded dark:bg-green-900 dark:border-green-700">
                      <span className="text-green-800 dark:text-green-200">
                        Réponse attendue: {currentQuestion.correctAnswer}
                      </span>
                    </div>
                  )}

                  {/* Statistiques des réponses */}
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">
                        Réponses reçues:
                      </span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {
                          Object.keys(responses[currentQuestion.id] || {})
                            .length
                        }{" "}
                        / {participants.length}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Contrôles */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Contrôles de session
              </h3>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Démarrer/Pause/Reprendre */}
                {session.status === "waiting" && (
                  <button
                    onClick={handleStartSession}
                    disabled={actionLoading || participants.length === 0}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {actionLoading ? <LoadingSpinner size="sm" /> : "Démarrer"}
                  </button>
                )}

                {session.status === "active" && (
                  <button
                    onClick={handlePauseSession}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 disabled:opacity-50"
                  >
                    {actionLoading ? <LoadingSpinner size="sm" /> : "Pause"}
                  </button>
                )}

                {session.status === "paused" && (
                  <button
                    onClick={handleResumeSession}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {actionLoading ? <LoadingSpinner size="sm" /> : "Reprendre"}
                  </button>
                )}

                {/* Navigation questions */}
                <button
                  onClick={handlePreviousQuestion}
                  disabled={currentIndex <= 0 || session.status !== "active"}
                  className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ← Précédente
                </button>

                <button
                  onClick={handleNextQuestion}
                  disabled={
                    currentIndex >= totalQuestions - 1 ||
                    session.status !== "active"
                  }
                  className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Suivante →
                </button>

                {/* Terminer */}
                <button
                  onClick={handleEndSession}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                >
                  {actionLoading ? <LoadingSpinner size="sm" /> : "Terminer"}
                </button>
              </div>

              {/* Avertissement participants */}
              {session.status === "waiting" && participants.length === 0 && (
                <div className="mt-4 p-3 bg-yellow-100 border border-yellow-200 rounded-lg dark:bg-yellow-900 dark:border-yellow-700">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    ⚠️ Aucun participant connecté. Partagez le code{" "}
                    <strong>{session.code}</strong> pour que les participants
                    puissent rejoindre.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar - Participants et Stats */}
          <div className="space-y-6">
            {/* Participants */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Participants ({participants.length})
              </h3>

              <div className="space-y-3 max-h-96 overflow-y-auto">
                {participants.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400 text-sm text-center py-8">
                    Aucun participant connecté
                  </p>
                ) : (
                  participants.map((participant) => (
                    <div
                      key={participant.id}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                    >
                      <div className="flex items-center space-x-3">
                        <div
                          className={`w-3 h-3 rounded-full ${
                            participant.isConnected
                              ? "bg-green-400"
                              : "bg-gray-400"
                          }`}
                        />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {participant.name}
                        </span>
                      </div>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {participant.score || 0} pts
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Leaderboard */}
            {leaderboard.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  Classement
                </h3>

                <div className="space-y-2">
                  {leaderboard.slice(0, 10).map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between p-2 rounded"
                    >
                      <div className="flex items-center space-x-3">
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                            entry.rank === 1
                              ? "bg-yellow-400 text-yellow-900"
                              : entry.rank === 2
                              ? "bg-gray-300 text-gray-800"
                              : entry.rank === 3
                              ? "bg-yellow-600 text-white"
                              : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                          }`}
                        >
                          {entry.rank}
                        </span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {entry.name}
                        </span>
                      </div>
                      <span className="text-sm font-bold text-primary-600 dark:text-primary-400">
                        {entry.score} pts
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Statistiques rapides */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Statistiques
              </h3>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Total participants
                  </span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {participants.length}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Connectés
                  </span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {participants.filter((p) => p.isConnected).length}
                  </span>
                </div>

                {currentQuestion && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Ont répondu
                    </span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {Object.keys(responses[currentQuestion.id] || {}).length}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SessionHost;
