import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useAuthStore } from "../../stores/authStore";
import { useThemeStore } from "../../stores/themeStore";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import {
  EyeIcon,
  EyeSlashIcon,
  SunIcon,
  MoonIcon,
  CheckIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

const Register = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const navigate = useNavigate();
  const { register: registerUser } = useAuthStore();
  const { theme, setTheme } = useThemeStore();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
    setFocus,
  } = useForm({
    defaultValues: {
      role: "formateur",
    },
  });

  const password = watch("password");

  // Focus automatique sur le premier champ
  useEffect(() => {
    setFocus("firstName");
  }, [setFocus]);

  // Validation du mot de passe
  const passwordRequirements = [
    { label: "Au moins 6 caractères", test: (pwd) => pwd && pwd.length >= 6 },
    { label: "Une lettre majuscule", test: (pwd) => pwd && /[A-Z]/.test(pwd) },
    { label: "Une lettre minuscule", test: (pwd) => pwd && /[a-z]/.test(pwd) },
    { label: "Un chiffre", test: (pwd) => pwd && /\d/.test(pwd) },
  ];

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    try {
      const result = await registerUser(data);

      if (result.success) {
        navigate("/dashboard", { replace: true });
      }
    } catch (error) {
      console.error("Erreur d'inscription:", error);
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
            <div className="w-16 h-16 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-2xl">Q</span>
            </div>
          </div>

          <h2 className="mt-6 text-3xl font-extrabold text-gray-900 dark:text-white">
            Inscription
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Créez votre compte QuizApp gratuitement
          </p>
        </div>

        {/* Formulaire */}
        <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4">
            {/* Prénom et Nom */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="firstName" className="sr-only">
                  Prénom
                </label>
                <input
                  {...register("firstName", {
                    required: "Prénom requis",
                    minLength: {
                      value: 2,
                      message: "Le prénom doit contenir au moins 2 caractères",
                    },
                  })}
                  type="text"
                  autoComplete="given-name"
                  className={`input ${errors.firstName ? "input-error" : ""}`}
                  placeholder="Prénom"
                  disabled={isSubmitting}
                />
                {errors.firstName && (
                  <p className="mt-1 text-sm text-danger-600 dark:text-danger-400">
                    {errors.firstName.message}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="lastName" className="sr-only">
                  Nom
                </label>
                <input
                  {...register("lastName", {
                    required: "Nom requis",
                    minLength: {
                      value: 2,
                      message: "Le nom doit contenir au moins 2 caractères",
                    },
                  })}
                  type="text"
                  autoComplete="family-name"
                  className={`input ${errors.lastName ? "input-error" : ""}`}
                  placeholder="Nom"
                  disabled={isSubmitting}
                />
                {errors.lastName && (
                  <p className="mt-1 text-sm text-danger-600 dark:text-danger-400">
                    {errors.lastName.message}
                  </p>
                )}
              </div>
            </div>

            {/* Nom d'utilisateur */}
            <div>
              <label htmlFor="username" className="sr-only">
                Nom d'utilisateur
              </label>
              <input
                {...register("username", {
                  required: "Nom d'utilisateur requis",
                  minLength: {
                    value: 3,
                    message:
                      "Le nom d'utilisateur doit contenir au moins 3 caractères",
                  },
                  pattern: {
                    value: /^[a-zA-Z0-9_-]+$/,
                    message:
                      "Seules les lettres, chiffres, _ et - sont autorisés",
                  },
                })}
                type="text"
                autoComplete="username"
                className={`input ${errors.username ? "input-error" : ""}`}
                placeholder="Nom d'utilisateur"
                disabled={isSubmitting}
              />
              {errors.username && (
                <p className="mt-1 text-sm text-danger-600 dark:text-danger-400">
                  {errors.username.message}
                </p>
              )}
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="sr-only">
                Adresse email
              </label>
              <input
                {...register("email", {
                  required: "Email requis",
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: "Adresse email invalide",
                  },
                })}
                type="email"
                autoComplete="email"
                className={`input ${errors.email ? "input-error" : ""}`}
                placeholder="Adresse email"
                disabled={isSubmitting}
              />
              {errors.email && (
                <p className="mt-1 text-sm text-danger-600 dark:text-danger-400">
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Rôle */}
            <div>
              <label
                htmlFor="role"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Vous êtes :
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center">
                  <input
                    {...register("role")}
                    type="radio"
                    value="formateur"
                    className="sr-only"
                    disabled={isSubmitting}
                  />
                  <div
                    className={`flex-1 p-3 border rounded-lg cursor-pointer text-center transition-colors duration-200 ${
                      watch("role") === "formateur"
                        ? "border-primary-500 bg-primary-50 dark:bg-primary-900 text-primary-700 dark:text-primary-200"
                        : "border-gray-300 dark:border-gray-600 hover:border-primary-300 dark:hover:border-primary-500"
                    }`}
                  >
                    <span className="block text-sm font-medium">Formateur</span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400">
                      Créer des quiz
                    </span>
                  </div>
                </label>
                <label className="flex items-center">
                  <input
                    {...register("role")}
                    type="radio"
                    value="etudiant"
                    className="sr-only"
                    disabled={isSubmitting}
                  />
                  <div
                    className={`flex-1 p-3 border rounded-lg cursor-pointer text-center transition-colors duration-200 ${
                      watch("role") === "etudiant"
                        ? "border-primary-500 bg-primary-50 dark:bg-primary-900 text-primary-700 dark:text-primary-200"
                        : "border-gray-300 dark:border-gray-600 hover:border-primary-300 dark:hover:border-primary-500"
                    }`}
                  >
                    <span className="block text-sm font-medium">Étudiant</span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400">
                      Participer aux quiz
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {/* Mot de passe */}
            <div className="relative">
              <label htmlFor="password" className="sr-only">
                Mot de passe
              </label>
              <input
                {...register("password", {
                  required: "Mot de passe requis",
                  minLength: {
                    value: 6,
                    message:
                      "Le mot de passe doit contenir au moins 6 caractères",
                  },
                })}
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
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

            {/* Indicateurs de force du mot de passe */}
            {password && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Force du mot de passe :
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {passwordRequirements.map((req, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      {req.test(password) ? (
                        <CheckIcon className="h-4 w-4 text-success-600 dark:text-success-400" />
                      ) : (
                        <XMarkIcon className="h-4 w-4 text-gray-400" />
                      )}
                      <span
                        className={`text-xs ${
                          req.test(password)
                            ? "text-success-600 dark:text-success-400"
                            : "text-gray-500 dark:text-gray-400"
                        }`}
                      >
                        {req.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Confirmation mot de passe */}
            <div>
              <label htmlFor="confirmPassword" className="sr-only">
                Confirmer le mot de passe
              </label>
              <input
                {...register("confirmPassword", {
                  required: "Confirmation du mot de passe requise",
                  validate: (value) =>
                    value === password ||
                    "Les mots de passe ne correspondent pas",
                })}
                type="password"
                autoComplete="new-password"
                className={`input ${
                  errors.confirmPassword ? "input-error" : ""
                }`}
                placeholder="Confirmer le mot de passe"
                disabled={isSubmitting}
              />
              {errors.confirmPassword && (
                <p className="mt-1 text-sm text-danger-600 dark:text-danger-400">
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>
          </div>

          {/* Conditions d'utilisation */}
          <div className="flex items-start">
            <input
              {...register("acceptTerms", {
                required: "Vous devez accepter les conditions d'utilisation",
              })}
              type="checkbox"
              className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 dark:border-gray-600 rounded"
              disabled={isSubmitting}
            />
            <div className="ml-3">
              <label className="text-sm text-gray-600 dark:text-gray-400">
                J'accepte les{" "}
                <Link
                  to="/terms"
                  className="text-primary-600 hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300"
                >
                  conditions d'utilisation
                </Link>{" "}
                et la{" "}
                <Link
                  to="/privacy"
                  className="text-primary-600 hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300"
                >
                  politique de confidentialité
                </Link>
              </label>
              {errors.acceptTerms && (
                <p className="mt-1 text-sm text-danger-600 dark:text-danger-400">
                  {errors.acceptTerms.message}
                </p>
              )}
            </div>
          </div>

          {/* Bouton d'inscription */}
          <div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              {isSubmitting ? (
                <LoadingSpinner size="sm" color="white" inline />
              ) : (
                "Créer mon compte"
              )}
            </button>
          </div>

          {/* Lien de connexion */}
          <div className="text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Vous avez déjà un compte ?{" "}
              <Link
                to="/login"
                className="font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300"
              >
                Se connecter
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

export default Register;
