// SessionJoin corrigé - frontend/src/pages/session/SessionJoin.js

import { useState, useEffect } from "react";
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
} from "@heroicons/react/24/outline";

const SessionJoin = () => {
  const { code: urlCode } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const { socket, isConnected, joinSession } = useSocket();

  const [loading, setLoading] = useState(false);
  const [sessionInfo, setSessionInfo] = useState(null);
  const [joining, setJoining] = useState(false);
  const [step, setStep] = useState("enter-code");

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: {
      sessionCode: urlCode?.toUpperCase() || "",
      participantName: user?.firstName || user?.username || "",
      isAnonymous: !isAuthenticated,
    },
  });

  const sessionCode = watch("sessionCode");
  const participantName = watch("participantName");
  const isAnonymous = watch("isAnonymous");

  // Validation du bouton - CORRIGÉ
  const isCodeValid = sessionCode && sessionCode.trim().length >= 6;
  const isNameValid = participantName && participantName.trim().length >= 2;

  // Charger les infos de la session si code fourni dans l'URL
  useEffect(() => {
    if (urlCode && urlCode.length >= 6) {
      loadSessionInfo(urlCode);
    }
  }, [urlCode]);

  // Écouter les événements Socket.IO - NETTOYAGE AUTOMATIQUE
  useEffect(() => {
    if (!socket || !isConnected) return;

    let isComponentMounted = true;

    const handleSessionJoined = (data) => {
      if (!isComponentMounted) return;
      console.log("Session rejointe:", data);
      setJoining(false);
      setStep("joined");
      toast.success("Session rejointe avec succès !");

      setTimeout(() => {
        if (isComponentMounted) {
          navigate(`/session/${data.sessionId}/play`);
        }
      }, 2000);
    };

    const handleError = (error) => {
      if (!isComponentMounted) return;
      console.error("Erreur Socket.IO:", error);
      setJoining(false);
      toast.error(error.message || "Erreur lors de la connexion");
      setStep("session-info");
    };

    // Événements socket avec nettoyage
    socket.on("session_joined", handleSessionJoined);
    socket.on("error", handleError);

    return () => {
      isComponentMounted = false;
      socket.off("session_joined", handleSessionJoined);
      socket.off("error", handleError);
    };
  }, [socket, isConnected, navigate]);

  const loadSessionInfo = async (code) => {
    if (!code || code.trim().length < 6) return;

    try {
      setLoading(true);
      const response = await sessionService.getSessionByCode(code);
      setSessionInfo(response.session);
      setStep("session-info");
    } catch (error) {
      console.error("Erreur lors du chargement de la session:", error);
      toast.error("Code de session invalide ou session introuvable");
      setStep("enter-code");
      setSessionInfo(null);
    } finally {
      setLoading(false);
    }
  };

  const onSubmitCode = async (data) => {
    const code = data.sessionCode.toUpperCase().trim();
    if (!code || code.length < 6) {
      toast.error(
        "Veuillez entrer un code de session valide (6 caractères minimum)"
      );
      return;
    }

    setValue("sessionCode", code);
    await loadSessionInfo(code);
  };

  const onJoinSession = async (data) => {
    if (!sessionInfo) {
      toast.error("Informations de session manquantes");
      return;
    }

    const name = data.participantName.trim();
    if (!name || name.length < 2) {
      toast.error("Veuillez entrer un nom d'au moins 2 caractères");
      return;
    }

    if (!sessionInfo.canJoin) {
      toast.error("Cette session n'accepte plus de nouveaux participants");
      return;
    }

    setJoining(true);
    setStep("joining");

    try {
      // Vérifier la connexion socket
      if (!socket || !isConnected) {
        throw new Error("Connexion au serveur non établie");
      }

      joinSession(sessionInfo.code, name, data.isAnonymous);
    } catch (error) {
      console.error("Erreur lors de la connexion:", error);
      setJoining(false);
      setStep("session-info");
      toast.error(error.message || "Erreur lors de la connexion à la session");
    }
  };

  const renderEnterCodeStep = () => (
    <div className="max-w-md w-full mx-auto">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-xl flex items-center justify-center mx-auto mb-4">
          <UserGroupIcon className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white">
          Rejoindre un Quiz
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Entrez le code fourni par votre formateur
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmitCode)} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Code de session
          </label>
          <input
            {...register("sessionCode", {
              required: "Code de session requis",
              minLength: {
                value: 6,
                message: "Le code doit contenir au moins 6 caractères",
              },
              pattern: {
                value: /^[A-Z0-9]+$/,
                message: "Le code ne peut contenir que des lettres et chiffres",
              },
            })}
            type="text"
            className={`w-full px-4 py-3 text-center text-lg font-mono uppercase tracking-widest border rounded-lg focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white ${
              errors.sessionCode ? "border-red-300 dark:border-red-600" : ""
            }`}
            placeholder="ABC123"
            maxLength={8}
            autoComplete="off"
            disabled={loading}
            onChange={(e) => {
              const value = e.target.value
                .toUpperCase()
                .replace(/[^A-Z0-9]/g, "");
              e.target.value = value;
              setValue("sessionCode", value);
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
          className="w-full inline-flex items-center justify-center px-4 py-3 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
        >
          {loading ? <LoadingSpinner size="sm" className="mr-2" /> : null}
          {loading ? "Recherche..." : "Rechercher la session"}
        </button>
      </form>

      <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900 rounded-lg border border-blue-200 dark:border-blue-700">
        <div className="flex">
          <InformationCircleIcon className="h-5 w-5 text-blue-400 flex-shrink-0" />
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
              Comment obtenir un code ?
            </h3>
            <div className="mt-2 text-sm text-blue-700 dark:text-blue-300">
              <p>
                Le code de session vous est fourni par votre formateur au début
                du quiz. Il est généralement affiché sur l'écran de
                présentation.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSessionInfoStep = () => (
    <div className="max-w-md w-full mx-auto">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-blue-500 rounded-xl flex items-center justify-center mx-auto mb-4">
          <UserGroupIcon className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Session trouvée !
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Entrez vos informations pour rejoindre
        </p>
      </div>

      {/* Informations de la session */}
      {sessionInfo && (
        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {sessionInfo.title}
              </h3>
              {sessionInfo.quiz && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {sessionInfo.quiz.title}
                </p>
              )}
              {sessionInfo.host && (
                <p className="text-sm text-gray-500 dark:text-gray-500">
                  Animé par{" "}
                  {sessionInfo.host.displayName || sessionInfo.host.username}
                </p>
              )}
              <div className="mt-2 flex items-center space-x-4 text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  {sessionInfo.participantCount} participants
                </span>
                <span
                  className={`px-2 py-1 text-xs rounded-full ${
                    sessionInfo.status === "waiting"
                      ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                      : sessionInfo.status === "active"
                      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                      : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
                  }`}
                >
                  {sessionInfo.status === "waiting"
                    ? "En attente"
                    : sessionInfo.status === "active"
                    ? "En cours"
                    : sessionInfo.status}
                </span>
              </div>
            </div>
          </div>

          {!sessionInfo.canJoin && (
            <div className="mt-3 p-3 bg-orange-100 dark:bg-orange-900 rounded border-l-4 border-orange-400">
              <p className="text-sm text-orange-800 dark:text-orange-200">
                Cette session n'accepte plus de nouveaux participants.
              </p>
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit(onJoinSession)} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Votre nom
          </label>
          <div className="relative">
            <UserIcon className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
            <input
              {...register("participantName", {
                required: "Nom requis",
                minLength: {
                  value: 2,
                  message: "Le nom doit contenir au moins 2 caractères",
                },
                maxLength: {
                  value: 30,
                  message: "Le nom ne peut dépasser 30 caractères",
                },
              })}
              type="text"
              className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white ${
                errors.participantName
                  ? "border-red-300 dark:border-red-600"
                  : ""
              }`}
              placeholder="Entrez votre nom"
              disabled={joining}
            />
          </div>
          {errors.participantName && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
              {errors.participantName.message}
            </p>
          )}
        </div>

        {!isAuthenticated && (
          <div className="flex items-center">
            <input
              {...register("isAnonymous")}
              type="checkbox"
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 dark:border-gray-600 rounded"
              disabled={joining}
            />
            <label className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
              Participer de manière anonyme
            </label>
          </div>
        )}

        <div className="flex space-x-3">
          <button
            type="button"
            onClick={() => {
              setStep("enter-code");
              setSessionInfo(null);
            }}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-md transition-colors"
            disabled={joining}
          >
            Changer de code
          </button>
          <button
            type="submit"
            disabled={joining || !isNameValid || !sessionInfo?.canJoin}
            className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-colors"
          >
            {joining ? <LoadingSpinner size="sm" className="mr-1" /> : null}
            {joining ? "Connexion..." : "Rejoindre"}
          </button>
        </div>
      </form>
    </div>
  );

  const renderJoiningStep = () => (
    <div className="max-w-md w-full mx-auto text-center">
      <div className="mb-8">
        <LoadingSpinner size="xl" />
        <h1 className="mt-4 text-2xl font-bold text-gray-900 dark:text-white">
          Connexion en cours...
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Nous vous connectons à la session
        </p>
      </div>
    </div>
  );

  const renderJoinedStep = () => (
    <div className="max-w-md w-full mx-auto text-center">
      <div className="mb-8">
        <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-green-600 rounded-xl flex items-center justify-center mx-auto mb-4">
          <CheckCircleIcon className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Connecté !
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Vous allez être redirigé vers le quiz...
        </p>
      </div>
      <div className="animate-pulse">
        <LoadingSpinner size="lg" />
      </div>
    </div>
  );

  const renderContent = () => {
    switch (step) {
      case "enter-code":
        return renderEnterCodeStep();
      case "session-info":
        return renderSessionInfoStep();
      case "joining":
        return renderJoiningStep();
      case "joined":
        return renderJoinedStep();
      default:
        return renderEnterCodeStep();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      {renderContent()}
    </div>
  );
};

export default SessionJoin;
