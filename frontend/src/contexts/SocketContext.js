import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import io from "socket.io-client";
import { useAuthStore } from "../stores/authStore";
import toast from "react-hot-toast";

const SocketContext = createContext();

// Configuration Socket.IO optimisée
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

  // Refs pour éviter les re-renders inutiles
  const heartbeatIntervalRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const lastHeartbeatRef = useRef(null);

  // Configuration optimisée
  const socketConfig = {
    auth: {
      token: accessToken,
    },
    // Reconnexion moins agressive
    reconnection: true,
    reconnectionAttempts: 3, // Réduit de 5 à 3
    reconnectionDelay: 2000, // Augmenté de 1000 à 2000ms
    reconnectionDelayMax: 10000, // Augmenté de 5000 à 10000ms
    timeout: 10000, // Réduit de 20000 à 10000ms

    // Optimisations transport
    transports: ["websocket", "polling"], // Privilégier WebSocket
    upgrade: true,
    rememberUpgrade: true,

    // Buffer et compression
    forceNew: false,
    compress: true,
  };

  // Initialiser la connexion Socket.IO avec lazy loading
  useEffect(() => {
    if (!accessToken || !user) {
      return;
    }

    let socketInstance = null;
    let isDestroyed = false;

    const initSocket = async () => {
      try {
        socketInstance = io(SOCKET_URL, socketConfig);

        // Événements de connexion optimisés
        socketInstance.on("connect", () => {
          if (isDestroyed) return;
          console.log("📡 Connecté au serveur Socket.IO");
          setIsConnected(true);
          setConnectionError(null);

          // Réinitialiser le heartbeat lors de la connexion
          clearInterval(heartbeatIntervalRef.current);
          startHeartbeat();
        });

        socketInstance.on("disconnect", (reason) => {
          if (isDestroyed) return;
          console.log("📡 Déconnecté du serveur Socket.IO:", reason);
          setIsConnected(false);
          stopHeartbeat();

          // Reconnexion intelligente basée sur la raison
          if (reason === "io server disconnect") {
            // Le serveur a fermé la connexion - attendre avant de reconnecter
            reconnectTimeoutRef.current = setTimeout(() => {
              if (!isDestroyed && socketInstance) {
                socketInstance.connect();
              }
            }, 5000);
          }
        });

        socketInstance.on("connect_error", (error) => {
          if (isDestroyed) return;
          console.error("❌ Erreur de connexion Socket.IO:", error);
          setConnectionError(error.message);
          setIsConnected(false);
          stopHeartbeat();
        });

        socketInstance.on("reconnect", (attemptNumber) => {
          if (isDestroyed) return;
          console.log(`📡 Reconnecté après ${attemptNumber} tentatives`);
          setIsConnected(true);
          setConnectionError(null);
          toast.success("Connexion rétablie");
          startHeartbeat();
        });

        socketInstance.on("reconnect_failed", () => {
          if (isDestroyed) return;
          console.error("❌ Échec de reconnexion définitif");
          toast.error("Impossible de se reconnecter au serveur");
          stopHeartbeat();
        });

        setSocket(socketInstance);
      } catch (error) {
        console.error("Erreur lors de l'initialisation du socket:", error);
        setConnectionError(error.message);
      }
    };

    initSocket();

    return () => {
      isDestroyed = true;
      stopHeartbeat();

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      if (socketInstance) {
        socketInstance.removeAllListeners();
        socketInstance.disconnect();
      }
    };
  }, [accessToken, user?.id]); // Dépendances optimisées

  // Heartbeat optimisé avec throttling
  const startHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }

    heartbeatIntervalRef.current = setInterval(() => {
      const now = Date.now();

      // Throttling: éviter les heartbeats trop fréquents
      if (lastHeartbeatRef.current && now - lastHeartbeatRef.current < 55000) {
        return;
      }

      if (socket && isConnected) {
        socket.emit("participant_heartbeat");
        lastHeartbeatRef.current = now;
      }
    }, 60000); // Augmenté de 30s à 60s
  }, [socket, isConnected]);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  // Actions optimisées avec debouncing
  const joinSession = useCallback(
    (sessionCode, participantName, isAnonymous = false) => {
      if (!socket || !isConnected) {
        toast.error("Connexion non établie");
        return;
      }

      socket.emit("join_session", {
        sessionCode,
        participantName,
        isAnonymous,
      });
    },
    [socket, isConnected]
  );

  const leaveSession = useCallback(() => {
    if (socket && isConnected) {
      socket.emit("leave_session");
    }
    stopHeartbeat();
  }, [socket, isConnected, stopHeartbeat]);

  const hostSession = useCallback(
    (sessionId) => {
      if (socket && isConnected) {
        socket.emit("host_session", { sessionId });
      }
    },
    [socket, isConnected]
  );

  // Actions d'hôte optimisées
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

  // Debounced submit response pour éviter les doubles soumissions
  const submitResponseDebounced = useRef(null);
  const submitResponse = useCallback(
    (questionId, answer, timeSpent) => {
      if (!socket || !isConnected) {
        toast.error("Impossible d'envoyer la réponse - Connexion perdue");
        return;
      }

      // Annuler la précédente soumission si elle existe
      if (submitResponseDebounced.current) {
        clearTimeout(submitResponseDebounced.current);
      }

      // Debounce pour éviter les doubles clics
      submitResponseDebounced.current = setTimeout(() => {
        socket.emit("submit_response", {
          questionId,
          answer,
          timeSpent,
        });
      }, 100);
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

  // État de la session optimisé
  const [sessionState, setSessionState] = useState({
    sessionId: null,
    participantId: null,
    isHost: false,
    status: "disconnected",
  });

  // Gestionnaires d'événements avec cleanup automatique
  useEffect(() => {
    if (!socket) return;

    const eventHandlers = {
      session_joined: (data) => {
        console.log("✅ Session rejointe:", data);
        setSessionState((prev) => ({
          ...prev,
          sessionId: data.sessionId,
          participantId: data.participantId,
          status: "joined",
        }));
        startHeartbeat();
      },

      host_connected: (data) => {
        console.log("🎯 Hôte connecté:", data);
        setSessionState((prev) => ({
          ...prev,
          sessionId: data.sessionId,
          isHost: true,
          status: "hosting",
        }));
      },

      session_started: () => {
        console.log("🚀 Session démarrée");
        setSessionState((prev) => ({
          ...prev,
          status: "playing",
        }));
      },

      session_ended: () => {
        console.log("🏁 Session terminée");
        setSessionState((prev) => ({
          ...prev,
          status: "ended",
        }));
        stopHeartbeat();
      },

      error: (error) => {
        console.error("Socket error:", error);
        toast.error(error.message || "Erreur de connexion");
      },
    };

    // Enregistrer tous les événements
    Object.entries(eventHandlers).forEach(([event, handler]) => {
      socket.on(event, handler);
    });

    // Cleanup automatique
    return () => {
      Object.keys(eventHandlers).forEach((event) => {
        socket.off(event);
      });
    };
  }, [socket, startHeartbeat, stopHeartbeat]);

  // Heartbeat conditionnel - seulement pour les participants
  useEffect(() => {
    if (
      sessionState.sessionId &&
      sessionState.participantId &&
      !sessionState.isHost &&
      isConnected
    ) {
      startHeartbeat();
    } else {
      stopHeartbeat();
    }

    return stopHeartbeat;
  }, [sessionState, isConnected, startHeartbeat, stopHeartbeat]);

  // Context value optimisé avec memoization
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

    // Communication
    sendMessage,

    // Helpers optimisés
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
          // Retourner une fonction de cleanup
          return () => socket.off(event, handler);
        }
        return () => {};
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
