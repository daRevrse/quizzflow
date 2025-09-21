import { useState, useEffect, useCallback, useRef } from "react";
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
  ClockIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  CogIcon,
  EyeIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/outline";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

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
  const [error, setError] = useState(null);
  const [autoAdvanceEnabled, setAutoAdvanceEnabled] = useState(true); // Configurable
  const [isAutoAdvancing, setIsAutoAdvancing] = useState(false);

  // États pour la gestion des questions
  const [questionTimer, setQuestionTimer] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [questionResults, setQuestionResults] = useState(null);

  // Refs pour éviter les actions multiples et les fuites mémoire
  const isInitializedRef = useRef(false);
  const isLoadingRef = useRef(false);
  const lastActionRef = useRef(null);
  const componentMountedRef = useRef(true);

  const { nextQuestion, endSession } = useSocket();

  // Fonction pour charger la session de manière robuste
  const loadSession = useCallback(async () => {
    if (isLoadingRef.current || !componentMountedRef.current) return;

    try {
      isLoadingRef.current = true;
      setLoading(true);
      setError(null);

      console.log("📡 Chargement session host:", sessionId);

      const response = await sessionService.getSession(sessionId);
      const sessionData = response.session;
      const permissions = response.permissions;

      console.log("✅ Session data received:", { sessionData, permissions });

      // Vérifications de sécurité
      if (!sessionData) {
        throw new Error("Session non trouvée");
      }

      if (!permissions?.canControl) {
        setError(
          "Vous n'avez pas les permissions pour contrôler cette session"
        );
        toast.error("Permissions insuffisantes");
        navigate("/dashboard");
        return;
      }

      if (!componentMountedRef.current) return;

      // Mettre à jour les états
      setSession(sessionData);
      setParticipants(
        Array.isArray(sessionData.participants) ? sessionData.participants : []
      );
      setResponses(sessionData.responses || {});

      // Définir la question courante si applicable
      if (
        sessionData.status === "active" &&
        typeof sessionData.currentQuestionIndex === "number" &&
        sessionData.quiz?.questions?.length > sessionData.currentQuestionIndex
      ) {
        const question =
          sessionData.quiz.questions[sessionData.currentQuestionIndex];
        setCurrentQuestion(question);

        // Calculer le temps restant si il y a une limite de temps
        if (question?.timeLimit && sessionData.currentQuestionStartedAt) {
          const startTime = new Date(sessionData.currentQuestionStartedAt);
          const elapsed = Math.floor((Date.now() - startTime) / 1000);
          const remaining = Math.max(0, question.timeLimit - elapsed);
          setQuestionTimer(remaining);
        }
      } else {
        setCurrentQuestion(null);
        setQuestionTimer(null);
      }

      console.log("✅ Session chargée avec succès");
    } catch (error) {
      console.error("❌ Erreur lors du chargement de la session:", error);

      if (!componentMountedRef.current) return;

      const errorMessage = error.message || "Erreur lors du chargement";
      setError(errorMessage);

      if (
        error.message?.includes("non trouvée") ||
        error.message?.includes("404")
      ) {
        toast.error("Session non trouvée");
        navigate("/dashboard");
      }
    } finally {
      if (componentMountedRef.current) {
        isLoadingRef.current = false;
        setLoading(false);
      }
    }
  }, [sessionId, navigate]);

  // Initialisation et chargement de la session
  useEffect(() => {
    componentMountedRef.current = true;

    if (!isInitializedRef.current) {
      isInitializedRef.current = true;
      loadSession();
    }

    return () => {
      componentMountedRef.current = false;
    };
  }, [loadSession]);

  // Gestion des événements Socket.IO avec nettoyage automatique
  useEffect(() => {
    if (!socket || !isConnected || !session) return;

    let isSocketMounted = true;

    // Rejoindre la room en tant qu'hôte
    if (socket && session.id) {
      console.log("🔗 Connexion socket host pour session:", session.id);
      hostSession(session.id);
    }

    // Gestionnaires d'événements
    const handleParticipantJoined = (data) => {
      if (!isSocketMounted || !componentMountedRef.current) return;

      console.log("👤 Nouveau participant:", data);

      setParticipants((prev) => {
        const existing = prev.find((p) => p.id === data.participant.id);
        if (existing) return prev;

        const updated = [...prev, data.participant];
        toast.success(`${data.participant.name} a rejoint la session`);
        return updated;
      });

      // Mettre à jour le compteur dans la session
      setSession((prev) =>
        prev
          ? {
              ...prev,
              participantCount:
                // data.participantCount || prev.participantCount + 1,
                prev.participantCount + 1,
            }
          : null
      );
    };

    const handleParticipantLeft = (data) => {
      if (!isSocketMounted || !componentMountedRef.current) return;

      console.log("👋 Participant parti:", data);

      setParticipants((prev) => {
        const updated = prev.filter((p) => p.id !== data.participantId);
        const leftParticipant = prev.find((p) => p.id === data.participantId);

        if (leftParticipant) {
          toast.info(`${leftParticipant.name} a quitté la session`);
        }

        return updated;
      });

      setSession((prev) =>
        prev
          ? {
              ...prev,
              participantCount: Math.max(0, (prev.participantCount || 0) - 1),
            }
          : null
      );
    };

    const handleNewResponse = (data) => {
      if (!isSocketMounted || !componentMountedRef.current) return;

      console.log("📝 Nouvelle réponse:", data);

      setResponses((prev) => {
        const questionResponses = prev[data.questionId] || [];
        const existingIndex = questionResponses.findIndex(
          (r) => r.participantId === data.participantId
        );

        if (existingIndex >= 0) {
          // Remplacer la réponse existante
          questionResponses[existingIndex] = data;
        } else {
          // Ajouter nouvelle réponse
          questionResponses.push(data);
        }

        return {
          ...prev,
          [data.questionId]: questionResponses,
        };
      });
    };

    const handleNewResponsesBatch = (data) => {
      if (!isSocketMounted || !componentMountedRef.current) return;

      console.log("📝 Batch de réponses:", data);

      setResponses((prev) => ({
        ...prev,
        ...data.responses,
      }));
    };

    const handleLeaderboardUpdate = (data) => {
      if (!isSocketMounted || !componentMountedRef.current) return;

      console.log("🏆 Mise à jour leaderboard:", data);
      setLeaderboard(data.leaderboard || []);
    };

    const handleHostConnected = (data) => {
      if (!isSocketMounted || !componentMountedRef.current) return;

      console.log("🎯 Hôte connecté:", data);
      toast.success("Connecté en tant qu'hôte");
    };

    const handleError = (data) => {
      if (!isSocketMounted || !componentMountedRef.current) return;

      console.error("❌ Erreur socket:", data);
      toast.error(data.message || "Erreur de connexion");
    };

    const handleSessionUpdated = (data) => {
      if (!isSocketMounted || !componentMountedRef.current) return;

      console.log("📝 Session mise à jour:", data);

      if (data.sessionId === session.id) {
        setSession((prev) => (prev ? { ...prev, ...data.updates } : null));
      }
    };

    // Écouter les événements
    socket.on("participant_joined", handleParticipantJoined);
    socket.on("participant_left", handleParticipantLeft);
    socket.on("new_response", handleNewResponse);
    socket.on("new_responses_batch", handleNewResponsesBatch);
    socket.on("leaderboard_updated", handleLeaderboardUpdate);
    socket.on("host_connected", handleHostConnected);
    socket.on("session_updated", handleSessionUpdated);
    socket.on("error", handleError);

    // Nettoyage
    return () => {
      isSocketMounted = false;
      socket.off("participant_joined", handleParticipantJoined);
      socket.off("participant_left", handleParticipantLeft);
      socket.off("new_response", handleNewResponse);
      socket.off("new_responses_batch", handleNewResponsesBatch);
      socket.off("leaderboard_updated", handleLeaderboardUpdate);
      socket.off("host_connected", handleHostConnected);
      socket.off("session_updated", handleSessionUpdated);
      socket.off("error", handleError);
    };
  }, [socket, isConnected, session]);

  // Timer pour la question courante
  // useEffect(() => {
  //   if (questionTimer === null || questionTimer <= 0) return;

  //   const interval = setInterval(() => {
  //     setQuestionTimer((prev) => {
  //       if (prev === null || prev <= 1) {
  //         // Temps écoulé
  //         clearInterval(interval);
  //         if (componentMountedRef.current) {
  //           // toast.warning("Temps écoulé pour cette question !");
  //           toast("⏰ Temps écoulé pour cette question !", {
  //             icon: "⚠️",
  //             style: {
  //               background: "#F59E0B",
  //               color: "white",
  //             },
  //             duration: 3000,
  //           });
  //           // Passer automatiquement aux résultats
  //           setShowResults(true);
  //         }
  //         return 0;
  //       }
  //       return prev - 1;
  //     });
  //   }, 1000);

  //   return () => clearInterval(interval);
  // }, [questionTimer]);
  useEffect(() => {
    if (questionTimer === null || questionTimer <= 0) return;

    const interval = setInterval(() => {
      setQuestionTimer((prev) => {
        if (prev === null || prev <= 1) {
          // Temps écoulé
          clearInterval(interval);
          if (componentMountedRef.current && autoAdvanceEnabled) {
            console.log("⏰ Temps écoulé côté hôte, avancement automatique...");

            toast("⏰ Temps écoulé pour cette question !", {
              icon: "⚠️",
              style: {
                background: "#F59E0B",
                color: "white",
              },
              duration: 3000,
            });

            // CORRECTION: Déclencher l'avancement automatique
            handleAutoAdvance();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [questionTimer, autoAdvanceEnabled]); // Ajouter autoAdvanceEnabled aux dépendances

  // Fonction utilitaire pour exécuter des actions avec protection
  const executeAction = useCallback(
    async (actionName, actionFn) => {
      if (!componentMountedRef.current) return;

      const now = Date.now();
      const actionKey = `${actionName}_${sessionId}`;

      // Empêcher les actions multiples rapides
      if (
        lastActionRef.current === actionKey &&
        now - lastActionRef.current < 2000
      ) {
        console.warn("⚠️  Action déjà en cours:", actionName);
        return;
      }

      lastActionRef.current = actionKey;

      try {
        setActionLoading(true);
        setError(null);

        await actionFn();

        // Recharger la session après action
        setTimeout(() => {
          if (componentMountedRef.current) {
            loadSession();
          }
        }, 500);
      } catch (error) {
        console.error(`❌ Erreur lors de ${actionName}:`, error);

        if (componentMountedRef.current) {
          const errorMessage = error.message || `Erreur lors de ${actionName}`;
          setError(errorMessage);
          toast.error(errorMessage);
        }
      } finally {
        if (componentMountedRef.current) {
          setActionLoading(false);
          // Reset après délai
          setTimeout(() => {
            if (lastActionRef.current === actionKey) {
              lastActionRef.current = null;
            }
          }, 2000);
        }
      }
    },
    [sessionId, loadSession]
  );

  const handleAutoAdvance = useCallback(async () => {
    if (isAutoAdvancing || !componentMountedRef.current) return;

    try {
      setIsAutoAdvancing(true);

      // Vérifier s'il y a une question suivante
      const currentIndex = session?.currentQuestionIndex || 0;
      const totalQuestions = session?.quiz?.questions?.length || 0;

      console.log(`🔍 Avancement auto: ${currentIndex + 1}/${totalQuestions}`);

      if (currentIndex >= totalQuestions - 1) {
        // Dernière question : terminer la session
        console.log("🏁 Dernière question, fin automatique de session");

        toast.success("Dernière question terminée ! Fin de session...", {
          duration: 3000,
        });

        // Attendre un peu avant de terminer
        setTimeout(() => {
          if (componentMountedRef.current) {
            executeAction("fin automatique", async () => {
              endSession();
            });
          }
        }, 2000);
      } else {
        // Passer à la question suivante
        console.log(`➡️ Passage automatique à la question ${currentIndex + 2}`);

        await executeAction("passage automatique", async () => {
          nextQuestion();
        });

        toast.success(`Question ${currentIndex + 2}`, {
          icon: "➡️",
          duration: 2000,
        });
      }
    } catch (error) {
      console.error("❌ Erreur avancement automatique:", error);
      toast.error("Erreur lors de l'avancement automatique");
    } finally {
      setIsAutoAdvancing(false);
    }
  }, [session, nextQuestion, endSession, executeAction, isAutoAdvancing]);

  // Actions de session
  const handleStartSession = useCallback(() => {
    executeAction("démarrage", async () => {
      if (participants.length === 0) {
        throw new Error("Au moins un participant est requis");
      }

      await sessionService.startSession(sessionId);
      toast.success("Session démarrée !");
    });
  }, [sessionId, executeAction, participants.length]);

  const handlePauseSession = useCallback(() => {
    executeAction("pause", async () => {
      await sessionService.pauseSession(sessionId);
      toast.success("Session mise en pause");
    });
  }, [sessionId, executeAction]);

  const handleResumeSession = useCallback(() => {
    executeAction("reprise", async () => {
      await sessionService.resumeSession(sessionId);
      toast.success("Session reprise");
    });
  }, [sessionId, executeAction]);

  const handleEndSession = useCallback(() => {
    if (!window.confirm("Êtes-vous sûr de vouloir terminer cette session ?")) {
      return;
    }

    executeAction("fermeture", async () => {
      await sessionService.endSession(sessionId);
      toast.success("Session terminée");

      // Naviguer vers les résultats après un délai
      setTimeout(() => {
        if (componentMountedRef.current) {
          navigate(`/session/${sessionId}/results`);
        }
      }, 1500);
    });
  }, [sessionId, executeAction, navigate]);

  // Formatage des données
  const formatDuration = (start, end = null) => {
    if (!start) return "N/A";

    const startTime = new Date(start);
    const endTime = end ? new Date(end) : new Date();
    const diffMs = endTime - startTime;
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffSeconds = Math.floor((diffMs % (1000 * 60)) / 1000);

    return `${diffMinutes}m ${diffSeconds}s`;
  };

  const formatTime = (seconds) => {
    if (typeof seconds !== "number" || isNaN(seconds)) return "0:00";

    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
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

  const getStatusIcon = (status) => {
    switch (status) {
      case "waiting":
        return <ClockIcon className="h-4 w-4" />;
      case "active":
        return <PlayIcon className="h-4 w-4" />;
      case "paused":
        return <PauseIcon className="h-4 w-4" />;
      case "finished":
        return <CheckCircleIcon className="h-4 w-4" />;
      default:
        return <ExclamationTriangleIcon className="h-4 w-4" />;
    }
  };

  const handleNextQuestion = useCallback(() => {
    if (isAutoAdvancing) return;

    executeAction("passage manuel", async () => {
      nextQuestion();
      toast.success("Question suivante !");
    });
  }, [nextQuestion, executeAction, isAutoAdvancing]);

  const handlePreviousQuestion = useCallback(() => {
    if (isAutoAdvancing) return;

    executeAction("retour", async () => {
      // Implémenter previousQuestion si disponible
      toast.info("Question précédente");
    });
  }, [executeAction, isAutoAdvancing]);

  // AJOUT: Fonction pour formater le temps restant
  const formatTimeWithProgress = (seconds) => {
    if (seconds === null || seconds === undefined) return "--";

    const totalTime = currentQuestion?.timeLimit || 30;
    const percentage = Math.max(0, (seconds / totalTime) * 100);

    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;

    const timeString =
      mins > 0
        ? `${mins}:${secs.toString().padStart(2, "0")}`
        : secs.toString();

    return { timeString, percentage };
  };

  // MODIFICATION: Affichage du timer avec indicateur d'avancement automatique
  const renderQuestionTimer = () => {
    if (questionTimer === null || questionTimer <= 0) return null;

    const { timeString, percentage } = formatTimeWithProgress(questionTimer);
    const isLowTime = questionTimer <= 10;

    return (
      <div className="bg-red-50 dark:bg-red-900 rounded-lg p-4 relative overflow-hidden">
        {/* Barre de progression */}
        <div
          className="absolute inset-0 bg-red-200 dark:bg-red-800 transition-all duration-1000 ease-linear"
          style={{ width: `${percentage}%` }}
        />

        <div className="relative flex items-center justify-between">
          <div className="flex items-center">
            <ClockIcon
              className={`h-8 w-8 ${
                isLowTime ? "animate-pulse text-red-700" : "text-red-600"
              } dark:text-red-400`}
            />
            <div className="ml-3">
              <p className="text-sm font-medium text-red-600 dark:text-red-400">
                Temps restant
                {autoAdvanceEnabled && (
                  <span className="ml-2 text-xs">
                    (Avancement auto {isAutoAdvancing ? "⏳" : "🤖"})
                  </span>
                )}
              </p>
              <p
                className={`text-2xl font-semibold ${
                  isLowTime ? "animate-pulse" : ""
                } text-red-900 dark:text-red-100`}
              >
                {timeString}
              </p>
            </div>
          </div>

          {/* Toggle pour activer/désactiver l'auto-advance */}
          <div className="flex items-center space-x-2">
            <label className="text-xs text-red-600 dark:text-red-400">
              Auto
            </label>
            <button
              onClick={() => setAutoAdvanceEnabled(!autoAdvanceEnabled)}
              className={`w-8 h-4 rounded-full transition-colors ${
                autoAdvanceEnabled ? "bg-red-600" : "bg-gray-400"
              }`}
            >
              <div
                className={`w-3 h-3 bg-white rounded-full shadow transform transition-transform ${
                  autoAdvanceEnabled ? "translate-x-4" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>
        </div>

        {isLowTime && (
          <div className="mt-2 text-xs text-red-700 dark:text-red-300">
            ⚠️ Temps bientôt écoulé !
          </div>
        )}
      </div>
    );
  };

  // MODIFICATION: Contrôles de navigation avec état
  const renderNavigationControls = () => {
    const currentIndex = session?.currentQuestionIndex || 0;
    const totalQuestions = session?.quiz?.questions?.length || 0;
    const isFirstQuestion = currentIndex === 0;
    const isLastQuestion = currentIndex >= totalQuestions - 1;

    return (
      <div className="flex items-center justify-between mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <button
          onClick={handlePreviousQuestion}
          disabled={isFirstQuestion || actionLoading || isAutoAdvancing}
          className="btn btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ArrowLeftIcon className="w-4 h-4 mr-2" />
          Précédente
        </button>

        <div className="flex items-center space-x-4">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Question {currentIndex + 1} sur {totalQuestions}
          </span>

          {questionTimer > 0 && autoAdvanceEnabled && (
            <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 px-2 py-1 rounded">
              Auto: {questionTimer}s
            </span>
          )}
        </div>

        <button
          onClick={handleNextQuestion}
          disabled={isLastQuestion || actionLoading || isAutoAdvancing}
          className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Suivante
          <ArrowRightIcon className="w-4 h-4 ml-2" />
        </button>
      </div>
    );
  };

  // Rendu des erreurs
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mb-4">
                <ExclamationTriangleIcon className="h-8 w-8 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Erreur de chargement
              </h3>
              <p className="text-red-600 dark:text-red-400 mb-6">{error}</p>
              <div className="flex space-x-4 justify-center">
                <button
                  onClick={() => navigate("/dashboard")}
                  className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                >
                  Retour au dashboard
                </button>
                <button
                  onClick={loadSession}
                  className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
                >
                  Réessayer
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Rendu du loading
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            Chargement de la session...
          </p>
        </div>
      </div>
    );
  }

  // Rendu principal
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* En-tête de session */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {session?.title}
                </h1>
                <div className="flex items-center space-x-4 mt-2">
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    Code:{" "}
                    <span className="font-mono font-semibold">
                      {session?.code}
                    </span>
                  </span>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                      session?.status
                    )}`}
                  >
                    {getStatusIcon(session?.status)}
                    <span className="ml-1 capitalize">{session?.status}</span>
                  </span>
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => navigate(`/session/${sessionId}/results`)}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
                >
                  <EyeIcon className="h-4 w-4 mr-2" />
                  Voir résultats
                </button>

                {session?.status === "waiting" && (
                  <button
                    onClick={handleStartSession}
                    disabled={actionLoading || participants.length === 0}
                    className="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {actionLoading ? (
                      <LoadingSpinner size="sm" className="mr-2" />
                    ) : (
                      <PlayIcon className="h-4 w-4 mr-2" />
                    )}
                    Démarrer
                  </button>
                )}

                {session?.status === "active" && (
                  <>
                    <button
                      onClick={handlePauseSession}
                      disabled={actionLoading}
                      className="inline-flex items-center px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-md hover:bg-orange-700 disabled:opacity-50"
                    >
                      {actionLoading ? (
                        <LoadingSpinner size="sm" className="mr-2" />
                      ) : (
                        <PauseIcon className="h-4 w-4 mr-2" />
                      )}
                      Pause
                    </button>
                    <button
                      onClick={handleEndSession}
                      disabled={actionLoading}
                      className="inline-flex items-center px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 disabled:opacity-50"
                    >
                      {actionLoading ? (
                        <LoadingSpinner size="sm" className="mr-2" />
                      ) : (
                        <StopIcon className="h-4 w-4 mr-2" />
                      )}
                      Terminer
                    </button>
                  </>
                )}

                {session?.status === "paused" && (
                  <>
                    <button
                      onClick={handleResumeSession}
                      disabled={actionLoading}
                      className="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 disabled:opacity-50"
                    >
                      {actionLoading ? (
                        <LoadingSpinner size="sm" className="mr-2" />
                      ) : (
                        <PlayIcon className="h-4 w-4 mr-2" />
                      )}
                      Reprendre
                    </button>
                    <button
                      onClick={handleEndSession}
                      disabled={actionLoading}
                      className="inline-flex items-center px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 disabled:opacity-50"
                    >
                      {actionLoading ? (
                        <LoadingSpinner size="sm" className="mr-2" />
                      ) : (
                        <StopIcon className="h-4 w-4 mr-2" />
                      )}
                      Terminer
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Informations de la session */}
          <div className="px-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 dark:bg-blue-900 rounded-lg p-4">
                <div className="flex items-center">
                  <UserGroupIcon className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                      Participants
                    </p>
                    <p className="text-2xl font-semibold text-blue-900 dark:text-blue-100">
                      {participants.length}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 dark:bg-green-900 rounded-lg p-4">
                <div className="flex items-center">
                  <ChartBarIcon className="h-8 w-8 text-green-600 dark:text-green-400" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-green-600 dark:text-green-400">
                      Questions
                    </p>
                    <p className="text-2xl font-semibold text-green-900 dark:text-green-100">
                      {session?.currentQuestionIndex + 1 || 0} /{" "}
                      {session?.quiz?.questions?.length || 0}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900 rounded-lg p-4">
                <div className="flex items-center">
                  <ClockIcon className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
                      Durée
                    </p>
                    <p className="text-2xl font-semibold text-yellow-900 dark:text-yellow-100">
                      {formatDuration(session?.startedAt, session?.endedAt)}
                    </p>
                  </div>
                </div>
              </div>

              {renderQuestionTimer()}
              {/* {questionTimer !== null && questionTimer > 0 && (
                <div className="bg-red-50 dark:bg-red-900 rounded-lg p-4">
                  <div className="flex items-center">
                    <ClockIcon className="h-8 w-8 text-red-600 dark:text-red-400" />
                    <div className="ml-3">
                      <p className="text-sm font-medium text-red-600 dark:text-red-400">
                        Temps restant
                      </p>
                      <p className="text-2xl font-semibold text-red-900 dark:text-red-100">
                        {formatTime(questionTimer)}
                      </p>
                    </div>
                  </div>
                </div>
              )} */}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Question courante */}
          {currentQuestion && (
            <div className="lg:col-span-2">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                    Question {session?.currentQuestionIndex + 1}
                  </h2>
                </div>
                <div className="px-6 py-4">
                  <p className="text-gray-900 dark:text-white text-lg mb-4">
                    {currentQuestion.question}
                  </p>

                  <div className="space-y-2">
                    {currentQuestion.answers?.map((answer, index) => (
                      <div
                        key={index}
                        className={`p-3 rounded-lg border ${
                          answer.isCorrect
                            ? "bg-green-50 border-green-200 dark:bg-green-900 dark:border-green-800"
                            : "bg-gray-50 border-gray-200 dark:bg-gray-700 dark:border-gray-600"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-gray-900 dark:text-white">
                            {String.fromCharCode(65 + index)}. {answer.text}
                          </span>
                          {answer.isCorrect && (
                            <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
                          )}
                        </div>

                        {/* Barre de progression des réponses */}
                        {responses[currentQuestion.id] && (
                          <div className="mt-2">
                            <div className="bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                              <div
                                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                style={{
                                  width: `${
                                    ((responses[currentQuestion.id]?.filter(
                                      (r) => r.answer === index
                                    ).length || 0) /
                                      Math.max(participants.length, 1)) *
                                    100
                                  }%`,
                                }}
                              />
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {responses[currentQuestion.id]?.filter(
                                (r) => r.answer === index
                              ).length || 0}{" "}
                              réponse(s)
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
          {session?.status === "active" &&
            currentQuestion &&
            renderNavigationControls()}

          {/* Liste des participants */}
          <div className={currentQuestion ? "lg:col-span-1" : "lg:col-span-3"}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                  Participants ({participants.length})
                </h2>
              </div>

              <div className="max-h-96 overflow-y-auto">
                {participants.length === 0 ? (
                  <div className="px-6 py-8 text-center">
                    <UserGroupIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500 dark:text-gray-400">
                      Aucun participant pour le moment
                    </p>
                    <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                      Partagez le code{" "}
                      <span className="font-mono font-semibold">
                        {session?.code}
                      </span>
                    </p>
                  </div>
                ) : (
                  <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                    {participants.map((participant) => (
                      <li key={participant.id} className="px-6 py-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <div className="flex-shrink-0">
                              <div
                                className={`h-8 w-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${
                                  participant.isAnonymous
                                    ? "bg-gray-500"
                                    : "bg-primary-500"
                                }`}
                              >
                                {participant.name.charAt(0).toUpperCase()}
                              </div>
                            </div>
                            <div className="ml-3">
                              <p className="text-sm font-medium text-gray-900 dark:text-white">
                                {participant.name}
                              </p>
                              <div className="flex items-center space-x-2">
                                {participant.isAnonymous && (
                                  <span className="text-xs text-gray-500 dark:text-gray-400">
                                    Anonyme
                                  </span>
                                )}
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  Score: {participant.score || 0}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Indicateur de réponse */}
                          {currentQuestion && responses[currentQuestion.id] && (
                            <div className="flex-shrink-0">
                              {responses[currentQuestion.id].find(
                                (r) => r.participantId === participant.id
                              ) ? (
                                <CheckCircleIcon className="h-5 w-5 text-green-500" />
                              ) : (
                                <div className="h-5 w-5 rounded-full border-2 border-gray-300 dark:border-gray-600" />
                              )}
                            </div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Message d'aide si session en attente */}
        {session?.status === "waiting" && participants.length === 0 && (
          <div className="mt-6 bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex">
              <InformationCircleIcon className="h-5 w-5 text-blue-400 mt-0.5" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                  Comment démarrer votre session
                </h3>
                <div className="mt-2 text-sm text-blue-700 dark:text-blue-300">
                  <ol className="list-decimal list-inside space-y-1">
                    <li>
                      Partagez le code{" "}
                      <span className="font-mono font-semibold">
                        {session?.code}
                      </span>{" "}
                      avec vos participants
                    </li>
                    <li>Attendez qu'ils rejoignent la session</li>
                    <li>Cliquez sur "Démarrer" quand vous êtes prêt</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SessionHost;
