import { create } from "zustand";
import { persist } from "zustand/middleware";
import Cookies from "js-cookie";
import { apiClient } from "../services/api";
import toast from "react-hot-toast";

// Store d'authentification avec Zustand
export const useAuthStore = create(
  persist(
    (set, get) => ({
      // État initial
      user: null,
      accessToken: null,
      refreshToken: null,
      isLoading: true,
      isAuthenticated: false,

      // Actions
      login: async (credentials) => {
        try {
          set({ isLoading: true });

          const response = await apiClient.post("/auth/login", credentials);
          const { user, tokens } = response.data;

          // Stocker les tokens
          const { accessToken, refreshToken } = tokens;
          Cookies.set("accessToken", accessToken, {
            expires: 1, // 1 jour
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
          });

          Cookies.set("refreshToken", refreshToken, {
            expires: 7, // 7 jours
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
          });

          // Mettre à jour le state
          set({
            user,
            accessToken,
            refreshToken,
            isAuthenticated: true,
            isLoading: false,
          });

          // Configurer l'intercepteur avec le nouveau token
          apiClient.defaults.headers.common[
            "Authorization"
          ] = `Bearer ${accessToken}`;

          toast.success(`Bienvenue ${user.firstName || user.username} !`);

          return { success: true, user };
        } catch (error) {
          set({ isLoading: false });

          const message =
            error.response?.data?.error || "Erreur lors de la connexion";
          toast.error(message);

          return { success: false, error: message };
        }
      },

      register: async (userData) => {
        try {
          set({ isLoading: true });

          const response = await apiClient.post("/auth/register", userData);
          const { user, tokens } = response.data;

          // Stocker les tokens
          const { accessToken, refreshToken } = tokens;
          Cookies.set("accessToken", accessToken, {
            expires: 1,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
          });

          Cookies.set("refreshToken", refreshToken, {
            expires: 7,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
          });

          // Mettre à jour le state
          set({
            user,
            accessToken,
            refreshToken,
            isAuthenticated: true,
            isLoading: false,
          });

          // Configurer l'intercepteur
          apiClient.defaults.headers.common[
            "Authorization"
          ] = `Bearer ${accessToken}`;

          toast.success("Compte créé avec succès ! Bienvenue !");

          return { success: true, user };
        } catch (error) {
          set({ isLoading: false });

          const message =
            error.response?.data?.error || "Erreur lors de l'inscription";
          toast.error(message);

          return { success: false, error: message };
        }
      },

      logout: async () => {
        try {
          // Appeler l'endpoint de déconnexion si l'utilisateur est connecté
          const { accessToken } = get();
          if (accessToken) {
            await apiClient.post("/auth/logout");
          }
        } catch (error) {
          console.log("Erreur lors de la déconnexion:", error);
        } finally {
          // Nettoyer les tokens
          Cookies.remove("accessToken");
          Cookies.remove("refreshToken");

          // Nettoyer l'intercepteur
          delete apiClient.defaults.headers.common["Authorization"];

          // Réinitialiser le state
          set({
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
            isLoading: false,
          });

          toast.success("Déconnexion réussie");
        }
      },

      updateProfile: async (profileData) => {
        try {
          set({ isLoading: true });

          const response = await apiClient.put("/auth/me", profileData);
          const { user } = response.data;

          set({
            user,
            isLoading: false,
          });

          toast.success("Profil mis à jour avec succès");

          return { success: true, user };
        } catch (error) {
          set({ isLoading: false });

          const message =
            error.response?.data?.error || "Erreur lors de la mise à jour";
          toast.error(message);

          return { success: false, error: message };
        }
      },

      changePassword: async (passwordData) => {
        try {
          set({ isLoading: true });

          await apiClient.put("/auth/password", passwordData);

          set({ isLoading: false });
          toast.success("Mot de passe modifié avec succès");

          return { success: true };
        } catch (error) {
          set({ isLoading: false });

          const message =
            error.response?.data?.error ||
            "Erreur lors du changement de mot de passe";
          toast.error(message);

          return { success: false, error: message };
        }
      },

      refreshAccessToken: async () => {
        try {
          const { refreshToken } = get();
          if (!refreshToken) {
            throw new Error("Aucun refresh token disponible");
          }

          const response = await apiClient.post("/auth/refresh", {
            refreshToken,
          });

          const { tokens } = response.data;
          const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
            tokens;

          // Mettre à jour les cookies
          Cookies.set("accessToken", newAccessToken, {
            expires: 1,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
          });

          Cookies.set("refreshToken", newRefreshToken, {
            expires: 7,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
          });

          // Mettre à jour le state
          set({
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
          });

          // Mettre à jour l'intercepteur
          apiClient.defaults.headers.common[
            "Authorization"
          ] = `Bearer ${newAccessToken}`;

          return newAccessToken;
        } catch (error) {
          console.error("Erreur lors du renouvellement du token:", error);

          // Token de rafraîchissement invalide, déconnecter l'utilisateur
          get().logout();

          throw error;
        }
      },

      initializeAuth: async () => {
        try {
          set({ isLoading: true });

          // Récupérer les tokens depuis les cookies
          const accessToken = Cookies.get("accessToken");
          const refreshToken = Cookies.get("refreshToken");

          if (!accessToken) {
            set({ isLoading: false });
            return;
          }

          // Configurer l'intercepteur
          apiClient.defaults.headers.common[
            "Authorization"
          ] = `Bearer ${accessToken}`;

          try {
            // Vérifier la validité du token en récupérant le profil
            const response = await apiClient.get("/auth/me");
            const { user } = response.data;

            set({
              user,
              accessToken,
              refreshToken,
              isAuthenticated: true,
              isLoading: false,
            });
          } catch (error) {
            // Token expiré, essayer de le rafraîchir
            if (error.response?.status === 401 && refreshToken) {
              try {
                await get().refreshAccessToken();

                // Réessayer de récupérer le profil
                const response = await apiClient.get("/auth/me");
                const { user } = response.data;

                set({
                  user,
                  isAuthenticated: true,
                  isLoading: false,
                });
              } catch (refreshError) {
                // Impossible de rafraîchir, déconnecter
                get().logout();
              }
            } else {
              // Token invalide ou aucun refresh token
              get().logout();
            }
          }
        } catch (error) {
          console.error("Erreur lors de l'initialisation de l'auth:", error);
          set({ isLoading: false });
        }
      },

      // Vérifier si l'utilisateur a un rôle spécifique
      hasRole: (role) => {
        const { user } = get();
        return user?.role === role;
      },

      // Vérifier si l'utilisateur a l'un des rôles spécifiés
      hasAnyRole: (roles) => {
        const { user } = get();
        return user && roles.includes(user.role);
      },

      // Vérifier si l'utilisateur est formateur ou admin
      canCreateQuiz: () => {
        const { user } = get();
        return user && ["formateur", "admin"].includes(user.role);
      },

      // Vérifier si l'utilisateur est admin
      isAdmin: () => {
        const { user } = get();
        return user?.role === "admin";
      },
    }),
    {
      name: "auth-storage",
      // Ne pas persister les tokens sensibles dans localStorage
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// Intercepteur pour gérer l'expiration des tokens automatiquement
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const { refreshAccessToken, isAuthenticated } = useAuthStore.getState();

        if (isAuthenticated) {
          await refreshAccessToken();

          // Retry la requête originale avec le nouveau token
          const newToken = useAuthStore.getState().accessToken;
          originalRequest.headers.Authorization = `Bearer ${newToken}`;

          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        // Le refresh a échoué, l'utilisateur sera déconnecté par refreshAccessToken
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);
