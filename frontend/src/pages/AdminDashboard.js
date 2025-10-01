// frontend/src/pages/AdminDashboard.js
import { useState, useEffect } from "react";
import { useAuthStore } from "../stores/authStore";
import LoadingSpinner from "../components/common/LoadingSpinner";
import UserCreateModal from "../components/admin/UserCreateModal";
import UserDetailModal from "../components/admin/UserDetailModal";
import toast from "react-hot-toast";
import apiClient from "../services/api";
import {
  UserGroupIcon,
  PuzzlePieceIcon,
  ChartBarIcon,
  ServerStackIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  EyeIcon,
  TrashIcon,
  UserPlusIcon,
  Cog6ToothIcon,
  ArrowUpIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const AdminDashboard = () => {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [refreshing, setRefreshing] = useState(false);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);

  // États pour les données admin
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [systemHealth, setSystemHealth] = useState(null);
  const [activities, setActivities] = useState([]);

  // États pour les filtres et pagination
  const [userFilters, setUserFilters] = useState({
    page: 1,
    limit: 10,
    search: "",
    role: "",
    status: "",
  });
  const [usersPagination, setUsersPagination] = useState(null);

  // Vérifier si l'utilisateur est admin
  useEffect(() => {
    if (user?.role !== "admin") {
      toast.error("Accès refusé - Droits administrateur requis");
      return;
    }
    loadAllData();
  }, [user]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      await loadStats();
      if (activeTab === "users") await loadUsers();
      if (activeTab === "system") await loadSystemHealth();
      if (activeTab === "activity") await loadActivities();
    } catch (error) {
      console.error("Erreur lors du chargement:", error);
      toast.error("Erreur lors du chargement des données");
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await apiClient.get("/admin/stats");
      setStats(response.data);
    } catch (error) {
      console.error("Erreur stats:", error);
      throw error;
    }
  };

  const loadUsers = async () => {
    try {
      const response = await apiClient.get("/admin/users", {
        params: userFilters,
      });
      console.log("response", response);
      setUsers(response.data.users);
      setUsersPagination(response.data.pagination);
    } catch (error) {
      console.error("Erreur utilisateurs:", error);
      throw error;
    }
  };

  const loadSystemHealth = async () => {
    try {
      const response = await apiClient.get("/admin/health");
      setSystemHealth(response.data);
    } catch (error) {
      console.error("Erreur santé système:", error);
      throw error;
    }
  };

  const loadActivities = async () => {
    try {
      const response = await apiClient.get("/admin/activity");
      setActivities(response.data.activities);
    } catch (error) {
      console.error("Erreur activités:", error);
      throw error;
    }
  };

  // Recharger les données selon l'onglet actif
  useEffect(() => {
    if (user?.role === "admin" && !loading) {
      if (activeTab === "users") loadUsers();
      if (activeTab === "system") loadSystemHealth();
      if (activeTab === "activity") loadActivities();
    }
  }, [activeTab, userFilters]);

  const handleUserAction = async (userId, action) => {
    try {
      if (action === "view") {
        setSelectedUserId(userId);
        setShowDetailModal(true);
        return;
      }

      if (action === "delete") {
        if (
          !window.confirm(
            "Êtes-vous sûr de vouloir supprimer cet utilisateur ?"
          )
        ) {
          return;
        }
        await apiClient.delete(`/admin/users/${userId}`);
        toast.success("Utilisateur supprimé avec succès");
      } else if (action === "toggle") {
        const targetUser = users.find((u) => u.id === userId);
        await apiClient.put(`/admin/users/${userId}`, {
          isActive: !targetUser.isActive,
        });
        toast.success(
          `Utilisateur ${
            targetUser.isActive ? "désactivé" : "activé"
          } avec succès`
        );
      }
      await loadUsers();
    } catch (error) {
      console.error("Erreur action utilisateur:", error);
      toast.error(error.response?.data?.error || "Erreur lors de l'action");
    }
  };

  const handleSystemCleanup = async () => {
    if (!window.confirm("Nettoyer les sessions inactives ?")) return;

    try {
      setRefreshing(true);
      const response = await apiClient.post("/admin/system/cleanup");
      const total =
        response.data.deleted.completedSessions +
        response.data.deleted.abandonedSessions;
      toast.success(`Nettoyage effectué : ${total} sessions supprimées`);
      await loadStats();
    } catch (error) {
      console.error("Erreur nettoyage:", error);
      toast.error("Erreur lors du nettoyage");
    } finally {
      setRefreshing(false);
    }
  };

  const getStatusColor = (status) => {
    return status
      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
      : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
  };

  const getRoleBadge = (role) => {
    const badges = {
      admin: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      formateur:
        "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      etudiant:
        "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    };
    return (
      badges[role] ||
      "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
    );
  };

  const getActivityIcon = (type) => {
    const icons = {
      user_created: UserPlusIcon,
      quiz_created: PuzzlePieceIcon,
      session_created: ChartBarIcon,
    };
    return icons[type] || ClockIcon;
  };

  if (user?.role !== "admin") {
    return (
      <div className="text-center py-12">
        <ExclamationTriangleIcon className="h-16 w-16 text-red-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          Accès refusé
        </h3>
        <p className="text-gray-500 dark:text-gray-400">
          Vous n'avez pas les droits administrateur requis.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Modals */}
      <UserCreateModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onUserCreated={() => {
          loadUsers();
          loadStats();
        }}
      />
      <UserDetailModal
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedUserId(null);
        }}
        userId={selectedUserId}
      />

      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Cog6ToothIcon className="h-8 w-8 text-red-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Administration
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Gestion et surveillance de la plateforme
                </p>
              </div>
            </div>
            <button
              onClick={loadAllData}
              disabled={refreshing}
              className="inline-flex items-center px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-md disabled:opacity-50"
            >
              {refreshing ? "Actualisation..." : "Actualiser"}
            </button>
          </div>
        </div>

        {/* Onglets */}
        <div className="border-t border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex overflow-x-auto">
            {[
              { id: "overview", name: "Vue d'ensemble", icon: ChartBarIcon },
              { id: "users", name: "Utilisateurs", icon: UserGroupIcon },
              { id: "system", name: "Système", icon: ServerStackIcon },
              { id: "activity", name: "Activité", icon: ClockIcon },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`group relative min-w-0 flex-1 overflow-hidden py-4 px-4 text-sm font-medium text-center hover:bg-gray-50 dark:hover:bg-gray-700 focus:z-10 whitespace-nowrap ${
                  activeTab === tab.id
                    ? "text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400"
                    : "text-gray-500 dark:text-gray-400 border-b-2 border-transparent"
                }`}
              >
                <tab.icon className="h-5 w-5 mx-auto mb-1" />
                {tab.name}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Vue d'ensemble */}
      {activeTab === "overview" && stats && (
        <div className="space-y-6">
          {/* Statistiques principales */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <UserGroupIcon className="h-8 w-8 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Utilisateurs
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {stats.overview.totalUsers}
                  </p>
                  {stats.today.newUsers > 0 && (
                    <p className="text-xs text-green-600 flex items-center mt-1">
                      <ArrowUpIcon className="h-3 w-3 mr-1" />+
                      {stats.today.newUsers} aujourd'hui
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <PuzzlePieceIcon className="h-8 w-8 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Quiz
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {stats.overview.totalQuizzes}
                  </p>
                  {stats.today.newQuizzes > 0 && (
                    <p className="text-xs text-green-600 flex items-center mt-1">
                      <ArrowUpIcon className="h-3 w-3 mr-1" />+
                      {stats.today.newQuizzes} aujourd'hui
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <ChartBarIcon className="h-8 w-8 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Sessions
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {stats.overview.totalSessions}
                  </p>
                  {stats.today.newSessions > 0 && (
                    <p className="text-xs text-green-600 flex items-center mt-1">
                      <ArrowUpIcon className="h-3 w-3 mr-1" />+
                      {stats.today.newSessions} aujourd'hui
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <CheckCircleIcon className="h-8 w-8 text-green-500" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Actifs (30j)
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {stats.overview.activeUsers}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {Math.round(
                      (stats.overview.activeUsers / stats.overview.totalUsers) *
                        100
                    )}
                    % du total
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <ClockIcon className="h-8 w-8 text-yellow-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Sessions actives
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {stats.overview.activeSessions}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    En cours maintenant
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Répartition */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Utilisateurs par rôle
              </h3>
              <div className="space-y-3">
                {Object.entries(stats.breakdown.usersByRole).map(
                  ([role, count]) => (
                    <div
                      key={role}
                      className="flex items-center justify-between"
                    >
                      <span className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                        {role === "admin"
                          ? "Administrateurs"
                          : role === "formateur"
                          ? "Formateurs"
                          : "Étudiants"}
                      </span>
                      <div className="flex items-center space-x-2">
                        <div className="w-32 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              role === "admin"
                                ? "bg-red-600"
                                : role === "formateur"
                                ? "bg-blue-600"
                                : "bg-green-600"
                            }`}
                            style={{
                              width: `${
                                (count / stats.overview.totalUsers) * 100
                              }%`,
                            }}
                          />
                        </div>
                        <span className="text-sm font-medium text-gray-900 dark:text-white w-12 text-right">
                          {count}
                        </span>
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Quiz par difficulté
              </h3>
              <div className="space-y-3">
                {Object.entries(stats.breakdown.quizzesByDifficulty).map(
                  ([difficulty, count]) => (
                    <div
                      key={difficulty}
                      className="flex items-center justify-between"
                    >
                      <span className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                        {difficulty}
                      </span>
                      <div className="flex items-center space-x-2">
                        <div className="w-32 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              difficulty === "facile"
                                ? "bg-green-600"
                                : difficulty === "moyen"
                                ? "bg-yellow-600"
                                : "bg-red-600"
                            }`}
                            style={{
                              width: `${
                                (count / stats.overview.totalQuizzes) * 100
                              }%`,
                            }}
                          />
                        </div>
                        <span className="text-sm font-medium text-gray-900 dark:text-white w-12 text-right">
                          {count}
                        </span>
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Gestion des utilisateurs */}
      {activeTab === "users" && (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Gestion des utilisateurs
              </h3>

              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-md"
              >
                <UserPlusIcon className="h-4 w-4 mr-2" />
                Nouvel utilisateur
              </button>
            </div>

            {/* Filtres */}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher..."
                  value={userFilters.search}
                  onChange={(e) =>
                    setUserFilters({
                      ...userFilters,
                      search: e.target.value,
                      page: 1,
                    })
                  }
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <select
                value={userFilters.role}
                onChange={(e) =>
                  setUserFilters({
                    ...userFilters,
                    role: e.target.value,
                    page: 1,
                  })
                }
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Tous les rôles</option>
                <option value="admin">Admin</option>
                <option value="formateur">Formateur</option>
                <option value="etudiant">Étudiant</option>
              </select>
              <select
                value={userFilters.status}
                onChange={(e) =>
                  setUserFilters({
                    ...userFilters,
                    status: e.target.value,
                    page: 1,
                  })
                }
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Tous les statuts</option>
                <option value="active">Actifs</option>
                <option value="inactive">Inactifs</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Utilisateur
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Rôle
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Statut
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Inscrit le
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {users.map((userItem) => (
                  <tr
                    key={userItem.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center">
                          <span className="text-primary-600 dark:text-primary-400 font-medium text-sm">
                            {userItem.firstName?.[0] ||
                              userItem.username?.[0]?.toUpperCase()}
                          </span>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {userItem.firstName && userItem.lastName
                              ? `${userItem.firstName} ${userItem.lastName}`
                              : userItem.username}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {userItem.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadge(
                          userItem.role
                        )}`}
                      >
                        {userItem.role === "admin"
                          ? "Admin"
                          : userItem.role === "formateur"
                          ? "Formateur"
                          : "Étudiant"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                          userItem.isActive
                        )}`}
                      >
                        {userItem.isActive ? "Actif" : "Inactif"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {format(new Date(userItem.createdAt), "dd/MM/yyyy", {
                        locale: fr,
                      })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleUserAction(userItem.id, "view")}
                          className="text-primary-600 hover:text-primary-500 dark:text-primary-400"
                          title="Voir détails"
                        >
                          <EyeIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() =>
                            handleUserAction(userItem.id, "toggle")
                          }
                          className={`${
                            userItem.isActive
                              ? "text-yellow-600 hover:text-yellow-500"
                              : "text-green-600 hover:text-green-500"
                          } dark:text-yellow-400`}
                          title={userItem.isActive ? "Désactiver" : "Activer"}
                        >
                          {userItem.isActive ? (
                            <XCircleIcon className="h-5 w-5" />
                          ) : (
                            <CheckCircleIcon className="h-5 w-5" />
                          )}
                        </button>
                        <button
                          onClick={() =>
                            handleUserAction(userItem.id, "delete")
                          }
                          className="text-red-600 hover:text-red-500 dark:text-red-400"
                          title="Supprimer"
                          disabled={userItem.id === user.id}
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {usersPagination && usersPagination.totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Page {usersPagination.page} sur {usersPagination.totalPages} (
                  {usersPagination.total} utilisateurs)
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() =>
                      setUserFilters({
                        ...userFilters,
                        page: userFilters.page - 1,
                      })
                    }
                    disabled={userFilters.page === 1}
                    className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Précédent
                  </button>
                  <button
                    onClick={() =>
                      setUserFilters({
                        ...userFilters,
                        page: userFilters.page + 1,
                      })
                    }
                    disabled={userFilters.page >= usersPagination.totalPages}
                    className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Suivant
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Santé du système */}
      {activeTab === "system" && systemHealth && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              État du système
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div
                  className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${
                    systemHealth.status === "healthy"
                      ? "bg-green-100 dark:bg-green-900"
                      : "bg-red-100 dark:bg-red-900"
                  }`}
                >
                  {systemHealth.status === "healthy" ? (
                    <CheckCircleIcon className="h-8 w-8 text-green-600 dark:text-green-400" />
                  ) : (
                    <XCircleIcon className="h-8 w-8 text-red-600 dark:text-red-400" />
                  )}
                </div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  État général
                </p>
                <p className="text-lg font-bold text-gray-900 dark:text-white capitalize">
                  {systemHealth.status === "healthy"
                    ? "Opérationnel"
                    : "Problème"}
                </p>
              </div>

              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 bg-blue-100 dark:bg-blue-900">
                  <ClockIcon className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Temps de fonctionnement
                </p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  {systemHealth.uptime.formatted}
                </p>
              </div>

              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 bg-purple-100 dark:bg-purple-900">
                  <ServerStackIcon className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                </div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Mémoire utilisée
                </p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  {systemHealth.memory.percentage}%
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {systemHealth.memory.heapUsed}MB /{" "}
                  {systemHealth.memory.heapTotal}MB
                </p>
              </div>
            </div>
          </div>

          {/* Actions système */}
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Actions système
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={handleSystemCleanup}
                disabled={refreshing}
                className="p-4 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-left disabled:opacity-50"
              >
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                  Nettoyer les sessions
                </h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Supprimer les sessions inactives et terminées
                </p>
              </button>

              <button
                onClick={() => loadSystemHealth()}
                className="p-4 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-left"
              >
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                  Actualiser l'état
                </h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Recharger les métriques système
                </p>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Journal d'activité */}
      {activeTab === "activity" && (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Journal d'activité
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Activités récentes sur la plateforme
            </p>
          </div>

          <div className="p-6">
            <div className="flow-root">
              <ul className="-mb-8">
                {activities.map((activity, index) => {
                  const IconComponent = getActivityIcon(activity.type);
                  return (
                    <li key={activity.id}>
                      <div className="relative pb-8">
                        {index !== activities.length - 1 && (
                          <span
                            className="absolute top-5 left-5 -ml-px h-full w-0.5 bg-gray-200 dark:bg-gray-700"
                            aria-hidden="true"
                          />
                        )}
                        <div className="relative flex items-start space-x-3">
                          <div>
                            <div
                              className={`h-10 w-10 rounded-full flex items-center justify-center ring-8 ring-white dark:ring-gray-800 ${
                                activity.type === "user_created"
                                  ? "bg-blue-500"
                                  : activity.type === "quiz_created"
                                  ? "bg-green-500"
                                  : "bg-purple-500"
                              }`}
                            >
                              <IconComponent className="h-5 w-5 text-white" />
                            </div>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div>
                              <p className="text-sm text-gray-900 dark:text-white">
                                {activity.description}
                              </p>
                              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                par {activity.user} •{" "}
                                {format(
                                  new Date(activity.timestamp),
                                  "dd/MM/yyyy à HH:mm",
                                  {
                                    locale: fr,
                                  }
                                )}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            {activities.length === 0 && (
              <div className="text-center py-12">
                <ClockIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">
                  Aucune activité récente
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
