import { Link, useLocation } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";
import {
  HomeIcon,
  PuzzlePieceIcon,
  PlayIcon,
  PlusIcon,
  UserGroupIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  QuestionMarkCircleIcon,
  TrophyIcon,
  ListBulletIcon,
} from "@heroicons/react/24/outline";
import classNames from "classnames";

const Sidebar = () => {
  const location = useLocation();
  const { user } = useAuthStore();

  const isActive = (path) => {
    if (path === "/") {
      return location.pathname === "/";
    }
    return location.pathname.startsWith(path);
  };

  const navigation = [
    {
      name: "Administration",
      href: "/admin",
      icon: Cog6ToothIcon,
      show: user?.role === "admin",
    },
    {
      name: "Dashboard",
      href: "/dashboard",
      icon: HomeIcon,
      show: true,
    },
    {
      name: "Mes Quiz",
      href: "/quiz",
      icon: PuzzlePieceIcon,
      show: true,
    },
    {
      name: "Créer un Quiz",
      href: "/quiz/create",
      icon: PlusIcon,
      show: user?.role === "formateur" || user?.role === "admin",
    },
    {
      name: "Mes Sessions",
      href: "/sessions",
      icon: ListBulletIcon,
      show: user?.role === "formateur" || user?.role === "admin",
    },
    {
      name: "Créer une Session",
      href: "/session/create",
      icon: PlayIcon,
      show: user?.role === "formateur" || user?.role === "admin",
    },
    {
      name: "Perfomance",
      href: "/results",
      icon: TrophyIcon,
      show: user?.role === "etudiant",
    },
    {
      name: "Rejoindre",
      href: "/join",
      icon: UserGroupIcon,
      show: true,
    },
  ];

  const bottomNavigation = [
    {
      name: "Statistiques",
      href: "/stats",
      icon: ChartBarIcon,
      show: user?.role === "formateur" || user?.role === "admin",
    },
    {
      name: "Paramètres",
      href: "/settings",
      icon: Cog6ToothIcon,
      show: true,
    },
    {
      name: "Aide",
      href: "/help",
      icon: QuestionMarkCircleIcon,
      show: true,
    },
  ];

  const NavLink = ({ item }) => {
    const IconComponent = item.icon;

    return (
      <Link
        to={item.href}
        className={classNames(
          "flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors duration-200",
          isActive(item.href)
            ? "bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-200 shadow-sm"
            : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
        )}
      >
        <IconComponent className="h-5 w-5 mr-3" />
        {item.name}
      </Link>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700">
      {/* Header de la sidebar */}
      <div className="flex items-center justify-center h-16 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-2">
          <div className="w-12 h-12 bg-gradient-to-r bg-white rounded-xl flex items-center justify-center shadow-lg">
            <img src="/images/logo.png" alt="Logo" className="w-12 h-12" />
          </div>
          <span className="text-lg font-semibold text-gray-900 dark:text-white">
            QuizFlow
          </span>
        </div>
      </div>

      {/* Navigation principale */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        <nav className="flex-1 px-4 py-6 space-y-2">
          {navigation
            .filter((item) => item.show)
            .map((item) => (
              <NavLink key={item.name} item={item} />
            ))}
        </nav>

        {/* Section utilisateur */}
        {/* {user && (
          <div className="px-4 py-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="flex-shrink-0">
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt="Avatar"
                    className="w-10 h-10 rounded-full"
                  />
                ) : (
                  <div className="w-10 h-10 bg-gradient-to-r from-primary-400 to-secondary-400 rounded-full flex items-center justify-center">
                    <span className="text-white font-medium text-sm">
                      {(
                        user.firstName?.[0] || user.username?.[0]
                      )?.toUpperCase()}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {user.firstName || user.username}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                  {user.role}
                </p>
              </div>
            </div>
          </div>
        )} */}

        {/* Navigation secondaire */}
        <nav className="px-4 py-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
          {bottomNavigation
            .filter((item) => item.show)
            .map((item) => (
              <NavLink key={item.name} item={item} />
            ))}
        </nav>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
          Version 1.0.0
        </p>
      </div>
    </div>
  );
};

export default Sidebar;
