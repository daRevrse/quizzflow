import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";
import { useSocket } from "../../contexts/SocketContext";
import { sessionService } from "../../services/api";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import QRCodeGenerator from "../../components/session/QRCodeGenerator";
import WordCloudDisplay from "../../components/quiz/WordCloudDisplay";
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
  EyeIcon,
  InformationCircleIcon,
  TrashIcon,
  QrCodeIcon,
  DocumentDuplicateIcon,
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
  const [autoAdvanceEnabled, setAutoAdvanceEnabled] = useState(true);
  const [isAutoAdvancing, setIsAutoAdvancing] = useState(false);

  // États pour la gestion des questions
  const [questionTimer, setQuestionTimer] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [questionResults, setQuestionResults] = useState(null);

  // NOUVEAU: État pour le QR Code
  const [showQRCode, setShowQRCode] = useState(false);

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

      setSession(sessionData);
      setParticipants(
        Array.isArray(sessionData.participants) ? sessionData.participants : []
      );
      setResponses(sessionData.responses || {});

      if (
        sessionData.status === "active" &&
        typeof sessionData.currentQuestionIndex === "number" &&
        sessionData.quiz?.questions?.length > sessionData.currentQuestionIndex
      ) {
        const question =
          sessionData.quiz.questions[sessionData.currentQuestionIndex];
        setCurrentQuestion(question);

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

    if (socket && session.id) {
      console.log("🔗 Connexion socket host pour session:", session.id);
      hostSession(session.id);
    }

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

      setSession((prev) =>
        prev
          ? {
              ...prev,
              participantCount: prev.participantCount + 1,
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
          questionResponses[existingIndex] = data;
        } else {
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

      console.log("🔄 Session mise à jour:", data);

      if (data.sessionId === session.id) {
        setSession((prev) => (prev ? { ...prev, ...data.updates } : null));
      }
    };

    const handleNextQuestionFromServer = (data) => {
      if (!isSocketMounted || !componentMountedRef.current) return;

      console.log("🎯 Question automatique reçue du serveur:", data);

      if (data.question && data.question.timeLimit) {
        setQuestionTimer(data.question.timeLimit);
        console.log(`⏰ Timer local mis à jour: ${data.question.timeLimit}s`);
      } else {
        setQuestionTimer(null);
      }

      setTimeout(() => {
        if (componentMountedRef.current) {
          loadSession();
        }
      }, 500);

      if (data.autoAdvanced) {
        toast.success("⏰ Avancement automatique par le serveur", {
          duration: 3000,
          style: { background: "#10B981", color: "white" },
        });
      }
    };

    socket.on("participant_joined", handleParticipantJoined);
    socket.on("participant_left", handleParticipantLeft);
    socket.on("new_response", handleNewResponse);
    socket.on("new_responses_batch", handleNewResponsesBatch);
    socket.on("leaderboard_updated", handleLeaderboardUpdate);
    socket.on("host_connected", handleHostConnected);
    socket.on("session_updated", handleSessionUpdated);
    socket.on("error", handleError);
    socket.on("next_question", handleNextQuestionFromServer);

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
      socket.off("next_question", handleNextQuestionFromServer);
    };
  }, [socket, isConnected, session, hostSession, loadSession]);

  const executeAction = useCallback(
    async (actionName, actionFn) => {
      if (!componentMountedRef.current) return;

      const now = Date.now();
      const actionKey = `${actionName}_${sessionId}`;

      if (
        lastActionRef.current === actionKey &&
        now - lastActionRef.current < 2000
      ) {
        console.warn("⚠️ Action déjà en cours:", actionName);
        return;
      }

      lastActionRef.current = actionKey;

      try {
        setActionLoading(true);
        setError(null);

        await actionFn();

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

      const currentIndex = session?.currentQuestionIndex || 0;
      const totalQuestions = session?.quiz?.questions?.length || 0;

      console.log(`🔄 Avancement auto: ${currentIndex + 1}/${totalQuestions}`);

      if (currentIndex >= totalQuestions - 1) {
        console.log("🏁 Dernière question, fin automatique de session");

        toast.success("Dernière question terminée ! Fin de session...", {
          duration: 3000,
        });

        setTimeout(() => {
          if (componentMountedRef.current) {
            executeAction("fin automatique", async () => {
              await sessionService.endSession(sessionId);
              if (socket && isConnected) {
                socket.emit("end_session");
              }
            });
          }
        }, 2000);
      } else {
        console.log(`➡️ Passage automatique à la question ${currentIndex + 2}`);

        await executeAction("passage automatique", async () => {
          if (socket && isConnected) {
            socket.emit("next_question", { sessionId: session.id });
          }
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
  }, [session, sessionId, socket, isConnected, executeAction, isAutoAdvancing]);

  useEffect(() => {
    if (questionTimer === null || questionTimer <= 0) return;

    const interval = setInterval(() => {
      setQuestionTimer((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);

          if (componentMountedRef.current) {
            if (autoAdvanceEnabled) {
              console.log(
                "⏰ Temps écoulé côté hôte, avancement automatique..."
              );

              toast("⏰ Temps écoulé pour cette question !", {
                icon: "⚠️",
                style: {
                  background: "#F59E0B",
                  color: "white",
                },
                duration: 3000,
              });

              handleAutoAdvance();
            } else {
              toast(
                "⏰ Temps écoulé ! Le serveur va avancer automatiquement...",
                {
                  icon: "⏰",
                  style: {
                    background: "#F59E0B",
                    color: "white",
                  },
                  duration: 3000,
                }
              );
            }
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [questionTimer, autoAdvanceEnabled, handleAutoAdvance]);

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
    if (!session) {
      toast.error("Session non trouvée");
      return;
    }

    if (session.status === "finished") {
      toast.info("La session est déjà terminée");
      navigate(`/session/${sessionId}/results`);
      return;
    }

    if (!["active", "paused"].includes(session.status)) {
      toast.error(
        `Impossible de terminer une session avec le statut "${session.status}"`
      );
      return;
    }

    if (!window.confirm("Êtes-vous sûr de vouloir terminer cette session ?")) {
      return;
    }

    executeAction("fermeture", async () => {
      try {
        await sessionService.endSession(sessionId);
        toast.success("Session terminée");

        setTimeout(() => {
          if (componentMountedRef.current) {
            navigate(`/session/${sessionId}/results`);
          }
        }, 1500);
      } catch (error) {
        if (
          error.message?.includes("terminée") ||
          error.message?.includes("finished")
        ) {
          toast.info("La session était déjà terminée");
          navigate(`/session/${sessionId}/results`);
        } else {
          throw error;
        }
      }
    });
  }, [sessionId, executeAction, navigate, session]);

  const handleCancelSession = useCallback(() => {
    const sessionTitle = session?.title || "cette session";
    const isActive = session?.status === "active";

    let confirmMessage;
    if (isActive) {
      confirmMessage = `⚠️ Attention ! La session "${sessionTitle}" est actuellement active avec ${participants.length} participant(s).\n\nVoulez-vous vraiment l'annuler définitivement ?\n\n• Tous les participants seront déconnectés\n• Les données de cette session seront perdues\n• Cette action est irréversible`;
    } else {
      confirmMessage = `Êtes-vous sûr de vouloir supprimer définitivement la session "${sessionTitle}" ?\n\nCette action est irréversible.`;
    }

    if (!window.confirm(confirmMessage)) {
      return;
    }

    executeAction("annulation", async () => {
      if (isActive) {
        try {
          await sessionService.endSession(sessionId);
        } catch (error) {
          console.warn("Erreur lors de la fermeture avant suppression:", error);
        }
      }

      await sessionService.deleteSession(sessionId);
      toast.success("Session supprimée avec succès");

      setTimeout(() => {
        if (componentMountedRef.current) {
          navigate("/sessions");
        }
      }, 1000);
    });
  }, [sessionId, executeAction, navigate, session, participants.length]);

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
    executeAction("passage manuel", async () => {
      if (socket && isConnected) {
        socket.emit("next_question", { sessionId: session.id });
      }
    });
  }, [socket, isConnected, session?.id, executeAction]);

  const handlePreviousQuestion = useCallback(() => {
    executeAction("retour", async () => {
      toast.info("Question précédente");
    });
  }, [executeAction]);

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

  const renderQuestionTimer = () => {
    if (questionTimer === null || questionTimer <= 0) return null;

    const { timeString, percentage } = formatTimeWithProgress(questionTimer);
    const isLowTime = questionTimer <= 10;
    const isCriticalTime = questionTimer <= 5;

    return (
      <div
        className={`rounded-lg p-4 relative overflow-hidden ${
          isCriticalTime
            ? "bg-red-100 dark:bg-red-900"
            : isLowTime
            ? "bg-orange-50 dark:bg-orange-900"
            : "bg-blue-50 dark:bg-blue-900"
        }`}
      >
        <div
          className={`absolute inset-0 transition-all duration-1000 ease-linear ${
            isCriticalTime
              ? "bg-red-200 dark:bg-red-800"
              : isLowTime
              ? "bg-orange-200 dark:bg-orange-800"
              : "bg-blue-200 dark:bg-blue-800"
          }`}
          style={{ width: `${percentage}%` }}
        />

        <div className="relative flex items-center justify-between">
          <div className="flex items-center">
            <ClockIcon
              className={`h-8 w-8 ${
                isCriticalTime
                  ? "animate-pulse text-red-700"
                  : isLowTime
                  ? "text-orange-600"
                  : "text-blue-600"
              } dark:text-current`}
            />
            <div className="ml-3">
              <p
                className={`text-sm font-medium ${
                  isCriticalTime
                    ? "text-red-700"
                    : isLowTime
                    ? "text-orange-600"
                    : "text-blue-600"
                } dark:text-current`}
              >
                Temps restant
                {autoAdvanceEnabled && (
                  <span className="ml-2 text-xs">
                    (Avancement auto {isAutoAdvancing ? "⏳" : "🤖"})
                  </span>
                )}
              </p>
              <p
                className={`text-2xl font-semibold ${
                  isCriticalTime ? "animate-pulse" : ""
                } text-gray-900 dark:text-white`}
              >
                {timeString}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <label
              className={`text-xs ${
                isCriticalTime
                  ? "text-red-600"
                  : isLowTime
                  ? "text-orange-600"
                  : "text-blue-600"
              } dark:text-current`}
            >
              {autoAdvanceEnabled ? "Auto Frontend" : "Auto Serveur"}
            </label>
            <button
              onClick={() => setAutoAdvanceEnabled(!autoAdvanceEnabled)}
              className={`w-8 h-4 rounded-full transition-colors ${
                autoAdvanceEnabled
                  ? isCriticalTime
                    ? "bg-red-600"
                    : isLowTime
                    ? "bg-orange-600"
                    : "bg-blue-600"
                  : "bg-gray-400"
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

        {isCriticalTime && (
          <div className="mt-2 text-xs text-red-700 dark:text-red-300 animate-pulse">
            🚨{" "}
            {autoAdvanceEnabled
              ? "Avancement automatique imminent !"
              : "Le serveur va avancer automatiquement !"}
          </div>
        )}

        {isLowTime && !isCriticalTime && (
          <div className="mt-2 text-xs text-orange-700 dark:text-orange-300">
            ⏰{" "}
            {autoAdvanceEnabled
              ? "Avancement automatique bientôt..."
              : "Le serveur va bientôt avancer automatiquement"}
          </div>
        )}
      </div>
    );
  };

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

          {questionTimer > 0 && (
            <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 px-2 py-1 rounded">
              {autoAdvanceEnabled
                ? `Auto-frontend: ${questionTimer}s`
                : `Auto-serveur: ${questionTimer}s`}
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

  // NOUVEAU: Fonction pour rendre les résultats de la question
  const renderQuestionResults = () => {
    if (!currentQuestion) return null;

    const currentResponses = responses[currentQuestion.id] || [];
    const responseCount = currentResponses.length;
    const participantCount = participants.length;

    // NOUVEAU: Cas spécial pour nuage de mots
    if (currentQuestion.type === "nuage_mots") {
      const questionId =
        currentQuestion.id || `q_${session?.currentQuestionIndex}`;

      // Récupération des réponses
      let questionResponses = responses[questionId] || [];

      if (questionResponses.length === 0) {
        const alternativeIds = [
          currentQuestion.id,
          `q_${session?.currentQuestionIndex}`,
          `q${session?.currentQuestionIndex}`,
          session?.currentQuestionIndex?.toString(),
        ];

        for (const altId of alternativeIds) {
          if (responses[altId] && responses[altId].length > 0) {
            questionResponses = responses[altId];
            break;
          }
        }
      }

      const responseCount = questionResponses.length;
      const participantCount = participants.length;

      // Agréger tous les mots
      const wordFrequency = {};
      questionResponses.forEach((response) => {
        if (Array.isArray(response.answer)) {
          response.answer.forEach((word) => {
            const normalizedWord = word.toLowerCase().trim();
            wordFrequency[normalizedWord] =
              (wordFrequency[normalizedWord] || 0) + 1;
          });
        }
      });

      // Trier par fréquence
      const sortedWords = Object.entries(wordFrequency)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 50); // Top 50 mots

      return (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
              Nuage de mots
            </h3>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {responseCount} / {participantCount} participants
            </div>
          </div>

          {/* Nuage de mots visuel */}
          {sortedWords.length > 0 ? (
            <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-xl p-6 border-2 border-purple-200 dark:border-purple-800">
              <div className="flex flex-wrap gap-3 justify-center">
                {sortedWords.map(([word, count], index) => {
                  const maxCount = sortedWords[0][1];
                  const fontSize = Math.max(
                    12,
                    Math.min(32, (count / maxCount) * 28 + 14)
                  );
                  const opacity = 0.5 + (count / maxCount) * 0.5;

                  return (
                    <div
                      key={word}
                      className="inline-flex items-center gap-2 px-4 py-2 
                        bg-gradient-to-r from-purple-100 to-blue-100 
                        dark:from-purple-800 dark:to-blue-800 
                        rounded-full border border-purple-300 dark:border-purple-700
                        hover:scale-110 transition-transform cursor-default"
                      style={{
                        fontSize: `${fontSize}px`,
                        opacity: opacity,
                      }}
                      title={`${count} mention${count > 1 ? "s" : ""}`}
                    >
                      <span className="font-bold text-purple-800 dark:text-purple-200">
                        {word}
                      </span>
                      <span className="text-xs bg-purple-200 dark:bg-purple-900 text-purple-700 dark:text-purple-300 px-2 py-1 rounded-full font-medium">
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <p>Aucun mot-clé reçu pour le moment...</p>
            </div>
          )}

          {/* Progression */}
          {participantCount > 0 && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Progression
                </span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {Math.round((responseCount / participantCount) * 100)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-purple-500 to-blue-500 h-2 rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.round(
                      (responseCount / participantCount) * 100
                    )}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Bouton passer à la suite */}
          {responseCount === participantCount && responseCount > 0 && (
            <div className="flex justify-center">
              <button
                onClick={handleNextQuestion}
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 
                  text-white font-semibold py-3 px-6 rounded-xl 
                  shadow-lg hover:shadow-xl transition-all
                  flex items-center gap-2"
              >
                <CheckCircleIcon className="w-5 h-5" />
                Tous ont répondu - Question suivante
              </button>
            </div>
          )}
        </div>
      );
    }

    // Cas pour QCM
    if (currentQuestion.type === "qcm") {
      const questionId =
        currentQuestion.id || `q_${session?.currentQuestionIndex}`;

      console.log("📊 Debug QCM Stats:", {
        questionId,
        currentQuestionId: currentQuestion.id,
        responsesKeys: Object.keys(responses),
        currentResponses: responses[questionId],
        allResponses: responses,
      });

      // Essayer plusieurs formats d'ID
      let questionResponses = responses[questionId] || [];

      if (questionResponses.length === 0) {
        const alternativeIds = [
          currentQuestion.id,
          `q_${session?.currentQuestionIndex}`,
          `q${session?.currentQuestionIndex}`,
          session?.currentQuestionIndex?.toString(),
          currentQuestion.order?.toString(),
        ];

        for (const altId of alternativeIds) {
          if (responses[altId] && responses[altId].length > 0) {
            questionResponses = responses[altId];
            console.log(`✅ Réponses trouvées avec ID: ${altId}`);
            break;
          }
        }
      }

      const responseCount = questionResponses.length;
      const participantCount = participants.length;

      console.log(
        `📈 Stats finales: ${responseCount} réponses sur ${participantCount} participants`
      );

      // 🔴 CORRECTION: Détecter si QCM multiple
      const correctOptions = (currentQuestion.options || []).filter(
        (opt) => opt.isCorrect
      );
      const isMultipleChoice = correctOptions.length > 1;

      console.log(
        `🎯 Type QCM: ${isMultipleChoice ? "Multiple" : "Simple"} (${
          correctOptions.length
        } bonnes réponses)`
      );

      // 🔴 CORRECTION: Calculer les stats selon le type
      const optionStats = (currentQuestion.options || []).map(
        (option, index) => {
          let count = 0;

          if (isMultipleChoice) {
            // ✅ QCM MULTIPLE: Compter combien de participants ont sélectionné cette option
            count = questionResponses.filter((r) => {
              // La réponse peut être un tableau d'indices
              if (Array.isArray(r.answer)) {
                return (
                  r.answer.includes(index) ||
                  r.answer.includes(index.toString()) ||
                  r.answer.map((a) => parseInt(a)).includes(index)
                );
              }
              // Ou un seul index (rare mais possible)
              return r.answer === index || r.answer === index.toString();
            }).length;

            console.log(
              `Option ${index} "${option.text}": ${count} sélections (QCM multiple)`
            );
          } else {
            // ✅ QCM SIMPLE: Compter normalement
            count = questionResponses.filter((r) => {
              return (
                r.answer === index ||
                r.answer === index.toString() ||
                r.answer === option.text ||
                (typeof r.answer === "string" &&
                  r.answer.toLowerCase() === option.text.toLowerCase())
              );
            }).length;

            console.log(
              `Option ${index} "${option.text}": ${count} réponses (QCM simple)`
            );
          }

          const percentage =
            responseCount > 0 ? Math.round((count / responseCount) * 100) : 0;

          return {
            ...option,
            count,
            percentage,
            index,
          };
        }
      );

      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Résultats{" "}
              {isMultipleChoice && (
                <span className="text-sm font-normal text-blue-600 dark:text-blue-400">
                  (Choix multiples)
                </span>
              )}
            </h3>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {responseCount} / {participantCount} réponses
            </span>
          </div>

          {/* 🔴 NOUVEAU: Indicateur QCM multiple */}
          {isMultipleChoice && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-200 flex items-center">
                <svg
                  className="w-4 h-4 mr-2"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>
                  <strong>QCM à choix multiples</strong> -{" "}
                  {correctOptions.length} bonnes réponses attendues. Les
                  statistiques montrent le nombre de participants ayant
                  sélectionné chaque option.
                </span>
              </p>
            </div>
          )}

          {/* Options avec statistiques */}
          {optionStats.map((option) => (
            <div
              key={option.index}
              className={`p-4 rounded-lg border-2 transition-all ${
                option.isCorrect
                  ? "border-success-500 bg-success-50 dark:bg-success-900/20"
                  : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center flex-1">
                  {/* Badge lettre */}
                  <span
                    className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold mr-3 ${
                      option.isCorrect
                        ? "bg-success-500 text-white"
                        : "bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200"
                    }`}
                  >
                    {String.fromCharCode(65 + option.index)}
                  </span>

                  {/* Texte de l'option */}
                  <span className="font-medium text-gray-900 dark:text-white flex-1">
                    {option.text}
                  </span>

                  {/* Indicateur correct */}
                  {option.isCorrect && (
                    <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-success-100 dark:bg-success-900/50 text-success-800 dark:text-success-200">
                      ✓ Correct
                    </span>
                  )}
                </div>

                {/* Stats */}
                <span className="text-sm font-bold ml-4 whitespace-nowrap">
                  {option.count} ({option.percentage}%)
                </span>
              </div>

              {/* Barre de progression */}
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-500 ${
                    option.isCorrect ? "bg-success-600" : "bg-primary-600"
                  }`}
                  style={{ width: `${option.percentage}%` }}
                />
              </div>

              {/* 🔴 NOUVEAU: Détail pour QCM multiple */}
              {isMultipleChoice && option.count > 0 && (
                <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                  {option.count} participant{option.count > 1 ? "s ont" : " a"}{" "}
                  sélectionné cette option
                  {option.isCorrect && " (parmi les bonnes réponses)"}
                </div>
              )}
            </div>
          ))}

          {/* Message si aucune réponse */}
          {responseCount === 0 && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <p>Aucune réponse reçue pour le moment...</p>
            </div>
          )}

          {/* 🔴 NOUVEAU: Statistiques globales pour QCM multiple */}
          {isMultipleChoice && responseCount > 0 && (
            <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                <svg
                  className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                </svg>
                Analyse des réponses complètes
              </h4>

              {(() => {
                // Compter les réponses 100% correctes
                const perfectAnswers = questionResponses.filter((r) => {
                  if (!Array.isArray(r.answer)) return false;

                  const correctIndices = correctOptions
                    .map((_, idx) =>
                      currentQuestion.options.findIndex(
                        (opt) => opt === correctOptions[idx]
                      )
                    )
                    .sort();

                  const answerIndices = r.answer.map((a) => parseInt(a)).sort();

                  return (
                    JSON.stringify(answerIndices) ===
                    JSON.stringify(correctIndices)
                  );
                }).length;

                const perfectPercentage =
                  responseCount > 0
                    ? Math.round((perfectAnswers / responseCount) * 100)
                    : 0;

                return (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg">
                      <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                        {perfectAnswers}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Réponses parfaites
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        {perfectPercentage}% du total
                      </div>
                    </div>

                    <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg">
                      <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                        {responseCount - perfectAnswers}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Réponses partielles
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        {100 - perfectPercentage}% du total
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="mt-3 text-xs text-gray-600 dark:text-gray-400 italic">
                💡 Une réponse est "parfaite" quand le participant a sélectionné
                toutes les bonnes options et aucune mauvaise.
              </div>
            </div>
          )}
        </div>
      );
    }

    // Cas pour Vrai/Faux
    if (currentQuestion.type === "vrai_faux") {
      // 🔴 FIX: ID de question cohérent
      const questionId =
        currentQuestion.id || `q_${session?.currentQuestionIndex}`;

      console.log("🔍 Debug Vrai/Faux Stats:", {
        questionId,
        responsesKeys: Object.keys(responses),
        currentResponses: responses[questionId],
      });

      // 🔴 FIX: Essayer plusieurs formats d'ID
      let questionResponses = responses[questionId] || [];

      if (questionResponses.length === 0) {
        const alternativeIds = [
          currentQuestion.id,
          `q_${session?.currentQuestionIndex}`,
          `q${session?.currentQuestionIndex}`,
          session?.currentQuestionIndex?.toString(),
        ];

        for (const altId of alternativeIds) {
          if (responses[altId] && responses[altId].length > 0) {
            questionResponses = responses[altId];
            console.log(`✅ Réponses trouvées avec ID: ${altId}`);
            break;
          }
        }
      }

      const responseCount = questionResponses.length;
      const participantCount = participants.length;

      console.log(
        `📊 Stats Vrai/Faux: ${responseCount} réponses sur ${participantCount}`
      );

      // 🔴 FIX: Compter TOUTES les variations possibles
      const vraiCount = questionResponses.filter((r) => {
        const answer = String(r.answer).toLowerCase().trim();
        // Accepter: 0, "0", "vrai", "true", true
        return (
          r.answer === 0 ||
          answer === "0" ||
          answer === "vrai" ||
          answer === "true" ||
          r.answer === true
        );
      }).length;

      const fauxCount = questionResponses.filter((r) => {
        const answer = String(r.answer).toLowerCase().trim();
        // Accepter: 1, "1", "faux", "false", false
        return (
          r.answer === 1 ||
          answer === "1" ||
          answer === "faux" ||
          answer === "false" ||
          r.answer === false
        );
      }).length;

      console.log(`📊 Comptage: Vrai=${vraiCount}, Faux=${fauxCount}`);

      // 🔴 FIX: Détecter quelle est la bonne réponse
      let correctAnswer = "vrai"; // Par défaut

      if (currentQuestion.correctAnswer !== undefined) {
        const correctValue = String(currentQuestion.correctAnswer)
          .toLowerCase()
          .trim();

        if (
          currentQuestion.correctAnswer === false ||
          currentQuestion.correctAnswer === 1 ||
          correctValue === "faux" ||
          correctValue === "false" ||
          correctValue === "1"
        ) {
          correctAnswer = "faux";
        }
      }

      console.log(`✅ Bonne réponse: ${correctAnswer}`);

      return (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            Résultats ({responseCount} / {participantCount})
          </h3>

          <div className="grid grid-cols-2 gap-4">
            {/* Carte VRAI */}
            <div
              className={`p-6 rounded-lg border-2 text-center ${
                correctAnswer === "vrai"
                  ? "border-success-500 bg-success-50 dark:bg-success-900/20"
                  : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800"
              }`}
            >
              <div className="text-4xl mb-2">✓</div>
              <div className="font-bold text-gray-900 dark:text-white mb-2">
                Vrai
              </div>
              <div className="text-2xl font-bold text-primary-600">
                {vraiCount}
              </div>
              <div className="text-sm text-gray-500">
                {responseCount > 0
                  ? Math.round((vraiCount / responseCount) * 100)
                  : 0}
                %
              </div>

              {/* Barre de progression */}
              <div className="mt-3 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-green-500 h-2 rounded-full transition-all duration-500"
                  style={{
                    width: `${
                      responseCount > 0 ? (vraiCount / responseCount) * 100 : 0
                    }%`,
                  }}
                />
              </div>
            </div>

            {/* Carte FAUX */}
            <div
              className={`p-6 rounded-lg border-2 text-center ${
                correctAnswer === "faux"
                  ? "border-success-500 bg-success-50 dark:bg-success-900/20"
                  : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800"
              }`}
            >
              <div className="text-4xl mb-2">✗</div>
              <div className="font-bold text-gray-900 dark:text-white mb-2">
                Faux
              </div>
              <div className="text-2xl font-bold text-primary-600">
                {fauxCount}
              </div>
              <div className="text-sm text-gray-500">
                {responseCount > 0
                  ? Math.round((fauxCount / responseCount) * 100)
                  : 0}
                %
              </div>

              {/* Barre de progression */}
              <div className="mt-3 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-red-500 h-2 rounded-full transition-all duration-500"
                  style={{
                    width: `${
                      responseCount > 0 ? (fauxCount / responseCount) * 100 : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Message si aucune réponse */}
          {responseCount === 0 && (
            <div className="text-center py-4 text-gray-500 dark:text-gray-400">
              Aucune réponse reçue pour le moment...
            </div>
          )}

          {/* Debug info (à retirer en production) */}
          {process.env.NODE_ENV === "development" && (
            <div className="mt-4 p-3 bg-gray-100 dark:bg-gray-700 rounded text-xs">
              <p>Debug: questionId={questionId}</p>
              <p>
                Réponses brutes:{" "}
                {JSON.stringify(questionResponses.map((r) => r.answer))}
              </p>
            </div>
          )}
        </div>
      );
    }

    // Cas pour Réponse libre
    if (currentQuestion.type === "reponse_libre") {
      // 🔴 FIX: Récupération cohérente de l'ID
      const questionId =
        currentQuestion.id || `q_${session?.currentQuestionIndex}`;

      console.log("🔍 Debug Réponse Libre Stats:", {
        questionId,
        responsesKeys: Object.keys(responses),
        currentResponses: responses[questionId],
      });

      // 🔴 FIX: Essayer plusieurs formats d'ID
      let questionResponses = responses[questionId] || [];

      if (questionResponses.length === 0) {
        const alternativeIds = [
          currentQuestion.id,
          `q_${session?.currentQuestionIndex}`,
          `q${session?.currentQuestionIndex}`,
          session?.currentQuestionIndex?.toString(),
        ];

        for (const altId of alternativeIds) {
          if (responses[altId] && responses[altId].length > 0) {
            questionResponses = responses[altId];
            console.log(`✅ Réponses trouvées avec ID: ${altId}`);
            break;
          }
        }
      }

      const responseCount = questionResponses.length;
      const participantCount = participants.length;

      console.log(
        `📊 Stats Réponse Libre: ${responseCount} réponses sur ${participantCount}`
      );

      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Réponses reçues
            </h3>
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {responseCount} / {participantCount}
            </span>
          </div>

          {/* Liste des réponses */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {questionResponses.length > 0 ? (
              questionResponses.map((response, index) => {
                const participant = participants.find(
                  (p) => p.id === response.participantId
                );

                return (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border-2 ${
                      response.isCorrect
                        ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                        : response.isCorrect === false
                        ? "border-red-500 bg-red-50 dark:bg-red-900/20"
                        : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {participant?.name || "Participant anonyme"}
                          </span>
                          {response.timeSpent !== undefined && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              ({response.timeSpent}s)
                            </span>
                          )}
                        </div>
                        <p className="text-gray-900 dark:text-white font-medium">
                          {response.answer}
                        </p>
                      </div>

                      {/* Indicateur correct/incorrect */}
                      {response.isCorrect !== undefined && (
                        <div className="flex-shrink-0">
                          {response.isCorrect ? (
                            <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                              <CheckCircleIcon className="w-5 h-5" />
                              <span className="text-sm font-medium">
                                +{response.points || 0} pts
                              </span>
                            </div>
                          ) : (
                            <XCircleIcon className="w-5 h-5 text-red-600 dark:text-red-400" />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <InformationCircleIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Aucune réponse reçue pour le moment...</p>
              </div>
            )}
          </div>

          {/* Réponse correcte attendue */}
          {currentQuestion.correctAnswer && (
            <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-start gap-2">
                <InformationCircleIcon className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
                    Réponse attendue :
                  </p>
                  <p className="text-blue-900 dark:text-blue-100 font-medium">
                    {currentQuestion.correctAnswer}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Barre de progression */}
          {participantCount > 0 && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Progression
                </span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {Math.round((responseCount / participantCount) * 100)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.round(
                      (responseCount / participantCount) * 100
                    )}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      );
    }

    return null;
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
                  onClick={handleCancelSession}
                  disabled={actionLoading}
                  className="inline-flex items-center px-3 py-2 border border-red-300 dark:border-red-600 rounded-md text-sm font-medium text-red-700 dark:text-red-300 bg-white dark:bg-gray-700 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                  title={
                    session?.status === "active"
                      ? "Annuler la session active"
                      : "Supprimer la session"
                  }
                >
                  <TrashIcon className="h-4 w-4 mr-2" />
                  {session?.status === "active" ? "Annuler" : "Supprimer"}
                </button>

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

                {session?.status === "finished" && (
                  <div className="inline-flex items-center px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-sm font-medium rounded-md border border-gray-300 dark:border-gray-600">
                    <CheckCircleIcon className="h-4 w-4 mr-2" />
                    Session terminée
                  </div>
                )}
              </div>
            </div>
          </div>

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

                  {/* Affichage conditionnel selon le type */}
                  {renderQuestionResults()}
                </div>

                {session?.status === "active" && renderNavigationControls()}
              </div>
            </div>
          )}

          {/* Sidebar Participants avec QR Code */}
          <div className={currentQuestion ? "lg:col-span-1" : "lg:col-span-3"}>
            <div className="space-y-6">
              {/* NOUVEAU: Section QR Code */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                <div className="p-4 bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900/20 dark:to-primary-800/20 rounded-lg border border-primary-200 dark:border-primary-800">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-primary-900 dark:text-primary-100">
                      Code de session
                    </h3>
                    <button
                      onClick={() => setShowQRCode(!showQRCode)}
                      className="p-2 hover:bg-primary-200 dark:hover:bg-primary-900/40 rounded-lg transition-colors"
                      title={
                        showQRCode
                          ? "Masquer le QR Code"
                          : "Afficher le QR Code"
                      }
                    >
                      <QrCodeIcon className="h-5 w-5 text-primary-700 dark:text-primary-300" />
                    </button>
                  </div>

                  <div className="text-center mb-3">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 rounded-lg shadow">
                      <span className="font-mono text-3xl font-bold text-primary-600 dark:text-primary-400">
                        {session.code}
                      </span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(session.code);
                          toast.success("Code copié !");
                        }}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                      >
                        <DocumentDuplicateIcon className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                      </button>
                    </div>
                  </div>

                  {showQRCode && (
                    <div className="mt-4">
                      <QRCodeGenerator
                        sessionCode={session.code}
                        size={200}
                        showDownload={true}
                        showCopy={false}
                      />
                    </div>
                  )}

                  <p className="text-xs text-center text-primary-700 dark:text-primary-300 mt-2">
                    Les participants peuvent rejoindre avec ce code sur <br />
                    <span className="font-mono font-semibold">
                      {/* {window.location.origin}/join */}
                      {process.env.REACT_APP_URL}/join
                    </span>
                  </p>
                </div>
              </div>

              {/* Liste des participants */}
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

                            {currentQuestion &&
                              responses[currentQuestion.id] && (
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
        </div>

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
