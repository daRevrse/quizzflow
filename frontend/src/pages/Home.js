import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuthStore } from "../stores/authStore";
import { useThemeStore } from "../stores/themeStore";
import {
  PuzzlePieceIcon,
  UserGroupIcon,
  ChartBarIcon,
  PlayIcon,
  SparklesIcon,
  BoltIcon,
  ShieldCheckIcon,
  GlobeAltIcon,
  CheckIcon,
  StarIcon,
  AcademicCapIcon,
  BuildingOfficeIcon,
  UsersIcon,
  SunIcon,
  MoonIcon,
} from "@heroicons/react/24/outline";
import { StarIcon as StarSolidIcon } from "@heroicons/react/24/solid";

const Home = () => {
  const { isAuthenticated, user } = useAuthStore();
  const { theme, setTheme } = useThemeStore();
  const navigate = useNavigate();
  const [joinCode, setJoinCode] = useState("");

  const handleQuickJoin = (e) => {
    e.preventDefault();
    if (joinCode.trim()) {
      navigate(`/join/${joinCode.toUpperCase()}`);
    }
  };

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
  };

  const features = [
    {
      name: "Quiz Interactifs",
      description:
        "Créez des quiz engageants avec différents types de questions : QCM, Vrai/Faux, réponses libres, nuages de mots.",
      icon: PuzzlePieceIcon,
      color: "from-primary-500 to-primary-600",
      benefits: ["Interface intuitive", "Média intégrés", "Questions variées"],
    },
    {
      name: "Temps Réel",
      description:
        "Participez à des sessions en direct avec mise à jour instantanée des scores et classements via WebSocket.",
      icon: BoltIcon,
      color: "from-secondary-500 to-secondary-600",
      benefits: [
        "Synchronisation instantanée",
        "Pas de latence",
        "Reconnexion automatique",
      ],
    },
    {
      name: "Multi-Participants",
      description:
        "Jusqu'à 100 participants simultanés par session avec gestion avancée des connexions et modération.",
      icon: UserGroupIcon,
      color: "from-success-500 to-success-600",
      benefits: [
        "Scalabilité garantie",
        "Gestion des déconnexions",
        "Modération intégrée",
      ],
    },
    {
      name: "Analytiques Avancées",
      description:
        "Analysez les performances avec des graphiques détaillés, exportez vos données et identifiez les tendances.",
      icon: ChartBarIcon,
      color: "from-warning-500 to-warning-600",
      benefits: [
        "Graphiques en temps réel",
        "Export CSV/PDF",
        "Analyses prédictives",
      ],
    },
    {
      name: "Sécurité Renforcée",
      description:
        "Authentification robuste, chiffrement des données et conformité RGPD pour protéger vos informations.",
      icon: ShieldCheckIcon,
      color: "from-danger-500 to-danger-600",
      benefits: [
        "Chiffrement bout-en-bout",
        "Conformité RGPD",
        "Audit de sécurité",
      ],
    },
    {
      name: "Universel & Accessible",
      description:
        "Interface responsive compatible tous appareils, accessible via un simple code de session ou QR code.",
      icon: GlobeAltIcon,
      color: "from-purple-500 to-purple-600",
      benefits: [
        "Responsive design",
        "QR codes automatiques",
        "Accessibilité Web",
      ],
    },
  ];

  const stats = [
    { name: "Quiz Créés", value: "12,547", growth: "+23%" },
    { name: "Utilisateurs Actifs", value: "8,392", growth: "+18%" },
    { name: "Sessions Mensuelles", value: "34,821", growth: "+31%" },
    { name: "Participants Uniques", value: "156,438", growth: "+42%" },
  ];

  const testimonials = [
    {
      name: "Marie Dubois",
      role: "Formatrice Digital Learning",
      company: "TechEdu Corp",
      image: "/api/placeholder/64/64",
      content:
        "QuizApp a révolutionné mes formations. L'engagement des apprenants a augmenté de 85% depuis que j'utilise cette plateforme.",
      rating: 5,
    },
    {
      name: "Thomas Martin",
      role: "Responsable Formation",
      company: "InnovLab",
      image: "/api/placeholder/64/64",
      content:
        "Interface intuitive, fonctionnalités avancées et support technique exceptionnel. Exactement ce qu'il nous fallait pour nos formations techniques.",
      rating: 5,
    },
    {
      name: "Sarah Johnson",
      role: "Enseignante",
      company: "Université Paris-Tech",
      image: "/api/placeholder/64/64",
      content:
        "Mes étudiants adorent ! Les quiz en temps réel rendent mes cours magistraux beaucoup plus interactifs et mémorables.",
      rating: 5,
    },
  ];

  const useCases = [
    {
      icon: AcademicCapIcon,
      title: "Éducation",
      description: "Écoles, universités, formations en ligne",
      examples: [
        "Cours magistraux interactifs",
        "Évaluations formatives",
        "Révisions collectives",
      ],
    },
    {
      icon: BuildingOfficeIcon,
      title: "Entreprise",
      description: "Formation professionnelle, team building",
      examples: [
        "Onboarding nouveaux employés",
        "Formations produits",
        "Quiz de sécurité",
      ],
    },
    {
      icon: UsersIcon,
      title: "Événements",
      description: "Conférences, webinaires, ateliers",
      examples: [
        "Engagement audience",
        "Feedback en direct",
        "Networking games",
      ],
    },
  ];

  const pricingPlans = [
    {
      name: "Gratuit",
      price: "0€",
      period: "/mois",
      description: "Parfait pour découvrir QuizApp",
      features: [
        "3 quiz actifs",
        "25 participants max/session",
        "Types de questions de base",
        "Statistiques simples",
        "Support communauté",
      ],
      cta: "Commencer Gratuitement",
      popular: false,
      disabled: [],
    },
    {
      name: "Pro",
      price: "19€",
      period: "/mois",
      description: "Pour les formateurs professionnels",
      features: [
        "Quiz illimités",
        "100 participants max/session",
        "Tous types de questions",
        "Analytics avancées",
        "Export de données",
        "Support prioritaire",
        "Personnalisation de marque",
      ],
      cta: "Essai Gratuit 14 jours",
      popular: true,
      disabled: [],
    },
    {
      name: "Enterprise",
      price: "Sur mesure",
      period: "",
      description: "Solutions sur mesure pour les organisations",
      features: [
        "Participants illimités",
        "Intégrations API",
        "SSO & sécurité avancée",
        "Analytics prédictives",
        "Support dédié 24/7",
        "Formation équipe",
        "SLA garanti",
      ],
      cta: "Nous Contacter",
      popular: false,
      disabled: ["Bientôt disponible"],
    },
  ];

  return (
    <div className="min-h-screen">
      <button
        onClick={toggleTheme}
        className="fixed top-4 right-4 z-50 p-3 rounded-full bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors duration-200"
        title={`Basculer vers le thème ${
          theme === "light" ? "sombre" : "clair"
        }`}
      >
        {theme === "light" ? (
          <MoonIcon className="h-5 w-5" />
        ) : (
          <SunIcon className="h-5 w-5" />
        )}
      </button>

      {/* Hero Section */}
      <header className="relative bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-20">
        <div className="container mx-auto px-6 lg:px-12 text-center">
          <h1 className="text-4xl lg:text-6xl font-bold mb-6">
            Rendez vos cours interactifs avec{" "}
            <span className="text-yellow-300">QuizzFlow</span>
          </h1>
          <p className="text-lg lg:text-xl mb-8">
            Créez des quiz en temps réel, engagez vos étudiants et suivez leurs
            progrès instantanément.
          </p>
          <div className="flex justify-center space-x-4">
            <Link
              to="/register"
              className="px-6 py-3 bg-yellow-400 text-gray-900 font-semibold rounded-md shadow hover:bg-yellow-300 transition"
            >
              Commencer gratuitement
            </Link>
            <Link
              to="/"
              className="px-6 py-3 bg-transparent border border-white rounded-md hover:bg-white hover:text-indigo-600 transition"
            >
              Voir la démo
            </Link>
          </div>
        </div>
      </header>

      {/* Stats Section */}
      <section className="py-16 bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-6 lg:px-12 grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
          <div>
            <h2 className="text-4xl font-bold text-indigo-600 dark:text-indigo-400">
              10k+
            </h2>
            <p className="mt-2 text-gray-600 dark:text-gray-300">
              Utilisateurs actifs
            </p>
          </div>
          <div>
            <h2 className="text-4xl font-bold text-indigo-600 dark:text-indigo-400">
              500k+
            </h2>
            <p className="mt-2 text-gray-600 dark:text-gray-300">
              Quiz réalisés
            </p>
          </div>
          <div>
            <h2 className="text-4xl font-bold text-indigo-600 dark:text-indigo-400">
              98%
            </h2>
            <p className="mt-2 text-gray-600 dark:text-gray-300">
              Satisfaction
            </p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="container mx-auto px-6 lg:px-12 text-center">
          <h2 className="text-3xl font-bold mb-12">
            Fonctionnalités principales
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 bg-white dark:bg-gray-800 shadow rounded-xl">
              <h3 className="text-xl font-semibold mb-4">Quiz en direct</h3>
              <p className="text-gray-600 dark:text-gray-300">
                Lancez vos quiz et voyez les réponses de vos étudiants en temps
                réel.
              </p>
            </div>
            <div className="p-6 bg-white dark:bg-gray-800 shadow rounded-xl">
              <h3 className="text-xl font-semibold mb-4">
                Classements instantanés
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Encouragez la compétition avec des scores visibles
                immédiatement.
              </p>
            </div>
            <div className="p-6 bg-white dark:bg-gray-800 shadow rounded-xl">
              <h3 className="text-xl font-semibold mb-4">Rapports détaillés</h3>
              <p className="text-gray-600 dark:text-gray-300">
                Analysez la performance de vos étudiants avec des graphiques
                clairs.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-indigo-600 text-white text-center">
        <h2 className="text-3xl font-bold mb-6">
          Prêt à dynamiser vos cours ?
        </h2>
        <p className="mb-8 text-lg">
          Essayez QuizzFlow gratuitement et engagez vos étudiants dès
          aujourd’hui.
        </p>
        <Link
          to="/register"
          className="px-8 py-4 bg-yellow-400 text-gray-900 font-semibold rounded-md shadow hover:bg-yellow-300 transition"
        >
          Créer un compte
        </Link>
      </section>

      {/* Footer */}
      <footer className="py-10 bg-gray-100 dark:bg-gray-900 text-center">
        <p className="text-gray-600 dark:text-gray-400">
          © {new Date().getFullYear()} QuizzFlow. Tous droits réservés.
        </p>
      </footer>
    </div>
  );
};

export default Home;
