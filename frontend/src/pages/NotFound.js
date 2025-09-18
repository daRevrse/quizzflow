import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import {
  HomeIcon,
  ArrowLeftIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";

const NotFound = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 px-4 py-16 sm:px-6 sm:py-24 md:grid md:place-items-center lg:px-8">
      <div className="max-w-max mx-auto">
        <main className="sm:flex">
          <p className="text-4xl font-extrabold text-primary-600 dark:text-primary-400 sm:text-5xl">
            404
          </p>
          <div className="sm:ml-6">
            <div className="sm:border-l sm:border-gray-200 dark:sm:border-gray-700 sm:pl-6">
              <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight sm:text-5xl">
                Page introuvable
              </h1>
              <p className="mt-1 text-base text-gray-500 dark:text-gray-400">
                La page que vous recherchez n'existe pas ou a été déplacée.
              </p>
            </div>
            <div className="mt-10 flex flex-col sm:flex-row sm:space-x-3 space-y-3 sm:space-y-0">
              <Link
                to={isAuthenticated ? "/dashboard" : "/"}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                <HomeIcon className="h-4 w-4 mr-2" />
                {isAuthenticated ? "Retour au Dashboard" : "Retour à l'accueil"}
              </Link>
              <button
                onClick={() => navigate(-1)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                <ArrowLeftIcon className="h-4 w-4 mr-2" />
                Retour
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default NotFound;
