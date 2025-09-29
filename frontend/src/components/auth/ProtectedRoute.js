import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";
import LoadingSpinner from "../common/LoadingSpinner";

const ProtectedRoute = ({ children, roles = [] }) => {
  const { user, isAuthenticated, isLoading } = useAuthStore();
  const location = useLocation();

  // Afficher le loader pendant l'initialisation
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            Vérification des permissions...
          </p>
        </div>
      </div>
    );
  }

  // Rediriger vers la page de connexion si non authentifié
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Vérifier les rôles si spécifiés
  if (roles.length > 0 && !roles.includes(user.role)) {
    // return (
    //   <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
    //     <div className="max-w-md w-full mx-auto">
    //       <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-6 text-center">
    //         <div className="w-16 h-16 mx-auto mb-4 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
    //           <svg
    //             className="w-8 h-8 text-red-600 dark:text-red-400"
    //             fill="none"
    //             stroke="currentColor"
    //             viewBox="0 0 24 24"
    //           >
    //             <path
    //               strokeLinecap="round"
    //               strokeLinejoin="round"
    //               strokeWidth={2}
    //               d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.664-.833-2.464 0L5.268 16.5c-.77.833.192 2.5 1.732 2.5z"
    //             />
    //           </svg>
    //         </div>
    //         <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
    //           Accès refusé
    //         </h2>
    //         <p className="text-gray-600 dark:text-gray-400 mb-4">
    //           Vous n'avez pas les permissions nécessaires pour accéder à cette
    //           page.
    //         </p>
    //         <p className="text-sm text-gray-500 dark:text-gray-500 mb-6">
    //           Rôles requis : {roles.join(", ")} | Votre rôle : {user.role}
    //         </p>
    //         <button
    //           onClick={() => window.history.back()}
    //           className="btn-primary"
    //         >
    //           Retour
    //         </button>
    //       </div>
    //     </div>
    //   </div>
    // );
    return <Navigate to="/dashboard" state={{ from: location }} replace />;
  }

  // Rendre le composant si tout est bon
  return children;
};

export default ProtectedRoute;
