// frontend/src/pages/session/ParticipantResults.js

import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  ChartBarIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  TrophyIcon,
  UsersIcon,
  ArrowLeftIcon,
  ShareIcon,
} from "@heroicons/react/24/outline";
import toast from "react-hot-toast";
import LoadingSpinner from "../../components/common/LoadingSpinner";
// CORRECTION: Importer sessionService au lieu d'apiClient
import { sessionService } from "../../services/api";

const ParticipantResults = () => {
  const { sessionId, participantId } = useParams();
  const navigate = useNavigate();
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchParticipantResults();
  }, [sessionId, participantId]);

  const fetchParticipantResults = async () => {
    try {
      setLoading(true);

      // CORRECTION: Essayer d'abord l'API spécifique, puis fallback sur l'API générale
      let response;
      let data;

      try {
        // Tentative avec l'API spécifique
        response = await fetch(
          `/api/session/${sessionId}/participant/${participantId}/results`
        );

        if (response.ok) {
          data = await response.json();
        } else if (response.status === 404 || response.status === 500) {
          // L'endpoint n'existe pas, utiliser l'API générale
          throw new Error("Endpoint spécifique non disponible");
        } else {
          throw new Error(`Erreur HTTP: ${response.status}`);
        }
      } catch (apiError) {
        console.log(
          "API spécifique indisponible, utilisation de l'API générale"
        );

        // CORRECTION: Utiliser sessionService.getSession au lieu d'apiClient.getSession
        const sessionResponse = await sessionService.getSession(sessionId);
        const sessionData = sessionResponse.session;

        if (!sessionData) {
          throw new Error("Session non trouvée");
        }

        // Trouver le participant
        const participant = sessionData.participants?.find(
          (p) =>
            p.id === participantId ||
            p.id.includes(participantId) ||
            participantId.includes(p.id)
        );

        if (!participant) {
          throw new Error("Participant non trouvé dans cette session");
        }

        // Reconstruire les résultats du participant
        const responses = sessionData.responses || {};
        const participantResponses = [];

        Object.keys(responses).forEach((questionId, questionIndex) => {
          const questionResponses = responses[questionId] || [];
          const participantResponse = questionResponses.find(
            (r) => r.participantId === participant.id
          );

          if (participantResponse) {
            // Trouver la question correspondante
            const question = sessionData.quiz?.questions?.find(
              (q) => q.id === questionId || q.order === questionIndex + 1
            ) || { question: `Question ${questionIndex + 1}` };

            participantResponses.push({
              questionId: questionId,
              questionText: question.question,
              answer: participantResponse.answer,
              isCorrect: participantResponse.isCorrect || false,
              points: participantResponse.points || 0,
              timeSpent: participantResponse.timeSpent || 0,
              submittedAt: participantResponse.submittedAt,
            });
          }
        });

        // Calculer les statistiques
        const totalQuestions = sessionData.quiz?.questions?.length || 0;
        const correctAnswers = participantResponses.filter(
          (r) => r.isCorrect
        ).length;
        const totalTimeSpent = participantResponses.reduce(
          (sum, r) => sum + (r.timeSpent || 0),
          0
        );
        const accuracyRate =
          totalQuestions > 0
            ? Math.round((correctAnswers / totalQuestions) * 100)
            : 0;

        // Calculer le rang
        const participants = sessionData.participants || [];
        const sortedParticipants = participants
          .filter((p) => typeof p.score === "number")
          .sort((a, b) => (b.score || 0) - (a.score || 0));

        const rank =
          sortedParticipants.findIndex((p) => p.id === participant.id) + 1;

        // Reconstituer la structure attendue
        data = {
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
          },
          responses: participantResponses,
          rank: rank > 0 ? rank : null,
          session: {
            id: sessionData.id,
            code: sessionData.code,
            title: sessionData.title,
          },
        };
      }

      setResults(data);
    } catch (error) {
      console.error("Erreur lors de la récupération des résultats:", error);
      setError(error.message);
      toast.error("Erreur lors du chargement des résultats");
    } finally {
      setLoading(false);
    }
  };

  // ... rest of the component code remains exactly the same ...
  const handleShare = async () => {
    const shareData = {
      title: `Résultats du quiz`,
      text: `J'ai obtenu ${results?.participant.score} points avec ${results?.participant.accuracyRate}% de bonnes réponses !`,
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        // Fallback: copier dans le presse-papier
        await navigator.clipboard.writeText(
          shareData.text + "\n" + shareData.url
        );
        toast.success("Lien copié dans le presse-papier !");
      }
    } catch (error) {
      console.error("Erreur lors du partage:", error);
      toast.error("Impossible de partager les résultats");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (error || !results) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <XCircleIcon className="mx-auto h-12 w-12 text-red-400" />
          <h3 className="mt-4 text-sm font-medium text-gray-900 dark:text-white">
            Erreur lors du chargement
          </h3>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {error || "Résultats non trouvés"}
          </p>
          <button
            onClick={() => navigate(-1)}
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700"
          >
            <ArrowLeftIcon className="w-4 h-4 mr-2" />
            Retour
          </button>
        </div>
      </div>
    );
  }

  const { participant, responses, rank } = results;
  const performance = participant.accuracyRate;
  const timeEfficiency = participant.averageTimePerQuestion;

  // Déterminer le niveau de performance
  let performanceLevel = "Peut mieux faire";
  let performanceColor = "text-red-600";
  let performanceIcon = XCircleIcon;

  if (performance >= 80) {
    performanceLevel = "Excellent !";
    performanceColor = "text-green-600";
    performanceIcon = CheckCircleIcon;
  } else if (performance >= 60) {
    performanceLevel = "Bien joué !";
    performanceColor = "text-blue-600";
    performanceIcon = CheckCircleIcon;
  } else if (performance >= 40) {
    performanceLevel = "Pas mal !";
    performanceColor = "text-yellow-600";
    performanceIcon = CheckCircleIcon;
  }

  const PerformanceIcon = performanceIcon;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-6">
            <div className="flex items-center">
              <button
                onClick={() => navigate(-1)}
                className="mr-4 p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <ArrowLeftIcon className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Mes Résultats
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {participant.name} • Session terminée
                </p>
              </div>
            </div>
            <button
              onClick={handleShare}
              className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <ShareIcon className="w-4 h-4 mr-2" />
              Partager
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Résumé général */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8">
          <div className="flex items-center justify-center mb-6">
            <div className="text-center">
              <PerformanceIcon
                className={`w-16 h-16 mx-auto mb-4 ${performanceColor}`}
              />
              <h2 className={`text-3xl font-bold ${performanceColor} mb-2`}>
                {performanceLevel}
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Vous avez terminé le quiz avec succès
              </p>
            </div>
          </div>

          {/* Stats principales */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary-600 mb-1">
                {participant.score}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Points obtenus
              </div>
            </div>

            <div className="text-center">
              <div className="text-3xl font-bold text-green-600 mb-1">
                {participant.accuracyRate}%
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Taux de réussite
              </div>
            </div>

            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600 mb-1">
                {rank || "N/A"}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Classement
              </div>
            </div>

            <div className="text-center">
              <div className="text-3xl font-bold text-orange-600 mb-1">
                {Math.round(participant.totalTimeSpent / 60)}min
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Temps total
              </div>
            </div>
          </div>
        </div>

        {/* Statistiques détaillées */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Performance */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center mb-4">
              <ChartBarIcon className="w-5 h-5 text-primary-600 mr-2" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Performance
              </h3>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Réponses correctes
                </span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {participant.correctAnswers}/{participant.totalQuestions}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Taux de réussite
                </span>
                <span className="text-sm font-medium text-green-600">
                  {participant.accuracyRate}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-green-500 to-green-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${participant.accuracyRate}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Temps */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center mb-4">
              <ClockIcon className="w-5 h-5 text-orange-600 mr-2" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Temps
              </h3>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Temps total
                </span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {Math.round(participant.totalTimeSpent / 60)}min{" "}
                  {participant.totalTimeSpent % 60}s
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Moyenne par question
                </span>
                <span className="text-sm font-medium text-orange-600">
                  {participant.averageTimePerQuestion}s
                </span>
              </div>
            </div>
          </div>

          {/* Classement */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center mb-4">
              <TrophyIcon className="w-5 h-5 text-yellow-600 mr-2" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Classement
              </h3>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Position
                </span>
                <span className="text-2xl font-bold text-yellow-600">
                  #{rank || "N/A"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Score
                </span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {participant.score} pts
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Détail des réponses */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Détail de vos réponses
            </h3>
          </div>

          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {responses.map((response, index) => (
              <div key={response.questionId} className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                      Question {index + 1}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Votre réponse:{" "}
                      <span className="font-medium">{response.answer}</span>
                    </p>
                  </div>

                  <div className="flex items-center space-x-4 ml-4">
                    {/* Temps */}
                    <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                      <ClockIcon className="w-4 h-4 mr-1" />
                      {response.timeSpent}s
                    </div>

                    {/* Points */}
                    <div className="flex items-center text-sm font-medium">
                      <span
                        className={
                          response.isCorrect ? "text-green-600" : "text-red-600"
                        }
                      >
                        {response.points} pts
                      </span>
                    </div>

                    {/* Statut */}
                    <div className="flex items-center">
                      {response.isCorrect ? (
                        <CheckCircleIcon className="w-5 h-5 text-green-500" />
                      ) : (
                        <XCircleIcon className="w-5 h-5 text-red-500" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Barre de progression du temps */}
                <div className="mt-3">
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
                    <div
                      className={`h-1 rounded-full transition-all duration-300 ${
                        response.timeSpent <= 30
                          ? "bg-green-500"
                          : response.timeSpent <= 60
                          ? "bg-yellow-500"
                          : "bg-red-500"
                      }`}
                      style={{
                        width: `${Math.min(
                          (response.timeSpent / 120) * 100,
                          100
                        )}%`,
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => navigate("/dashboard")}
            className="inline-flex items-center justify-center px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Retour au tableau de bord
          </button>

          <button
            onClick={handleShare}
            className="inline-flex items-center justify-center px-6 py-3 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
          >
            <ShareIcon className="w-4 h-4 mr-2" />
            Partager mes résultats
          </button>
        </div>
      </div>
    </div>
  );
};

export default ParticipantResults;
