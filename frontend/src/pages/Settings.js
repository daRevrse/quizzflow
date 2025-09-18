import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useAuthStore } from "../stores/authStore";
import { useThemeStore } from "../stores/themeStore";
import LoadingSpinner from "../components/common/LoadingSpinner";
import toast from "react-hot-toast";
import {
  Cog6ToothIcon,
  SunIcon,
  MoonIcon,
  ComputerDesktopIcon,
  BellIcon,
  ShieldCheckIcon,
  LanguageIcon,
  PaintBrushIcon,
  SpeakerWaveIcon,
  CheckCircleIcon,
  InformationCircleIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";

const Settings = () => {
  const { user } = useAuthStore();
  const { theme, setTheme } = useThemeStore();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("appearance");

  // Formulaire pour les paramètres
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm({
    defaultValues: {
      // Apparence
      theme: theme || "system",
      fontSize: "medium",
      compactMode: false,

      // Notifications
      emailNotifications: true,
      browserNotifications: true,
      sessionReminders: true,
      resultsNotifications: true,
      marketingEmails: false,

      // Audio
      soundEffects: true,
      soundVolume: 50,
      voiceAnnouncements: false,

      // Langue
      language: "fr",
      dateFormat: "DD/MM/YYYY",
      timezone: "Europe/Paris",

      // Confidentialité
      profileVisibility: "public",
      analyticsTracking: true,
      cookieConsent: true,
      dataRetention: "1year",

      // Quiz
      defaultQuizSettings: {
        showCorrectAnswers: true,
        randomizeQuestions: false,
        timeLimit: 30,
        allowRetry: false,
      },
    },
  });

  const watchedValues = watch();

  useEffect(() => {
    setValue("theme", theme);
  }, [theme, setValue]);

  const onSubmit = async (data) => {
    try {
      setLoading(true);

      // Appliquer le thème
      if (data.theme !== theme) {
        setTheme(data.theme);
      }

      // Sauvegarder dans localStorage pour les préférences locales
      localStorage.setItem("userSettings", JSON.stringify(data));

      // Ici on pourrait envoyer au serveur pour les préférences globales
      // await settingsService.updateSettings(data);

      toast.success("Paramètres sauvegardés avec succès");
    } catch (error) {
      console.error("Erreur lors de la sauvegarde:", error);
      toast.error("Erreur lors de la sauvegarde des paramètres");
    } finally {
      setLoading(false);
    }
  };

  const resetToDefaults = () => {
    if (
      window.confirm(
        "Êtes-vous sûr de vouloir restaurer les paramètres par défaut ?"
      )
    ) {
      // Reset form to defaults
      const defaults = {
        theme: "system",
        fontSize: "medium",
        compactMode: false,
        emailNotifications: true,
        browserNotifications: true,
        sessionReminders: true,
        resultsNotifications: true,
        marketingEmails: false,
        soundEffects: true,
        soundVolume: 50,
        voiceAnnouncements: false,
        language: "fr",
        dateFormat: "DD/MM/YYYY",
        timezone: "Europe/Paris",
        profileVisibility: "public",
        analyticsTracking: true,
        cookieConsent: true,
        dataRetention: "1year",
      };

      Object.keys(defaults).forEach((key) => {
        setValue(key, defaults[key]);
      });

      toast.success("Paramètres restaurés par défaut");
    }
  };

  const requestNotificationPermission = async () => {
    if ("Notification" in window) {
      try {
        const permission = await Notification.requestPermission();
        if (permission === "granted") {
          setValue("browserNotifications", true);
          toast.success("Notifications autorisées");
        } else {
          setValue("browserNotifications", false);
          toast.error("Notifications refusées");
        }
      } catch (error) {
        console.error("Erreur permissions notifications:", error);
        toast.error("Impossible d'activer les notifications");
      }
    }
  };

  const themeOptions = [
    {
      value: "light",
      label: "Clair",
      icon: SunIcon,
      description: "Thème clair",
    },
    {
      value: "dark",
      label: "Sombre",
      icon: MoonIcon,
      description: "Thème sombre",
    },
    {
      value: "system",
      label: "Système",
      icon: ComputerDesktopIcon,
      description: "Suivre le système",
    },
  ];

  const fontSizes = [
    { value: "small", label: "Petit" },
    { value: "medium", label: "Moyen" },
    { value: "large", label: "Grand" },
    { value: "xl", label: "Très grand" },
  ];

  const languages = [
    { value: "fr", label: "Français" },
    { value: "en", label: "English" },
    { value: "es", label: "Español" },
    { value: "de", label: "Deutsch" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
        <div className="px-6 py-4">
          <div className="flex items-center space-x-3">
            <Cog6ToothIcon className="h-8 w-8 text-gray-400" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Paramètres
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Personnalisez votre expérience sur la plateforme
              </p>
            </div>
          </div>
        </div>

        {/* Onglets */}
        <div className="border-t border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex overflow-x-auto">
            {[
              { id: "appearance", name: "Apparence", icon: PaintBrushIcon },
              { id: "notifications", name: "Notifications", icon: BellIcon },
              { id: "audio", name: "Audio", icon: SpeakerWaveIcon },
              { id: "language", name: "Langue", icon: LanguageIcon },
              { id: "privacy", name: "Confidentialité", icon: ShieldCheckIcon },
              { id: "quiz", name: "Quiz", icon: Cog6ToothIcon },
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
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          {activeTab === "appearance" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  Apparence
                </h3>
              </div>

              {/* Thème */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Thème
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {themeOptions.map((option) => (
                    <label
                      key={option.value}
                      className={`relative flex cursor-pointer rounded-lg border p-4 hover:bg-gray-50 dark:hover:bg-gray-700 ${
                        watchedValues.theme === option.value
                          ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20"
                          : "border-gray-300 dark:border-gray-600"
                      }`}
                    >
                      <input
                        {...register("theme")}
                        type="radio"
                        value={option.value}
                        className="sr-only"
                      />
                      <div className="flex flex-1 items-center">
                        <option.icon
                          className={`h-6 w-6 mr-3 ${
                            watchedValues.theme === option.value
                              ? "text-primary-600 dark:text-primary-400"
                              : "text-gray-400"
                          }`}
                        />
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {option.label}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {option.description}
                          </div>
                        </div>
                      </div>
                      {watchedValues.theme === option.value && (
                        <CheckCircleIcon className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                      )}
                    </label>
                  ))}
                </div>
              </div>

              {/* Taille de police */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Taille de police
                </label>
                <select {...register("fontSize")} className="input max-w-xs">
                  {fontSizes.map((size) => (
                    <option key={size.value} value={size.value}>
                      {size.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Mode compact */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Mode compact
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Réduire les espaces et la taille des éléments
                  </p>
                </div>
                <input
                  {...register("compactMode")}
                  type="checkbox"
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
              </div>
            </div>
          )}

          {activeTab === "notifications" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  Notifications
                </h3>
              </div>

              {/* Notifications par email */}
              <div>
                <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                  Notifications par email
                </h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm text-gray-700 dark:text-gray-300">
                        Notifications générales
                      </label>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Informations importantes sur votre compte
                      </p>
                    </div>
                    <input
                      {...register("emailNotifications")}
                      type="checkbox"
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm text-gray-700 dark:text-gray-300">
                        Rappels de session
                      </label>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Recevoir des rappels avant les sessions
                      </p>
                    </div>
                    <input
                      {...register("sessionReminders")}
                      type="checkbox"
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm text-gray-700 dark:text-gray-300">
                        Résultats de quiz
                      </label>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Notifications des résultats de quiz
                      </p>
                    </div>
                    <input
                      {...register("resultsNotifications")}
                      type="checkbox"
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm text-gray-700 dark:text-gray-300">
                        Emails marketing
                      </label>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Nouveautés et promotions
                      </p>
                    </div>
                    <input
                      {...register("marketingEmails")}
                      type="checkbox"
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                  </div>
                </div>
              </div>

              {/* Notifications navigateur */}
              <div>
                <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                  Notifications navigateur
                </h4>
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm text-gray-700 dark:text-gray-300">
                      Notifications push
                    </label>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Recevoir des notifications dans le navigateur
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      {...register("browserNotifications")}
                      type="checkbox"
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <button
                      type="button"
                      onClick={requestNotificationPermission}
                      className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-500"
                    >
                      Autoriser
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "audio" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  Audio
                </h3>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Effets sonores
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Sons lors des interactions
                  </p>
                </div>
                <input
                  {...register("soundEffects")}
                  type="checkbox"
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Volume sonore: {watchedValues.soundVolume}%
                </label>
                <input
                  {...register("soundVolume")}
                  type="range"
                  min="0"
                  max="100"
                  className="w-full"
                  disabled={!watchedValues.soundEffects}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Annonces vocales
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Lecture vocale des questions (accessibilité)
                  </p>
                </div>
                <input
                  {...register("voiceAnnouncements")}
                  type="checkbox"
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
              </div>
            </div>
          )}

          {activeTab === "language" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  Langue et région
                </h3>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Langue
                </label>
                <select {...register("language")} className="input max-w-xs">
                  {languages.map((lang) => (
                    <option key={lang.value} value={lang.value}>
                      {lang.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Format de date
                </label>
                <select {...register("dateFormat")} className="input max-w-xs">
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Fuseau horaire
                </label>
                <select {...register("timezone")} className="input max-w-xs">
                  <option value="Europe/Paris">Europe/Paris (UTC+1)</option>
                  <option value="America/New_York">
                    America/New_York (UTC-5)
                  </option>
                  <option value="Asia/Tokyo">Asia/Tokyo (UTC+9)</option>
                  <option value="UTC">UTC (UTC+0)</option>
                </select>
              </div>
            </div>
          )}

          {activeTab === "privacy" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  Confidentialité et données
                </h3>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Visibilité du profil
                </label>
                <select
                  {...register("profileVisibility")}
                  className="input max-w-xs"
                >
                  <option value="public">Public</option>
                  <option value="friends">Amis uniquement</option>
                  <option value="private">Privé</option>
                </select>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Suivi analytique
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Autoriser le suivi pour améliorer l'expérience
                  </p>
                </div>
                <input
                  {...register("analyticsTracking")}
                  type="checkbox"
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Rétention des données
                </label>
                <select
                  {...register("dataRetention")}
                  className="input max-w-xs"
                >
                  <option value="3months">3 mois</option>
                  <option value="6months">6 mois</option>
                  <option value="1year">1 an</option>
                  <option value="2years">2 ans</option>
                  <option value="indefinite">Indéfinie</option>
                </select>
              </div>
            </div>
          )}

          {activeTab === "quiz" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  Paramètres par défaut des quiz
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  Ces paramètres seront appliqués par défaut lors de la création
                  de nouveaux quiz.
                </p>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Afficher les bonnes réponses
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Montrer les réponses correctes après chaque question
                  </p>
                </div>
                <input
                  {...register("defaultQuizSettings.showCorrectAnswers")}
                  type="checkbox"
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Questions aléatoires
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Mélanger l'ordre des questions
                  </p>
                </div>
                <input
                  {...register("defaultQuizSettings.randomizeQuestions")}
                  type="checkbox"
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Temps limite par défaut (secondes)
                </label>
                <input
                  {...register("defaultQuizSettings.timeLimit")}
                  type="number"
                  min="10"
                  max="300"
                  className="input max-w-xs"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Autoriser les nouvelles tentatives
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Permettre aux participants de refaire le quiz
                  </p>
                </div>
                <input
                  {...register("defaultQuizSettings.allowRetry")}
                  type="checkbox"
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={resetToDefaults}
              className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-md transition-colors"
            >
              <ExclamationTriangleIcon className="h-4 w-4 mr-2" />
              Restaurer par défaut
            </button>

            <div className="flex items-center space-x-3">
              {isDirty && (
                <span className="text-sm text-amber-600 dark:text-amber-400 flex items-center">
                  <InformationCircleIcon className="h-4 w-4 mr-1" />
                  Modifications non sauvegardées
                </span>
              )}
              <button
                type="submit"
                disabled={loading || !isDirty}
                className="inline-flex items-center px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-sm font-medium rounded-md transition-colors"
              >
                {loading ? (
                  <LoadingSpinner size="sm" className="mr-2" />
                ) : (
                  <CheckCircleIcon className="h-4 w-4 mr-2" />
                )}
                {loading ? "Sauvegarde..." : "Sauvegarder"}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

export default Settings;
