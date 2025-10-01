// Page de liste des sessions - frontend/src/pages/session/SessionsList.js

import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";
import { sessionService } from "../../services/api";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import toast from "react-hot-toast";
import {
  PlusIcon,
  MagnifyingGlassIcon,
  PlayIcon,
  PauseIcon,
  StopIcon,
  EyeIcon,
  TrashIcon,
  UsersIcon,
  ClockIcon,
  FunnelIcon,
} from "@heroicons/react/24/outline";

const SessionsList = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();

  // États principaux
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(
    searchParams.get("search") || ""
  );
  const [statusFilter, setStatusFilter] = useState(
    searchParams.get("status") || "all"
  );
  const [currentPage, setCurrentPage] = useState(
    parseInt(searchParams.get("page")) || 1
  );
  const [totalPages, setTotalPages] = useState(1);
  const [totalSessions, setTotalSessions] = useState(0);

  // Charger les sessions
  const loadSessions = async (page = 1, search = "", status = "all") => {
    try {
      setLoading(true);

      const params = {
        page,
        limit: 12,
        my: "true", // Mes sessions seulement
      };

      if (search.trim()) {
        params.search = search.trim();
      }

      if (status !== "all") {
        params.status = status;
      }

      const response = await sessionService.getSessions(params);

      setSessions(response.sessions || []);
      setTotalPages(response.pagination?.pages || 1);
      setTotalSessions(response.pagination?.total || 0);

      // Mettre à jour l'URL
      const newSearchParams = new URLSearchParams();
      if (search) newSearchParams.set("search", search);
      if (status !== "all") newSearchParams.set("status", status);
      if (page > 1) newSearchParams.set("page", page.toString());

      setSearchParams(newSearchParams);
    } catch (error) {
      console.error("Erreur lors du chargement des sessions:", error);
      toast.error("Erreur lors du chargement des sessions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions(currentPage, searchTerm, statusFilter);
  }, [currentPage, searchTerm, statusFilter]);

  // Gestionnaires d'événements
  const handleSearch = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleStatusFilter = (status) => {
    setStatusFilter(status);
    setCurrentPage(1);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDeleteSession = async (sessionId, sessionTitle) => {
    if (
      !window.confirm(
        `Êtes-vous sûr de vouloir supprimer la session "${sessionTitle}" ?`
      )
    ) {
      return;
    }

    try {
      await sessionService.deleteSession(sessionId);
      toast.success("Session supprimée avec succès");
      loadSessions(currentPage, searchTerm, statusFilter);
    } catch (error) {
      console.error("Erreur lors de la suppression:", error);
      toast.error("Erreur lors de la suppression de la session");
    }
  };

  // Utilitaires
  const getStatusColor = (status) => {
    switch (status) {
      case "waiting":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "active":
        return "bg-green-100 text-green-800 border-green-200";
      case "paused":
        return "bg-orange-100 text-orange-800 border-orange-200";
      case "finished":
        return "bg-gray-100 text-gray-800 border-gray-200";
      case "cancelled":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case "waiting":
        return "En attente";
      case "active":
        return "En cours";
      case "paused":
        return "En pause";
      case "finished":
        return "Terminée";
      case "cancelled":
        return "Annulée";
      default:
        return status;
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDuration = (startDate, endDate) => {
    if (!startDate) return "N/A";

    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : new Date();
    const duration = end - start;

    const minutes = Math.floor(duration / (1000 * 60));
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}min`;
    }
    return `${minutes}min`;
  };

  if (loading && sessions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="xl" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            Chargement des sessions...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="md:flex md:items-center md:justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  Mes Sessions
                </h1>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  Gérez vos sessions de quiz ({totalSessions} session
                  {totalSessions !== 1 ? "s" : ""})
                </p>
              </div>
              <div className="mt-4 md:mt-0">
                <Link
                  to="/quiz"
                  className="inline-flex items-center px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-md hover:bg-primary-700 transition-colors"
                >
                  <PlusIcon className="h-5 w-5 mr-2" />
                  Créer une session
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filtres et recherche */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Recherche */}
            <div className="lg:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Rechercher une session
              </label>
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={handleSearch}
                  placeholder="Nom de session, quiz, code..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>

            {/* Filtre par statut */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <FunnelIcon className="inline h-4 w-4 mr-1" />
                Filtrer par statut
              </label>
              <select
                value={statusFilter}
                onChange={(e) => handleStatusFilter(e.target.value)}
                className="w-full py-2 px-3 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="all">Tous les statuts</option>
                <option value="waiting">En attente</option>
                <option value="active">En cours</option>
                <option value="paused">En pause</option>
                <option value="finished">Terminées</option>
                <option value="cancelled">Annulées</option>
              </select>
            </div>
          </div>
        </div>

        {/* Liste des sessions */}
        {sessions.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
            <UsersIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
              Aucune session trouvée
            </h3>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              {searchTerm || statusFilter !== "all"
                ? "Essayez de modifier vos critères de recherche."
                : "Créez votre première session à partir d'un quiz."}
            </p>
            {!searchTerm && statusFilter === "all" && (
              <Link
                to="/quiz"
                className="mt-4 inline-flex items-center px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-md hover:bg-primary-700 transition-colors"
              >
                <PlusIcon className="h-5 w-5 mr-2" />
                Créer une session
              </Link>
            )}
          </div>
        ) : (
          <>
            {/* Grille des sessions */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-md transition-shadow border border-gray-200 dark:border-gray-700"
                >
                  <div className="p-6">
                    {/* Header avec statut */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                          {session.title}
                        </h3>
                        {session.quiz && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                            {session.quiz.title}
                          </p>
                        )}
                      </div>
                      <span
                        className={`ml-2 px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(
                          session.status
                        )}`}
                      >
                        {getStatusText(session.status)}
                      </span>
                    </div>

                    {/* Code de session */}
                    <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          Code:
                        </span>
                        <span className="font-mono font-bold text-lg text-primary-600 dark:text-primary-400">
                          {session.code}
                        </span>
                      </div>
                    </div>

                    {/* Statistiques */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="text-center">
                        <div className="flex items-center justify-center mb-1">
                          <UsersIcon className="h-5 w-5 text-gray-400 mr-1" />
                          <span className="text-2xl font-bold text-gray-900 dark:text-white">
                            {session.participantCount || 0}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          Participants
                        </p>
                      </div>

                      <div className="text-center">
                        <div className="flex items-center justify-center mb-1">
                          <ClockIcon className="h-5 w-5 text-gray-400 mr-1" />
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {session.startedAt
                              ? formatDuration(
                                  session.startedAt,
                                  session.endedAt
                                )
                              : "N/A"}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          Durée
                        </p>
                      </div>
                    </div>

                    {/* Dates */}
                    <div className="space-y-2 mb-6">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">
                          Créée:
                        </span>
                        <span className="text-gray-900 dark:text-white">
                          {formatDate(session.createdAt)}
                        </span>
                      </div>

                      {session.startedAt && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">
                            Démarrée:
                          </span>
                          <span className="text-gray-900 dark:text-white">
                            {formatDate(session.startedAt)}
                          </span>
                        </div>
                      )}

                      {session.endedAt && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">
                            Terminée:
                          </span>
                          <span className="text-gray-900 dark:text-white">
                            {formatDate(session.endedAt)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex space-x-2">
                      {/* Gérer/Voir */}
                      {session.status === "waiting" ||
                      session.status === "active" ||
                      session.status === "paused" ? (
                        <Link
                          to={`/session/${session.id}/host`}
                          className="flex-1 inline-flex items-center justify-center px-3 py-2 bg-primary-600 text-white text-sm font-medium rounded-md hover:bg-primary-700 transition-colors"
                        >
                          {session.status === "active" ? (
                            <>
                              <PlayIcon className="h-4 w-4 mr-1" />
                              Gérer
                            </>
                          ) : session.status === "paused" ? (
                            <>
                              <PauseIcon className="h-4 w-4 mr-1" />
                              Reprendre
                            </>
                          ) : (
                            <>
                              <PlayIcon className="h-4 w-4 mr-1" />
                              Démarrer
                            </>
                          )}
                        </Link>
                      ) : (
                        <Link
                          to={`/session/${session.id}/results`}
                          className="flex-1 inline-flex items-center justify-center px-3 py-2 bg-gray-600 text-white text-sm font-medium rounded-md hover:bg-gray-700 transition-colors"
                        >
                          <EyeIcon className="h-4 w-4 mr-1" />
                          Résultats
                        </Link>
                      )}

                      {/* Supprimer */}
                      <button
                        onClick={() =>
                          handleDeleteSession(session.id, session.title)
                        }
                        disabled={session.status === "active"}
                        className="px-3 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        title={
                          session.status === "active"
                            ? "Impossible de supprimer une session active"
                            : "Supprimer la session"
                        }
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Page {currentPage} sur {totalPages} ({totalSessions} session
                    {totalSessions !== 1 ? "s" : ""} au total)
                  </div>

                  <div className="flex space-x-2">
                    {/* Bouton précédent */}
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage <= 1}
                      className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-600"
                    >
                      Précédent
                    </button>

                    {/* Numéros de pages */}
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }

                      return (
                        <button
                          key={pageNum}
                          onClick={() => handlePageChange(pageNum)}
                          className={`px-3 py-2 text-sm font-medium rounded-md ${
                            pageNum === currentPage
                              ? "bg-primary-600 text-white"
                              : "text-gray-500 bg-white border border-gray-300 hover:bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-600"
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}

                    {/* Bouton suivant */}
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage >= totalPages}
                      className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-600"
                    >
                      Suivant
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default SessionsList;
