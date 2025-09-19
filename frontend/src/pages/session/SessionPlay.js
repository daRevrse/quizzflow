import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";
import { useSocket } from "../../contexts/SocketContext";
import { sessionService } from "../../services/api";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import toast from "react-hot-toast";
import {
  CheckCircleIcon,
  ClockIcon,
  UserGroupIcon,
  TrophyIcon,
  ExclamationTriangleIcon,
  QuestionMarkCircleIcon,
  PlayIcon,
  PauseIcon,
  StopIcon,
  XCircleIcon,
  ArrowRightIcon,
  StarIcon,
  FireIcon,
  BoltIcon,
  AcademicCapIcon,
  ChartBarIcon,
} from "@heroicons/react/24/outline";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const SessionPlay = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { socket, isConnected } = useSocket();

  // États principaux
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [questionResults, setQuestionResults] = useState(null);
  const [playerScore, setPlayerScore] = useState(0);
  const [leaderboard, setLeaderboard] = useState([]);
  const [sessionStatus, setSessionStatus] = useState("waiting");
  const [participantInfo, setParticipantInfo] = useState(null);

  // États pour l'UI et les animations
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [waitingMessage, setWaitingMessage] = useState(
    "En attente du démarrage..."
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCorrectAnswer, setShowCorrectAnswer] = useState(false);
  const [streak, setStreak] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [currentQuestionNumber, setCurrentQuestionNumber] = useState(0);

  // Refs pour la gestion du composant
  const componentMountedRef = useRef(true);
  const isLoadingRef = useRef(false);
  const timerRef = useRef(null);
  const hasJoinedSessionRef = useRef(false);

  // Charger la session et initialiser l'état
  const loadSession = useCallback(async () => {
    if (isLoadingRef.current || !componentMountedRef.current) return;

    try {
      isLoadingRef.current = true;
      setLoading(true);
      setError(null);

      console.log("📡 Chargement session play:", sessionId);

      const response = await sessionService.getSession(sessionId);
      const sessionData = response.session;
      const permissions = response.permissions;

      console.log("✅ Session data loaded:", { sessionData, permissions });

      if (!sessionData) {
        throw new Error("Session non trouvée");
      }

      // Vérifier si on peut participer
      if (!permissions?.canParticipate) {
        if (sessionData.status === "finished") {
          toast.info("Cette session est terminée");
          navigate(`/session/${sessionId}/results`);
          return;
        } else if (sessionData.status === "cancelled") {
          toast.error("Cette session a été annulée");
          navigate("/join");
          return;
        } else {
          toast.error("Vous ne pouvez pas participer à cette session");
          navigate("/join");
          return;
        }
      }

      if (!componentMountedRef.current) return;

      // Mettre à jour les états de session
      setSession(sessionData);
      setSessionStatus(sessionData.status);
      setTotalQuestions(sessionData.quiz?.questions?.length || 0);
      setCurrentQuestionNumber((sessionData.currentQuestionIndex || 0) + 1);

      // Récupérer les informations du participant
      const myParticipant = sessionData.participants?.find(
        (p) =>
          p.userId === user?.id ||
          p.name === (user?.firstName || user?.username) ||
          p.id?.includes(user?.id)
      );

      if (myParticipant) {
        setParticipantInfo(myParticipant);
        setPlayerScore(myParticipant.score || 0);
        setStreak(myParticipant.streak || 0);
        console.log("👤 Participant trouvé:", myParticipant);
      } else {
        console.warn("⚠️  Participant non trouvé dans la session");
        // Si pas de participant trouvé, vérifier si on peut toujours rejoindre
        if (
          sessionData.status === "waiting" ||
          (sessionData.status === "active" &&
            sessionData.settings?.allowLateJoin)
        ) {
          // Rediriger vers la page de jointure
          navigate(`/join/${sessionData.code}`);
          return;
        }
      }

      // Définir la question courante si la session est active
      if (
        sessionData.status === "active" &&
        typeof sessionData.currentQuestionIndex === "number" &&
        sessionData.quiz?.questions?.length > sessionData.currentQuestionIndex
      ) {
        const question =
          sessionData.quiz.questions[sessionData.currentQuestionIndex];
        setCurrentQuestion(question);
        setShowResults(false);
        setShowCorrectAnswer(false);

        // Réinitialiser l'état de la question
        let hasAnswered = false;
        let myAnswer = null;

        // Vérifier si on a déjà répondu à cette question
        if (myParticipant && sessionData.responses?.[question.id]) {
          const myResponse = sessionData.responses[question.id].find(
            (r) => r.participantId === myParticipant.id
          );
          if (myResponse) {
            hasAnswered = true;
            myAnswer = myResponse.answer;
          }
        }

        setIsAnswered(hasAnswered);
        setSelectedAnswer(myAnswer);

        // Gérer le timer si il y a une limite de temps
        if (question.timeLimit && sessionData.currentQuestionStartedAt) {
          const startTime = new Date(sessionData.currentQuestionStartedAt);
          const elapsed = Math.floor((Date.now() - startTime) / 1000);
          const remaining = Math.max(0, question.timeLimit - elapsed);
          setTimeRemaining(remaining);

          console.log(`⏰ Timer question: ${remaining}s restantes`);
        } else {
          setTimeRemaining(null);
        }
      } else {
        // Pas de question active
        setCurrentQuestion(null);
        setTimeRemaining(null);
        setShowResults(false);
        setIsAnswered(false);
        setSelectedAnswer(null);

        // Messages d'attente selon le statut
        switch (sessionData.status) {
          case "waiting":
            setWaitingMessage("En attente du démarrage de la session...");
            break;
          case "paused":
            setWaitingMessage("Session mise en pause par l'animateur...");
            break;
          case "finished":
            toast.success(
              "Session terminée ! Redirection vers les résultats..."
            );
            setTimeout(() => {
              navigate(`/session/${sessionId}/results`);
            }, 2000);
            return;
          default:
            setWaitingMessage("En attente...");
        }
      }

      console.log("✅ Session chargée avec succès");
    } catch (error) {
      console.error("❌ Erreur lors du chargement:", error);

      if (!componentMountedRef.current) return;

      const errorMessage = error.message || "Erreur lors du chargement";
      setError(errorMessage);

      if (
        errorMessage.includes("non trouvée") ||
        errorMessage.includes("404")
      ) {
        toast.error("Session non trouvée");
        navigate("/join");
      }
    } finally {
      if (componentMountedRef.current) {
        isLoadingRef.current = false;
        setLoading(false);
      }
    }
  }, [sessionId, user, navigate]);

  // Initialisation et nettoyage
  useEffect(() => {
    componentMountedRef.current = true;
    loadSession();

    return () => {
      componentMountedRef.current = false;
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [loadSession]);

  // Gestion du timer de question
  useEffect(() => {
    // Nettoyer le timer précédent
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Démarrer un nouveau timer si nécessaire
    if (
      timeRemaining !== null &&
      timeRemaining > 0 &&
      !isAnswered &&
      !showResults
    ) {
      console.log(`⏰ Démarrage timer: ${timeRemaining}s`);

      timerRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev === null || prev <= 1) {
            console.log("⏰ Temps écoulé !");
            clearInterval(timerRef.current);
            timerRef.current = null;

            if (componentMountedRef.current && !isAnswered) {
              handleTimeUp();
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    // Nettoyage
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [timeRemaining, isAnswered, showResults]);

  // Gestion des événements Socket.IO
  useEffect(() => {
    if (!socket || !isConnected || !sessionId || !participantInfo) return;

    let isSocketMounted = true;

    // Rejoindre la session en tant que participant (une seule fois)
    if (!hasJoinedSessionRef.current) {
      console.log("🔗 Connexion socket participant:", {
        sessionId,
        participantId: participantInfo.id,
      });

      socket.emit("join_session", {
        sessionId,
        participantId: participantInfo.id,
        role: "participant",
      });

      hasJoinedSessionRef.current = true;
    }

    // === Gestionnaires d'événements Session ===
    const handleSessionStarted = (data) => {
      if (!isSocketMounted || !componentMountedRef.current) return;

      console.log("🚀 Session démarrée:", data);
      setSessionStatus("active");
      setWaitingMessage("");
      toast.success("La session a commencé !");

      // Recharger pour obtenir la première question
      setTimeout(() => {
        if (componentMountedRef.current) {
          loadSession();
        }
      }, 1000);
    };

    const handleSessionPaused = (data) => {
      if (!isSocketMounted || !componentMountedRef.current) return;

      console.log("⏸️ Session en pause:", data);
      setSessionStatus("paused");
      setWaitingMessage("Session mise en pause par l'animateur...");

      // Arrêter le timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      toast.info("Session mise en pause");
    };

    const handleSessionResumed = (data) => {
      if (!isSocketMounted || !componentMountedRef.current) return;

      console.log("▶️ Session reprise:", data);
      setSessionStatus("active");
      setWaitingMessage("");
      toast.success("Session reprise !");

      // Recharger pour synchroniser l'état
      setTimeout(() => {
        if (componentMountedRef.current) {
          loadSession();
        }
      }, 500);
    };

    const handleSessionEnded = (data) => {
      if (!isSocketMounted || !componentMountedRef.current) return;

      console.log("🏁 Session terminée:", data);
      setSessionStatus("finished");

      // Arrêter le timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      toast.success("Session terminée ! Merci d'avoir participé 🎉");

      // Redirection vers les résultats
      setTimeout(() => {
        if (componentMountedRef.current) {
          navigate(`/session/${sessionId}/results`);
        }
      }, 3000);
    };

    // === Gestionnaires d'événements Questions ===
    const handleNewQuestion = (data) => {
      if (!isSocketMounted || !componentMountedRef.current) return;

      console.log("❓ Nouvelle question:", data);

      // Réinitialiser l'état pour la nouvelle question
      setCurrentQuestion(data.question);
      setSelectedAnswer(null);
      setIsAnswered(false);
      setShowResults(false);
      setShowCorrectAnswer(false);
      setQuestionResults(null);
      setIsSubmitting(false);
      setCurrentQuestionNumber((data.questionIndex || 0) + 1);

      // Gérer le timer
      if (data.question.timeLimit) {
        setTimeRemaining(data.question.timeLimit);
      } else {
        setTimeRemaining(null);
      }

      toast.success(`Question ${(data.questionIndex || 0) + 1} !`, {
        icon: "❓",
        duration: 2000,
      });
    };

    const handleQuestionResults = (data) => {
      if (!isSocketMounted || !componentMountedRef.current) return;

      console.log("📊 Résultats question:", data);

      // Arrêter le timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      setTimeRemaining(null);
      setShowResults(true);
      setShowCorrectAnswer(true);
      setQuestionResults(data.results);

      // Vérifier si notre réponse était correcte
      const myResponse = data.results?.responses?.find(
        (r) => r.participantId === participantInfo.id
      );

      if (myResponse && myResponse.isCorrect) {
        toast.success("Bonne réponse ! 🎉", {
          duration: 3000,
          style: {
            background: "#10B981",
            color: "white",
          },
        });

        // Augmenter le streak
        setStreak((prev) => prev + 1);
      } else if (myResponse && !myResponse.isCorrect) {
        toast.error("Dommage ! 😔", {
          duration: 2000,
          style: {
            background: "#EF4444",
            color: "white",
          },
        });

        // Réinitialiser le streak
        setStreak(0);
      }
    };

    const handleLeaderboardUpdate = (data) => {
      if (!isSocketMounted || !componentMountedRef.current) return;

      console.log("🏆 Mise à jour leaderboard:", data);
      setLeaderboard(data.leaderboard || []);

      // Mettre à jour le score et streak du joueur
      const myEntry = data.leaderboard?.find(
        (entry) =>
          (participantInfo && entry.id === participantInfo.id) ||
          entry.name === (user?.firstName || user?.username)
      );

      if (myEntry) {
        setPlayerScore(myEntry.score || 0);
        setStreak(myEntry.streak || 0);
      }
    };

    // === Gestionnaires d'événements Réponses ===
    const handleResponseReceived = (data) => {
      if (!isSocketMounted || !componentMountedRef.current) return;

      console.log("✅ Réponse confirmée:", data);

      if (data.participantId === participantInfo.id) {
        setIsAnswered(true);
        setIsSubmitting(false);
        toast.success("Réponse enregistrée !", {
          icon: "✅",
          duration: 2000,
        });
      }
    };

    const handleResponseError = (data) => {
      if (!isSocketMounted || !componentMountedRef.current) return;

      console.error("❌ Erreur réponse:", data);
      setIsSubmitting(false);

      toast.error(data.message || "Erreur lors de l'envoi de votre réponse", {
        duration: 3000,
      });
    };

    // === Gestionnaires d'événements généraux ===
    const handleError = (data) => {
      if (!isSocketMounted || !componentMountedRef.current) return;

      console.error("❌ Erreur socket:", data);
      toast.error(data.message || "Erreur de connexion");
    };

    const handleDisconnect = () => {
      if (!isSocketMounted || !componentMountedRef.current) return;

      console.warn("🔌 Socket déconnecté");
      toast.error("Connexion perdue. Tentative de reconnexion...", {
        duration: 5000,
      });
    };

    const handleReconnect = () => {
      if (!isSocketMounted || !componentMountedRef.current) return;

      console.log("🔌 Socket reconnecté");
      toast.success("Connexion rétablie !", {
        duration: 2000,
      });

      // Se reconnecter à la session
      hasJoinedSessionRef.current = false;
    };

    // Écouter les événements
    socket.on("session_started", handleSessionStarted);
    socket.on("session_paused", handleSessionPaused);
    socket.on("session_resumed", handleSessionResumed);
    socket.on("session_ended", handleSessionEnded);
    socket.on("new_question", handleNewQuestion);
    socket.on("question_results", handleQuestionResults);
    socket.on("leaderboard_updated", handleLeaderboardUpdate);
    socket.on("response_received", handleResponseReceived);
    socket.on("response_error", handleResponseError);
    socket.on("error", handleError);
    socket.on("disconnect", handleDisconnect);
    socket.on("reconnect", handleReconnect);

    // Nettoyage
    return () => {
      isSocketMounted = false;
      socket.off("session_started", handleSessionStarted);
      socket.off("session_paused", handleSessionPaused);
      socket.off("session_resumed", handleSessionResumed);
      socket.off("session_ended", handleSessionEnded);
      socket.off("new_question", handleNewQuestion);
      socket.off("question_results", handleQuestionResults);
      socket.off("leaderboard_updated", handleLeaderboardUpdate);
      socket.off("response_received", handleResponseReceived);
      socket.off("response_error", handleResponseError);
      socket.off("error", handleError);
      socket.off("disconnect", handleDisconnect);
      socket.off("reconnect", handleReconnect);
    };
  }, [
    socket,
    isConnected,
    sessionId,
    participantInfo,
    user,
    navigate,
    loadSession,
  ]);

  // === Fonctions d'interaction ===

  // Soumettre une réponse
  const handleSubmitAnswer = useCallback(() => {
    if (selectedAnswer === null && selectedAnswer !== 0) {
      toast.error("Veuillez sélectionner une réponse");
      return;
    }

    if (isAnswered || isSubmitting || !currentQuestion || !participantInfo) {
      return;
    }

    const response = {
      sessionId,
      questionId: currentQuestion.id,
      participantId: participantInfo.id,
      answer: selectedAnswer,
      submittedAt: new Date().toISOString(),
      timeSpent:
        currentQuestion.timeLimit && timeRemaining !== null
          ? currentQuestion.timeLimit - timeRemaining
          : null,
    };

    console.log("📤 Envoi réponse:", response);
    setIsSubmitting(true);

    if (socket && isConnected) {
      socket.emit("submit_answer", response);

      // Timeout de sécurité
      setTimeout(() => {
        if (isSubmitting && componentMountedRef.current) {
          setIsSubmitting(false);
          toast.error("Délai d'attente dépassé. Réessayez.");
        }
      }, 10000);
    } else {
      console.warn("⚠️  Socket non connecté");
      setIsSubmitting(false);
      toast.error("Problème de connexion. Vérifiez votre réseau.");
    }
  }, [
    selectedAnswer,
    isAnswered,
    isSubmitting,
    currentQuestion,
    participantInfo,
    sessionId,
    socket,
    isConnected,
    timeRemaining,
  ]);

  // Temps écoulé
  const handleTimeUp = useCallback(() => {
    if (isAnswered || showResults) return;

    console.log("⏰ Temps écoulé pour la question");
    // toast.warning("Temps écoulé !", {
    //   icon: "⏰",
    //   duration: 3000,
    // });
    toast("⏰ Temps écoulé !", {
      icon: "⚠️",
      style: {
        background: "#F59E0B",
        color: "white",
      },
      duration: 3000,
    });

    if (
      selectedAnswer !== null &&
      selectedAnswer !== undefined &&
      !isSubmitting
    ) {
      // Soumettre la réponse sélectionnée
      handleSubmitAnswer();
    } else {
      // Aucune réponse sélectionnée
      setIsAnswered(true);
      toast.info("Aucune réponse sélectionnée", {
        duration: 2000,
      });
    }
  }, [
    isAnswered,
    showResults,
    selectedAnswer,
    isSubmitting,
    handleSubmitAnswer,
  ]);

  // Sélectionner une réponse
  const handleSelectAnswer = useCallback(
    (answerIndex) => {
      if (isAnswered || showResults || isSubmitting) return;

      setSelectedAnswer(answerIndex);
      console.log("📝 Réponse sélectionnée:", answerIndex);

      // Feedback tactile
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    },
    [isAnswered, showResults, isSubmitting]
  );

  // === Fonctions utilitaires ===

  const getStatusColor = (status) => {
    const colors = {
      waiting:
        "text-yellow-600 bg-yellow-50 border-yellow-200 dark:bg-yellow-900 dark:text-yellow-200 dark:border-yellow-800",
      active:
        "text-green-600 bg-green-50 border-green-200 dark:bg-green-900 dark:text-green-200 dark:border-green-800",
      paused:
        "text-orange-600 bg-orange-50 border-orange-200 dark:bg-orange-900 dark:text-orange-200 dark:border-orange-800",
      finished:
        "text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:border-blue-800",
    };
    return (
      colors[status] ||
      "text-gray-600 bg-gray-50 border-gray-200 dark:bg-gray-900 dark:text-gray-200 dark:border-gray-800"
    );
  };

  const getTimerColor = (time) => {
    if (time > 10) return "text-green-600 dark:text-green-400";
    if (time > 5) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const formatTime = (seconds) => {
    if (typeof seconds !== "number" || isNaN(seconds)) return "0:00";

    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getAnswerLetter = (index) => {
    return String.fromCharCode(65 + index); // A, B, C, D...
  };

  const getStreakEmoji = (streakCount) => {
    if (streakCount >= 5) return "🔥";
    if (streakCount >= 3) return "⚡";
    if (streakCount >= 1) return "✨";
    return "";
  };

  const getPositionSuffix = (position) => {
    const suffixes = ["er", "ème", "ème"];
    return suffixes[position - 1] || "ème";
  };

  // === Rendus conditionnels ===

  // Rendu des erreurs
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 text-center">
            <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mb-4">
              <ExclamationTriangleIcon className="h-8 w-8 text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Erreur
            </h3>
            <p className="text-red-600 dark:text-red-400 mb-6">{error}</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => navigate("/join")}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
              >
                Rejoindre une session
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
    );
  }

  // Rendu du loading
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            Connexion à la session...
          </p>
          {session && (
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-500">
              {session.title}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
        <div className="text-center">
          <ExclamationTriangleIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Session non trouvée
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            Cette session n'existe pas ou a été fermée.
          </p>
          <button
            onClick={() => navigate("/join")}
            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
          >
            Rejoindre une session
          </button>
        </div>
      </div>
    );
  }

  // === Rendu principal ===
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white truncate">
                {session.title}
              </h1>
              <div className="flex items-center space-x-4 mt-1">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  <span className="font-mono font-semibold">
                    {session.code}
                  </span>
                </span>
                <span
                  className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                    sessionStatus
                  )}`}
                >
                  {sessionStatus === "active" && (
                    <PlayIcon className="h-3 w-3 mr-1" />
                  )}
                  {sessionStatus === "paused" && (
                    <PauseIcon className="h-3 w-3 mr-1" />
                  )}
                  {sessionStatus === "waiting" && (
                    <ClockIcon className="h-3 w-3 mr-1" />
                  )}
                  {sessionStatus === "finished" && (
                    <CheckCircleIcon className="h-3 w-3 mr-1" />
                  )}
                  <span className="capitalize">
                    {sessionStatus === "finished" && "Terminée"}
                  </span>
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-4 ml-4">
              {/* Score et streak du joueur */}
              <div className="text-right">
                <div className="flex items-center justify-end space-x-2">
                  <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                    {playerScore}
                  </div>
                  {streak > 0 && (
                    <div className="flex items-center text-orange-500">
                      <span className="text-sm font-medium">{streak}</span>
                      <span className="ml-1">{getStreakEmoji(streak)}</span>
                    </div>
                  )}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Score {streak > 0 && `• Série ${streak}`}
                </div>
              </div>

              {/* Bouton leaderboard */}
              {session.settings?.showLeaderboard && leaderboard.length > 0 && (
                <button
                  onClick={() => setShowLeaderboard(!showLeaderboard)}
                  className="inline-flex items-center px-3 py-2 bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
                >
                  <TrophyIcon className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Classement</span>
                </button>
              )}
            </div>
          </div>

          {/* Progression et timer */}
          <div className="mt-4">
            {totalQuestions > 0 && (
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Question {currentQuestionNumber} sur {totalQuestions}
                </span>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {Math.round((currentQuestionNumber / totalQuestions) * 100)}%
                  complété
                </div>
              </div>
            )}

            {/* Barre de progression */}
            {totalQuestions > 0 && (
              <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-4">
                <div
                  className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(
                      (currentQuestionNumber / totalQuestions) * 100,
                      100
                    )}%`,
                  }}
                />
              </div>
            )}

            {/* Timer */}
            {timeRemaining !== null && timeRemaining >= 0 && (
              <div className="text-center">
                <div
                  className={`text-4xl font-mono font-bold ${getTimerColor(
                    timeRemaining
                  )} transition-colors duration-300`}
                >
                  {formatTime(timeRemaining)}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Temps restant
                </div>

                {/* Barre de progression du timer */}
                {currentQuestion?.timeLimit && (
                  <div className="max-w-xs mx-auto mt-2 bg-gray-200 dark:bg-gray-700 rounded-full h-1">
                    <div
                      className={`h-1 rounded-full transition-all duration-1000 ${
                        timeRemaining > 10
                          ? "bg-green-500"
                          : timeRemaining > 5
                          ? "bg-yellow-500"
                          : "bg-red-500"
                      }`}
                      style={{
                        width: `${Math.max(
                          (timeRemaining / currentQuestion.timeLimit) * 100,
                          0
                        )}%`,
                      }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {currentQuestion ? (
          /* Question active */
          <div className="space-y-6">
            {/* Question */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4">
                <div className="text-center">
                  <div className="text-white/80 text-sm font-medium mb-1">
                    Question {currentQuestionNumber}
                  </div>
                  <h2 className="text-xl md:text-2xl font-bold text-white leading-tight">
                    {currentQuestion.question}
                  </h2>
                </div>
              </div>

              {/* Image de la question si disponible */}
              {currentQuestion.image && (
                <div className="px-6 pt-4">
                  <img
                    src={currentQuestion.image}
                    alt="Illustration de la question"
                    className="w-full max-w-md mx-auto rounded-lg shadow-sm"
                  />
                </div>
              )}

              {/* Réponses */}
              <div className="p-6 space-y-3">
                {currentQuestion.answers?.map((answer, index) => {
                  const isSelected = selectedAnswer === index;
                  const isCorrect = showCorrectAnswer && answer.isCorrect;
                  const isWrong =
                    showCorrectAnswer && isSelected && !answer.isCorrect;
                  const responseCount =
                    questionResults?.responses?.filter(
                      (r) => r.answer === index
                    ).length || 0;
                  const percentage =
                    questionResults?.totalResponses > 0
                      ? Math.round(
                          (responseCount / questionResults.totalResponses) * 100
                        )
                      : 0;

                  return (
                    <div key={index} className="relative">
                      <button
                        onClick={() => handleSelectAnswer(index)}
                        disabled={isAnswered || showResults || isSubmitting}
                        className={`w-full p-4 text-left border-2 rounded-xl transition-all duration-200 ${
                          isSelected && !showResults
                            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 dark:border-blue-400 transform scale-105 shadow-md"
                            : showResults && isCorrect
                            ? "border-green-500 bg-green-50 dark:bg-green-900/30 dark:border-green-400"
                            : showResults && isWrong
                            ? "border-red-500 bg-red-50 dark:bg-red-900/30 dark:border-red-400"
                            : "border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500"
                        } ${
                          isAnswered || showResults || isSubmitting
                            ? "cursor-not-allowed opacity-75"
                            : "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:shadow-sm"
                        }`}
                      >
                        <div className="flex items-center">
                          <div
                            className={`flex-shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-bold transition-colors ${
                              isSelected && !showResults
                                ? "border-blue-500 bg-blue-500 text-white"
                                : showResults && isCorrect
                                ? "border-green-500 bg-green-500 text-white"
                                : showResults && isWrong
                                ? "border-red-500 bg-red-500 text-white"
                                : "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400"
                            }`}
                          >
                            {getAnswerLetter(index)}
                          </div>

                          <span className="ml-4 text-gray-900 dark:text-white font-medium flex-1">
                            {answer.text}
                          </span>

                          {/* Icônes de statut */}
                          <div className="ml-auto flex items-center space-x-2">
                            {showResults && (
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                {responseCount} ({percentage}%)
                              </div>
                            )}

                            {isSelected && !showResults && (
                              <CheckCircleIcon className="h-5 w-5 text-blue-500" />
                            )}
                            {showResults && isCorrect && (
                              <CheckCircleIcon className="h-5 w-5 text-green-500" />
                            )}
                            {showResults && isWrong && (
                              <XCircleIcon className="h-5 w-5 text-red-500" />
                            )}
                          </div>
                        </div>

                        {/* Barre de progression des résultats */}
                        {showResults && questionResults && (
                          <div className="mt-3">
                            <div className="bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full transition-all duration-700 ${
                                  isCorrect
                                    ? "bg-green-500"
                                    : isSelected
                                    ? "bg-red-500"
                                    : "bg-gray-400 dark:bg-gray-500"
                                }`}
                                style={{
                                  width: `${percentage}%`,
                                  transitionDelay: `${index * 100}ms`,
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Actions */}
              <div className="px-6 pb-6">
                {!isAnswered && !showResults && (
                  <div className="text-center">
                    <button
                      onClick={handleSubmitAnswer}
                      disabled={
                        (selectedAnswer === null && selectedAnswer !== 0) ||
                        isSubmitting
                      }
                      className="inline-flex items-center px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:hover:transform-none"
                    >
                      {isSubmitting ? (
                        <>
                          <LoadingSpinner size="sm" className="mr-2" />
                          Envoi en cours...
                        </>
                      ) : (
                        <>
                          Confirmer ma réponse
                          <ArrowRightIcon className="ml-2 h-5 w-5" />
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Message si répondu */}
                {isAnswered && !showResults && (
                  <div className="text-center">
                    <div className="inline-flex items-center px-6 py-3 bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200 rounded-xl border border-green-200 dark:border-green-800">
                      <CheckCircleIcon className="h-5 w-5 mr-2" />
                      <span className="font-medium">Réponse enregistrée !</span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                      En attente des autres participants...
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Informations supplémentaires pendant les résultats */}
            {showResults && questionResults && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                  <ChartBarIcon className="h-5 w-5 mr-2" />
                  Résultats de la question
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {questionResults.totalResponses}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Participants
                    </div>
                  </div>

                  <div className="text-center p-4 bg-green-50 dark:bg-green-900/30 rounded-lg">
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {questionResults.stats?.correctAnswers || 0}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Bonnes réponses
                    </div>
                  </div>

                  <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                      {questionResults.stats?.responseRate || 0}%
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Taux de réponse
                    </div>
                  </div>
                </div>

                {/* Explication si disponible */}
                {currentQuestion.explanation && (
                  <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                    <h4 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2 flex items-center">
                      <AcademicCapIcon className="h-4 w-4 mr-2" />
                      Explication
                    </h4>
                    <p className="text-yellow-700 dark:text-yellow-300 text-sm leading-relaxed">
                      {currentQuestion.explanation}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* État d'attente */
          <div className="text-center py-16">
            <div
              className={`mx-auto w-20 h-20 rounded-full flex items-center justify-center mb-6 ${
                sessionStatus === "waiting"
                  ? "bg-blue-100 dark:bg-blue-900"
                  : sessionStatus === "paused"
                  ? "bg-orange-100 dark:bg-orange-900"
                  : sessionStatus === "finished"
                  ? "bg-green-100 dark:bg-green-900"
                  : "bg-gray-100 dark:bg-gray-800"
              }`}
            >
              {sessionStatus === "waiting" && (
                <ClockIcon className="h-10 w-10 text-blue-600 dark:text-blue-400" />
              )}
              {sessionStatus === "paused" && (
                <PauseIcon className="h-10 w-10 text-orange-600 dark:text-orange-400" />
              )}
              {sessionStatus === "finished" && (
                <CheckCircleIcon className="h-10 w-10 text-green-600 dark:text-green-400" />
              )}
              {!["waiting", "paused", "finished"].includes(sessionStatus) && (
                <QuestionMarkCircleIcon className="h-10 w-10 text-gray-600 dark:text-gray-400" />
              )}
            </div>

            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
              {sessionStatus === "waiting" && "En attente du démarrage"}
              {sessionStatus === "paused" && "Session en pause"}
              {sessionStatus === "finished" && "Session terminée"}
              {!["waiting", "paused", "finished"].includes(sessionStatus) &&
                waitingMessage}
            </h3>

            <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto">
              {sessionStatus === "waiting" &&
                "L'animateur va bientôt démarrer la session. Restez connecté !"}
              {sessionStatus === "paused" &&
                "L'animateur a mis la session en pause temporairement."}
              {sessionStatus === "finished" &&
                "Merci d'avoir participé ! Consultez vos résultats ci-dessous."}
              {!["waiting", "paused", "finished"].includes(sessionStatus) &&
                "Veuillez patienter..."}
            </p>

            {/* Animations d'attente */}
            {sessionStatus === "waiting" && (
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md mx-auto shadow-lg">
                <div className="flex items-center justify-center space-x-2 text-blue-600 dark:text-blue-400 mb-4">
                  <LoadingSpinner size="sm" />
                  <span className="font-medium">Préparation en cours...</span>
                </div>

                <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
                  <div className="flex items-center justify-between">
                    <span>Participants connectés</span>
                    <span className="font-medium">
                      {session.participantCount || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Questions préparées</span>
                    <span className="font-medium">{totalQuestions}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Boutons d'action selon le statut */}
            {sessionStatus === "finished" && (
              <div className="space-y-4">
                <button
                  onClick={() => navigate(`/session/${sessionId}/results`)}
                  className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-lg"
                >
                  <TrophyIcon className="h-5 w-5 mr-2" />
                  Voir les résultats détaillés
                </button>
              </div>
            )}
          </div>
        )}

        {/* Leaderboard modal */}
        {showLeaderboard && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 w-full max-w-md max-h-[80vh] overflow-hidden">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
                  <TrophyIcon className="h-6 w-6 mr-2 text-yellow-500" />
                  Classement
                </h3>
                <button
                  onClick={() => setShowLeaderboard(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <XCircleIcon className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {leaderboard.slice(0, 20).map((participant, index) => {
                  const isMe =
                    participant.id === participantInfo?.id ||
                    participant.name === (user?.firstName || user?.username);

                  return (
                    <div
                      key={participant.id || index}
                      className={`flex items-center justify-between p-3 rounded-xl transition-all ${
                        isMe
                          ? "bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/30 border-2 border-blue-200 dark:border-blue-700 shadow-sm"
                          : "bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700"
                      }`}
                    >
                      <div className="flex items-center">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-sm ${
                            index === 0
                              ? "bg-gradient-to-br from-yellow-400 to-yellow-600"
                              : index === 1
                              ? "bg-gradient-to-br from-gray-400 to-gray-600"
                              : index === 2
                              ? "bg-gradient-to-br from-orange-400 to-orange-600"
                              : "bg-gradient-to-br from-gray-500 to-gray-700"
                          }`}
                        >
                          {index < 3 ? (
                            <span className="text-lg">
                              {index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"}
                            </span>
                          ) : (
                            index + 1
                          )}
                        </div>

                        <div className="ml-3">
                          <div className="flex items-center">
                            <span
                              className={`font-semibold ${
                                isMe
                                  ? "text-blue-900 dark:text-blue-100"
                                  : "text-gray-900 dark:text-white"
                              }`}
                            >
                              {participant.name}
                            </span>
                            {isMe && (
                              <span className="text-xs text-blue-600 dark:text-blue-400 ml-2 font-medium">
                                (Vous)
                              </span>
                            )}
                          </div>
                          {participant.streak > 0 && (
                            <div className="flex items-center text-xs text-orange-600 dark:text-orange-400">
                              <span>Série {participant.streak}</span>
                              <span className="ml-1">
                                {getStreakEmoji(participant.streak)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="text-right">
                        <div
                          className={`text-lg font-bold ${
                            isMe
                              ? "text-blue-900 dark:text-blue-100"
                              : "text-gray-900 dark:text-white"
                          }`}
                        >
                          {participant.score || 0}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          points
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {leaderboard.length === 0 && (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <TrophyIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Aucune donnée de classement pour le moment</p>
                </div>
              )}

              {leaderboard.length > 20 && (
                <div className="text-center mt-4 text-sm text-gray-500 dark:text-gray-400">
                  Affichage des 20 premiers participants
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SessionPlay;
