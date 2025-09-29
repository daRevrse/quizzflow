import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";
import { useSocket } from "../../contexts/SocketContext";
import { sessionService } from "../../services/api";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import WordCloudQuestion from "../../components/quiz/WordCloudQuestion";
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
  XCircleIcon,
  ArrowRightIcon,
  UserIcon,
  InformationCircleIcon,
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

  // États pour l'UI
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
  const [freeTextAnswer, setFreeTextAnswer] = useState("");

  // 🔴 NOUVEAU: État pour QCM multiple
  const [multipleSelections, setMultipleSelections] = useState([]);

  // Refs
  const componentMountedRef = useRef(true);
  const isLoadingRef = useRef(false);
  const timerRef = useRef(null);
  const hasJoinedSessionRef = useRef(false);

  const loadSession = useCallback(async () => {
    if (isLoadingRef.current || !componentMountedRef.current) return;

    try {
      isLoadingRef.current = true;
      setLoading(true);
      setError(null);

      const response = await sessionService.getSession(sessionId);
      const sessionData = response.session;
      const permissions = response.permissions;

      if (!sessionData) {
        throw new Error("Session non trouvée");
      }

      if (!permissions?.canParticipate) {
        if (sessionData.status === "finished") {
          toast("Cette session est terminée", {
            icon: "ℹ️",
            style: { background: "#3B82F6", color: "white" },
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

      setSession(sessionData);
      setSessionStatus(sessionData.status);
      setTotalQuestions(sessionData.quiz?.questions?.length || 0);
      setCurrentQuestionNumber((sessionData.currentQuestionIndex || 0) + 1);

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
      } else {
        if (
          sessionData.status === "waiting" ||
          (sessionData.status === "active" &&
            sessionData.settings?.allowLateJoin)
        ) {
          navigate(`/join/${sessionData.code}`);
          return;
        }
      }

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

        // 🔴 CORRECTION: Réinitialiser multipleSelections
        if (Array.isArray(myAnswer)) {
          setMultipleSelections(myAnswer);
        } else {
          setMultipleSelections([]);
        }

        if (question.timeLimit && sessionData.currentQuestionStartedAt) {
          const startTime = new Date(sessionData.currentQuestionStartedAt);
          const elapsed = Math.floor((Date.now() - startTime) / 1000);
          const remaining = Math.max(0, question.timeLimit - elapsed);
          setTimeRemaining(remaining);
        } else {
          setTimeRemaining(null);
        }
      } else {
        setCurrentQuestion(null);
        setTimeRemaining(null);
        setShowResults(false);
        setIsAnswered(false);
        setSelectedAnswer(null);
        setMultipleSelections([]);

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
    } catch (error) {
      console.error("Erreur lors du chargement:", error);

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
          "❌ Informations manquantes pour récupérer résultats finaux"
        );
        return;
      }

      console.log("📊 Récupération résultats finaux:", {
        sessionId,
        participantId: participantInfo.id,
      });

      const response = await sessionService.getSession(sessionId);

      if (response?.session) {
        const session = response.session;

        // Trouver les données du participant
        const participant = session.participants?.find(
          (p) => p.id === participantInfo.id || p.name === participantInfo.name
        );

        if (participant) {
          console.log("👤 Participant trouvé:", participant);

          // 🔴 CORRECTION: Analyser les réponses RÉELLES du participant
          const responses = session.responses || {};
          const participantResponses = [];
          let correctAnswers = 0;
          let totalTimeSpent = 0;

          console.log("📝 Analyse des réponses:", {
            questionsDisponibles: Object.keys(responses),
            totalQuestions: session.quiz?.questions?.length || 0,
          });

          // Analyser toutes les réponses du participant
          Object.keys(responses).forEach((questionId) => {
            const questionResponses = responses[questionId] || [];
            const participantResponse = questionResponses.find(
              (r) => r.participantId === participant.id
            );

            if (participantResponse) {
              participantResponses.push(participantResponse);

              // 🔴 CORRECTION: Compter correctement les bonnes réponses
              if (participantResponse.isCorrect) {
                correctAnswers++;
              }

              totalTimeSpent += participantResponse.timeSpent || 0;

              console.log(`   Question ${questionId}:`, {
                isCorrect: participantResponse.isCorrect,
                points: participantResponse.points,
                timeSpent: participantResponse.timeSpent,
              });
            }
          });

          // 🔴 CORRECTION CRITIQUE: Utiliser le nombre de questions RÉPONDUES
          const totalQuestions = participantResponses.length;

          console.log("📊 Calcul stats participant:", {
            totalQuestions: totalQuestions,
            correctAnswers: correctAnswers,
            participantResponses: participantResponses.length,
            scoreParticipant: participant.score,
          });

          // 🔴 CORRECTION: Calculer le taux de réussite sur les questions RÉPONDUES
          const accuracyRate =
            totalQuestions > 0
              ? Math.round((correctAnswers / totalQuestions) * 100)
              : 0;

          console.log("🎯 Taux de réussite calculé:", {
            correctAnswers,
            totalQuestions,
            accuracyRate,
          });

          // 🔴 CORRECTION: Calculer le score maximum possible basé sur les réponses
          let maxPossibleScore = 0;
          participantResponses.forEach((response) => {
            // Trouver la question correspondante
            const questionIndex = parseInt(
              response.questionId?.replace(/\D/g, "") || 0
            );
            const question = session.quiz?.questions?.[questionIndex];

            if (question) {
              maxPossibleScore += question.points || 1;
            } else {
              // Fallback: utiliser les points de la réponse
              maxPossibleScore += response.points || 1;
            }
          });

          console.log("💰 Score maximum calculé:", maxPossibleScore);

          // Calculer le rang
          const participants = session.participants || [];
          const sortedParticipants = participants
            .filter((p) => typeof p.score === "number")
            .sort((a, b) => (b.score || 0) - (a.score || 0));

          const rank =
            sortedParticipants.findIndex((p) => p.id === participant.id) + 1;

          console.log("🏆 Classement:", {
            rank: rank > 0 ? rank : null,
            totalParticipants: sortedParticipants.length,
            topScores: sortedParticipants.slice(0, 3).map((p) => ({
              name: p.name,
              score: p.score,
            })),
          });

          // 🔴 CORRECTION: Structure finale avec calculs corrigés
          const finalResultsData = {
            participant: {
              id: participant.id,
              name: participant.name,
              score: participant.score || 0,
              correctAnswers, // Nombre réel de bonnes réponses
              totalQuestions, // Nombre réel de questions répondues
              accuracyRate, // Calculé sur les questions répondues
              totalTimeSpent,
              averageTimePerQuestion:
                participantResponses.length > 0
                  ? Math.round(totalTimeSpent / participantResponses.length)
                  : 0,
              responses: participantResponses,
              maxPossibleScore, // Score max basé sur les questions répondues
            },
            rank: rank > 0 ? rank : null,
            session: {
              id: session.id,
              code: session.code,
              title: session.title,
              quiz: session.quiz,
              status: session.status,
              endedAt: session.endedAt,
              autoEnded: session.autoEnded || false,
            },
          };

          console.log("✅ Résultats finaux calculés:", finalResultsData);

          setFinalResults(finalResultsData);
          setShowFinalResults(true);
        } else {
          console.error("❌ Participant non trouvé dans la session");
          toast.error("Impossible de trouver vos données dans cette session");
        }
      } else {
        console.error("❌ Session non trouvée");
        toast.error("Session non trouvée");
      }
    } catch (error) {
      console.error("💥 Erreur récupération résultats finaux:", error);
      toast.error("Impossible de récupérer les résultats");
    }
  };

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

  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (timeRemaining !== null && timeRemaining > 0 && !showResults) {
      timerRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev === null || prev <= 1) {
            clearInterval(timerRef.current);
            timerRef.current = null;

            if (componentMountedRef.current) {
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
  }, [timeRemaining, showResults]);

  useEffect(() => {
    if (!socket || !isConnected || !sessionId || !participantInfo) return;

    let isSocketMounted = true;

    if (!hasJoinedSessionRef.current) {
      socket.emit("join_session", {
        sessionId,
        participantId: participantInfo.id,
        role: "participant",
      });

      hasJoinedSessionRef.current = true;
    }

    const handleSessionStarted = (data) => {
      if (!isSocketMounted || !componentMountedRef.current) return;
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
      if (!isSocketMounted || !componentMountedRef.current) return;

      setSessionStatus("finished");
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      setCurrentQuestion(null);
      setShowResults(false);
      setShowCorrectAnswer(false);
      setTimeRemaining(null);

      let toastMessage = "Session terminée ! Merci d'avoir participé";
      let toastConfig = {
        duration: 4000,
        style: { background: "#10B981", color: "white" },
      };

      if (data.autoEnded) {
        toastMessage = "Session terminée automatiquement - temps écoulé !";
        toastConfig.style.background = "#F59E0B";
        toastConfig.icon = "⏰";
      }

      toast.success(toastMessage, toastConfig);

      setTimeout(() => {
        if (componentMountedRef.current) {
          fetchFinalResults();
        }
      }, 1500);
    };

    const handleNextQuestion = (data) => {
      if (!isSocketMounted || !componentMountedRef.current) return;
      setCurrentQuestion(data.question);
      setSelectedAnswer(null);
      setMultipleSelections([]); // 🔴 CORRECTION
      setIsAnswered(false);
      setShowResults(false);
      setShowCorrectAnswer(false);
      setQuestionResults(null);
      setIsSubmitting(false);
      setFreeTextAnswer("");
      setCurrentQuestionNumber((data.questionIndex || 0) + 1);
      setSession((prevSession) => ({
        ...prevSession,
        currentQuestionIndex: data.questionIndex,
        currentQuestionStartedAt: data.startedAt || new Date().toISOString(),
      }));

      if (data.question.timeLimit) {
        setTimeRemaining(data.question.timeLimit);
      } else {
        setTimeRemaining(null);
      }

      if (data.autoAdvanced) {
        toast.success(
          `Temps écoulé ! Question ${(data.questionIndex || 0) + 1}`,
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
        toast.success("Bonne réponse !", {
          duration: 3000,
          style: { background: "#10B981", color: "white" },
        });
        setStreak((prev) => prev + 1);
      } else if (myResponse && !myResponse.isCorrect) {
        toast.error("Dommage !", {
          duration: 2000,
          style: { background: "#EF4444", color: "white" },
        });
        setStreak(0);
      }
    };

    const handleLeaderboardUpdate = (data) => {
      if (!isSocketMounted || !componentMountedRef.current) return;
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
      setIsSubmitting(false);
      toast.error(data.message || "Erreur lors de l'envoi de votre réponse", {
        duration: 3000,
      });
    };

    const handleError = (data) => {
      if (!isSocketMounted || !componentMountedRef.current) return;
      toast.error(data.message || "Erreur de connexion");
    };

    const handleDisconnect = () => {
      if (!isSocketMounted || !componentMountedRef.current) return;
      toast.error("Connexion perdue. Tentative de reconnexion...", {
        duration: 5000,
      });
    };

    const handleReconnect = () => {
      if (!isSocketMounted || !componentMountedRef.current) return;
      toast.success("Connexion rétablie !", {
        duration: 2000,
      });
      hasJoinedSessionRef.current = false;
    };

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
    loadSession,
    fetchFinalResults,
  ]);

  const extractAnswerText = (answer) => {
    if (typeof answer === "string") {
      return answer;
    }

    if (!answer) {
      return "";
    }

    if (typeof answer === "object") {
      if (answer.text) return String(answer.text);
      if (answer.label) return String(answer.label);
      if (answer.value) return String(answer.value);
      if (answer.name) return String(answer.name);
    }

    return String(answer);
  };

  // 🔴 CORRECTION CRITIQUE: handleSubmitAnswer avec validation par type
  const handleSubmitAnswer = useCallback(() => {
    console.log("🔥 handleSubmitAnswer appelé", {
      selectedAnswer,
      questionType: currentQuestion?.type,
      isAnswered,
      isSubmitting,
    });

    // 🔴 CORRECTION: Validation selon le type de question
    if (currentQuestion?.type === "nuage_mots") {
      if (!Array.isArray(selectedAnswer) || selectedAnswer.length === 0) {
        toast.error("Veuillez ajouter au moins un mot-clé");
        return;
      }
    } else if (currentQuestion?.type === "reponse_libre") {
      if (!selectedAnswer || selectedAnswer.trim() === "") {
        toast.error("Veuillez saisir une réponse");
        return;
      }
    } else if (currentQuestion?.type === "qcm") {
      // Détecter si QCM multiple
      const correctOptions = (
        currentQuestion.options ||
        currentQuestion.answers ||
        []
      ).filter((opt) => opt.isCorrect);
      const isMultipleChoice = correctOptions.length > 1;

      if (isMultipleChoice) {
        // Validation pour QCM multiple
        if (!Array.isArray(selectedAnswer) || selectedAnswer.length === 0) {
          toast.error("Veuillez sélectionner au moins une réponse");
          return;
        }
        console.log(
          `✅ QCM multiple validé: ${selectedAnswer.length} réponses`
        );
      } else {
        // Validation pour QCM simple
        if (selectedAnswer === null || selectedAnswer === undefined) {
          toast.error("Veuillez sélectionner une réponse");
          return;
        }
        console.log(`✅ QCM simple validé: réponse ${selectedAnswer}`);
      }
    } else if (currentQuestion?.type === "vrai_faux") {
      if (selectedAnswer === null || selectedAnswer === undefined) {
        toast.error("Veuillez sélectionner une réponse");
        return;
      }
    }

    if (isAnswered || isSubmitting || !currentQuestion || !participantInfo) {
      return;
    }

    if (!socket || !isConnected) {
      toast.error("Problème de connexion");
      return;
    }

    let questionId;
    if (session?.currentQuestionIndex !== undefined) {
      questionId = `q_${session.currentQuestionIndex}`;
    } else if (currentQuestion?.id) {
      questionId = currentQuestion.id;
    } else {
      questionId = `q_${currentQuestionNumber - 1}`;
    }

    const response = {
      questionId,
      sessionId,
      participantId: participantInfo.id,
      answer: selectedAnswer, // 🔴 Peut être tableau pour nuage de mots
      submittedAt: new Date().toISOString(),
      timeSpent:
        currentQuestion.timeLimit && timeRemaining !== null
          ? currentQuestion.timeLimit - timeRemaining
          : null,
    };

    console.log("📤 Envoi réponse:", response);

    setIsSubmitting(true);
    socket.emit("submit_response", response);

    const handleResponseConfirmation = (data) => {
      if (data.questionId === questionId) {
        setIsAnswered(true);
        setIsSubmitting(false);
        if (data.success !== false) {
          const message = `Réponse enregistrée ! ${
            data.isCorrect ? "✅ Correct" : "❌ Incorrect"
          } (${data.points || 0} pts)`;
          toast.success(message, { duration: 3000 });
        }
        socket.off("response_submitted", handleResponseConfirmation);
      }
    };

    const handleResponseError = (error) => {
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

    socket.on("response_submitted", handleResponseConfirmation);
    socket.on("error", handleResponseError);

    const timeoutId = setTimeout(() => {
      if (isSubmitting && componentMountedRef.current) {
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

  const handleTimeUp = useCallback(() => {
    if (isAnswered || showResults) return;

    toast("Temps écoulé !", {
      icon: "⏰",
      style: { background: "#F59E0B", color: "white" },
      duration: 3000,
    });

    if (
      selectedAnswer !== null &&
      selectedAnswer !== undefined &&
      !isSubmitting
    ) {
      // 🔴 CORRECTION: Vérifier aussi les tableaux vides
      if (Array.isArray(selectedAnswer) && selectedAnswer.length === 0) {
        setIsAnswered(true);
        toast.error("Aucune réponse sélectionnée", { duration: 2000 });
        return;
      }
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

  // 🔴 CORRECTION: handleSelectAnswer avec support QCM multiple
  const handleSelectAnswer = useCallback(
    (answerIndex) => {
      console.log("🎯 Sélection réponse:", answerIndex);

      if (isAnswered || showResults || isSubmitting) {
        return;
      }

      // 🔴 NOUVEAU: Détecter si c'est un QCM multiple
      const correctOptions =
        currentQuestion.options?.filter((opt) => opt.isCorrect) || [];
      const isMultipleChoice = correctOptions.length > 1;

      if (isMultipleChoice) {
        // QCM Multiple : toggle la sélection
        setSelectedAnswer((prev) => {
          const current = Array.isArray(prev) ? prev : [];
          if (current.includes(answerIndex)) {
            return current.filter((idx) => idx !== answerIndex);
          } else {
            return [...current, answerIndex];
          }
        });

        if (navigator.vibrate) {
          navigator.vibrate(30);
        }
      } else {
        // QCM Simple : sélection unique
        setSelectedAnswer(answerIndex);

        if (navigator.vibrate) {
          navigator.vibrate(50);
        }

        toast(`Réponse ${String.fromCharCode(65 + answerIndex)} sélectionnée`, {
          icon: "👆",
          duration: 1000,
          style: { background: "#3B82F6", color: "white" },
        });
      }
    },
    [isAnswered, showResults, isSubmitting, currentQuestion]
  );

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

    // 🔴 CORRECTION: Calculer la performance basée sur les VRAIES stats
    const performance = participant.accuracyRate;
    const scorePercentage =
      participant.maxPossibleScore > 0
        ? Math.round((participant.score / participant.maxPossibleScore) * 100)
        : 0;

    console.log("🎨 Affichage FinalResults:", {
      score: participant.score,
      maxPossibleScore: participant.maxPossibleScore,
      correctAnswers: participant.correctAnswers,
      totalQuestions: participant.totalQuestions,
      accuracyRate: participant.accuracyRate,
      scorePercentage,
    });

    let performanceLevel = "Peut mieux faire";
    let performanceColor = "text-red-600";
    let bgColor = "bg-red-50";
    let emoji = "😅";

    if (performance >= 90) {
      performanceLevel = "Exceptionnel !";
      performanceColor = "text-purple-600";
      bgColor = "bg-purple-50";
      emoji = "🏆";
    } else if (performance >= 80) {
      performanceLevel = "Excellent !";
      performanceColor = "text-green-600";
      bgColor = "bg-green-50";
      emoji = "🎉";
    } else if (performance >= 70) {
      performanceLevel = "Très bien !";
      performanceColor = "text-blue-600";
      bgColor = "bg-blue-50";
      emoji = "👏";
    } else if (performance >= 60) {
      performanceLevel = "Bien joué !";
      performanceColor = "text-teal-600";
      bgColor = "bg-teal-50";
      emoji = "😊";
    } else if (performance >= 40) {
      performanceLevel = "Pas mal !";
      performanceColor = "text-yellow-600";
      bgColor = "bg-yellow-50";
      emoji = "👍";
    }

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 animate-fadeIn">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 animate-slideUp">
          {/* Confettis animation */}
          <div className="text-center mb-6">
            <div className="text-6xl mb-4 animate-bounce">{emoji}</div>
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
              {/* Score */}
              <div className="text-center">
                <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                  {participant.score}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Points
                </div>
                {participant.maxPossibleScore > 0 && (
                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    sur {participant.maxPossibleScore}
                  </div>
                )}
              </div>

              {/* Précision */}
              <div className="text-center">
                <div className={`text-2xl font-bold ${performanceColor}`}>
                  {participant.accuracyRate}%
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Précision
                </div>
                <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  {participant.correctAnswers}/{participant.totalQuestions}{" "}
                  correct
                </div>
              </div>
            </div>
          </div>

          {/* Détails */}
          <div className="space-y-3 mb-6">
            {/* Réponses correctes */}
            <div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700 rounded">
              <span className="text-sm text-gray-600 dark:text-gray-400 flex items-center">
                <svg
                  className="w-4 h-4 mr-2 text-green-500"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                Réponses correctes
              </span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {participant.correctAnswers}/{participant.totalQuestions}
              </span>
            </div>

            {/* Classement */}
            {rank && (
              <div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700 rounded">
                <span className="text-sm text-gray-600 dark:text-gray-400 flex items-center">
                  <svg
                    className="w-4 h-4 mr-2 text-yellow-500"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  Classement
                </span>
                <span className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
                  #{rank}
                </span>
              </div>
            )}

            {/* Temps total */}
            <div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700 rounded">
              <span className="text-sm text-gray-600 dark:text-gray-400 flex items-center">
                <svg
                  className="w-4 h-4 mr-2 text-blue-500"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                    clipRule="evenodd"
                  />
                </svg>
                Temps total
              </span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {Math.floor(participant.totalTimeSpent / 60)}min{" "}
                {participant.totalTimeSpent % 60}s
              </span>
            </div>

            {/* Temps moyen par question */}
            {participant.averageTimePerQuestion > 0 && (
              <div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700 rounded">
                <span className="text-sm text-gray-600 dark:text-gray-400 flex items-center">
                  <svg
                    className="w-4 h-4 mr-2 text-purple-500"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Temps moyen / question
                </span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {participant.averageTimePerQuestion}s
                </span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col space-y-3">
            <button
              onClick={onViewDetails}
              className="w-full bg-gradient-to-r from-primary-600 to-blue-600 hover:from-primary-700 hover:to-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
            >
              <span className="flex items-center justify-center">
                <svg
                  className="w-5 h-5 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
                Voir les détails
              </span>
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

  // Rendu principal
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

          {/* Progression */}
          {totalQuestions > 0 && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Question {currentQuestionNumber} sur {totalQuestions}
                </span>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {Math.round((currentQuestionNumber / totalQuestions) * 100)}%
                  complété
                </div>
              </div>

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
          )}
        </div>
      </div>

      {/* Contenu principal */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {currentQuestion ? (
          <div className="space-y-6">
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

              {currentQuestion.image && (
                <div className="px-6 pt-4">
                  <img
                    src={currentQuestion.image}
                    alt="Illustration de la question"
                    className="w-full max-w-md mx-auto rounded-lg shadow-sm"
                  />
                </div>
              )}

              <div className="p-6 space-y-3">
                {/* 🔴 NOUVEAU: Nuage de mots */}
                {currentQuestion.type === "nuage_mots" && (
                  <>
                    <WordCloudQuestion
                      question={currentQuestion}
                      onSubmit={(words) => {
                        console.log("📝 Nuage de mots mis à jour:", words);
                        setSelectedAnswer(words);
                      }}
                      isSubmitted={isAnswered}
                      submittedAnswer={selectedAnswer}
                      timeRemaining={timeRemaining}
                    />

                    {/* BOUTON CONFIRMER pour nuage de mots */}
                    {!isAnswered && !showResults && (
                      <div className="mt-6 text-center">
                        <button
                          onClick={handleSubmitAnswer}
                          disabled={
                            isSubmitting ||
                            !Array.isArray(selectedAnswer) ||
                            selectedAnswer.length === 0
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
                              Confirmer mes{" "}
                              {Array.isArray(selectedAnswer)
                                ? selectedAnswer.length
                                : 0}{" "}
                              mot
                              {Array.isArray(selectedAnswer) &&
                              selectedAnswer.length > 1
                                ? "s"
                                : ""}
                              <ArrowRightIcon className="ml-2 h-5 w-5" />
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </>
                )}

                {/* 🔴 CORRECTION: Réponse libre */}
                {currentQuestion.type === "reponse_libre" && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                        Votre réponse :
                      </label>
                      <textarea
                        value={
                          typeof selectedAnswer === "string"
                            ? selectedAnswer
                            : ""
                        }
                        onChange={(e) => {
                          if (!isAnswered && !showResults && !isSubmitting) {
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
                    </div>

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
                  </div>
                )}

                {/* 🔴 CORRECTION: QCM et Vrai/Faux avec support multiple */}
                {currentQuestion.type === "qcm" &&
                  (() => {
                    const answers =
                      currentQuestion.answers || currentQuestion.options || [];
                    const correctOptions = answers.filter(
                      (opt) => opt.isCorrect
                    );
                    const isMultipleChoice = correctOptions.length > 1;

                    console.log("🔍 QCM Debug:", {
                      totalOptions: answers.length,
                      correctOptions: correctOptions.length,
                      isMultipleChoice,
                      selectedAnswer,
                    });

                    return (
                      <>
                        {/* Indicateur QCM multiple */}
                        {isMultipleChoice && !isAnswered && (
                          <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                            <p className="text-sm text-blue-800 dark:text-blue-200 flex items-center">
                              <InformationCircleIcon className="h-5 w-5 mr-2 flex-shrink-0" />
                              <span>
                                <span className="font-bold">
                                  Question à choix multiples
                                </span>{" "}
                                - Sélectionnez toutes les bonnes réponses (
                                {correctOptions.length} réponses correctes)
                              </span>
                            </p>
                          </div>
                        )}

                        {/* Options de réponse */}
                        <div className="space-y-3">
                          {answers.map((answer, index) => {
                            const answerText = extractAnswerText(answer);

                            let isCorrectAnswer = false;
                            if (
                              typeof currentQuestion.correctAnswer === "number"
                            ) {
                              isCorrectAnswer =
                                currentQuestion.correctAnswer === index;
                            } else if (
                              answer &&
                              typeof answer === "object" &&
                              "isCorrect" in answer
                            ) {
                              isCorrectAnswer = answer.isCorrect;
                            }

                            // Gestion sélection simple vs multiple
                            const isSelected = isMultipleChoice
                              ? Array.isArray(selectedAnswer) &&
                                selectedAnswer.includes(index)
                              : selectedAnswer === index;

                            const isCorrect =
                              showCorrectAnswer && isCorrectAnswer;
                            const isWrong =
                              showCorrectAnswer &&
                              isSelected &&
                              !isCorrectAnswer;

                            return (
                              <div key={index} className="relative">
                                <button
                                  onClick={() => handleSelectAnswer(index)}
                                  disabled={
                                    isAnswered || showResults || isSubmitting
                                  }
                                  className={`w-full p-4 text-left border-2 rounded-xl transition-all duration-200 ${
                                    isSelected && !showResults
                                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 dark:border-blue-400 transform scale-[1.02] shadow-lg"
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
                                    {/* Indicateur visuel */}
                                    <div
                                      className={`flex-shrink-0 ${
                                        isMultipleChoice
                                          ? "w-6 h-6 rounded"
                                          : "w-8 h-8 rounded-full"
                                      } border-2 flex items-center justify-center text-sm font-bold transition-colors ${
                                        isSelected && !showResults
                                          ? "border-blue-500 bg-blue-500 text-white"
                                          : showResults && isCorrect
                                          ? "border-green-500 bg-green-500 text-white"
                                          : showResults && isWrong
                                          ? "border-red-500 bg-red-500 text-white"
                                          : "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400"
                                      }`}
                                    >
                                      {isMultipleChoice
                                        ? isSelected
                                          ? "✓"
                                          : ""
                                        : String.fromCharCode(65 + index)}
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
                                        {/* Lettre pour QCM multiple */}
                                        {isMultipleChoice && !showResults && (
                                          <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 mr-2">
                                            {String.fromCharCode(65 + index)}.
                                          </span>
                                        )}
                                        {answerText || `Option ${index + 1}`}
                                      </div>
                                    </div>

                                    {/* Icône résultat */}
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
                              </div>
                            );
                          })}
                        </div>

                        {/* Message d'aide pour QCM multiple */}
                        {isMultipleChoice && !isAnswered && !showResults && (
                          <div className="mt-3 text-center">
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {Array.isArray(selectedAnswer) &&
                              selectedAnswer.length > 0 ? (
                                <>
                                  <span className="font-medium text-blue-600 dark:text-blue-400">
                                    {selectedAnswer.length} réponse
                                    {selectedAnswer.length > 1 ? "s" : ""}{" "}
                                    sélectionnée
                                    {selectedAnswer.length > 1 ? "s" : ""}
                                  </span>{" "}
                                  sur {correctOptions.length} attendue
                                  {correctOptions.length > 1 ? "s" : ""}
                                </>
                              ) : (
                                `Sélectionnez ${correctOptions.length} réponse${
                                  correctOptions.length > 1 ? "s" : ""
                                }`
                              )}
                            </p>
                          </div>
                        )}
                      </>
                    );
                  })()}

                {currentQuestion.type === "vrai_faux" &&
                  (() => {
                    // Déterminer les options Vrai/Faux
                    let vraiOptions;

                    if (
                      Array.isArray(currentQuestion.options) &&
                      currentQuestion.options.length === 2
                    ) {
                      // Format avec options explicites
                      vraiOptions = currentQuestion.options.map(
                        (option, index) => ({
                          text: option.text || (index === 0 ? "Vrai" : "Faux"),
                          isCorrect: option.isCorrect === true,
                        })
                      );
                    } else {
                      // Format avec correctAnswer - générer les options
                      let vraiIsCorrect = false;

                      if (typeof currentQuestion.correctAnswer === "boolean") {
                        vraiIsCorrect = currentQuestion.correctAnswer === true;
                      } else if (
                        typeof currentQuestion.correctAnswer === "number"
                      ) {
                        vraiIsCorrect = currentQuestion.correctAnswer === 0; // 0 = Vrai, 1 = Faux
                      } else if (
                        typeof currentQuestion.correctAnswer === "string"
                      ) {
                        const correctStr = currentQuestion.correctAnswer
                          .toLowerCase()
                          .trim();
                        vraiIsCorrect = ["true", "vrai", "0"].includes(
                          correctStr
                        );
                      }

                      vraiOptions = [
                        { text: "Vrai", isCorrect: vraiIsCorrect },
                        { text: "Faux", isCorrect: !vraiIsCorrect },
                      ];
                    }

                    return (
                      <div className="grid grid-cols-2 gap-4">
                        {vraiOptions.map((answer, index) => {
                          const isCorrectAnswer = answer.isCorrect;
                          const isSelected = selectedAnswer === index;
                          const isCorrect =
                            showCorrectAnswer && isCorrectAnswer;
                          const isWrong =
                            showCorrectAnswer && isSelected && !isCorrectAnswer;

                          // Calcul des pourcentages si résultats disponibles
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

                          // Couleurs et styles selon l'état
                          let buttonClasses = "relative group";
                          let contentClasses =
                            "relative z-10 flex flex-col items-center justify-center p-8 rounded-2xl border-3 transition-all duration-300 transform";
                          let iconClasses =
                            "mb-4 transition-transform duration-300";

                          if (isAnswered || showResults || isSubmitting) {
                            contentClasses += " cursor-not-allowed";
                          } else {
                            contentClasses +=
                              " cursor-pointer hover:scale-105 hover:shadow-2xl";
                            iconClasses += " group-hover:scale-110";
                          }

                          // États visuels
                          if (isSelected && !showResults) {
                            // Sélectionné (avant résultats)
                            contentClasses +=
                              index === 0
                                ? " border-green-500 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/30 shadow-xl shadow-green-200 dark:shadow-green-900/50"
                                : " border-red-500 bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-800/30 shadow-xl shadow-red-200 dark:shadow-red-900/50";
                          } else if (showResults && isCorrect) {
                            // Bonne réponse (après résultats)
                            contentClasses +=
                              " border-green-500 bg-gradient-to-br from-green-100 to-green-200 dark:from-green-800/50 dark:to-green-700/50 shadow-xl ring-4 ring-green-300 dark:ring-green-700";
                          } else if (showResults && isWrong) {
                            // Mauvaise réponse (après résultats)
                            contentClasses +=
                              " border-red-500 bg-gradient-to-br from-red-100 to-red-200 dark:from-red-800/50 dark:to-red-700/50 shadow-xl ring-4 ring-red-300 dark:ring-red-700";
                          } else {
                            // État normal
                            contentClasses +=
                              index === 0
                                ? " border-green-300 dark:border-green-600 bg-white dark:bg-gray-800 hover:border-green-400 dark:hover:border-green-500"
                                : " border-red-300 dark:border-red-600 bg-white dark:bg-gray-800 hover:border-red-400 dark:hover:border-red-500";
                          }

                          return (
                            <button
                              key={index}
                              onClick={() => handleSelectAnswer(index)}
                              disabled={
                                isAnswered || showResults || isSubmitting
                              }
                              className={buttonClasses}
                            >
                              <div className={contentClasses}>
                                {/* Icône principale */}
                                <div className={iconClasses}>
                                  {index === 0 ? (
                                    // Icône VRAI
                                    <div
                                      className={`w-20 h-20 rounded-full flex items-center justify-center ${
                                        isSelected && !showResults
                                          ? "bg-green-500 text-white"
                                          : showResults && isCorrect
                                          ? "bg-green-600 text-white animate-bounce"
                                          : "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                                      }`}
                                    >
                                      <CheckCircleIcon
                                        className="w-12 h-12"
                                        strokeWidth={2.5}
                                      />
                                    </div>
                                  ) : (
                                    // Icône FAUX
                                    <div
                                      className={`w-20 h-20 rounded-full flex items-center justify-center ${
                                        isSelected && !showResults
                                          ? "bg-red-500 text-white"
                                          : showResults && isCorrect
                                          ? "bg-red-600 text-white animate-bounce"
                                          : "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                                      }`}
                                    >
                                      <XCircleIcon
                                        className="w-12 h-12"
                                        strokeWidth={2.5}
                                      />
                                    </div>
                                  )}
                                </div>

                                {/* Texte */}
                                <div
                                  className={`text-3xl font-bold mb-2 transition-colors ${
                                    isSelected && !showResults
                                      ? index === 0
                                        ? "text-green-700 dark:text-green-300"
                                        : "text-red-700 dark:text-red-300"
                                      : showResults && isCorrect
                                      ? index === 0
                                        ? "text-green-800 dark:text-green-200"
                                        : "text-red-800 dark:text-red-200"
                                      : index === 0
                                      ? "text-green-600 dark:text-green-400"
                                      : "text-red-600 dark:text-red-400"
                                  }`}
                                >
                                  {answer.text}
                                </div>

                                {/* Indicateur de sélection */}
                                {isSelected && !showResults && (
                                  <div className="absolute top-4 right-4">
                                    <div
                                      className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                        index === 0
                                          ? "bg-green-500"
                                          : "bg-red-500"
                                      } text-white shadow-lg`}
                                    >
                                      <CheckCircleIcon className="w-5 h-5" />
                                    </div>
                                  </div>
                                )}

                                {/* Indicateur de résultat */}
                                {showResults && (isCorrect || isWrong) && (
                                  <div className="absolute top-4 right-4">
                                    <div
                                      className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                        isCorrect
                                          ? "bg-green-500 animate-pulse"
                                          : "bg-red-500"
                                      } text-white shadow-lg`}
                                    >
                                      {isCorrect ? (
                                        <CheckCircleIcon
                                          className="w-6 h-6"
                                          strokeWidth={3}
                                        />
                                      ) : (
                                        <XCircleIcon
                                          className="w-6 h-6"
                                          strokeWidth={3}
                                        />
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Barre de statistiques (si résultats disponibles) */}
                                {showResults && questionResults && (
                                  <div className="w-full mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                                    <div className="flex items-center justify-between text-sm mb-2">
                                      <span className="font-medium text-gray-700 dark:text-gray-300">
                                        {responseCount} réponse
                                        {responseCount > 1 ? "s" : ""}
                                      </span>
                                      <span
                                        className={`font-bold ${
                                          index === 0
                                            ? "text-green-600 dark:text-green-400"
                                            : "text-red-600 dark:text-red-400"
                                        }`}
                                      >
                                        {percentage}%
                                      </span>
                                    </div>
                                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                                      <div
                                        className={`h-2 rounded-full transition-all duration-1000 ease-out ${
                                          index === 0
                                            ? "bg-green-500"
                                            : "bg-red-500"
                                        }`}
                                        style={{ width: `${percentage}%` }}
                                      />
                                    </div>
                                  </div>
                                )}

                                {/* Animation de pulse pour la bonne réponse */}
                                {showResults && isCorrect && (
                                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-green-400/20 to-transparent animate-pulse pointer-events-none" />
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })()}
              </div>

              {/* 🔴 CORRECTION: Bouton de soumission avec validation par type */}
              <div className="px-6 pb-6">
                {!isAnswered &&
                  !showResults &&
                  currentQuestion.type !== "nuage_mots" && (
                    <div className="text-center">
                      <button
                        onClick={handleSubmitAnswer}
                        disabled={
                          isSubmitting ||
                          (currentQuestion.type === "reponse_libre" &&
                            (!selectedAnswer ||
                              typeof selectedAnswer !== "string" ||
                              selectedAnswer.trim() === "")) ||
                          ((currentQuestion.type === "qcm" ||
                            currentQuestion.type === "vrai_faux") &&
                            (selectedAnswer === null ||
                              selectedAnswer === undefined ||
                              (Array.isArray(selectedAnswer) &&
                                selectedAnswer.length === 0)))
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
          </div>
        ) : (
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
      </div>
    </div>
  );
};

export default SessionPlay;
