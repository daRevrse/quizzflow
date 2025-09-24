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
  UserIcon,
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

  const [showFinalResults, setShowFinalResults] = useState(false);
  const [finalResults, setFinalResults] = useState(null);

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
          toast("Cette session est terminée", {
            icon: "ℹ️",
            style: {
              background: "#3B82F6",
              color: "white",
            },
          });
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
        console.warn("⚠️ Participant non trouvé dans la session");
        if (
          sessionData.status === "waiting" ||
          (sessionData.status === "active" &&
            sessionData.settings?.allowLateJoin)
        ) {
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
        console.log("🎃🎃question", question);
        setCurrentQuestion(question);
        setShowResults(false);
        setShowCorrectAnswer(false);

        // Réinitialiser l'état de la question
        let hasAnswered = false;
        let myAnswer = null;

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
        setCurrentQuestion(null);
        setTimeRemaining(null);
        setShowResults(false);
        setIsAnswered(false);
        setSelectedAnswer(null);

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
      console.error("⛔ Erreur lors du chargement:", error);

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

  const fetchFinalResults = async () => {
    try {
      if (!participantInfo?.id || !sessionId) {
        console.warn(
          "Informations manquantes pour récupérer les résultats finaux"
        );
        return;
      }

      console.log("🔍 Récupération résultats finaux:", {
        sessionId,
        participantId: participantInfo.id,
      });

      // CORRECTION: Utiliser l'API session générale au lieu d'un endpoint spécifique
      const response = await sessionService.getSession(sessionId);

      if (response?.session) {
        const session = response.session;

        // Trouver les données du participant
        const participant = session.participants?.find(
          (p) => p.id === participantInfo.id || p.name === participantInfo.name
        );

        if (participant) {
          // Calculer les statistiques du participant
          const responses = session.responses || {};
          const participantResponses = [];
          let correctAnswers = 0;
          let totalTimeSpent = 0;

          // Analyser toutes les réponses du participant
          Object.keys(responses).forEach((questionId) => {
            const questionResponses = responses[questionId] || [];
            const participantResponse = questionResponses.find(
              (r) => r.participantId === participant.id
            );

            if (participantResponse) {
              participantResponses.push(participantResponse);
              if (participantResponse.isCorrect) correctAnswers++;
              totalTimeSpent += participantResponse.timeSpent || 0;
            }
          });

          const totalQuestions = session.quiz?.questions?.length || 0;
          const accuracyRate =
            totalQuestions > 0
              ? Math.round((correctAnswers / totalQuestions) * 100)
              : 0;

          // Calculer le rang
          const participants = session.participants || [];
          const sortedParticipants = participants
            .filter((p) => typeof p.score === "number")
            .sort((a, b) => (b.score || 0) - (a.score || 0));

          const rank =
            sortedParticipants.findIndex((p) => p.id === participant.id) + 1;

          const finalResultsData = {
            participant: {
              id: participant.id,
              name: participant.name,
              score: participant.score || 0,
              correctAnswers,
              totalQuestions,
              accuracyRate,
              totalTimeSpent,
              averageTimePerQuestion:
                participantResponses.length > 0
                  ? Math.round(totalTimeSpent / participantResponses.length)
                  : 0,
              responses: participantResponses,
            },
            rank: rank > 0 ? rank : null,
            session: {
              id: session.id,
              code: session.code,
              title: session.title,
              quiz: session.quiz,
            },
          };

          console.log("✅ Résultats finaux calculés:", finalResultsData);

          setFinalResults(finalResultsData);
          setShowFinalResults(true);
        } else {
          console.warn("Participant non trouvé dans la session");
          toast.error("Impossible de récupérer vos résultats");
        }
      } else {
        throw new Error("Session non trouvée");
      }
    } catch (error) {
      console.error("Erreur récupération résultats finaux:", error);

      // Fallback : créer des résultats basiques
      if (participantInfo && session) {
        const fallbackResults = {
          participant: {
            id: participantInfo.id,
            name: participantInfo.name,
            score: playerScore,
            correctAnswers: 0,
            totalQuestions: totalQuestions,
            accuracyRate: 0,
            totalTimeSpent: 0,
            averageTimePerQuestion: 0,
            responses: [],
          },
          rank: null,
          session: {
            id: session.id,
            code: session.code,
            title: session.title,
            quiz: session.quiz,
          },
        };

        setFinalResults(fallbackResults);
        setShowFinalResults(true);

        toast.warn(
          "Résultats partiels - certaines données ne sont pas disponibles"
        );
      } else {
        toast.error("Impossible de récupérer les résultats");
      }
    }
  };

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
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

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

    // Gestionnaires d'événements Session
    const handleSessionStarted = (data) => {
      if (!isSocketMounted || !componentMountedRef.current) return;
      console.log("🚀 Session démarrée:", data);
      setSessionStatus("active");
      setWaitingMessage("");
      toast.success("La session a commencé !");
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
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      toast.success("Session mise en pause");
    };

    const handleSessionResumed = (data) => {
      if (!isSocketMounted || !componentMountedRef.current) return;
      console.log("▶️ Session reprise:", data);
      setSessionStatus("active");
      setWaitingMessage("");
      toast.success("Session reprise !");
      setTimeout(() => {
        if (componentMountedRef.current) {
          loadSession();
        }
      }, 500);
    };

    const handleSessionEnded = (data) => {
      console.log("📋 Session terminée:", data);
      setSessionStatus("finished");
      toast.success("Session terminée ! Merci d'avoir participé 🎉");
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setCurrentQuestion(null);
      setShowResults(false);
      setShowCorrectAnswer(false);
      setTimeout(() => {
        fetchFinalResults();
      }, 2000);
    };

    const handleNextQuestion = (data) => {
      if (!isSocketMounted || !componentMountedRef.current) return;
      console.log("➡️ Nouvelle question reçue:", data);
      setCurrentQuestion(data.question);
      setSelectedAnswer(null);
      setIsAnswered(false);
      setShowResults(false);
      setShowCorrectAnswer(false);
      setQuestionResults(null);
      setIsSubmitting(false);
      setCurrentQuestionNumber((data.questionIndex || 0) + 1);
      setSession((prevSession) => ({
        ...prevSession,
        currentQuestionIndex: data.questionIndex,
        currentQuestionStartedAt: data.startedAt || new Date().toISOString(),
      }));
      if (data.question.timeLimit) {
        setTimeRemaining(data.question.timeLimit);
        console.log(`⏰ Timer démarré: ${data.question.timeLimit}s`);
      } else {
        setTimeRemaining(null);
      }
      if (data.autoAdvanced) {
        toast.success(
          `⏰ Temps écoulé ! Question ${(data.questionIndex || 0) + 1}`,
          {
            icon: "➡️",
            duration: 3000,
            style: { background: "#F59E0B", color: "white" },
          }
        );
      } else {
        toast.success(`Question ${(data.questionIndex || 0) + 1} !`, {
          icon: "❓",
          duration: 2000,
        });
      }
    };

    const handleQuestionResults = (data) => {
      if (!isSocketMounted || !componentMountedRef.current) return;
      console.log("📊 Résultats question:", data);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setTimeRemaining(null);
      setShowResults(true);
      setShowCorrectAnswer(true);
      setQuestionResults(data.results);
      const myResponse = data.results?.responses?.find(
        (r) => r.participantId === participantInfo.id
      );
      if (myResponse && myResponse.isCorrect) {
        toast.success("Bonne réponse ! 🎉", {
          duration: 3000,
          style: { background: "#10B981", color: "white" },
        });
        setStreak((prev) => prev + 1);
      } else if (myResponse && !myResponse.isCorrect) {
        toast.error("Dommage ! 😔", {
          duration: 2000,
          style: { background: "#EF4444", color: "white" },
        });
        setStreak(0);
      }
    };

    const handleLeaderboardUpdate = (data) => {
      if (!isSocketMounted || !componentMountedRef.current) return;
      console.log("🏆 Mise à jour leaderboard:", data);
      setLeaderboard(data.leaderboard || []);
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
      console.error("⛔ Erreur réponse:", data);
      setIsSubmitting(false);
      toast.error(data.message || "Erreur lors de l'envoi de votre réponse", {
        duration: 3000,
      });
    };

    const handleError = (data) => {
      if (!isSocketMounted || !componentMountedRef.current) return;
      console.error("⛔ Erreur socket:", data);
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
      hasJoinedSessionRef.current = false;
    };

    // Écouter les événements
    socket.on("session_started", handleSessionStarted);
    socket.on("session_paused", handleSessionPaused);
    socket.on("session_resumed", handleSessionResumed);
    socket.on("session_ended", handleSessionEnded);
    socket.on("next_question", handleNextQuestion);
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
      socket.off("next_question", handleNextQuestion);
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
    playerScore,
    currentQuestion?.timeLimit,
    fetchFinalResults,
    isAnswered,
    session,
    showResults,
  ]);

  const extractAnswerText = (answer) => {
    // Cas 1: answer est une chaîne directe
    if (typeof answer === "string") {
      return answer;
    }

    // Cas 2: answer est null/undefined
    if (!answer) {
      return "";
    }

    // Cas 3: answer est un objet
    if (typeof answer === "object") {
      // Priorité : text > label > value > name
      if (answer.text) {
        return String(answer.text);
      }
      if (answer.label) {
        return String(answer.label);
      }
      if (answer.value) {
        return String(answer.value);
      }
      if (answer.name) {
        return String(answer.name);
      }

      // Si c'est un objet avec juste isCorrect, c'est probablement un problème de structure
      if (
        typeof answer.isCorrect !== "undefined" &&
        Object.keys(answer).length === 1
      ) {
        console.warn("Option sans texte détectée:", answer);
        return `Option ${Math.random().toString(36).substr(2, 5)}`; // Texte de fallback
      }
    }

    // Dernier recours : conversion en string
    return String(answer);
  };

  // === Fonctions d'interaction ===

  // Soumettre une réponse
  const handleSubmitAnswer = useCallback(() => {
    console.log("🔥 handleSubmitAnswer appelé", {
      selectedAnswer,
      isAnswered,
      isSubmitting,
      currentQuestion: currentQuestion?.question,
      participantInfo: participantInfo?.id,
      session: session?.currentQuestionIndex,
    });

    // Vérifications de base
    if (selectedAnswer === null || selectedAnswer === undefined) {
      toast.error("Veuillez sélectionner une réponse");
      return;
    }

    if (isAnswered || isSubmitting || !currentQuestion || !participantInfo) {
      console.log("⛔ Conditions non remplies:", {
        isAnswered,
        isSubmitting,
        hasCurrentQuestion: !!currentQuestion,
        hasParticipantInfo: !!participantInfo,
      });
      return;
    }

    if (!socket || !isConnected) {
      console.warn("⚠️ Socket non connecté");
      toast.error("Problème de connexion. Vérifiez votre réseau.");
      return;
    }

    // Générer questionId basé sur l'index de la session
    let questionId;
    if (session?.currentQuestionIndex !== undefined) {
      questionId = `q_${session.currentQuestionIndex}`;
    } else if (currentQuestion?.id) {
      questionId = currentQuestion.id;
    } else {
      const questionNumber = currentQuestionNumber - 1;
      questionId = `q_${questionNumber}`;
    }

    const response = {
      questionId,
      sessionId,
      participantId: participantInfo.id,
      answer: selectedAnswer,
      submittedAt: new Date().toISOString(),
      timeSpent:
        currentQuestion.timeLimit && timeRemaining !== null
          ? currentQuestion.timeLimit - timeRemaining
          : null,
    };

    console.log("📤 Envoi réponse avec questionId corrigé:", response);

    if (!questionId) {
      console.error("⛔ ERREUR CRITIQUE: questionId non généré!");
      toast.error("Erreur: Question non identifiée");
      return;
    }

    setIsSubmitting(true);
    socket.emit("submit_response", response);

    // Gérer la confirmation
    const handleResponseConfirmation = (data) => {
      console.log("📨 Confirmation reçue:", data);
      if (data.questionId === questionId) {
        setIsAnswered(true);
        setIsSubmitting(false);
        if (data.success !== false) {
          const message = `Réponse enregistrée ! ${
            data.isCorrect ? "✅ Correct" : "⛔ Incorrect"
          } (${data.points || 0} pts)`;
          toast.success(message, { duration: 3000 });
        }
        socket.off("response_submitted", handleResponseConfirmation);
      }
    };

    // Gérer les erreurs
    const handleResponseError = (error) => {
      console.error("⛔ Erreur soumission:", error);
      setIsSubmitting(false);
      let errorMessage = "Erreur lors de l'envoi";
      switch (error.code) {
        case "INVALID_DATA":
          errorMessage = `Données invalides: ${
            error.field || "données manquantes"
          }`;
          break;
        case "ALREADY_ANSWERED":
          errorMessage = "Vous avez déjà répondu à cette question.";
          setIsAnswered(true);
          break;
        case "SESSION_NOT_ACTIVE":
          errorMessage = "La session n'est plus active.";
          break;
        case "QUESTION_NOT_FOUND":
        case "NO_ACTIVE_QUESTION":
        case "INVALID_QUESTION_INDEX":
          errorMessage = "Question introuvable ou invalide.";
          break;
        case "QUESTION_MISMATCH":
          errorMessage = "Question incorrecte. Actualisez la page.";
          break;
        default:
          errorMessage = error.message || "Erreur inconnue";
      }
      toast.error(errorMessage);
      socket.off("error", handleResponseError);
    };

    // Listeners
    socket.on("response_submitted", handleResponseConfirmation);
    socket.on("error", handleResponseError);

    // Timeout de sécurité
    const timeoutId = setTimeout(() => {
      if (isSubmitting && componentMountedRef.current) {
        console.warn("⏰ Timeout - aucune réponse du serveur");
        setIsSubmitting(false);
        toast.error("Délai d'attente dépassé. Veuillez réessayer.");
        socket.off("response_submitted", handleResponseConfirmation);
        socket.off("error", handleResponseError);
      }
    }, 8000);

    socket.once("response_submitted", () => clearTimeout(timeoutId));
    socket.once("error", () => clearTimeout(timeoutId));
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
    session?.currentQuestionIndex,
    currentQuestionNumber,
  ]);

  // Temps écoulé
  const handleTimeUp = useCallback(() => {
    if (isAnswered || showResults) return;
    console.log("⏰ Temps écoulé pour la question");
    toast("⏰ Temps écoulé !", {
      icon: "⚠️",
      style: { background: "#F59E0B", color: "white" },
      duration: 3000,
    });
    if (
      selectedAnswer !== null &&
      selectedAnswer !== undefined &&
      !isSubmitting
    ) {
      handleSubmitAnswer();
    } else {
      setIsAnswered(true);
      toast.error("Aucune réponse sélectionnée", { duration: 2000 });
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
      console.log("🎯 Sélection réponse:", answerIndex);
      if (isAnswered || showResults || isSubmitting) {
        console.log("⛔ Sélection bloquée");
        return;
      }
      setSelectedAnswer(answerIndex);
      console.log("📝 Réponse sélectionnée:", answerIndex);
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
      toast(`Réponse ${String.fromCharCode(65 + answerIndex)} sélectionnée`, {
        icon: "👆",
        duration: 1000,
        style: { background: "#3B82F6", color: "white" },
      });
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

  const getAnswerLetter = (index) => {
    return String.fromCharCode(65 + index); // A, B, C, D...
  };

  const getStreakEmoji = (streakCount) => {
    if (streakCount >= 5) return "🔥";
    if (streakCount >= 3) return "⚡";
    if (streakCount >= 1) return "✨";
    return "";
  };

  const getWaitingMessage = () => {
    if (!session) return "Chargement...";
    switch (session.status) {
      case "waiting":
        return "En attente du démarrage de la session...";
      case "paused":
        return "Session mise en pause par l'animateur...";
      case "active":
        if (isAnswered && !showResults) {
          return currentQuestion?.timeLimit
            ? "En attente de la fin du chrono..."
            : "En attente de l'animateur...";
        }
        return "Question en cours...";
      case "finished":
        return "Session terminée !";
      default:
        return "En attente...";
    }
  };

  const formatTime = (seconds) => {
    if (seconds === null || seconds === undefined) return "--";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
      return `${mins}:${secs.toString().padStart(2, "0")}`;
    }
    return secs.toString();
  };

  // === Rendus conditionnels ===

  const FinalResults = ({ results, onClose, onViewDetails }) => {
    const { participant, rank } = results;
    const performance = participant.accuracyRate;
    let performanceLevel = "Peut mieux faire";
    let performanceColor = "text-red-600";
    let bgColor = "bg-red-50";

    if (performance >= 80) {
      performanceLevel = "Excellent !";
      performanceColor = "text-green-600";
      bgColor = "bg-green-50";
    } else if (performance >= 60) {
      performanceLevel = "Bien joué !";
      performanceColor = "text-blue-600";
      bgColor = "bg-blue-50";
    } else if (performance >= 40) {
      performanceLevel = "Pas mal !";
      performanceColor = "text-yellow-600";
      bgColor = "bg-yellow-50";
    }

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6">
          {/* Confettis animation */}
          <div className="text-center mb-6">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className={`text-2xl font-bold ${performanceColor} mb-2`}>
              {performanceLevel}
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Quiz terminé avec succès !
            </p>
          </div>

          {/* Stats principales */}
          <div className={`${bgColor} dark:bg-gray-700 rounded-lg p-4 mb-6`}>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary-600">
                  {participant.score}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Points
                </div>
              </div>

              <div className="text-center">
                <div className={`text-2xl font-bold ${performanceColor}`}>
                  {participant.accuracyRate}%
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Précision
                </div>
              </div>
            </div>
          </div>

          {/* Détails */}
          <div className="space-y-3 mb-6">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Réponses correctes
              </span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {participant.correctAnswers}/{participant.totalQuestions}
              </span>
            </div>

            {rank && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Classement
                </span>
                <span className="text-sm font-medium text-yellow-600">
                  #{rank}
                </span>
              </div>
            )}

            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Temps total
              </span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {Math.round(participant.totalTimeSpent / 60)}min{" "}
                {participant.totalTimeSpent % 60}s
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col space-y-3">
            <button
              onClick={onViewDetails}
              className="w-full bg-primary-600 hover:bg-primary-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
            >
              Voir les détails
            </button>

            <button
              onClick={onClose}
              className="w-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium py-3 px-4 rounded-lg transition-colors"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Gestion de l'affichage des résultats finaux
  if (showFinalResults && finalResults) {
    return (
      <>
        {/* Interface normale en arrière-plan */}
        <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 dark:from-gray-900 dark:to-gray-800">
          {/* Header simplifié */}
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between h-16">
                <div>
                  <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                    Quiz terminé
                  </h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Session {session?.code}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-primary-600">
                    {finalResults.participant.score} pts
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {finalResults.participant.correctAnswers}/
                    {finalResults.participant.totalQuestions} correct
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="text-center">
              <CheckCircleIcon className="mx-auto h-16 w-16 text-green-500 mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                Merci d'avoir participé !
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-8">
                Vos résultats détaillés sont maintenant disponibles.
              </p>

              <div className="flex justify-center space-x-4">
                <button
                  onClick={() =>
                    navigate(
                      `/session/${sessionId}/participant/${participantInfo.id}/results`
                    )
                  }
                  className="bg-primary-600 hover:bg-primary-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  Voir mes résultats détaillés
                </button>
                <button
                  onClick={() => navigate("/dashboard")}
                  className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  Retour au tableau de bord
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Modal des résultats */}
        <FinalResults
          results={finalResults}
          onClose={() => setShowFinalResults(false)}
          onViewDetails={() =>
            navigate(
              `/session/${sessionId}/participant/${participantInfo.id}/results`
            )
          }
        />
      </>
    );
  }

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
              {/* CORRECTION: Gestion complète des différents types de questions */}
              <div className="p-6 space-y-3">
                {(() => {
                  console.log("🔍 Debug question courante:", {
                    type: currentQuestion.type,
                    options: currentQuestion.options,
                    answers: currentQuestion.answers,
                    correctAnswer: currentQuestion.correctAnswer,
                  });

                  // NOUVEAU: Questions à réponse libre
                  if (currentQuestion.type === "reponse_libre") {
                    return (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                            Votre réponse :
                          </label>
                          <textarea
                            value={selectedAnswer || ""}
                            onChange={(e) => {
                              if (
                                !isAnswered &&
                                !showResults &&
                                !isSubmitting
                              ) {
                                setSelectedAnswer(e.target.value);
                              }
                            }}
                            placeholder="Saisissez votre réponse ici..."
                            disabled={isAnswered || showResults || isSubmitting}
                            className={`w-full p-4 border-2 rounded-xl transition-all duration-200 resize-none ${
                              isAnswered || showResults || isSubmitting
                                ? "bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 cursor-not-allowed"
                                : "border-gray-300 dark:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800"
                            } text-gray-900 dark:text-white dark:bg-gray-800`}
                            rows={4}
                            maxLength={500}
                          />
                          <div className="flex justify-between items-center mt-2">
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {selectedAnswer ? selectedAnswer.length : 0}/500
                              caractères
                            </div>
                            {selectedAnswer &&
                              selectedAnswer.length > 0 &&
                              !isAnswered &&
                              !showResults && (
                                <div className="text-xs text-green-600 dark:text-green-400 flex items-center">
                                  <CheckCircleIcon className="h-3 w-3 mr-1" />
                                  Prêt à envoyer
                                </div>
                              )}
                          </div>
                        </div>

                        {/* Affichage de la réponse correcte après soumission */}
                        {showResults &&
                          showCorrectAnswer &&
                          currentQuestion.correctAnswer && (
                            <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg">
                              <h4 className="font-medium text-green-800 dark:text-green-200 mb-2 flex items-center">
                                <CheckCircleIcon className="h-4 w-4 mr-2" />
                                Réponse correcte :
                              </h4>
                              <p className="text-green-700 dark:text-green-300 font-medium">
                                {currentQuestion.correctAnswer}
                              </p>
                            </div>
                          )}

                        {/* Affichage de la réponse de l'utilisateur après soumission */}
                        {showResults && isAnswered && selectedAnswer && (
                          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                            <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2 flex items-center">
                              <UserIcon className="h-4 w-4 mr-2" />
                              Votre réponse :
                            </h4>
                            <p className="text-blue-700 dark:text-blue-300">
                              {selectedAnswer}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  }

                  // Questions vrai/faux (existant, mais amélioré)
                  if (currentQuestion.type === "vrai_faux") {
                    // Si la question vrai/faux utilise correctAnswer au lieu d'options
                    if (
                      (!currentQuestion.options ||
                        currentQuestion.options.length === 0) &&
                      currentQuestion.correctAnswer !== undefined
                    ) {
                      console.log(
                        "🔧 Génération automatique des options vrai/faux"
                      );

                      const vraiOptions = [
                        {
                          text: "Vrai",
                          isCorrect:
                            currentQuestion.correctAnswer === "true" ||
                            currentQuestion.correctAnswer === true ||
                            currentQuestion.correctAnswer === 0,
                        },
                        {
                          text: "Faux",
                          isCorrect:
                            currentQuestion.correctAnswer === "false" ||
                            currentQuestion.correctAnswer === false ||
                            currentQuestion.correctAnswer === 1,
                        },
                      ];

                      return vraiOptions.map((answer, index) => {
                        const isCorrectAnswer = answer.isCorrect;
                        const isSelected = selectedAnswer === index;
                        const isCorrect = showCorrectAnswer && isCorrectAnswer;
                        const isWrong =
                          showCorrectAnswer && isSelected && !isCorrectAnswer;

                        const responseCount =
                          questionResults?.responses?.filter(
                            (r) => r.answer === index
                          ).length || 0;
                        const percentage =
                          questionResults?.totalResponses > 0
                            ? Math.round(
                                (responseCount /
                                  questionResults.totalResponses) *
                                  100
                              )
                            : 0;

                        return (
                          <div key={index} className="relative">
                            <button
                              onClick={() => handleSelectAnswer(index)}
                              disabled={
                                isAnswered || showResults || isSubmitting
                              }
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
                                  {String.fromCharCode(65 + index)}
                                </div>

                                <div className="flex-1 ml-4">
                                  <div
                                    className={`font-medium transition-colors ${
                                      showResults && isCorrect
                                        ? "text-green-800 dark:text-green-200"
                                        : showResults && isWrong
                                        ? "text-red-800 dark:text-red-200"
                                        : "text-gray-900 dark:text-white"
                                    }`}
                                  >
                                    {answer.text}
                                  </div>

                                  {showResults && questionResults && (
                                    <div
                                      className={`text-sm mt-1 ${
                                        isCorrect
                                          ? "text-green-600 dark:text-green-300"
                                          : isWrong
                                          ? "text-red-600 dark:text-red-300"
                                          : "text-gray-500 dark:text-gray-400"
                                      }`}
                                    >
                                      {percentage}% ({responseCount} participant
                                      {responseCount !== 1 ? "s" : ""})
                                    </div>
                                  )}
                                </div>

                                {showResults && (isCorrect || isWrong) && (
                                  <div className="ml-2">
                                    {isCorrect ? (
                                      <CheckCircleIcon className="h-5 w-5 text-green-500" />
                                    ) : (
                                      <XCircleIcon className="h-5 w-5 text-red-500" />
                                    )}
                                  </div>
                                )}
                              </div>
                            </button>

                            {showResults && questionResults && (
                              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200 dark:bg-gray-700 rounded-b-xl overflow-hidden">
                                <div
                                  className={`h-full transition-all duration-1000 ${
                                    isCorrect
                                      ? "bg-green-500"
                                      : "bg-gray-400 dark:bg-gray-500"
                                  }`}
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                            )}
                          </div>
                        );
                      });
                    }
                  }

                  // NOUVEAU: Questions nuage de mots
                  if (currentQuestion.type === "nuage_mots") {
                    return (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                            Votre réponse (mots-clés séparés par des virgules) :
                          </label>
                          <input
                            type="text"
                            value={selectedAnswer || ""}
                            onChange={(e) => {
                              if (
                                !isAnswered &&
                                !showResults &&
                                !isSubmitting
                              ) {
                                setSelectedAnswer(e.target.value);
                              }
                            }}
                            placeholder="mot1, mot2, mot3..."
                            disabled={isAnswered || showResults || isSubmitting}
                            className={`w-full p-4 border-2 rounded-xl transition-all duration-200 ${
                              isAnswered || showResults || isSubmitting
                                ? "bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 cursor-not-allowed"
                                : "border-gray-300 dark:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800"
                            } text-gray-900 dark:text-white dark:bg-gray-800`}
                          />
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                            Séparez vos mots-clés par des virgules
                          </div>
                        </div>

                        {/* Affichage des mots-clés collectés après soumission */}
                        {showResults && questionResults?.wordCloud && (
                          <div className="mt-4 p-4 bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800 rounded-lg">
                            <h4 className="font-medium text-purple-800 dark:text-purple-200 mb-3">
                              Nuage de mots des participants :
                            </h4>
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(questionResults.wordCloud).map(
                                ([word, count]) => (
                                  <span
                                    key={word}
                                    className="px-3 py-1 bg-purple-200 dark:bg-purple-800 text-purple-800 dark:text-purple-200 rounded-full text-sm font-medium"
                                    style={{
                                      fontSize:
                                        Math.max(
                                          12,
                                          Math.min(20, 12 + count * 2)
                                        ) + "px",
                                    }}
                                  >
                                    {word} ({count})
                                  </span>
                                )
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  }

                  // Questions QCM (traitement existant amélioré)
                  const answers =
                    currentQuestion.answers || currentQuestion.options || [];

                  console.log("🔍 Traitement des réponses:", answers);

                  return answers.map((answer, index) => {
                    // Utiliser la fonction d'extraction robuste du texte
                    const answerText = extractAnswerText(answer);

                    console.log(`Option ${index}:`, {
                      original: answer,
                      extracted: answerText,
                      type: typeof answer,
                    });

                    // Déterminer si c'est la bonne réponse
                    let isCorrectAnswer = false;

                    // Méthode 1: Via l'index correctAnswer
                    if (typeof currentQuestion.correctAnswer === "number") {
                      isCorrectAnswer = currentQuestion.correctAnswer === index;
                    }
                    // Méthode 2: Via la propriété isCorrect de l'option
                    else if (
                      answer &&
                      typeof answer === "object" &&
                      "isCorrect" in answer
                    ) {
                      isCorrectAnswer = answer.isCorrect;
                    }
                    // Méthode 3: Comparaison de texte (pour les cas edge)
                    else if (
                      typeof currentQuestion.correctAnswer === "string"
                    ) {
                      isCorrectAnswer =
                        answerText.toLowerCase().trim() ===
                        currentQuestion.correctAnswer.toLowerCase().trim();
                    }

                    const isSelected = selectedAnswer === index;
                    const isCorrect = showCorrectAnswer && isCorrectAnswer;
                    const isWrong =
                      showCorrectAnswer && isSelected && !isCorrectAnswer;

                    const responseCount =
                      questionResults?.responses?.filter(
                        (r) => r.answer === index
                      ).length || 0;
                    const percentage =
                      questionResults?.totalResponses > 0
                        ? Math.round(
                            (responseCount / questionResults.totalResponses) *
                              100
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
                              {String.fromCharCode(65 + index)}
                            </div>

                            <div className="flex-1 ml-4">
                              <div
                                className={`font-medium transition-colors ${
                                  showResults && isCorrect
                                    ? "text-green-800 dark:text-green-200"
                                    : showResults && isWrong
                                    ? "text-red-800 dark:text-red-200"
                                    : "text-gray-900 dark:text-white"
                                }`}
                              >
                                {answerText || `Option ${index + 1}`}
                              </div>

                              {showResults && questionResults && (
                                <div
                                  className={`text-sm mt-1 ${
                                    isCorrect
                                      ? "text-green-600 dark:text-green-300"
                                      : isWrong
                                      ? "text-red-600 dark:text-red-300"
                                      : "text-gray-500 dark:text-gray-400"
                                  }`}
                                >
                                  {percentage}% ({responseCount} participant
                                  {responseCount !== 1 ? "s" : ""})
                                </div>
                              )}
                            </div>

                            {showResults && (isCorrect || isWrong) && (
                              <div className="ml-2">
                                {isCorrect ? (
                                  <CheckCircleIcon className="h-5 w-5 text-green-500" />
                                ) : (
                                  <XCircleIcon className="h-5 w-5 text-red-500" />
                                )}
                              </div>
                            )}
                          </div>
                        </button>

                        {showResults && questionResults && (
                          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200 dark:bg-gray-700 rounded-b-xl overflow-hidden">
                            <div
                              className={`h-full transition-all duration-1000 ${
                                isCorrect
                                  ? "bg-green-500"
                                  : "bg-gray-400 dark:bg-gray-500"
                              }`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
              // CORRECTION: Mise à jour du bouton de soumission pour gérer les
              réponses libres
              {/* Actions */}
              <div className="px-6 pb-6">
                {!isAnswered && !showResults && (
                  <div className="text-center">
                    <button
                      onClick={handleSubmitAnswer}
                      disabled={
                        currentQuestion.type === "reponse_libre" ||
                        currentQuestion.type === "nuage_mots"
                          ? !selectedAnswer ||
                            selectedAnswer.trim() === "" ||
                            isSubmitting
                          : selectedAnswer === null ||
                            selectedAnswer === undefined ||
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

                    {/* Message d'aide selon le type de question */}
                    {currentQuestion.type === "reponse_libre" &&
                      !selectedAnswer?.trim() && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                          Saisissez votre réponse dans le champ ci-dessus
                        </p>
                      )}
                    {currentQuestion.type === "nuage_mots" &&
                      !selectedAnswer?.trim() && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                          Entrez vos mots-clés séparés par des virgules
                        </p>
                      )}
                    {(currentQuestion.type === "qcm" ||
                      currentQuestion.type === "vrai_faux") &&
                      (selectedAnswer === null ||
                        selectedAnswer === undefined) && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                          Sélectionnez une option ci-dessus
                        </p>
                      )}
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
              <div className="text-center">
                <CheckCircleIcon className="mx-auto h-16 w-16 text-green-500 mb-6" />
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                  Quiz terminé !
                </h2>
                <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
                  Récupération de vos résultats en cours...
                </p>

                <div className="flex justify-center">
                  <LoadingSpinner />
                </div>

                <button
                  onClick={() => fetchFinalResults()}
                  className="mt-6 bg-primary-600 hover:bg-primary-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  Actualiser les résultats
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
