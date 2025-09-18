import { useState, useEffect, useCallback } from "react";
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
} from "@heroicons/react/24/outline";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const SessionPlay = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { socket, isConnected } = useSocket();

  // États
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [questionResults, setQuestionResults] = useState(null);
  const [playerScore, setPlayerScore] = useState(0);
  const [leaderboard, setLeaderboard] = useState([]);
  const [sessionStatus, setSessionStatus] = useState("waiting");

  // Charger la session
  const loadSession = useCallback(async () => {
    try {
      setLoading(true);
      const response = await sessionService.getSession(sessionId);
      const sessionData = response.session;

      setSession(sessionData);
      setSessionStatus(sessionData.status);
      setPlayerScore(sessionData.myScore || 0);

      // Définir la question courante si elle existe
      if (sessionData.currentQuestionIndex !== undefined) {
        const question =
          sessionData.quiz.questions?.[sessionData.currentQuestionIndex];
        if (question) {
          setCurrentQuestion(question);
          // Vérifier si on a déjà répondu à cette question
          const myResponse = sessionData.myResponses?.[question.id];
          if (myResponse) {
            setSelectedAnswer(myResponse.answer);
            setIsAnswered(true);
          }
        }
      }

      // Rejoindre la session via Socket.IO
      if (socket && isConnected) {
        socket.emit("join_session", {
          sessionId,
          participant: {
            id: user?.id || `anon_${Date.now()}`,
            name: user?.firstName || user?.username || "Participant anonyme",
          },
        });
      }
    } catch (error) {
      console.error("Erreur lors du chargement de la session:", error);
      toast.error("Erreur lors du chargement de la session");
      navigate("/");
    } finally {
      setLoading(false);
    }
  }, [sessionId, user, socket, isConnected, navigate]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  // Timer pour les questions chronométrées
  useEffect(() => {
    let timer;
    if (currentQuestion?.timeLimit && timeRemaining > 0 && !isAnswered) {
      timer = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            handleTimeUp();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [timeRemaining, isAnswered, currentQuestion]);

  // Événements Socket.IO
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleSessionStarted = () => {
      setSessionStatus("active");
      toast.success("La session a commencé !");
    };

    const handleSessionPaused = () => {
      setSessionStatus("paused");
      toast.info("Session mise en pause");
    };

    const handleSessionResumed = () => {
      setSessionStatus("active");
      toast.success("Session reprise");
    };

    const handleSessionEnded = () => {
      setSessionStatus("finished");
      toast.info("Session terminée");
      setTimeout(() => {
        navigate(`/session/${sessionId}/results`);
      }, 2000);
    };

    const handleNewQuestion = (data) => {
      setCurrentQuestion(data.question);
      setSelectedAnswer(null);
      setIsAnswered(false);
      setShowResults(false);
      setQuestionResults(null);

      if (data.question.timeLimit) {
        setTimeRemaining(data.question.timeLimit);
      }

      toast.success("Nouvelle question !");
    };

    const handleQuestionResults = (data) => {
      setShowResults(true);
      setQuestionResults(data.results);
    };

    const handleLeaderboardUpdate = (data) => {
      setLeaderboard(data.leaderboard);
      // Mettre à jour le score du joueur
      const myEntry = data.leaderboard.find(
        (entry) =>
          entry.id === user?.id ||
          entry.name === (user?.firstName || user?.username)
      );
      if (myEntry) {
        setPlayerScore(myEntry.score);
      }
    };

    socket.on("session_started", handleSessionStarted);
    socket.on("session_paused", handleSessionPaused);
    socket.on("session_resumed", handleSessionResumed);
    socket.on("session_ended", handleSessionEnded);
    socket.on("new_question", handleNewQuestion);
    socket.on("question_results", handleQuestionResults);
    socket.on("leaderboard_updated", handleLeaderboardUpdate);

    return () => {
      socket.off("session_started", handleSessionStarted);
      socket.off("session_paused", handleSessionPaused);
      socket.off("session_resumed", handleSessionResumed);
      socket.off("session_ended", handleSessionEnded);
      socket.off("new_question", handleNewQuestion);
      socket.off("question_results", handleQuestionResults);
      socket.off("leaderboard_updated", handleLeaderboardUpdate);
    };
  }, [socket, isConnected, sessionId, navigate, user]);

  // Gérer la soumission d'une réponse
  const handleSubmitAnswer = useCallback(() => {
    if (!selectedAnswer || isAnswered || !currentQuestion) return;

    const response = {
      sessionId,
      questionId: currentQuestion.id,
      answer: selectedAnswer,
      submittedAt: new Date().toISOString(),
      timeSpent: currentQuestion.timeLimit
        ? currentQuestion.timeLimit - timeRemaining
        : null,
    };

    if (socket) {
      socket.emit("submit_answer", response);
    }

    setIsAnswered(true);
    toast.success("Réponse envoyée !");
  }, [
    selectedAnswer,
    isAnswered,
    currentQuestion,
    sessionId,
    socket,
    timeRemaining,
  ]);

  const handleTimeUp = useCallback(() => {
    if (!isAnswered) {
      toast.warning("Temps écoulé !");
      if (selectedAnswer) {
        handleSubmitAnswer();
      } else {
        setIsAnswered(true);
      }
    }
  }, [isAnswered, selectedAnswer, handleSubmitAnswer]);

  // Gérer la sélection d'une réponse
  const handleSelectAnswer = (answer) => {
    if (isAnswered) return;
    setSelectedAnswer(answer);
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

  const getTimerColor = (time) => {
    if (time > 10) return "text-green-600 dark:text-green-400";
    if (time > 5) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            Connexion à la session...
          </p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <ExclamationTriangleIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Session non trouvée
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            Cette session n'existe pas ou a été fermée.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  {session.quiz.title}
                </h1>
                <div className="flex items-center space-x-3 text-sm text-gray-500 dark:text-gray-400">
                  <span>
                    Code:{" "}
                    <span className="font-mono font-bold">{session.code}</span>
                  </span>
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                      sessionStatus
                    )}`}
                  >
                    {sessionStatus === "waiting"
                      ? "En attente"
                      : sessionStatus === "active"
                      ? "En cours"
                      : sessionStatus === "paused"
                      ? "En pause"
                      : "Terminée"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="text-right">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Mon score
                </div>
                <div className="text-xl font-bold text-primary-600 dark:text-primary-400">
                  {playerScore} pts
                </div>
              </div>
              {timeRemaining !== null && timeRemaining > 0 && (
                <div className="flex items-center space-x-2">
                  <ClockIcon className="h-5 w-5 text-gray-400" />
                  <span
                    className={`text-xl font-bold ${getTimerColor(
                      timeRemaining
                    )}`}
                  >
                    {timeRemaining}s
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {sessionStatus === "waiting" && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
            <PlayIcon className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              En attente du démarrage
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Le formateur va bientôt commencer le quiz. Patientez quelques
              instants...
            </p>
            <div className="flex items-center justify-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
              <div className="flex items-center space-x-2">
                <UserGroupIcon className="h-4 w-4" />
                <span>
                  {session.participantCount || 0} participants connectés
                </span>
              </div>
            </div>
          </div>
        )}

        {sessionStatus === "paused" && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
            <PauseIcon className="h-16 w-16 text-orange-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Session en pause
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Le formateur a mis la session en pause. Elle reprendra bientôt.
            </p>
          </div>
        )}

        {sessionStatus === "finished" && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
            <StopIcon className="h-16 w-16 text-blue-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Session terminée
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Merci d'avoir participé ! Redirection vers les résultats...
            </p>
            <div className="text-3xl font-bold text-primary-600 dark:text-primary-400">
              Score final : {playerScore} points
            </div>
          </div>
        )}

        {sessionStatus === "active" && currentQuestion && (
          <div className="space-y-6">
            {/* Question */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
              <div className="text-center mb-6">
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                  Question {(session.currentQuestionIndex || 0) + 1} /{" "}
                  {session.quiz.questions?.length || 0}
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                  {currentQuestion.question}
                </h2>

                {currentQuestion.media && (
                  <div className="mb-6">
                    <img
                      src={currentQuestion.media.url}
                      alt="Media de la question"
                      className="max-w-lg mx-auto h-auto rounded-lg shadow-md"
                    />
                  </div>
                )}

                <div className="flex items-center justify-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                  <span>
                    {currentQuestion.points || 1} point
                    {(currentQuestion.points || 1) > 1 ? "s" : ""}
                  </span>
                  {currentQuestion.timeLimit && (
                    <span>{currentQuestion.timeLimit} secondes</span>
                  )}
                </div>
              </div>

              {/* Réponses */}
              {!showResults && (
                <div className="space-y-3">
                  {/* QCM */}
                  {currentQuestion.type === "qcm" &&
                    currentQuestion.options?.map((option, index) => (
                      <button
                        key={index}
                        onClick={() => handleSelectAnswer(option.text)}
                        disabled={isAnswered}
                        className={`w-full p-4 text-left rounded-lg border-2 transition-all ${
                          selectedAnswer === option.text
                            ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300"
                            : "border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 bg-white dark:bg-gray-700"
                        } ${
                          isAnswered
                            ? "opacity-50 cursor-not-allowed"
                            : "cursor-pointer"
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <span
                            className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-bold ${
                              selectedAnswer === option.text
                                ? "border-primary-500 bg-primary-500 text-white"
                                : "border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400"
                            }`}
                          >
                            {String.fromCharCode(65 + index)}
                          </span>
                          <span className="flex-1 text-gray-900 dark:text-white">
                            {option.text}
                          </span>
                        </div>
                      </button>
                    ))}

                  {/* Vrai/Faux */}
                  {currentQuestion.type === "vrai_faux" && (
                    <div className="grid grid-cols-2 gap-4">
                      {["true", "false"].map((answer) => (
                        <button
                          key={answer}
                          onClick={() => handleSelectAnswer(answer)}
                          disabled={isAnswered}
                          className={`p-6 text-center rounded-lg border-2 transition-all ${
                            selectedAnswer === answer
                              ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300"
                              : "border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 bg-white dark:bg-gray-700"
                          } ${
                            isAnswered
                              ? "opacity-50 cursor-not-allowed"
                              : "cursor-pointer"
                          }`}
                        >
                          <div className="text-2xl font-bold mb-2">
                            {answer === "true" ? "✓" : "✗"}
                          </div>
                          <div className="text-lg font-medium text-gray-900 dark:text-white">
                            {answer === "true" ? "Vrai" : "Faux"}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Réponse libre */}
                  {currentQuestion.type === "reponse_libre" && (
                    <div>
                      <textarea
                        value={selectedAnswer || ""}
                        onChange={(e) => handleSelectAnswer(e.target.value)}
                        disabled={isAnswered}
                        placeholder="Tapez votre réponse ici..."
                        className="w-full p-4 border-2 border-gray-200 dark:border-gray-600 rounded-lg focus:border-primary-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        rows={4}
                      />
                    </div>
                  )}

                  {/* Bouton de soumission */}
                  {selectedAnswer && !isAnswered && (
                    <div className="text-center pt-4">
                      <button
                        onClick={handleSubmitAnswer}
                        className="inline-flex items-center px-8 py-3 bg-primary-600 hover:bg-primary-700 text-white text-lg font-medium rounded-lg transition-colors"
                      >
                        <CheckCircleIcon className="h-5 w-5 mr-2" />
                        Valider ma réponse
                      </button>
                    </div>
                  )}

                  {isAnswered && (
                    <div className="text-center pt-4">
                      <div className="inline-flex items-center px-6 py-3 bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200 rounded-lg">
                        <CheckCircleIcon className="h-5 w-5 mr-2" />
                        Réponse envoyée ! En attente des autres participants...
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Résultats de la question */}
              {showResults && questionResults && (
                <div className="space-y-4">
                  <div className="text-center py-4">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                      Résultats de la question
                    </h3>
                  </div>

                  {currentQuestion.type === "qcm" && (
                    <div className="space-y-3">
                      {currentQuestion.options?.map((option, index) => {
                        const responseCount = Object.values(
                          questionResults
                        ).filter((r) => r.answer === option.text).length;
                        const percentage =
                          questionResults.length > 0
                            ? Math.round(
                                (responseCount /
                                  Object.keys(questionResults).length) *
                                  100
                              )
                            : 0;

                        return (
                          <div
                            key={index}
                            className={`p-4 rounded-lg border-2 ${
                              option.isCorrect
                                ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                                : "border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <span
                                  className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-bold ${
                                    option.isCorrect
                                      ? "border-green-500 bg-green-500 text-white"
                                      : "border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400"
                                  }`}
                                >
                                  {String.fromCharCode(65 + index)}
                                </span>
                                <span
                                  className={`flex-1 ${
                                    option.isCorrect
                                      ? "text-green-800 dark:text-green-200 font-medium"
                                      : "text-gray-700 dark:text-gray-300"
                                  }`}
                                >
                                  {option.text}
                                </span>
                                {option.isCorrect && (
                                  <CheckCircleIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
                                )}
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-medium text-gray-900 dark:text-white">
                                  {responseCount} réponse
                                  {responseCount !== 1 ? "s" : ""} ({percentage}
                                  %)
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {currentQuestion.explanation && (
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                      <div className="flex items-start space-x-2">
                        <QuestionMarkCircleIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
                            Explication
                          </p>
                          <p className="text-sm text-blue-700 dark:text-blue-300">
                            {currentQuestion.explanation}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Classement */}
            {leaderboard.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                <div className="flex items-center justify-center space-x-2 mb-6">
                  <TrophyIcon className="h-6 w-6 text-yellow-500" />
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    Classement
                  </h3>
                </div>

                <div className="space-y-3">
                  {leaderboard.slice(0, 10).map((entry, index) => {
                    const isMe =
                      entry.id === user?.id ||
                      entry.name === (user?.firstName || user?.username);

                    return (
                      <div
                        key={entry.id}
                        className={`flex items-center justify-between p-3 rounded-lg ${
                          isMe
                            ? "bg-primary-50 dark:bg-primary-900/20 border-2 border-primary-200 dark:border-primary-800"
                            : index === 0
                            ? "bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800"
                            : "bg-gray-50 dark:bg-gray-700"
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <span
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                              index === 0
                                ? "bg-yellow-500 text-white"
                                : index === 1
                                ? "bg-gray-400 text-white"
                                : index === 2
                                ? "bg-orange-600 text-white"
                                : "bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300"
                            }`}
                          >
                            {entry.rank}
                          </span>
                          <div>
                            <div
                              className={`font-medium ${
                                isMe
                                  ? "text-primary-700 dark:text-primary-300"
                                  : "text-gray-900 dark:text-white"
                              }`}
                            >
                              {entry.name} {isMe && "(Vous)"}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <span
                            className={`text-lg font-bold ${
                              isMe
                                ? "text-primary-600 dark:text-primary-400"
                                : "text-gray-900 dark:text-white"
                            }`}
                          >
                            {entry.score} pts
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {sessionStatus === "active" && !currentQuestion && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
            <QuestionMarkCircleIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              En attente de la prochaine question
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Le formateur prépare la prochaine question...
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SessionPlay;
