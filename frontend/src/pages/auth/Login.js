import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useAuthStore } from "../../stores/authStore";
import { useThemeStore } from "../../stores/themeStore";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import {
  EyeIcon,
  EyeSlashIcon,
  SunIcon,
  MoonIcon,
  ComputerDesktopIcon,
} from "@heroicons/react/24/outline";

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuthStore();
  const { theme, setTheme } = useThemeStore();

  const {
    register,
    handleSubmit,
    formState: { errors },
    setFocus,
  } = useForm();

  // Focus automatique sur le premier champ
  useEffect(() => {
    setFocus("identifier");
  }, [setFocus]);

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    try {
      const result = await login(data);

      if (result.success) {
        // Rediriger vers la page demandée ou le dashboard
        const from = location.state?.from?.pathname || "/dashboard";
        navigate(from, { replace: true });
      }
    } catch (error) {
      console.error("Erreur de connexion:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
  };

  const ThemeIcon = theme === "light" ? SunIcon : MoonIcon;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          {/* Logo */}
          <div className="flex justify-center">
            <Link to="/" className="flex items-center space-x-2 ml-2 lg:ml-0">
              <div className="w-16 h-16 bg-gradient-to-r bg-white rounded-xl flex items-center justify-center shadow-lg">
                <img src="/images/logo.png" alt="Logo" className="w-16 h-16" />
              </div>
            </Link>
          </div>

          <h2 className="mt-6 text-3xl font-extrabold text-gray-900 dark:text-white">
            Connexion
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Accédez à votre compte QuizFlow
          </p>
        </div>

        {/* Formulaire */}
        <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4">
            {/* Email ou nom d'utilisateur */}
            <div>
              <label htmlFor="identifier" className="sr-only">
                Email ou nom d'utilisateur
              </label>
              <input
                {...register("identifier", {
                  required: "Email ou nom d'utilisateur requis",
                })}
                type="text"
                autoComplete="username"
                className={`input ${errors.identifier ? "input-error" : ""}`}
                placeholder="Email ou nom d'utilisateur"
                disabled={isSubmitting}
              />
              {errors.identifier && (
                <p className="mt-1 text-sm text-danger-600 dark:text-danger-400">
                  {errors.identifier.message}
                </p>
              )}
            </div>

            {/* Mot de passe */}
            <div className="relative">
              <label htmlFor="password" className="sr-only">
                Mot de passe
              </label>
              <input
                {...register("password", {
                  required: "Mot de passe requis",
                })}
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                className={`input pr-12 ${
                  errors.password ? "input-error" : ""
                }`}
                placeholder="Mot de passe"
                disabled={isSubmitting}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isSubmitting}
              >
                {showPassword ? (
                  <EyeSlashIcon className="h-5 w-5 text-gray-400" />
                ) : (
                  <EyeIcon className="h-5 w-5 text-gray-400" />
                )}
              </button>
              {errors.password && (
                <p className="mt-1 text-sm text-danger-600 dark:text-danger-400">
                  {errors.password.message}
                </p>
              )}
            </div>
          </div>

          {/* Options */}
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <Link
                to="/forgot-password"
                className="font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300"
              >
                Mot de passe oublié ?
              </Link>
            </div>
          </div>

          {/* Bouton de connexion */}
          <div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              {isSubmitting ? (
                <LoadingSpinner size="sm" color="white" inline />
              ) : (
                "Se connecter"
              )}
            </button>
          </div>

          {/* Lien d'inscription */}
          <div className="text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Pas encore de compte ?{" "}
              <Link
                to="/register"
                className="font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300"
              >
                S'inscrire
              </Link>
            </p>
          </div>
        </form>

        {/* Divider */}
        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300 dark:border-gray-600" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400">
                Ou
              </span>
            </div>
          </div>
        </div>

        {/* Lien rejoindre un quiz */}
        <div className="mt-6">
          <Link
            to="/join"
            className="group relative w-full flex justify-center py-3 px-4 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors duration-200"
          >
            Rejoindre un quiz sans compte
          </Link>
        </div>

        {/* Comptes de démonstration */}
        <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900 rounded-lg border border-blue-200 dark:border-blue-700">
          <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
            Comptes de démonstration
          </h3>
          <div className="space-y-1 text-xs text-blue-600 dark:text-blue-300">
            <p>
              <strong>Admin:</strong> admin@quiz-app.local / password123
            </p>
            <p>
              <strong>Formateur:</strong> formateur@quiz-app.local / password123
            </p>
          </div>
        </div>
      </div>

      {/* Bouton de thème en position fixe */}
      <button
        onClick={toggleTheme}
        className="fixed top-4 right-4 p-3 rounded-full bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors duration-200"
        title={`Basculer vers le thème ${
          theme === "light" ? "sombre" : "clair"
        }`}
      >
        <ThemeIcon className="h-5 w-5" />
      </button>
    </div>
  );
};

export default Login;
