// frontend/src/pages/participant/ParticipantHistory.js

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  ChartBarIcon,
  ClockIcon,
  TrophyIcon,
  CalendarIcon,
  EyeIcon,
  CheckCircleIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import toast from "react-hot-toast";
import { useAuthStore } from "../../stores/authStore";
import LoadingSpinner from "../../components/common/LoadingSpinner";

const ParticipantHistory = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (user) {
      fetchParticipantHistory();
    }
  }, [user]);

  const fetchParticipantHistory = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/session/participant/${user.id}/history`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Impossible de récupérer l'historique");
      }

      const data = await response.json();
      console.log("data", data);
      //   setHistory(data.history || []);
      //   setStats(data.stats || {});
    } catch (error) {
      console.error("Erreur lors de la récupération de l'historique:", error);
      setError(error.message);
      toast.error("Erreur lors du chargement de l'historique");
    } finally {
      setLoading(false);
    }
  };

  const handleViewResults = (sessionId, participantId) => {
    navigate(`/session/${sessionId}/participant/${participantId}/results`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <XCircleIcon className="mx-auto h-12 w-12 text-red-400" />
          <h3 className="mt-4 text-sm font-medium text-gray-900 dark:text-white">
            Erreur lors du chargement
          </h3>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {error}
          </p>
          <button
            onClick={fetchParticipantHistory}
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Mon Historique
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Consultez vos participations passées et vos performances
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {stats && (
          <>
            {/* Statistiques globales */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                Vos Statistiques Globales
              </h2>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary-600 mb-1">
                    {stats.totalSessions}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Sessions participées
                  </div>
                </div>

                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600 mb-1">
                    {stats.averageScore}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Score moyen
                  </div>
                </div>

                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600 mb-1">
                    {stats.averageAccuracy}%
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Précision moyenne
                  </div>
                </div>

                <div className="text-center">
                  <div className="text-3xl font-bold text-yellow-600 mb-1">
                    {stats.bestScore}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Meilleur score
                  </div>
                </div>
              </div>
            </div>

            {/* Graphiques de performance */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Évolution des Scores
                </h3>
                <div className="space-y-3">
                  {history
                    .slice(0, 5)
                    .reverse()
                    .map((session, index) => (
                      <div
                        key={session.sessionId}
                        className="flex items-center justify-between"
                      >
                        <div className="text-sm text-gray-600 dark:text-gray-300">
                          {format(new Date(session.endedAt), "dd/MM", {
                            locale: fr,
                          })}
                        </div>
                        <div className="flex-1 mx-4">
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div
                              className="bg-gradient-to-r from-primary-500 to-primary-600 h-2 rounded-full"
                              style={{
                                width: `${Math.min(
                                  (session.score / stats.bestScore) * 100,
                                  100
                                )}%`,
                              }}
                            ></div>
                          </div>
                        </div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {session.score}
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Répartition des Performances
                </h3>
                <div className="space-y-3">
                  {[
                    {
                      label: "Excellent (≥80%)",
                      count: history.filter((s) => s.accuracyRate >= 80).length,
                      color: "bg-green-500",
                    },
                    {
                      label: "Bien (60-79%)",
                      count: history.filter(
                        (s) => s.accuracyRate >= 60 && s.accuracyRate < 80
                      ).length,
                      color: "bg-blue-500",
                    },
                    {
                      label: "Moyen (40-59%)",
                      count: history.filter(
                        (s) => s.accuracyRate >= 40 && s.accuracyRate < 60
                      ).length,
                      color: "bg-yellow-500",
                    },
                    {
                      label: "À améliorer (<40%)",
                      count: history.filter((s) => s.accuracyRate < 40).length,
                      color: "bg-red-500",
                    },
                  ].map((category) => (
                    <div
                      key={category.label}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center">
                        <div
                          className={`w-3 h-3 rounded-full ${category.color} mr-3`}
                        ></div>
                        <span className="text-sm text-gray-600 dark:text-gray-300">
                          {category.label}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {category.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Liste des sessions */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Historique des Sessions
            </h3>
          </div>

          {history.length === 0 ? (
            <div className="p-12 text-center">
              <ChartBarIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-4 text-sm font-medium text-gray-900 dark:text-white">
                Aucune participation
              </h3>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Vous n'avez encore participé à aucun quiz.
              </p>
              <button
                onClick={() => navigate("/join")}
                className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700"
              >
                Rejoindre un quiz
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {history.map((session) => (
                <div
                  key={session.sessionId}
                  className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h4 className="text-base font-medium text-gray-900 dark:text-white">
                          {session.quizTitle || session.sessionTitle}
                        </h4>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                          {session.sessionCode}
                        </span>
                      </div>

                      <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                        <div className="flex items-center">
                          <CalendarIcon className="w-4 h-4 mr-1" />
                          {format(new Date(session.endedAt), "dd MMMM yyyy", {
                            locale: fr,
                          })}
                        </div>

                        <div className="flex items-center">
                          <TrophyIcon className="w-4 h-4 mr-1" />
                          Position #{session.rank || "N/A"}
                        </div>

                        <div className="flex items-center">
                          <ClockIcon className="w-4 h-4 mr-1" />
                          {Math.round(session.totalTimeSpent / 60)}min
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-6">
                      {/* Score */}
                      <div className="text-center">
                        <div className="text-2xl font-bold text-primary-600">
                          {session.score}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          points
                        </div>
                      </div>

                      {/* Précision */}
                      <div className="text-center">
                        <div
                          className={`text-2xl font-bold ${
                            session.accuracyRate >= 80
                              ? "text-green-600"
                              : session.accuracyRate >= 60
                              ? "text-blue-600"
                              : session.accuracyRate >= 40
                              ? "text-yellow-600"
                              : "text-red-600"
                          }`}
                        >
                          {session.accuracyRate}%
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          précision
                        </div>
                      </div>

                      {/* Réponses correctes */}
                      <div className="text-center">
                        <div className="text-lg font-medium text-gray-900 dark:text-white">
                          {session.correctAnswers}/{session.totalQuestions}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          correct
                        </div>
                      </div>

                      {/* Action */}
                      <button
                        onClick={() =>
                          handleViewResults(session.sessionId, user.id)
                        }
                        className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        <EyeIcon className="w-4 h-4 mr-1" />
                        Voir
                      </button>
                    </div>
                  </div>

                  {/* Barre de progression de la précision */}
                  <div className="mt-4">
                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                      <span>Précision</span>
                      <span>{session.accuracyRate}%</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${
                          session.accuracyRate >= 80
                            ? "bg-green-500"
                            : session.accuracyRate >= 60
                            ? "bg-blue-500"
                            : session.accuracyRate >= 40
                            ? "bg-yellow-500"
                            : "bg-red-500"
                        }`}
                        style={{ width: `${session.accuracyRate}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action pour rejoindre un nouveau quiz */}
        <div className="mt-8 text-center">
          <button
            onClick={() => navigate("/join")}
            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700"
          >
            Participer à un nouveau quiz
          </button>
        </div>
      </div>
    </div>
  );
};

export default ParticipantHistory;
