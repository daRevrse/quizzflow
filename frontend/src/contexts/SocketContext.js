// SocketContext corrigé - frontend/src/contexts/SocketContext.js

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import io from "socket.io-client";
import { useAuthStore } from "../stores/authStore";
import toast from "react-hot-toast";

const SocketContext = createContext();

// Configuration Socket.IO
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || "http://localhost:3001";

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocket doit être utilisé dans un SocketProvider");
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const { accessToken, user } = useAuthStore();

  // Initialiser la connexion Socket.IO
  useEffect(() => {
    if (accessToken && user) {
      const socketInstance = io(SOCKET_URL, {
        auth: {
          token: accessToken,
        },
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
      });

      // Événements de connexion
      socketInstance.on("connect", () => {
        console.log("📡 Connecté au serveur Socket.IO");
        setIsConnected(true);
        setConnectionError(null);
      });

      socketInstance.on("disconnect", (reason) => {
        console.log("📡 Déconnecté du serveur Socket.IO:", reason);
        setIsConnected(false);

        if (reason === "io server disconnect") {
          socketInstance.connect();
        }
      });

      socketInstance.on("connect_error", (error) => {
        console.error("❌ Erreur de connexion Socket.IO:", error);
        setConnectionError(error.message);
        setIsConnected(false);
      });

      socketInstance.on("reconnect", (attemptNumber) => {
        console.log(`📡 Reconnecté après ${attemptNumber} tentatives`);
        setIsConnected(true);
        setConnectionError(null);
        toast.success("Connexion rétablie");
      });

      socketInstance.on("reconnect_failed", () => {
        console.error("❌ Échec de la reconnexion Socket.IO");
        setConnectionError("Impossible de se reconnecter au serveur");
        toast.error("Connexion perdue - Veuillez actualiser la page");
      });

      // Événements d'erreur génériques avec gestion améliorée
      socketInstance.on("error", (error) => {
        console.error("❌ Erreur Socket.IO:", error);

        // Ne pas afficher d'erreur pour les validations attendues
        if (error && error.code !== "MISSING_REQUIRED_FIELDS") {
          toast.error(error.message || "Erreur de connexion");
        }
      });

      setSocket(socketInstance);

      return () => {
        console.log("📡 Fermeture de la connexion Socket.IO");
        socketInstance.disconnect();
        setSocket(null);
        setIsConnected(false);
      };
    } else {
      // Pas de token, fermer la connexion existante
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setIsConnected(false);
      }
    }
  }, [accessToken, user?.id]);

  // Fonction joinSession corrigée avec validation complète
  // const joinSession = useCallback(
  //   (sessionCode, participantName, isAnonymous = false) => {
  //     if (!socket || !isConnected) {
  //       toast.error("Connexion non établie");
  //       return false;
  //     }

  //     // Validation côté client avant envoi
  //     if (!sessionCode || sessionCode.trim().length < 6) {
  //       toast.error("Code de session requis (minimum 6 caractères)");
  //       return false;
  //     }

  //     if (!participantName || participantName.trim().length < 2) {
  //       toast.error("Nom de participant requis (minimum 2 caractères)");
  //       return false;
  //     }

  //     console.log("🎯 Envoi de join_session:", {
  //       sessionCode: sessionCode.trim().toUpperCase(),
  //       participantName: participantName.trim(),
  //       isAnonymous: Boolean(isAnonymous),
  //     });

  //     // Données validées et nettoyées
  //     const joinData = {
  //       sessionCode: sessionCode.trim().toUpperCase(),
  //       participantName: participantName.trim(),
  //       isAnonymous: Boolean(isAnonymous),
  //     };

  //     socket.emit("join_session", joinData);
  //     return true;
  //   },
  //   [socket, isConnected]
  // );

  const joinSession = useCallback(
    (sessionCode, participantName, isAnonymous = false) => {
      console.log(`🔄 joinSession appelé avec:`, {
        sessionCode,
        participantName,
        isAnonymous,
        socketExists: !!socket,
        isConnected,
      });

      // Validation de la connexion
      if (!socket || !isConnected) {
        console.error("❌ Socket non connecté");
        toast.error("Connexion non établie");
        return false;
      }

      // Validation stricte des paramètres
      if (!sessionCode) {
        console.error("❌ sessionCode manquant:", sessionCode);
        toast.error("Code de session manquant");
        return false;
      }

      if (!participantName) {
        console.error("❌ participantName manquant:", participantName);
        toast.error("Nom de participant manquant");
        return false;
      }

      // Nettoyage et validation des données
      const cleanSessionCode = String(sessionCode).trim().toUpperCase();
      const cleanParticipantName = String(participantName).trim();
      const cleanIsAnonymous = Boolean(isAnonymous);

      // Validation des longueurs
      if (cleanSessionCode.length < 6) {
        console.error("❌ Code trop court:", cleanSessionCode);
        toast.error("Code de session requis (minimum 6 caractères)");
        return false;
      }

      if (cleanParticipantName.length < 2) {
        console.error("❌ Nom trop court:", cleanParticipantName);
        toast.error("Nom de participant requis (minimum 2 caractères)");
        return false;
      }

      // Préparation des données avec validation finale
      const joinData = {
        sessionCode: cleanSessionCode,
        participantName: cleanParticipantName,
        isAnonymous: cleanIsAnonymous,
      };

      console.log("🎯 Données finales à envoyer:", joinData);

      // Vérification finale avant envoi
      if (!joinData.sessionCode || !joinData.participantName) {
        console.error("❌ Données finales invalides:", joinData);
        toast.error("Erreur de validation des données");
        return false;
      }

      console.log("📡 Envoi join_session via socket.emit");

      try {
        // Envoi avec gestion d'erreur
        socket.emit("join_session", joinData);

        // Log de confirmation d'envoi
        console.log("✅ join_session envoyé avec succès");
        return true;
      } catch (error) {
        console.error("❌ Erreur lors de l'envoi:", error);
        toast.error("Erreur lors de l'envoi de la requête");
        return false;
      }
    },
    [socket, isConnected]
  );

  const leaveSession = useCallback(() => {
    if (socket && isConnected) {
      socket.emit("leave_session");
    }
  }, [socket, isConnected]);

  const hostSession = useCallback(
    (sessionId) => {
      if (!socket || !isConnected) {
        toast.error("Connexion non établie");
        return;
      }

      if (!sessionId) {
        toast.error("ID de session requis");
        return;
      }

      console.log("🎯 Envoi de host_session:", { sessionId });
      socket.emit("host_session", { sessionId });
    },
    [socket, isConnected]
  );

  const startSession = useCallback(() => {
    if (socket && isConnected) {
      socket.emit("start_session");
    }
  }, [socket, isConnected]);

  const pauseSession = useCallback(() => {
    if (socket && isConnected) {
      socket.emit("pause_session");
    }
  }, [socket, isConnected]);

  const resumeSession = useCallback(() => {
    if (socket && isConnected) {
      socket.emit("resume_session");
    }
  }, [socket, isConnected]);

  const endSession = useCallback(() => {
    if (socket && isConnected) {
      socket.emit("end_session");
    }
  }, [socket, isConnected]);

  const nextQuestion = useCallback(() => {
    if (socket && isConnected) {
      socket.emit("next_question");
    }
  }, [socket, isConnected]);

  const previousQuestion = useCallback(() => {
    if (socket && isConnected) {
      socket.emit("previous_question");
    }
  }, [socket, isConnected]);

  const submitResponse = useCallback(
    (questionId, answer, timeSpent) => {
      if (socket && isConnected) {
        socket.emit("submit_response", {
          questionId,
          answer,
          timeSpent,
        });
      } else {
        toast.error("Impossible d'envoyer la réponse - Connexion perdue");
      }
    },
    [socket, isConnected]
  );

  const sendMessage = useCallback(
    (message) => {
      if (socket && isConnected) {
        socket.emit("send_message", { message });
      }
    },
    [socket, isConnected]
  );

  const participantHeartbeat = useCallback(() => {
    if (socket && isConnected) {
      socket.emit("participant_heartbeat");
    }
  }, [socket, isConnected]);

  // État de la session actuelle
  const [sessionState, setSessionState] = useState({
    sessionId: null,
    participantId: null,
    isHost: false,
    status: "disconnected", // disconnected, joining, joined, playing
  });

  // Gestionnaires d'événements de session communs
  useEffect(() => {
    if (socket) {
      const handleSessionJoined = (data) => {
        console.log("✅ Session rejointe:", data);
        setSessionState((prev) => ({
          ...prev,
          sessionId: data.sessionId,
          participantId: data.participantId,
          status: "joined",
        }));

        // Succès confirmé
        toast.success("Session rejointe avec succès !");
      };

      const handleHostConnected = (data) => {
        console.log("🎯 Hôte connecté:", data);
        setSessionState((prev) => ({
          ...prev,
          sessionId: data.sessionId,
          isHost: true,
          status: "hosting",
        }));
      };

      const handleSessionStarted = () => {
        console.log("🚀 Session démarrée");
        setSessionState((prev) => ({
          ...prev,
          status: "playing",
        }));
      };

      const handleSessionEnded = () => {
        console.log("🏁 Session terminée");
        setSessionState((prev) => ({
          ...prev,
          status: "ended",
        }));
      };

      const handleError = (error) => {
        console.error("❌ Erreur reçue:", error);

        // Gestion spécifique des erreurs
        if (error.code === "MISSING_REQUIRED_FIELDS") {
          console.warn("⚠️ Erreur validation - données manquantes");
          // Cette erreur est normale lors de la validation, ne pas l'afficher
          return;
        }

        if (error.code === "SESSION_NOT_FOUND") {
          toast.error("Session non trouvée ou terminée");
        } else if (error.code === "SESSION_FULL") {
          toast.error("Cette session est complète");
        } else if (error.code === "LATE_JOIN_DISABLED") {
          toast.error("Cette session n'accepte plus de nouveaux participants");
        } else {
          toast.error(error.message || "Erreur de connexion");
        }
      };

      // Enregistrer les événements
      socket.on("session_joined", handleSessionJoined);
      socket.on("host_connected", handleHostConnected);
      socket.on("session_started", handleSessionStarted);
      socket.on("session_ended", handleSessionEnded);
      socket.on("error", handleError);

      return () => {
        socket.off("session_joined", handleSessionJoined);
        socket.off("host_connected", handleHostConnected);
        socket.off("session_started", handleSessionStarted);
        socket.off("session_ended", handleSessionEnded);
        socket.off("error", handleError);
      };
    }
  }, [socket]);

  // Heartbeat automatique pour les participants
  useEffect(() => {
    if (
      sessionState.sessionId &&
      sessionState.participantId &&
      !sessionState.isHost
    ) {
      const interval = setInterval(() => {
        participantHeartbeat();
      }, 30000); // Toutes les 30 secondes

      return () => clearInterval(interval);
    }
  }, [sessionState, participantHeartbeat]);

  const contextValue = {
    // État de connexion
    socket,
    isConnected,
    connectionError,

    // État de session
    sessionState,
    setSessionState,

    // Actions de session
    joinSession,
    leaveSession,
    hostSession,

    // Actions d'hôte
    startSession,
    pauseSession,
    resumeSession,
    endSession,
    nextQuestion,
    previousQuestion,

    // Actions de participant
    submitResponse,
    participantHeartbeat,

    // Communication
    sendMessage,

    // Helpers
    emit: useCallback(
      (event, data) => {
        if (socket && isConnected) {
          socket.emit(event, data);
        }
      },
      [socket, isConnected]
    ),

    on: useCallback(
      (event, handler) => {
        if (socket) {
          socket.on(event, handler);
        }
      },
      [socket]
    ),

    off: useCallback(
      (event, handler) => {
        if (socket) {
          socket.off(event, handler);
        }
      },
      [socket]
    ),
  };

  return (
    <SocketContext.Provider value={contextValue}>
      {children}
    </SocketContext.Provider>
  );
};
