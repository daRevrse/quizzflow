import { useState, useRef, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";
import { useThemeStore } from "../../stores/themeStore";
import { useSocket } from "../../contexts/SocketContext";
import {
  Bars3Icon,
  XMarkIcon,
  UserCircleIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  SunIcon,
  MoonIcon,
  ComputerDesktopIcon,
  BellIcon,
  SignalIcon,
  SignalSlashIcon,
} from "@heroicons/react/24/outline";

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, logout } = useAuthStore();
  const { theme, setTheme } = useThemeStore();
  const { isConnected, connectionError } = useSocket();

  const profileMenuRef = useRef(null);
  const themeMenuRef = useRef(null);

  // Fermer les menus quand on clique ailleurs
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target)
      ) {
        setIsProfileMenuOpen(false);
      }
      if (
        themeMenuRef.current &&
        !themeMenuRef.current.contains(event.target)
      ) {
        setIsThemeMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const themeOptions = [
    { value: "light", label: "Clair", icon: SunIcon },
    { value: "dark", label: "Sombre", icon: MoonIcon },
    { value: "system", label: "Système", icon: ComputerDesktopIcon },
  ];

  return (
    <nav className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo et navigation principale */}
          <div className="flex items-center">
            {/* Bouton menu mobile */}
            {isAuthenticated && (
              <button
                className="lg:hidden p-2 rounded-md text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
              >
                {isMenuOpen ? (
                  <XMarkIcon className="h-6 w-6" />
                ) : (
                  <Bars3Icon className="h-6 w-6" />
                )}
              </button>
            )}

            {/* Logo */}
            {/* <Link to="/" className="flex items-center space-x-2 ml-2 lg:ml-0">
              <div className="w-8 h-8 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">Q</span>
              </div>
              <span className="text-xl font-bold text-gray-900 dark:text-white">
                QuizApp
              </span>
            </Link> */}

            {!isAuthenticated && (
              <Link to="/" className="flex items-center space-x-2 ml-2 lg:ml-0">
                <div className="w-12 h-12 bg-gradient-to-r bg-white rounded-xl flex items-center justify-center shadow-lg">
                  <img
                    src="/images/logo.png"
                    alt="Logo"
                    className="w-12 h-12"
                  />
                </div>
                <span className="text-xl font-bold text-gray-900 dark:text-white">
                  QuizFlow
                </span>
              </Link>
            )}
          </div>

          {/* Actions de droite */}
          <div className="flex items-center space-x-3">
            {/* Indicateur de connexion Socket.IO */}
            {isAuthenticated && (
              <div className="flex items-center">
                {isConnected ? (
                  <div
                    className="flex items-center text-success-600 dark:text-success-400"
                    title="Connecté en temps réel"
                  >
                    <SignalIcon className="h-5 w-5" />
                  </div>
                ) : (
                  <div
                    className="flex items-center text-danger-600 dark:text-danger-400"
                    title={connectionError || "Déconnecté"}
                  >
                    <SignalSlashIcon className="h-5 w-5" />
                  </div>
                )}
              </div>
            )}

            {/* Menu thème */}
            <div className="relative" ref={themeMenuRef}>
              <button
                className="p-2 rounded-md text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => setIsThemeMenuOpen(!isThemeMenuOpen)}
                title="Changer le thème"
              >
                {theme === "light" && <SunIcon className="h-5 w-5" />}
                {theme === "dark" && <MoonIcon className="h-5 w-5" />}
                {theme === "system" && (
                  <ComputerDesktopIcon className="h-5 w-5" />
                )}
              </button>

              {isThemeMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 z-50 border border-gray-200 dark:border-gray-700">
                  {themeOptions.map((option) => {
                    const IconComponent = option.icon;
                    return (
                      <button
                        key={option.value}
                        className={`w-full flex items-center px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${
                          theme === option.value
                            ? "text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900"
                            : "text-gray-700 dark:text-gray-300"
                        }`}
                        onClick={() => {
                          setTheme(option.value);
                          setIsThemeMenuOpen(false);
                        }}
                      >
                        <IconComponent className="h-4 w-4 mr-3" />
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Notifications (pour les fonctionnalités futures) */}
            {isAuthenticated && (
              <button
                className="p-2 rounded-md text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 relative"
                title="Notifications"
              >
                <BellIcon className="h-5 w-5" />
                {/* Badge de notification */}
                {/* <span className="absolute -top-1 -right-1 h-3 w-3 bg-danger-500 rounded-full"></span> */}
              </button>
            )}

            {isAuthenticated ? (
              /* Menu utilisateur connecté */
              <div className="relative" ref={profileMenuRef}>
                <button
                  className="flex items-center space-x-2 p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
                  onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                >
                  <div className="flex items-center space-x-3">
                    {user.avatar ? (
                      <img
                        src={user.avatar}
                        alt="Avatar"
                        className="w-8 h-8 rounded-full"
                      />
                    ) : (
                      <UserCircleIcon className="h-8 w-8 text-gray-400" />
                    )}
                    <div className="hidden sm:block text-left">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {user.firstName || user.username}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {user.role}
                      </p>
                    </div>
                  </div>
                </button>

                {isProfileMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 z-50 border border-gray-200 dark:border-gray-700">
                    <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {user.firstName} {user.lastName}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {user.email}
                      </p>
                    </div>

                    <Link
                      to="/profile"
                      className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                      onClick={() => setIsProfileMenuOpen(false)}
                    >
                      <UserCircleIcon className="h-4 w-4 mr-3" />
                      Mon profil
                    </Link>

                    <Link
                      to="/settings"
                      className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                      onClick={() => setIsProfileMenuOpen(false)}
                    >
                      <Cog6ToothIcon className="h-4 w-4 mr-3" />
                      Paramètres
                    </Link>

                    <div className="border-t border-gray-200 dark:border-gray-700">
                      <button
                        className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                        onClick={() => {
                          setIsProfileMenuOpen(false);
                          handleLogout();
                        }}
                      >
                        <ArrowRightOnRectangleIcon className="h-4 w-4 mr-3" />
                        Se déconnecter
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Boutons pour utilisateurs non connectés */
              <div className="flex items-center space-x-3">
                <Link
                  to="/login"
                  className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white px-3 py-2 text-sm font-medium"
                >
                  Se connecter
                </Link>
                <Link to="/register" className="btn-primary btn-sm">
                  S'inscrire
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Menu mobile */}
      {isMenuOpen && isAuthenticated && (
        <div className="lg:hidden border-t border-gray-200 dark:border-gray-700">
          <div className="px-2 pt-2 pb-3 space-y-1 bg-white dark:bg-gray-800">
            <Link
              to="/dashboard"
              className={`block px-3 py-2 text-base font-medium rounded-md ${
                location.pathname === "/dashboard"
                  ? "bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-200"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
              onClick={() => setIsMenuOpen(false)}
            >
              Dashboard
            </Link>

            <Link
              to="/quiz"
              className={`block px-3 py-2 text-base font-medium rounded-md ${
                location.pathname.startsWith("/quiz")
                  ? "bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-200"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
              onClick={() => setIsMenuOpen(false)}
            >
              Mes Quiz
            </Link>

            {(user?.role === "formateur" || user?.role === "admin") && (
              <Link
                to="/session/create"
                className={`block px-3 py-2 text-base font-medium rounded-md ${
                  location.pathname.startsWith("/session")
                    ? "bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-200"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700"
                }`}
                onClick={() => setIsMenuOpen(false)}
              >
                Créer une session
              </Link>
            )}

            <Link
              to="/join"
              className={`block px-3 py-2 text-base font-medium rounded-md ${
                location.pathname === "/join"
                  ? "bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-200"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
              onClick={() => setIsMenuOpen(false)}
            >
              Rejoindre un quiz
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
