import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useAuthStore } from "../stores/authStore";
import { authService } from "../services/api";
import LoadingSpinner from "../components/common/LoadingSpinner";
import toast from "react-hot-toast";
import {
  UserIcon,
  EnvelopeIcon,
  LockClosedIcon,
  PhotoIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  TrashIcon,
  EyeIcon,
  EyeSlashIcon,
  Cog6ToothIcon,
} from "@heroicons/react/24/outline";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const Profile = () => {
  const { user, updateProfile, changePassword } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("profile");
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Formulaire de profil
  const {
    register: registerProfile,
    handleSubmit: handleSubmitProfile,
    formState: { errors: profileErrors, isDirty: profileIsDirty },
    reset: resetProfile,
  } = useForm({
    defaultValues: {
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      username: user?.username || "",
      email: user?.email || "",
      bio: user?.bio || "",
    },
  });

  // Formulaire de mot de passe
  const {
    register: registerPassword,
    handleSubmit: handleSubmitPassword,
    formState: { errors: passwordErrors },
    reset: resetPassword,
    watch: watchPassword,
  } = useForm();

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (user) {
      resetProfile({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        username: user.username || "",
        email: user.email || "",
        bio: user.bio || "",
      });
    }
  }, [user, resetProfile]);

  const onSubmitProfile = async (data) => {
    try {
      setLoading(true);
      const response = await updateProfile(data);
      if (response.success) {
        toast.success("Profil mis à jour avec succès");
      }
    } catch (error) {
      console.error("Erreur lors de la mise à jour du profil:", error);
      toast.error("Erreur lors de la mise à jour du profil");
    } finally {
      setLoading(false);
    }
  };

  const onSubmitPassword = async (data) => {
    try {
      setLoading(true);
      const response = await changePassword({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      if (response.success) {
        resetPassword();
        toast.success("Mot de passe modifié avec succès");
      }
    } catch (error) {
      console.error("Erreur lors du changement de mot de passe:", error);
      if (error.response?.status === 400) {
        toast.error("Mot de passe actuel incorrect");
      } else {
        toast.error("Erreur lors du changement de mot de passe");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (
      !window.confirm(
        "Êtes-vous sûr de vouloir supprimer définitivement votre compte ?"
      )
    ) {
      return;
    }

    try {
      setLoading(true);
      // Implémenter la suppression de compte
      toast.error("Suppression de compte non implémentée");
    } catch (error) {
      console.error("Erreur lors de la suppression du compte:", error);
      toast.error("Erreur lors de la suppression du compte");
    } finally {
      setLoading(false);
      setShowDeleteModal(false);
    }
  };

  const getRoleBadge = (role) => {
    switch (role) {
      case "admin":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      case "formateur":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "etudiant":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
        <div className="px-6 py-4">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-full flex items-center justify-center">
              <span className="text-white text-xl font-bold">
                {user?.firstName?.charAt(0)?.toUpperCase() ||
                  user?.username?.charAt(0)?.toUpperCase() ||
                  "U"}
              </span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {user?.firstName && user?.lastName
                  ? `${user.firstName} ${user.lastName}`
                  : user?.username || "Mon Profil"}
              </h1>
              <div className="flex items-center space-x-3 mt-1">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadge(
                    user?.role
                  )}`}
                >
                  {user?.role === "admin"
                    ? "Administrateur"
                    : user?.role === "formateur"
                    ? "Formateur"
                    : user?.role === "etudiant"
                    ? "Étudiant"
                    : "Utilisateur"}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Membre depuis{" "}
                  {user?.createdAt
                    ? format(new Date(user.createdAt), "MMMM yyyy", {
                        locale: fr,
                      })
                    : "-"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Onglets */}
        <div className="border-t border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex">
            {[
              { id: "profile", name: "Profil", icon: UserIcon },
              { id: "security", name: "Sécurité", icon: LockClosedIcon },
              { id: "preferences", name: "Préférences", icon: Cog6ToothIcon },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`group relative min-w-0 flex-1 overflow-hidden py-4 px-4 text-sm font-medium text-center hover:bg-gray-50 dark:hover:bg-gray-700 focus:z-10 ${
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

      {/* Contenu des onglets */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
        {activeTab === "profile" && (
          <form onSubmit={handleSubmitProfile(onSubmitProfile)} className="p-6">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  Informations personnelles
                </h3>
              </div>

              {/* Photo de profil */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Photo de profil
                </label>
                <div className="flex items-center space-x-4">
                  <div className="w-20 h-20 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-2xl font-bold">
                      {user?.firstName?.charAt(0)?.toUpperCase() ||
                        user?.username?.charAt(0)?.toUpperCase() ||
                        "U"}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-md transition-colors"
                  >
                    <PhotoIcon className="h-4 w-4 mr-2" />
                    Changer la photo
                  </button>
                </div>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  JPG, PNG ou GIF. Taille maximale de 5MB.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Prénom
                  </label>
                  <input
                    {...registerProfile("firstName", {
                      required: "Le prénom est requis",
                      minLength: {
                        value: 2,
                        message:
                          "Le prénom doit contenir au moins 2 caractères",
                      },
                    })}
                    type="text"
                    className={`input ${
                      profileErrors.firstName
                        ? "border-red-300 dark:border-red-600"
                        : ""
                    }`}
                    placeholder="Votre prénom"
                  />
                  {profileErrors.firstName && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                      {profileErrors.firstName.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Nom
                  </label>
                  <input
                    {...registerProfile("lastName", {
                      required: "Le nom est requis",
                      minLength: {
                        value: 2,
                        message: "Le nom doit contenir au moins 2 caractères",
                      },
                    })}
                    type="text"
                    className={`input ${
                      profileErrors.lastName
                        ? "border-red-300 dark:border-red-600"
                        : ""
                    }`}
                    placeholder="Votre nom"
                  />
                  {profileErrors.lastName && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                      {profileErrors.lastName.message}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Nom d'utilisateur
                </label>
                <input
                  {...registerProfile("username", {
                    required: "Le nom d'utilisateur est requis",
                    minLength: {
                      value: 3,
                      message:
                        "Le nom d'utilisateur doit contenir au moins 3 caractères",
                    },
                    pattern: {
                      value: /^[a-zA-Z0-9._-]+$/,
                      message:
                        "Le nom d'utilisateur ne peut contenir que des lettres, chiffres, points, tirets et underscores",
                    },
                  })}
                  type="text"
                  className={`input ${
                    profileErrors.username
                      ? "border-red-300 dark:border-red-600"
                      : ""
                  }`}
                  placeholder="Votre nom d'utilisateur"
                />
                {profileErrors.username && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                    {profileErrors.username.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Adresse e-mail
                </label>
                <input
                  {...registerProfile("email", {
                    required: "L'adresse e-mail est requise",
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: "Adresse e-mail invalide",
                    },
                  })}
                  type="email"
                  className={`input ${
                    profileErrors.email
                      ? "border-red-300 dark:border-red-600"
                      : ""
                  }`}
                  placeholder="votre@email.com"
                />
                {profileErrors.email && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                    {profileErrors.email.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Biographie
                </label>
                <textarea
                  {...registerProfile("bio")}
                  rows={4}
                  className="input"
                  placeholder="Parlez-nous de vous..."
                />
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  Quelques mots sur vous (optionnel).
                </p>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={loading || !profileIsDirty}
                  className="inline-flex items-center px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-sm font-medium rounded-md transition-colors"
                >
                  {loading ? (
                    <LoadingSpinner size="sm" className="mr-2" />
                  ) : (
                    <CheckCircleIcon className="h-4 w-4 mr-2" />
                  )}
                  {loading ? "Enregistrement..." : "Enregistrer"}
                </button>
              </div>
            </div>
          </form>
        )}

        {activeTab === "security" && (
          <div className="p-6">
            <div className="space-y-8">
              {/* Changement de mot de passe */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  Changer le mot de passe
                </h3>

                <form
                  onSubmit={handleSubmitPassword(onSubmitPassword)}
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Mot de passe actuel
                    </label>
                    <div className="relative">
                      <input
                        {...registerPassword("currentPassword", {
                          required: "Le mot de passe actuel est requis",
                        })}
                        type={showCurrentPassword ? "text" : "password"}
                        className={`input pr-10 ${
                          passwordErrors.currentPassword
                            ? "border-red-300 dark:border-red-600"
                            : ""
                        }`}
                        placeholder="Votre mot de passe actuel"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowCurrentPassword(!showCurrentPassword)
                        }
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      >
                        {showCurrentPassword ? (
                          <EyeSlashIcon className="h-5 w-5 text-gray-400" />
                        ) : (
                          <EyeIcon className="h-5 w-5 text-gray-400" />
                        )}
                      </button>
                    </div>
                    {passwordErrors.currentPassword && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                        {passwordErrors.currentPassword.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Nouveau mot de passe
                    </label>
                    <div className="relative">
                      <input
                        {...registerPassword("newPassword", {
                          required: "Le nouveau mot de passe est requis",
                          minLength: {
                            value: 6,
                            message:
                              "Le mot de passe doit contenir au moins 6 caractères",
                          },
                        })}
                        type={showNewPassword ? "text" : "password"}
                        className={`input pr-10 ${
                          passwordErrors.newPassword
                            ? "border-red-300 dark:border-red-600"
                            : ""
                        }`}
                        placeholder="Votre nouveau mot de passe"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      >
                        {showNewPassword ? (
                          <EyeSlashIcon className="h-5 w-5 text-gray-400" />
                        ) : (
                          <EyeIcon className="h-5 w-5 text-gray-400" />
                        )}
                      </button>
                    </div>
                    {passwordErrors.newPassword && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                        {passwordErrors.newPassword.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Confirmer le nouveau mot de passe
                    </label>
                    <div className="relative">
                      <input
                        {...registerPassword("confirmPassword", {
                          required: "La confirmation est requise",
                          validate: (value) =>
                            value === watchPassword("newPassword") ||
                            "Les mots de passe ne correspondent pas",
                        })}
                        type={showConfirmPassword ? "text" : "password"}
                        className={`input pr-10 ${
                          passwordErrors.confirmPassword
                            ? "border-red-300 dark:border-red-600"
                            : ""
                        }`}
                        placeholder="Confirmez votre nouveau mot de passe"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowConfirmPassword(!showConfirmPassword)
                        }
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      >
                        {showConfirmPassword ? (
                          <EyeSlashIcon className="h-5 w-5 text-gray-400" />
                        ) : (
                          <EyeIcon className="h-5 w-5 text-gray-400" />
                        )}
                      </button>
                    </div>
                    {passwordErrors.confirmPassword && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                        {passwordErrors.confirmPassword.message}
                      </p>
                    )}
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={loading}
                      className="inline-flex items-center px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-sm font-medium rounded-md transition-colors"
                    >
                      {loading ? (
                        <LoadingSpinner size="sm" className="mr-2" />
                      ) : (
                        <LockClosedIcon className="h-4 w-4 mr-2" />
                      )}
                      {loading ? "Modification..." : "Modifier le mot de passe"}
                    </button>
                  </div>
                </form>
              </div>

              {/* Informations de connexion */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-8">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  Informations de connexion
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      Dernière connexion
                    </span>
                    <span className="text-sm text-gray-900 dark:text-white">
                      {user?.lastLoginAt
                        ? format(
                            new Date(user.lastLoginAt),
                            "dd MMMM yyyy à HH:mm",
                            { locale: fr }
                          )
                        : "Jamais"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      Compte créé le
                    </span>
                    <span className="text-sm text-gray-900 dark:text-white">
                      {user?.createdAt
                        ? format(new Date(user.createdAt), "dd MMMM yyyy", {
                            locale: fr,
                          })
                        : "Date inconnue"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Zone de danger */}
              <div className="border-t border-red-200 dark:border-red-800 pt-8">
                <h3 className="text-lg font-medium text-red-600 dark:text-red-400 mb-4">
                  Zone de danger
                </h3>
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <ExclamationTriangleIcon className="h-6 w-6 text-red-600 dark:text-red-400 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-red-800 dark:text-red-200">
                        Supprimer le compte
                      </h4>
                      <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                        Cette action est irréversible. Toutes vos données seront
                        définitivement supprimées.
                      </p>
                      <div className="mt-4">
                        <button
                          onClick={() => setShowDeleteModal(true)}
                          className="inline-flex items-center px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-md transition-colors"
                        >
                          <TrashIcon className="h-4 w-4 mr-2" />
                          Supprimer mon compte
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "preferences" && (
          <div className="p-6">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  Préférences
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                  Personnalisez votre expérience sur la plateforme.
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Notifications par email
                    </label>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Recevoir des notifications pour les nouvelles sessions
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    defaultChecked
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Thème sombre
                    </label>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Utiliser le thème sombre par défaut
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Son des notifications
                    </label>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Émettre un son lors des notifications
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    defaultChecked
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div className="pt-6">
                <button
                  type="button"
                  className="inline-flex items-center px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-md transition-colors"
                >
                  <CheckCircleIcon className="h-4 w-4 mr-2" />
                  Enregistrer les préférences
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal de confirmation de suppression */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen">
              &#8203;
            </span>

            <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white dark:bg-gray-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900 sm:mx-0 sm:h-10 sm:w-10">
                    <ExclamationTriangleIcon className="h-6 w-6 text-red-600 dark:text-red-400" />
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
                      Supprimer le compte
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Êtes-vous sûr de vouloir supprimer définitivement votre
                        compte ? Cette action supprimera toutes vos données,
                        quiz et sessions. Cette action ne peut pas être annulée.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={loading}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                >
                  {loading ? "Suppression..." : "Supprimer définitivement"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-600 shadow-sm px-4 py-2 bg-white dark:bg-gray-800 text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;
