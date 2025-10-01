// frontend/src/components/admin/UserDetailModal.jsx
import { useState, useEffect } from "react";
import { XMarkIcon, PencilIcon } from "@heroicons/react/24/outline";
import apiClient from "../../services/api";
import toast from "react-hot-toast";
import LoadingSpinner from "../common/LoadingSpinner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const UserDetailModal = ({ isOpen, onClose, userId }) => {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    role: "",
    isActive: true,
    firstName: "",
    lastName: "",
  });

  useEffect(() => {
    if (isOpen && userId) {
      loadUserDetails();
    }
  }, [isOpen, userId]);

  const loadUserDetails = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get(`/admin/users/${userId}`);
      setUser(response.data.user);
      setFormData({
        role: response.data.user.role,
        isActive: response.data.user.isActive,
        firstName: response.data.user.firstName || "",
        lastName: response.data.user.lastName || "",
      });
    } catch (error) {
      console.error("Erreur chargement utilisateur:", error);
      toast.error("Erreur lors du chargement");
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    try {
      await apiClient.put(`/admin/users/${userId}`, formData);
      toast.success("Utilisateur modifié avec succès");
      setEditing(false);
      loadUserDetails();
    } catch (error) {
      console.error("Erreur modification:", error);
      toast.error(
        error.response?.data?.error || "Erreur lors de la modification"
      );
    }
  };

  const getRoleBadge = (role) => {
    const badges = {
      admin: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      formateur:
        "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      etudiant:
        "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    };
    return badges[role] || "bg-gray-100 text-gray-800";
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Overlay */}
        <div
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-75"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="inline-block overflow-hidden text-left align-bottom transition-all transform bg-white dark:bg-gray-800 rounded-lg shadow-xl sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Détails de l'utilisateur
              </h3>
              <div className="flex items-center space-x-2">
                {!editing && (
                  <button
                    onClick={() => setEditing(true)}
                    className="p-2 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                  >
                    <PencilIcon className="h-5 w-5" />
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="p-2 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 py-4">
            {loading ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner />
              </div>
            ) : user ? (
              <div className="space-y-6">
                {/* Informations principales */}
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0 h-16 w-16 bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center">
                    <span className="text-primary-600 dark:text-primary-400 font-bold text-2xl">
                      {user.firstName?.[0] || user.username?.[0]?.toUpperCase()}
                    </span>
                  </div>
                  <div>
                    {editing ? (
                      <div className="flex space-x-2">
                        <input
                          type="text"
                          value={formData.firstName}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              firstName: e.target.value,
                            })
                          }
                          className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                          placeholder="Prénom"
                        />
                        <input
                          type="text"
                          value={formData.lastName}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              lastName: e.target.value,
                            })
                          }
                          className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                          placeholder="Nom"
                        />
                      </div>
                    ) : (
                      <h4 className="text-xl font-bold text-gray-900 dark:text-white">
                        {user.firstName && user.lastName
                          ? `${user.firstName} ${user.lastName}`
                          : user.username}
                      </h4>
                    )}
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      @{user.username}
                    </p>
                  </div>
                </div>

                {/* Informations détaillées */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Email
                    </label>
                    <p className="text-sm text-gray-900 dark:text-white">
                      {user.email}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Rôle
                    </label>
                    {editing ? (
                      <select
                        value={formData.role}
                        onChange={(e) =>
                          setFormData({ ...formData, role: e.target.value })
                        }
                        className="w-full px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                      >
                        <option value="etudiant">Étudiant</option>
                        <option value="formateur">Formateur</option>
                        <option value="admin">Administrateur</option>
                      </select>
                    ) : (
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadge(
                          user.role
                        )}`}
                      >
                        {user.role === "admin"
                          ? "Administrateur"
                          : user.role === "formateur"
                          ? "Formateur"
                          : "Étudiant"}
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Statut
                    </label>
                    {editing ? (
                      <select
                        value={formData.isActive}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            isActive: e.target.value === "true",
                          })
                        }
                        className="w-full px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                      >
                        <option value="true">Actif</option>
                        <option value="false">Inactif</option>
                      </select>
                    ) : (
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          user.isActive
                            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                            : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                        }`}
                      >
                        {user.isActive ? "Actif" : "Inactif"}
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Inscrit le
                    </label>
                    <p className="text-sm text-gray-900 dark:text-white">
                      {format(new Date(user.createdAt), "dd MMMM yyyy", {
                        locale: fr,
                      })}
                    </p>
                  </div>
                </div>

                {/* Statistiques */}
                {user.stats && (
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                    <h5 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                      Statistiques
                    </h5>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Quiz créés
                        </p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                          {user.stats.totalQuizzes || 0}
                        </p>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Sessions hébergées
                        </p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                          {user.stats.totalSessions || 0}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-center text-gray-500 dark:text-gray-400">
                Utilisateur non trouvé
              </p>
            )}
          </div>

          {/* Footer */}
          {editing && (
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    setFormData({
                      role: user.role,
                      isActive: user.isActive,
                      firstName: user.firstName || "",
                      lastName: user.lastName || "",
                    });
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleUpdate}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md"
                >
                  Enregistrer
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserDetailModal;
