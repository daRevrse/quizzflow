import axios from "axios";
import Cookies from "js-cookie";

// Configuration de l'API
const API_BASE_URL =
  process.env.REACT_APP_API_URL || "http://localhost:3001/api";

// Instance Axios principale
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
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

// Services API organisés par domaine

// Service d'authentification
export const authService = {
  // Connexion
  login: async (credentials) => {
    const response = await apiClient.post("/auth/login", credentials);
    return response.data;
  },

  // Inscription
  register: async (userData) => {
    const response = await apiClient.post("/auth/register", userData);
    return response.data;
  },

  // Déconnexion
  logout: async () => {
    const response = await apiClient.post("/auth/logout");
    return response.data;
  },

  // Rafraîchir le token
  refreshToken: async (refreshToken) => {
    const response = await apiClient.post("/auth/refresh", { refreshToken });
    return response.data;
  },

  // Récupérer le profil utilisateur
  getProfile: async () => {
    const response = await apiClient.get("/auth/me");
    return response.data;
  },

  // Mettre à jour le profil
  updateProfile: async (profileData) => {
    const response = await apiClient.put("/auth/me", profileData);
    return response.data;
  },

  // Changer le mot de passe
  changePassword: async (passwordData) => {
    const response = await apiClient.put("/auth/password", passwordData);
    return response.data;
  },

  // Supprimer le compte
  deleteAccount: async (passwordData) => {
    const response = await apiClient.delete("/auth/account", {
      data: passwordData,
    });
    return response.data;
  },

  // Vérifier un token
  verifyToken: async () => {
    const response = await apiClient.get("/auth/verify");
    return response.data;
  },
};

// Service de gestion des quiz
export const quizService = {
  // Récupérer la liste des quiz avec filtres
  getQuizzes: async (params = {}) => {
    const response = await apiClient.get("/quiz", { params });
    return response.data;
  },

  // Récupérer mes quiz
  getMyQuizzes: async (params = {}) => {
    const response = await apiClient.get("/quiz/my", { params });
    return response.data;
  },

  // Récupérer les catégories
  getCategories: async () => {
    const response = await apiClient.get("/quiz/categories");
    return response.data;
  },

  // Récupérer un quiz spécifique
  getQuiz: async (quizId) => {
    const response = await apiClient.get(`/quiz/${quizId}`);
    return response.data;
  },

  // Créer un quiz
  createQuiz: async (quizData) => {
    const response = await apiClient.post("/quiz", quizData);
    return response.data;
  },

  // Mettre à jour un quiz
  updateQuiz: async (quizId, quizData) => {
    const response = await apiClient.put(`/quiz/${quizId}`, quizData);
    return response.data;
  },

  // Supprimer un quiz
  deleteQuiz: async (quizId) => {
    const response = await apiClient.delete(`/quiz/${quizId}`);
    return response.data;
  },

  // Dupliquer un quiz
  duplicateQuiz: async (quizId) => {
    const response = await apiClient.post(`/quiz/${quizId}/duplicate`);
    return response.data;
  },
};

// Service de gestion des sessions
export const sessionService = {
  // Récupérer les résultats détaillés
  getResults: async (sessionId) => {
    const response = await apiClient.get(`/session/${sessionId}/results`);
    return response.data;
  },

  // Récupérer la liste des sessions avec filtres
  getSessions: async (params = {}) => {
    const queryParams = new URLSearchParams();

    // Paramètres de pagination
    if (params.page) queryParams.set("page", params.page);
    if (params.limit) queryParams.set("limit", params.limit);

    // Filtres
    if (params.search) queryParams.set("search", params.search);
    if (params.status) queryParams.set("status", params.status);
    if (params.quizId) queryParams.set("quizId", params.quizId);
    if (params.hostId) queryParams.set("hostId", params.hostId);
    if (params.my) queryParams.set("my", params.my);

    const response = await apiClient.get(`/session?${queryParams.toString()}`);
    return response.data;
  },

  // Récupérer une session spécifique
  getSession: async (sessionId) => {
    const response = await apiClient.get(`/session/${sessionId}`);
    return response.data;
  },

  // Récupérer une session par code
  getSessionByCode: async (code) => {
    const response = await apiClient.get(`/session/code/${code}`);
    return response.data;
  },

  // Créer une session
  createSession: async (sessionData) => {
    const response = await apiClient.post("/session", sessionData);
    return response.data;
  },

  // Mettre à jour une session
  updateSession: async (sessionId, sessionData) => {
    const response = await apiClient.put(`/session/${sessionId}`, sessionData);
    return response.data;
  },

  // Supprimer une session
  deleteSession: async (sessionId) => {
    const response = await apiClient.delete(`/session/${sessionId}`);
    return response.data;
  },

  // Actions de session
  startSession: async (sessionId) => {
    const response = await apiClient.post(`/session/${sessionId}/start`);
    return response.data;
  },

  pauseSession: async (sessionId) => {
    const response = await apiClient.post(`/session/${sessionId}/pause`);
    return response.data;
  },

  resumeSession: async (sessionId) => {
    const response = await apiClient.post(`/session/${sessionId}/resume`);
    return response.data;
  },

  endSession: async (sessionId) => {
    const response = await apiClient.post(`/session/${sessionId}/end`);
    return response.data;
  },

  // Récupérer le classement
  getLeaderboard: async (sessionId) => {
    const response = await apiClient.get(`/session/${sessionId}/leaderboard`);
    return response.data;
  },

  // Récupérer les résultats détaillés - NOUVELLE MÉTHODE
  getSessionResults: async (sessionId) => {
    const response = await apiClient.get(`/session/${sessionId}/results`);
    return response.data;
  },

  joinSession: async (sessionId, participantData) => {
    // Validation des données côté client
    if (!sessionId) {
      throw new Error("ID de session requis");
    }

    if (
      !participantData?.participantName ||
      participantData.participantName.trim().length < 2
    ) {
      throw new Error("Nom de participant requis (minimum 2 caractères)");
    }

    // Nettoyer les données
    const cleanData = {
      participantName: participantData.participantName.trim(),
      isAnonymous: Boolean(participantData.isAnonymous),
    };

    console.log("📡 sessionService.joinSession:", {
      sessionId,
      data: cleanData,
    });

    try {
      const response = await apiClient.post(
        `/session/${sessionId}/join`,
        cleanData
      );

      console.log("✅ Join session success:", response.data);

      return response.data;
    } catch (error) {
      console.error(
        "❌ Join session error:",
        error.response?.data || error.message
      );

      // Reformater l'erreur pour le frontend
      if (error.response?.data) {
        const apiError = error.response.data;
        throw new Error(
          apiError.error || apiError.message || "Erreur lors de la connexion"
        );
      }

      throw error;
    }
  },

  // Quitter une session (BONUS - si nécessaire)
  leaveSession: async (sessionId, participantId) => {
    if (!sessionId || !participantId) {
      throw new Error("ID de session et participant requis");
    }

    const response = await apiClient.delete(
      `/session/${sessionId}/participants/${participantId}`
    );
    return response.data;
  },
};

// Service de gestion des fichiers (pour les futurs uploads)
export const fileService = {
  // Upload d'un fichier
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

    const response = await apiClient.post("/upload", formData, config);
    return response.data;
  },

  // Supprimer un fichier
  deleteFile: async (fileId) => {
    const response = await apiClient.delete(`/upload/${fileId}`);
    return response.data;
  },
};

// Service de statistiques et rapports
export const statsService = {
  // Statistiques du dashboard
  getDashboardStats: async () => {
    const response = await apiClient.get("/stats/dashboard");
    return response.data;
  },

  // Statistiques des quiz
  getQuizStats: async (quizId, params = {}) => {
    const response = await apiClient.get(`/stats/quiz/${quizId}`, { params });
    return response.data;
  },

  // Statistiques des sessions
  getSessionStats: async (sessionId) => {
    const response = await apiClient.get(`/stats/session/${sessionId}`);
    return response.data;
  },

  // Export des données
  exportData: async (type, params = {}) => {
    const response = await apiClient.get(`/export/${type}`, {
      params,
      responseType: "blob", // Pour les fichiers
    });
    return response.data;
  },
};

// Utilitaires pour les erreurs API
export const handleApiError = (error) => {
  if (error.response) {
    // Erreur de réponse du serveur
    const { status, data } = error.response;

    switch (status) {
      case 400:
        return {
          type: "validation",
          message: data.error || "Données invalides",
          details: data.details || [],
        };
      case 401:
        return {
          type: "auth",
          message: "Vous devez être connecté pour accéder à cette ressource",
          code: data.code,
        };
      case 403:
        return {
          type: "permission",
          message: "Vous n'avez pas les permissions nécessaires",
          code: data.code,
        };
      case 404:
        return {
          type: "notFound",
          message: "Ressource non trouvée",
          code: data.code,
        };
      case 409:
        return {
          type: "conflict",
          message: data.error || "Conflit de données",
          code: data.code,
        };
      case 429:
        return {
          type: "rateLimit",
          message: "Trop de requêtes, veuillez patienter",
          code: data.code,
        };
      case 500:
        return {
          type: "server",
          message: "Erreur interne du serveur",
          code: data.code,
        };
      default:
        return {
          type: "unknown",
          message: data.error || "Une erreur inattendue s'est produite",
          code: data.code,
        };
    }
  } else if (error.request) {
    // Erreur de réseau
    return {
      type: "network",
      message:
        "Impossible de contacter le serveur. Vérifiez votre connexion internet.",
    };
  } else {
    // Autre erreur
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
