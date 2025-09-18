import { useState, useEffect } from "react";
import { useAuthStore } from "../stores/authStore";
import LoadingSpinner from "../components/common/LoadingSpinner";
import toast from "react-hot-toast";
import {
  UserGroupIcon,
  PuzzlePieceIcon,
  ChartBarIcon,
  ServerStackIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  TrophyIcon,
  EyeIcon,
  TrashIcon,
  UserPlusIcon,
  Cog6ToothIcon,
} from "@heroicons/react/24/outline";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const AdminDashboard = () => {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  // États pour les données admin
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalQuizzes: 0,
    totalSessions: 0,
    activeUsers: 0,
    activeSessions: 0,
  });

  const [recentUsers, setRecentUsers] = useState([]);
  const [systemHealth, setSystemHealth] = useState({
    status: "healthy",
    uptime: 0,
    memoryUsage: 0,
    diskUsage: 0,
  });
  const [recentActivity, setRecentActivity] = useState([]);

  // Vérifier si l'utilisateur est admin
  useEffect(() => {
    if (user?.role !== "admin") {
      toast.error("Accès refusé - Droits administrateur requis");
      return;
    }
    loadAdminData();
  }, [user]);

  const loadAdminData = async () => {
    try {
      setLoading(true);
      // Simuler le chargement des données admin
      // En réalité, on ferait des appels API vers des endpoints admin

      // Statistiques générales
      setStats({
        totalUsers: 1247,
        totalQuizzes: 3891,
        totalSessions: 15672,
        activeUsers: 89,
        activeSessions: 12,
      });

      // Utilisateurs récents
      setRecentUsers([
        {
          id: 1,
          name: "Marie Dubois",
          email: "marie@exemple.com",
          role: "etudiant",
          createdAt: new Date(),
          status: "active",
        },
        {
          id: 2,
          name: "Pierre Martin",
          email: "pierre@exemple.com",
          role: "formateur",
          createdAt: new Date(),
          status: "active",
        },
        {
          id: 3,
          name: "Sophie Laurent",
          email: "sophie@exemple.com",
          role: "etudiant",
          createdAt: new Date(),
          status: "pending",
        },
      ]);

      // État du système
      setSystemHealth({
        status: "healthy",
        uptime: 15.2, // jours
        memoryUsage: 68, // %
        diskUsage: 45, // %
      });

      // Activité récente
      setRecentActivity([
        {
          id: 1,
          type: "user_created",
          user: "Marie Dubois",
          description: "Nouvel utilisateur inscrit",
          timestamp: new Date(),
        },
        {
          id: 2,
          type: "quiz_created",
          user: "Pierre Martin",
          description: "Nouveau quiz créé: Histoire de France",
          timestamp: new Date(),
        },
        {
          id: 3,
          type: "session_started",
          user: "Sophie Laurent",
          description: "Session démarrée: Quiz de mathématiques",
          timestamp: new Date(),
        },
      ]);
    } catch (error) {
      console.error("Erreur lors du chargement des données admin:", error);
      toast.error("Erreur lors du chargement des données");
    } finally {
      setLoading(false);
    }
  };

  const handleUserAction = async (userId, action) => {
    try {
      // Simuler action sur utilisateur
      toast.success(`Action ${action} effectuée sur l'utilisateur`);
      // Recharger les données
      loadAdminData();
    } catch (error) {
      toast.error(`Erreur lors de l'action ${action}`);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "pending":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "suspended":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  const getActivityIcon = (type) => {
    switch (type) {
      case "user_created":
        return UserPlusIcon;
      case "quiz_created":
        return PuzzlePieceIcon;
      case "session_started":
        return ChartBarIcon;
      default:
        return ExclamationTriangleIcon;
    }
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
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
        <div className="px-6 py-4">
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
                    ? "text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
              >
                <tab.icon className="h-5 w-5 mx-auto mb-1" />
                {tab.name}
                {activeTab === tab.id && (
                  <span
                    aria-hidden="true"
                    className="bg-primary-500 absolute inset-x-0 bottom-0 h-0.5"
                  />
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Contenu */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Statistiques principales */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm font-medium">
                    Utilisateurs
                  </p>
                  <p className="text-3xl font-bold">{stats.totalUsers}</p>
                  <p className="text-blue-200 text-xs">
                    {stats.activeUsers} actifs
                  </p>
                </div>
                <UserGroupIcon className="h-8 w-8 text-blue-200" />
              </div>
            </div>

            <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-sm font-medium">Quiz</p>
                  <p className="text-3xl font-bold">{stats.totalQuizzes}</p>
                  <p className="text-green-200 text-xs">Total créés</p>
                </div>
                <PuzzlePieceIcon className="h-8 w-8 text-green-200" />
              </div>
            </div>

            <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 rounded-lg p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-yellow-100 text-sm font-medium">
                    Sessions
                  </p>
                  <p className="text-3xl font-bold">{stats.totalSessions}</p>
                  <p className="text-yellow-200 text-xs">
                    {stats.activeSessions} actives
                  </p>
                </div>
                <ChartBarIcon className="h-8 w-8 text-yellow-200" />
              </div>
            </div>

            <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100 text-sm font-medium">Système</p>
                  <p className="text-3xl font-bold">{systemHealth.uptime}j</p>
                  <p className="text-purple-200 text-xs">Uptime</p>
                </div>
                <ServerStackIcon className="h-8 w-8 text-purple-200" />
              </div>
            </div>

            <div className="bg-gradient-to-r from-red-500 to-red-600 rounded-lg p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-red-100 text-sm font-medium">État</p>
                  <p className="text-2xl font-bold">Sain</p>
                  <p className="text-red-200 text-xs">Système opérationnel</p>
                </div>
                <CheckCircleIcon className="h-8 w-8 text-red-200" />
              </div>
            </div>
          </div>

          {/* Graphiques et métriques */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Utilisation système
              </h3>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Mémoire
                    </span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {systemHealth.memoryUsage}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${systemHealth.memoryUsage}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Disque
                    </span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {systemHealth.diskUsage}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${systemHealth.diskUsage}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Activité récente
              </h3>
              <div className="space-y-3">
                {recentActivity.slice(0, 5).map((activity) => {
                  const IconComponent = getActivityIcon(activity.type);
                  return (
                    <div
                      key={activity.id}
                      className="flex items-center space-x-3"
                    >
                      <IconComponent className="h-5 w-5 text-gray-400" />
                      <div className="flex-1">
                        <p className="text-sm text-gray-900 dark:text-white">
                          {activity.description}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          par {activity.user} •{" "}
                          {format(activity.timestamp, "HH:mm")}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "users" && (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Gestion des utilisateurs
              </h3>
              <button className="inline-flex items-center px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-md">
                <UserPlusIcon className="h-4 w-4 mr-2" />
                Nouvel utilisateur
              </button>
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
                    Inscription
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {recentUsers.map((user) => (
                  <tr
                    key={user.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-primary-600 dark:text-primary-400">
                            {user.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {user.name}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {user.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          user.role === "admin"
                            ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                            : user.role === "formateur"
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                            : "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                        }`}
                      >
                        {user.role === "admin"
                          ? "Admin"
                          : user.role === "formateur"
                          ? "Formateur"
                          : "Étudiant"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                          user.status
                        )}`}
                      >
                        {user.status === "active"
                          ? "Actif"
                          : user.status === "pending"
                          ? "En attente"
                          : "Suspendu"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {format(user.createdAt, "dd/MM/yyyy", { locale: fr })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleUserAction(user.id, "view")}
                          className="text-primary-600 hover:text-primary-500 dark:text-primary-400"
                        >
                          <EyeIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleUserAction(user.id, "suspend")}
                          className="text-yellow-600 hover:text-yellow-500 dark:text-yellow-400"
                        >
                          <ExclamationTriangleIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleUserAction(user.id, "delete")}
                          className="text-red-600 hover:text-red-500 dark:text-red-400"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "system" && (
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
                <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  {systemHealth.status === "healthy"
                    ? "Système sain"
                    : "Problèmes détectés"}
                </h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Uptime: {systemHealth.uptime} jours
                </p>
              </div>

              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900 mb-4">
                  <ServerStackIcon className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </div>
                <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Mémoire
                </h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {systemHealth.memoryUsage}% utilisée
                </p>
              </div>

              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-yellow-100 dark:bg-yellow-900 mb-4">
                  <ChartBarIcon className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
                </div>
                <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Stockage
                </h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {systemHealth.diskUsage}% utilisé
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Actions système
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button className="p-4 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-left">
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                  Sauvegarder la base de données
                </h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Créer une sauvegarde complète des données
                </p>
              </button>

              <button className="p-4 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-left">
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                  Nettoyer le cache
                </h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Vider le cache système et des sessions
                </p>
              </button>

              <button className="p-4 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-left">
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                  Exporter les logs
                </h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Télécharger les journaux système
                </p>
              </button>

              <button className="p-4 border border-red-300 dark:border-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-left">
                <h4 className="font-medium text-red-600 dark:text-red-400 mb-2">
                  Mode maintenance
                </h4>
                <p className="text-sm text-red-500 dark:text-red-400">
                  Activer le mode maintenance
                </p>
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === "activity" && (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Journal d'activité
            </h3>
          </div>

          <div className="p-6">
            <div className="space-y-4">
              {recentActivity.map((activity) => {
                const IconComponent = getActivityIcon(activity.type);
                return (
                  <div
                    key={activity.id}
                    className="flex items-start space-x-4 p-4 border border-gray-200 dark:border-gray-600 rounded-lg"
                  >
                    <div
                      className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                        activity.type === "user_created"
                          ? "bg-blue-100 dark:bg-blue-900"
                          : activity.type === "quiz_created"
                          ? "bg-green-100 dark:bg-green-900"
                          : "bg-yellow-100 dark:bg-yellow-900"
                      }`}
                    >
                      <IconComponent
                        className={`h-5 w-5 ${
                          activity.type === "user_created"
                            ? "text-blue-600 dark:text-blue-400"
                            : activity.type === "quiz_created"
                            ? "text-green-600 dark:text-green-400"
                            : "text-yellow-600 dark:text-yellow-400"
                        }`}
                      />
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                          {activity.description}
                        </h4>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {format(activity.timestamp, "dd/MM/yyyy HH:mm", {
                            locale: fr,
                          })}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Par: {activity.user}
                      </p>
                      <div className="flex items-center mt-2 space-x-2">
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            activity.type === "user_created"
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                              : activity.type === "quiz_created"
                              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                              : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                          }`}
                        >
                          {activity.type === "user_created"
                            ? "Utilisateur"
                            : activity.type === "quiz_created"
                            ? "Quiz"
                            : "Session"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 text-center">
              <button className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-md">
                Charger plus d'activités
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
