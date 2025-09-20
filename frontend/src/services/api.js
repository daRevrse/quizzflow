import axios from "axios";
import Cookies from "js-cookie";

// Configuration de l'API
const API_BASE_URL =
  process.env.REACT_APP_API_URL || "http://localhost:3001/api";

// Instance Axios principale
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000, // Augmenté pour les requêtes lentes
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true, // Important pour les cookies de session
});

// Intercepteur pour ajouter automatiquement le token
apiClient.interceptors.request.use(
  (config) => {
    const token = Cookies.get("accessToken");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Intercepteur pour gérer les erreurs de réponse
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Si token expiré et qu'on n'a pas déjà essayé de le rafraîchir
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      originalRequest.url !== "/auth/refresh"
    ) {
      originalRequest._retry = true;

      try {
        const refreshToken = Cookies.get("refreshToken");
        if (refreshToken) {
          const response = await apiClient.post("/auth/refresh", {
            refreshToken,
          });
          const { accessToken } = response.data;

          Cookies.set("accessToken", accessToken, { expires: 1 });
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;

          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, redirect to login
        Cookies.remove("accessToken");
        Cookies.remove("refreshToken");
        window.location.href = "/login";
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Service d'authentification
export const authService = {
  login: async (credentials) => {
    try {
      const response = await apiClient.post("/auth/login", credentials);
      return response.data;
    } catch (error) {
      throw new Error(
        error.response?.data?.error ||
          error.response?.data?.message ||
          "Erreur de connexion"
      );
    }
  },

  register: async (userData) => {
    try {
      const response = await apiClient.post("/auth/register", userData);
      return response.data;
    } catch (error) {
      throw new Error(
        error.response?.data?.error ||
          error.response?.data?.message ||
          "Erreur d'inscription"
      );
    }
  },

  logout: async () => {
    try {
      const response = await apiClient.post("/auth/logout");
      return response.data;
    } catch (error) {
      console.warn("Erreur lors de la déconnexion:", error);
      // Continuer même en cas d'erreur côté serveur
      return { success: true };
    }
  },

  refreshToken: async (refreshToken) => {
    const response = await apiClient.post("/auth/refresh", { refreshToken });
    return response.data;
  },

  getProfile: async () => {
    const response = await apiClient.get("/auth/me");
    return response.data;
  },

  updateProfile: async (profileData) => {
    const response = await apiClient.put("/auth/me", profileData);
    return response.data;
  },

  changePassword: async (passwordData) => {
    const response = await apiClient.put("/auth/password", passwordData);
    return response.data;
  },

  deleteAccount: async (passwordData) => {
    const response = await apiClient.delete("/auth/account", {
      data: passwordData,
    });
    return response.data;
  },

  verifyToken: async () => {
    const response = await apiClient.get("/auth/verify");
    return response.data;
  },
};

// Service de gestion des quiz
export const quizService = {
  getQuizzes: async (params = {}) => {
    const response = await apiClient.get("/quiz", { params });
    return response.data;
  },

  getMyQuizzes: async (params = {}) => {
    const response = await apiClient.get("/quiz/my", { params });
    return response.data;
  },

  getCategories: async () => {
    const response = await apiClient.get("/quiz/categories");
    return response.data;
  },

  getQuiz: async (quizId) => {
    if (!quizId) {
      throw new Error("ID de quiz requis");
    }
    const response = await apiClient.get(`/quiz/${quizId}`);
    return response.data;
  },

  createQuiz: async (quizData) => {
    const response = await apiClient.post("/quiz", quizData);
    return response.data;
  },

  updateQuiz: async (quizId, quizData) => {
    if (!quizId) {
      throw new Error("ID de quiz requis");
    }
    const response = await apiClient.put(`/quiz/${quizId}`, quizData);
    return response.data;
  },

  deleteQuiz: async (quizId) => {
    if (!quizId) {
      throw new Error("ID de quiz requis");
    }
    const response = await apiClient.delete(`/quiz/${quizId}`);
    return response.data;
  },

  duplicateQuiz: async (quizId) => {
    if (!quizId) {
      throw new Error("ID de quiz requis");
    }
    const response = await apiClient.post(`/quiz/${quizId}/duplicate`);
    return response.data;
  },
};

// Service de gestion des sessions - CORRIGÉ ET OPTIMISÉ
export const sessionService = {
  // Récupérer la liste des sessions avec filtres
  getSessions: async (params = {}) => {
    try {
      const queryParams = new URLSearchParams();

      // Paramètres de pagination
      if (params.page) queryParams.set("page", params.page.toString());
      if (params.limit) queryParams.set("limit", params.limit.toString());

      // Filtres
      if (params.search && params.search.trim()) {
        queryParams.set("search", params.search.trim());
      }
      if (params.status && params.status !== "all") {
        queryParams.set("status", params.status);
      }
      if (params.quizId) queryParams.set("quizId", params.quizId.toString());
      if (params.hostId) queryParams.set("hostId", params.hostId.toString());
      if (params.my === true || params.my === "true") {
        queryParams.set("my", "true");
      }

      const response = await apiClient.get(
        `/session?${queryParams.toString()}`
      );
      return response.data;
    } catch (error) {
      console.error("❌ getSessions error:", error);
      throw new Error(
        error.response?.data?.error ||
          "Erreur lors de la récupération des sessions"
      );
    }
  },

  // Récupérer les détails d'une session par ID
  getSession: async (sessionId) => {
    if (!sessionId) {
      throw new Error("ID de session requis");
    }

    try {
      console.log("📡 sessionService.getSession:", sessionId);

      const response = await apiClient.get(`/session/${sessionId}`);

      console.log("✅ getSession response:", response.data);
      return response.data;
    } catch (error) {
      console.error("❌ getSession error:", error);

      if (error.response?.status === 404) {
        throw new Error("Session non trouvée");
      }

      throw new Error(
        error.response?.data?.error ||
          "Erreur lors de la récupération de la session"
      );
    }
  },

  // Récupérer une session par son code
  getSessionByCode: async (code) => {
    if (!code || typeof code !== "string" || code.length !== 6) {
      throw new Error("Code de session invalide (doit faire 6 caractères)");
    }

    try {
      console.log("📡 sessionService.getSessionByCode:", code);

      const response = await apiClient.get(
        `/session/code/${code.toUpperCase().trim()}`
      );

      console.log("✅ getSessionByCode response:", response.data);
      return response.data;
    } catch (error) {
      console.error("❌ getSessionByCode error:", error);

      if (error.response?.status === 404) {
        throw new Error("Session non trouvée avec ce code");
      }

      throw new Error(
        error.response?.data?.error ||
          "Erreur lors de la recherche de la session"
      );
    }
  },

  // Créer une nouvelle session
  createSession: async (sessionData) => {
    if (!sessionData.quizId || !sessionData.title) {
      throw new Error("Quiz et titre requis pour créer une session");
    }

    try {
      console.log(
        "📡 sessionService.createSession - données reçues:",
        sessionData
      );

      // CORRECTION: Assurer le format correct des settings
      const defaultSettings = {
        allowAnonymous: true,
        allowLateJoin: false,
        showLeaderboard: true,
        maxParticipants: 100,
        autoAdvance: false,
        shuffleQuestions: false,
        shuffleAnswers: false,
        questionTimeLimit: null,
        showCorrectAnswers: true,
        randomizeQuestions: false,
        enableChat: false,
      };

      // Merger les settings avec les valeurs par défaut
      const mergedSettings = { ...defaultSettings };

      if (sessionData.settings && typeof sessionData.settings === "object") {
        // Copier seulement les propriétés définies
        Object.keys(sessionData.settings).forEach((key) => {
          if (sessionData.settings[key] !== undefined) {
            mergedSettings[key] = sessionData.settings[key];
          }
        });
      }

      // Formater les données pour l'API
      const cleanData = {
        // quizId: parseInt(sessionData.quizId),
        quizId: sessionData.quizId,
        title: sessionData.title.trim(),
        description:
          sessionData.description && sessionData.description.trim()
            ? sessionData.description.trim()
            : undefined,
        settings: mergedSettings,
      };

      console.log(
        "📦 sessionService.createSession - données nettoyées:",
        cleanData
      );

      const response = await apiClient.post("/session", cleanData);

      console.log("✅ createSession response:", response.data);
      return response.data;
    } catch (error) {
      console.error("❌ createSession error:", error);
      console.error("❌ Error response data:", error.response?.data);

      // Détailler l'erreur pour le debug
      if (error.response?.data?.details) {
        console.error("❌ Validation details:", error.response.data.details);
      }

      throw new Error(
        error.response?.data?.error ||
          error.response?.data?.message ||
          "Erreur lors de la création de la session"
      );
    }
  },

  // Rejoindre une session - MÉTHODE CORRIGÉE
  joinSession: async (sessionId, participantData) => {
    if (!sessionId) {
      throw new Error("ID de session requis");
    }

    if (
      !participantData.participantName ||
      typeof participantData.participantName !== "string" ||
      participantData.participantName.trim().length < 2
    ) {
      throw new Error("Nom de participant requis (minimum 2 caractères)");
    }

    const cleanData = {
      participantName: participantData.participantName.trim(),
      isAnonymous: Boolean(participantData.isAnonymous),
    };

    try {
      console.log("📡 sessionService.joinSession:", {
        sessionId,
        data: cleanData,
      });

      const response = await apiClient.post(
        `/session/${sessionId}/join`,
        cleanData
      );

      console.log("✅ joinSession response:", response.data);
      return response.data;
    } catch (error) {
      console.error("❌ joinSession error:", error);

      // Reformater l'erreur pour le frontend
      const errorMessage =
        error.response?.data?.error ||
        error.response?.data?.message ||
        "Erreur lors de la connexion à la session";

      throw new Error(errorMessage);
    }
  },

  // Démarrer une session
  startSession: async (sessionId) => {
    if (!sessionId) {
      throw new Error("ID de session requis");
    }

    try {
      console.log("📡 sessionService.startSession:", sessionId);

      const response = await apiClient.post(`/session/${sessionId}/start`);

      console.log("✅ startSession response:", response.data);
      return response.data;
    } catch (error) {
      console.error("❌ startSession error:", error);

      throw new Error(
        error.response?.data?.error || "Erreur lors du démarrage de la session"
      );
    }
  },

  // Mettre en pause une session
  pauseSession: async (sessionId) => {
    if (!sessionId) {
      throw new Error("ID de session requis");
    }

    try {
      const response = await apiClient.post(`/session/${sessionId}/pause`);
      return response.data;
    } catch (error) {
      throw new Error(
        error.response?.data?.error || "Erreur lors de la mise en pause"
      );
    }
  },

  // Reprendre une session
  resumeSession: async (sessionId) => {
    if (!sessionId) {
      throw new Error("ID de session requis");
    }

    try {
      const response = await apiClient.post(`/session/${sessionId}/resume`);
      return response.data;
    } catch (error) {
      throw new Error(
        error.response?.data?.error || "Erreur lors de la reprise"
      );
    }
  },

  // Terminer une session
  endSession: async (sessionId) => {
    if (!sessionId) {
      throw new Error("ID de session requis");
    }

    try {
      const response = await apiClient.post(`/session/${sessionId}/end`);
      return response.data;
    } catch (error) {
      throw new Error(
        error.response?.data?.error || "Erreur lors de la fermeture"
      );
    }
  },

  // Supprimer une session
  deleteSession: async (sessionId) => {
    if (!sessionId) {
      throw new Error("ID de session requis");
    }

    try {
      const response = await apiClient.delete(`/session/${sessionId}`);
      return response.data;
    } catch (error) {
      throw new Error(
        error.response?.data?.error || "Erreur lors de la suppression"
      );
    }
  },

  // Mettre à jour une session
  updateSession: async (sessionId, sessionData) => {
    if (!sessionId) {
      throw new Error("ID de session requis");
    }

    try {
      const response = await apiClient.put(
        `/session/${sessionId}`,
        sessionData
      );
      return response.data;
    } catch (error) {
      throw new Error(
        error.response?.data?.error || "Erreur lors de la mise à jour"
      );
    }
  },

  // Récupérer les résultats détaillés d'une session
  getResults: async (sessionId) => {
    if (!sessionId) {
      throw new Error("ID de session requis");
    }

    try {
      const response = await apiClient.get(`/session/${sessionId}/results`);
      return response.data;
    } catch (error) {
      throw new Error(
        error.response?.data?.error ||
          "Erreur lors de la récupération des résultats"
      );
    }
  },

  // Quitter une session (optionnel)
  leaveSession: async (sessionId, participantId) => {
    if (!sessionId || !participantId) {
      throw new Error("ID de session et participant requis");
    }

    try {
      const response = await apiClient.delete(
        `/session/${sessionId}/participants/${participantId}`
      );
      return response.data;
    } catch (error) {
      throw new Error(
        error.response?.data?.error || "Erreur lors de la déconnexion"
      );
    }
  },
};

// Service de gestion des fichiers (pour les futurs uploads)
export const fileService = {
  uploadFile: async (file, onProgress = null) => {
    const formData = new FormData();
    formData.append("file", file);

    const config = {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    };

    if (onProgress) {
      config.onUploadProgress = (progressEvent) => {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        );
        onProgress(percentCompleted);
      };
    }

    try {
      const response = await apiClient.post("/upload", formData, config);
      return response.data;
    } catch (error) {
      throw new Error(
        error.response?.data?.error || "Erreur lors de l'upload du fichier"
      );
    }
  },

  deleteFile: async (fileId) => {
    if (!fileId) {
      throw new Error("ID de fichier requis");
    }

    try {
      const response = await apiClient.delete(`/upload/${fileId}`);
      return response.data;
    } catch (error) {
      throw new Error(
        error.response?.data?.error ||
          "Erreur lors de la suppression du fichier"
      );
    }
  },
};

// Service de statistiques et rapports
export const statsService = {
  getDashboardStats: async () => {
    try {
      const response = await apiClient.get("/stats/dashboard");
      return response.data;
    } catch (error) {
      throw new Error(
        error.response?.data?.error ||
          "Erreur lors de la récupération des statistiques"
      );
    }
  },

  getQuizStats: async (quizId, period = "7d") => {
    if (!quizId) {
      throw new Error("ID de quiz requis");
    }

    try {
      const response = await apiClient.get(`/stats/quiz/${quizId}`, {
        params: { period },
      });
      return response.data;
    } catch (error) {
      throw new Error(
        error.response?.data?.error ||
          "Erreur lors de la récupération des statistiques du quiz"
      );
    }
  },

  getSessionStats: async (sessionId) => {
    if (!sessionId) {
      throw new Error("ID de session requis");
    }

    try {
      const response = await apiClient.get(`/stats/session/${sessionId}`);
      return response.data;
    } catch (error) {
      throw new Error(
        error.response?.data?.error ||
          "Erreur lors de la récupération des statistiques de la session"
      );
    }
  },
};

// Helper pour analyser et formater les erreurs API
export const handleApiError = (error) => {
  console.error("API Error:", error);

  if (!error.response) {
    // Erreur réseau ou pas de réponse
    return {
      type: "network",
      message: "Problème de connexion. Vérifiez votre connexion internet.",
    };
  }

  const status = error.response.status;
  const data = error.response.data;

  if (status === 400) {
    return {
      type: "validation",
      message: data?.error || data?.message || "Données invalides",
      details: data?.details,
    };
  } else if (status === 401) {
    return {
      type: "auth",
      message: "Session expirée. Veuillez vous reconnecter.",
    };
  } else if (status === 403) {
    return {
      type: "permission",
      message: data?.error || "Permissions insuffisantes",
    };
  } else if (status === 404) {
    return {
      type: "notFound",
      message: data?.error || "Ressource non trouvée",
    };
  } else if (status === 409) {
    return {
      type: "conflict",
      message: data?.error || "Conflit de données",
    };
  } else if (status === 422) {
    return {
      type: "validation",
      message: data?.error || "Données invalides",
      details: data?.details,
    };
  } else if (status >= 500) {
    return {
      type: "server",
      message: "Erreur du serveur. Veuillez réessayer plus tard.",
    };
  } else {
    return {
      type: "unknown",
      message: error.message || "Une erreur inattendue s'est produite",
    };
  }
};

// Helper pour créer des requêtes avec retry automatique
export const createRetryRequest = (apiCall, maxRetries = 3, delay = 1000) => {
  return async (...args) => {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await apiCall(...args);
      } catch (error) {
        lastError = error;

        // Ne pas retry pour certaines erreurs
        if (
          error.response &&
          [400, 401, 403, 404, 422].includes(error.response.status)
        ) {
          throw error;
        }

        // Attendre avant le prochain essai (sauf au dernier)
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, delay * attempt));
        }
      }
    }

    throw lastError;
  };
};

// Helper pour les requêtes paginées
export const createPaginatedRequest = (apiCall) => {
  return async (allParams = {}) => {
    const { page = 1, limit = 20, ...params } = allParams;

    return await apiCall({
      ...params,
      page,
      limit,
    });
  };
};

export default apiClient;
