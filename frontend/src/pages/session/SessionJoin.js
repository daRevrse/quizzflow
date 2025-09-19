import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useAuthStore } from "../../stores/authStore";
import { useSocket } from "../../contexts/SocketContext";
import { sessionService } from "../../services/api";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import toast from "react-hot-toast";
import {
  UserGroupIcon,
  UserIcon,
  InformationCircleIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  EyeIcon,
  EyeSlashIcon,
} from "@heroicons/react/24/outline";

const SessionJoin = () => {
  const { code: urlCode } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const { socket, isConnected, joinSession } = useSocket();

  // États principaux
  const [loading, setLoading] = useState(false);
  const [sessionInfo, setSessionInfo] = useState(null);
  const [joining, setJoining] = useState(false);
  const [step, setStep] = useState("enter-code");
  const [error, setError] = useState(null);

  // Form avec react-hook-form
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    setError: setFormError,
    clearErrors,
    formState: { errors, isValid },
  } = useForm({
    mode: "onChange",
    defaultValues: {
      sessionCode: urlCode?.toUpperCase() || "",
      participantName: user?.firstName || user?.username || "",
      isAnonymous: !isAuthenticated,
    },
  });

  const sessionCode = watch("sessionCode");
  const participantName = watch("participantName");
  const isAnonymous = watch("isAnonymous");

  // Validation en temps réel
  const isCodeValid = sessionCode && sessionCode.trim().length === 6;
  const isNameValid = participantName && participantName.trim().length >= 2;

  // Charger les infos de la session si code fourni dans l'URL
  const loadSessionInfo = useCallback(
    async (code) => {
      if (!code || code.length !== 6) return;

      try {
        setLoading(true);
        setError(null);
        clearErrors();

        console.log("🔍 Chargement des infos de session:", code);

        const response = await sessionService.getSessionByCode(code);
        const sessionData = response.session;

        console.log("✅ Infos session chargées:", sessionData);

        if (!sessionData) {
          throw new Error("Session non trouvée");
        }

        // Vérifier si la session accepte de nouveaux participants
        if (!sessionData.canJoin) {
          let errorMessage =
            "Cette session n'accepte plus de nouveaux participants";

          if (sessionData.status === "finished") {
            errorMessage = "Cette session est terminée";
          } else if (sessionData.status === "cancelled") {
            errorMessage = "Cette session a été annulée";
          } else if (
            sessionData.status === "active" &&
            !sessionData.settings?.allowLateJoin
          ) {
            errorMessage =
              "Cette session est en cours et n'autorise pas les arrivées tardives";
          }

          setError(errorMessage);
          setStep("error");
          return;
        }

        // Vérifier la limite de participants
        if (
          sessionData.participantCount >= sessionData.settings?.maxParticipants
        ) {
          setError(
            `Session complète (${sessionData.settings.maxParticipants} participants maximum)`
          );
          setStep("error");
          return;
        }

        setSessionInfo(sessionData);
        setStep("enter-name");
      } catch (error) {
        console.error("❌ Erreur lors du chargement des infos:", error);

        const errorMessage =
          error.message || "Erreur lors du chargement de la session";
        setError(errorMessage);
        setStep("error");
      } finally {
        setLoading(false);
      }
    },
    [clearErrors]
  );

  // Charger automatiquement si code dans URL
  useEffect(() => {
    if (urlCode && urlCode.length === 6) {
      setValue("sessionCode", urlCode.toUpperCase());
      loadSessionInfo(urlCode);
    }
  }, [urlCode, setValue, loadSessionInfo]);

  // Écouter les événements Socket.IO avec nettoyage automatique
  useEffect(() => {
    // if (!socket || !isConnected) return;
    let isComponentMounted = true;
    // SessionJoin.js - Ajouter au début du useEffect des sockets
    if (!socket || !isConnected) {
      console.warn("⚠️ Socket non connecté, tentative de reconnexion...");

      // Si le socket n'est pas connecté, attendre un peu et réessayer
      setTimeout(() => {
        if (isComponentMounted) {
          loadSessionInfo(sessionCode);
        }
      }, 1000);
      return;
    }

    // const handleSessionJoined = (data) => {
    //   if (!isComponentMounted) return;
    //   console.log("🎉 Session rejointe:", data);

    //   setJoining(false);
    //   setStep("joined");
    //   toast.success("Session rejointe avec succès !");

    //   // Naviguer vers la page de jeu après un délai
    //   setTimeout(() => {
    //     if (isComponentMounted) {
    //       navigate(`/session/${data.session?.id || sessionInfo?.id}/play`);
    //     }
    //   }, 2000);
    // };

    const handleJoinError = (data) => {
      if (!isComponentMounted) return;
      console.error("❌ Erreur jointure:", data);

      setJoining(false);
      const errorMessage =
        data.error || data.message || "Erreur lors de la jointure";
      toast.error(errorMessage);
      setError(errorMessage);
    };

    const handleSessionUpdated = (data) => {
      if (!isComponentMounted) return;
      console.log("📝 Session mise à jour:", data);

      // Mettre à jour les infos si c'est la même session
      if (data.sessionId === sessionInfo?.id) {
        setSessionInfo((prev) =>
          prev
            ? {
                ...prev,
                ...data.updates,
              }
            : null
        );
      }
    };

    const handleSessionStatusChanged = (data) => {
      if (!isComponentMounted) return;
      console.log("🔄 Statut session changé:", data);

      if (data.sessionId === sessionInfo?.id) {
        if (data.status === "cancelled" || data.status === "finished") {
          toast.error("La session a été fermée");
          navigate("/join");
        }
      }
    };

    // SessionJoin.js - Ajouter dans le useEffect des sockets
    const handleSessionJoined = (data) => {
      if (!isComponentMounted) return;
      console.log("🎉 Session rejointe via socket:", data);

      // ✅ METTRE À JOUR L'ÉTAT AVEC LES DONNÉES REÇUES
      if (data.session) {
        setSessionInfo(data.session);
      }

      setJoining(false);
      setStep("joined");
      toast.success("Session rejointe avec succès !");

      // ✅ NAVIGUER VERS LA PAGE DE JEU
      setTimeout(() => {
        if (isComponentMounted) {
          navigate(`/session/${data.session?.id || sessionInfo?.id}/play`);
        }
      }, 1500);
    };

    // Écouter les événements
    socket.on("session_joined", handleSessionJoined);
    socket.on("join_error", handleJoinError);
    socket.on("session_updated", handleSessionUpdated);
    socket.on("session_ended", handleSessionStatusChanged);
    socket.on("session_cancelled", handleSessionStatusChanged);

    // Nettoyage
    return () => {
      isComponentMounted = false;
      socket.off("session_joined", handleSessionJoined);
      socket.off("join_error", handleJoinError);
      socket.off("session_updated", handleSessionUpdated);
      socket.off("session_ended", handleSessionStatusChanged);
      socket.off("session_cancelled", handleSessionStatusChanged);
    };
  }, [socket, isConnected, sessionInfo, navigate]);

  // Rechercher une session par code
  const handleSearchSession = async (data) => {
    const code = data.sessionCode.toUpperCase().trim();

    if (!code || code.length !== 6) {
      setFormError("sessionCode", {
        type: "manual",
        message: "Le code doit faire exactement 6 caractères",
      });
      return;
    }

    await loadSessionInfo(code);
  };

  // Rejoindre la session

  // const handleJoinSession = async (data) => {
  //   if (!sessionInfo) {
  //     setError("Informations de session manquantes");
  //     return;
  //   }

  //   try {
  //     setJoining(true);
  //     setError(null);
  //     clearErrors();

  //     const participantData = {
  //       participantName: data.participantName.trim(),
  //       isAnonymous: data.isAnonymous,
  //     };

  //     console.log("🚀 Tentative de jointure:", {
  //       sessionId: sessionInfo.id,
  //       participantData,
  //     });

  //     // ✅ NOUVEAU FLUX: Utiliser la méthode corrigée du context
  //     const success = await joinSession(sessionInfo.id, participantData);

  //     if (success) {
  //       console.log("✅ Jointure réussie");
  //       // Le context gère automatiquement la navigation
  //     } else {
  //       throw new Error("Échec de la jointure");
  //     }
  //   } catch (error) {
  //     console.error("❌ Erreur jointure session:", error);
  //     setJoining(false);

  //     const errorMessage = error.message || "Erreur lors de la jointure";
  //     setError(errorMessage);
  //     toast.error(errorMessage);

  //     // Gérer les erreurs spécifiques
  //     if (errorMessage.includes("nom") && errorMessage.includes("utilisé")) {
  //       setFormError("participantName", {
  //         type: "manual",
  //         message: errorMessage,
  //       });
  //     }
  //   }
  // };

  const handleJoinSession = async (data) => {
    if (!sessionInfo) {
      setError("Informations de session manquantes");
      return;
    }

    try {
      setJoining(true);
      setError(null);
      clearErrors();

      const participantData = {
        participantName: data.participantName.trim(),
        isAnonymous: data.isAnonymous,
      };

      console.log("🚀 Tentative de jointure:", {
        sessionId: sessionInfo.id,
        participantData,
      });

      // ✅ NOUVEAU FLUX: Utiliser la méthode corrigée du context
      const result = await joinSession(sessionInfo.id, participantData);

      if (result.success) {
        console.log("✅ Jointure réussie:", result);

        // ✅ METTRE À JOUR L'ÉTAT LOCAL AVEC LES DONNÉES DE LA SESSION
        setSessionInfo(result.session);
        setStep("joined");

        // ✅ NAVIGUER VERS LA PAGE DE JEU APRÈS UN COURT DÉLAI
        setTimeout(() => {
          navigate(`/session/${result.session.id}/play`);
        }, 1500);
      } else {
        throw new Error(result.error || "Échec de la jointure");
      }
    } catch (error) {
      console.error("❌ Erreur jointure session:", error);
      setJoining(false);

      const errorMessage = error.message || "Erreur lors de la jointure";
      setError(errorMessage);
      toast.error(errorMessage);

      // Gérer les erreurs spécifiques
      if (errorMessage.includes("nom") && errorMessage.includes("utilisé")) {
        setFormError("participantName", {
          type: "manual",
          message: errorMessage,
        });
      }
    }
  };

  // Retourner à l'étape précédente
  const handleBack = () => {
    setError(null);
    clearErrors();

    if (step === "enter-name") {
      setStep("enter-code");
      setSessionInfo(null);
    } else if (step === "error") {
      setStep("enter-code");
      setSessionInfo(null);
    }
  };

  // Recommencer le processus
  const handleRestart = () => {
    setError(null);
    clearErrors();
    setSessionInfo(null);
    setStep("enter-code");
    setValue("sessionCode", "");
    setValue("participantName", user?.firstName || user?.username || "");
  };

  // Formater le statut de session
  const getStatusInfo = (status) => {
    switch (status) {
      case "waiting":
        return {
          text: "En attente",
          color: "text-yellow-600 bg-yellow-50 border-yellow-200",
          icon: <InformationCircleIcon className="h-5 w-5" />,
        };
      case "active":
        return {
          text: "En cours",
          color: "text-green-600 bg-green-50 border-green-200",
          icon: <CheckCircleIcon className="h-5 w-5" />,
        };
      case "paused":
        return {
          text: "En pause",
          color: "text-orange-600 bg-orange-50 border-orange-200",
          icon: <ExclamationTriangleIcon className="h-5 w-5" />,
        };
      default:
        return {
          text: "Inconnue",
          color: "text-gray-600 bg-gray-50 border-gray-200",
          icon: <InformationCircleIcon className="h-5 w-5" />,
        };
    }
  };

  // Rendu des différentes étapes
  const renderStep = () => {
    switch (step) {
      case "enter-code":
        return (
          <form
            onSubmit={handleSubmit(handleSearchSession)}
            className="space-y-6"
          >
            <div>
              <label
                htmlFor="sessionCode"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Code de session
              </label>
              <input
                {...register("sessionCode", {
                  required: "Le code de session est requis",
                  minLength: {
                    value: 6,
                    message: "Le code doit faire 6 caractères",
                  },
                  maxLength: {
                    value: 6,
                    message: "Le code doit faire 6 caractères",
                  },
                  pattern: {
                    value: /^[A-Z0-9]{6}$/,
                    message:
                      "Le code doit contenir uniquement des lettres et chiffres",
                  },
                })}
                type="text"
                id="sessionCode"
                placeholder="Entrez le code à 6 caractères"
                maxLength={6}
                className="w-full px-4 py-3 text-center text-lg font-mono uppercase tracking-widest border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                style={{ letterSpacing: "0.3em" }}
                onChange={(e) => {
                  const value = e.target.value
                    .toUpperCase()
                    .replace(/[^A-Z0-9]/g, "");
                  setValue("sessionCode", value);
                  if (errors.sessionCode) clearErrors("sessionCode");
                }}
              />
              {errors.sessionCode && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {errors.sessionCode.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !isCodeValid}
              className="w-full flex items-center justify-center px-4 py-3 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  Recherche...
                </>
              ) : (
                <>
                  Rechercher la session
                  <ArrowRightIcon className="ml-2 h-5 w-5" />
                </>
              )}
            </button>
          </form>
        );

      case "enter-name":
        const statusInfo = getStatusInfo(sessionInfo.status);

        return (
          <div className="space-y-6">
            {/* Informations de la session */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    {sessionInfo.title}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Code:{" "}
                    <span className="font-mono font-semibold">
                      {sessionInfo.code}
                    </span>
                  </p>
                </div>
                <span
                  className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${statusInfo.color}`}
                >
                  {statusInfo.icon}
                  <span className="ml-1">{statusInfo.text}</span>
                </span>
              </div>

              {sessionInfo.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  {sessionInfo.description}
                </p>
              )}

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">
                    Quiz:
                  </span>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {sessionInfo.quiz?.title}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">
                    Animateur:
                  </span>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {sessionInfo.host?.name}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">
                    Participants:
                  </span>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {sessionInfo.participantCount} /{" "}
                    {sessionInfo.settings?.maxParticipants || 100}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">
                    Catégorie:
                  </span>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {sessionInfo.quiz?.category || "Non spécifiée"}
                  </p>
                </div>
              </div>
            </div>

            {/* Formulaire de participation */}
            <form
              onSubmit={handleSubmit(handleJoinSession)}
              className="space-y-6"
            >
              <div>
                <label
                  htmlFor="participantName"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Votre nom de participant
                </label>
                <input
                  {...register("participantName", {
                    required: "Le nom de participant est requis",
                    minLength: {
                      value: 2,
                      message: "Le nom doit faire au moins 2 caractères",
                    },
                    maxLength: {
                      value: 50,
                      message: "Le nom ne peut pas dépasser 50 caractères",
                    },
                    pattern: {
                      value: /^[a-zA-ZÀ-ÿ0-9\s\-_]+$/,
                      message:
                        "Le nom ne peut contenir que des lettres, chiffres, espaces, tirets et underscores",
                    },
                  })}
                  type="text"
                  id="participantName"
                  placeholder="Entrez votre nom"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                  onChange={(e) => {
                    setValue("participantName", e.target.value);
                    if (errors.participantName) clearErrors("participantName");
                  }}
                />
                {errors.participantName && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                    {errors.participantName.message}
                  </p>
                )}
              </div>

              {/* Option participation anonyme */}
              {sessionInfo.settings?.allowAnonymous && (
                <div className="flex items-center">
                  <input
                    {...register("isAnonymous")}
                    type="checkbox"
                    id="isAnonymous"
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <label
                    htmlFor="isAnonymous"
                    className="ml-2 block text-sm text-gray-700 dark:text-gray-300"
                  >
                    Participer de manière anonyme
                  </label>
                </div>
              )}

              {/* Messages d'information */}
              {sessionInfo.status === "active" &&
                sessionInfo.settings?.allowLateJoin && (
                  <div className="bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                    <div className="flex">
                      <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400 mt-0.5" />
                      <div className="ml-3">
                        <p className="text-sm text-yellow-800 dark:text-yellow-200">
                          Cette session est déjà en cours. Vous rejoindrez la
                          session en cours de route.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={handleBack}
                  className="flex-1 flex items-center justify-center px-4 py-3 bg-gray-600 text-white font-medium rounded-lg hover:bg-gray-700 transition-colors"
                >
                  <ArrowLeftIcon className="mr-2 h-5 w-5" />
                  Retour
                </button>
                <button
                  type="submit"
                  disabled={joining || !isNameValid}
                  className="flex-1 flex items-center justify-center px-4 py-3 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {joining ? (
                    <>
                      <LoadingSpinner size="sm" className="mr-2" />
                      Connexion...
                    </>
                  ) : (
                    <>
                      <UserGroupIcon className="mr-2 h-5 w-5" />
                      Rejoindre la session
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        );

      case "joined":
        return (
          <div className="text-center space-y-6">
            <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
              <CheckCircleIcon className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>

            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Session rejointe avec succès !
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Vous allez être redirigé vers la session de jeu...
              </p>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <div className="flex items-center justify-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                <LoadingSpinner size="sm" />
                <span>Connexion à la session...</span>
              </div>
            </div>
          </div>
        );

      case "error":
        return (
          <div className="text-center space-y-6">
            <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
              <ExclamationTriangleIcon className="h-8 w-8 text-red-600 dark:text-red-400" />
            </div>

            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Impossible de rejoindre la session
              </h3>
              <p className="text-red-600 dark:text-red-400">{error}</p>
            </div>

            <div className="flex space-x-4">
              <button
                onClick={handleBack}
                className="flex-1 flex items-center justify-center px-4 py-3 bg-gray-600 text-white font-medium rounded-lg hover:bg-gray-700 transition-colors"
              >
                <ArrowLeftIcon className="mr-2 h-5 w-5" />
                Retour
              </button>
              <button
                onClick={handleRestart}
                className="flex-1 flex items-center justify-center px-4 py-3 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors"
              >
                Recommencer
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        {/* En-tête */}
        <div className="text-center mb-8">
          <div className="mx-auto w-12 h-12 bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center mb-4">
            <UserGroupIcon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
            Rejoindre une session
          </h2>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            {step === "enter-code" &&
              "Entrez le code de session pour commencer"}
            {step === "enter-name" &&
              "Complétez vos informations de participant"}
            {step === "joined" && "Connexion réussie !"}
            {step === "error" && "Une erreur s'est produite"}
          </p>
        </div>

        {/* Contenu principal */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          {renderStep()}
        </div>

        {/* Indicateur d'étape */}
        {step !== "error" && (
          <div className="mt-6 flex justify-center space-x-2">
            <div
              className={`w-3 h-3 rounded-full ${
                step === "enter-code"
                  ? "bg-primary-600"
                  : "bg-gray-300 dark:bg-gray-600"
              }`}
            />
            <div
              className={`w-3 h-3 rounded-full ${
                step === "enter-name"
                  ? "bg-primary-600"
                  : "bg-gray-300 dark:bg-gray-600"
              }`}
            />
            <div
              className={`w-3 h-3 rounded-full ${
                step === "joined"
                  ? "bg-primary-600"
                  : "bg-gray-300 dark:bg-gray-600"
              }`}
            />
          </div>
        )}

        {/* Aide */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Besoin d'aide ? Contactez l'organisateur de la session.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SessionJoin;
