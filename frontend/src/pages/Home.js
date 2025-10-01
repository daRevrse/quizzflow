import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuthStore } from "../stores/authStore";
import { useThemeStore } from "../stores/themeStore";
import {
  PuzzlePieceIcon,
  UserGroupIcon,
  ChartBarIcon,
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
  ArrowRightIcon,
  PlayIcon,
  SparklesIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  TrophyIcon,
} from "@heroicons/react/24/outline";
import { StarIcon as StarSolidIcon } from "@heroicons/react/24/solid";

const Home = () => {
  const { isAuthenticated, user } = useAuthStore();
  const { theme, setTheme } = useThemeStore();
  const navigate = useNavigate();
  const [joinCode, setJoinCode] = useState("");
  const [currentTestimonial, setCurrentTestimonial] = useState(0);
  const [openFaq, setOpenFaq] = useState(null);

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
      color: "from-yellow-500 to-orange-600",
      benefits: [
        "Synchronisation instantanée",
        "Pas de latence",
        "Reconnexion automatique",
      ],
    },
    {
      name: "Multi-Participants",
      description:
        "Jusqu'à 100 participants simultanés par session avec gestion avancée des connexions.",
      icon: UserGroupIcon,
      color: "from-green-500 to-green-600",
      benefits: [
        "Scalabilité garantie",
        "Gestion des déconnexions",
        "Modération intégrée",
      ],
    },
    {
      name: "Analytiques Avancées",
      description:
        "Analysez les performances avec des graphiques détaillés et exportez vos données.",
      icon: ChartBarIcon,
      color: "from-purple-500 to-purple-600",
      benefits: [
        "Graphiques en temps réel",
        "Export CSV/PDF",
        "Analyses prédictives",
      ],
    },
    {
      name: "Sécurité Renforcée",
      description:
        "Authentification robuste, chiffrement des données et conformité RGPD.",
      icon: ShieldCheckIcon,
      color: "from-red-500 to-red-600",
      benefits: [
        "Chiffrement bout-en-bout",
        "Conformité RGPD",
        "Audit de sécurité",
      ],
    },
    {
      name: "Universel & Accessible",
      description:
        "Interface responsive compatible tous appareils, accessible via code ou QR code.",
      icon: GlobeAltIcon,
      color: "from-indigo-500 to-indigo-600",
      benefits: [
        "Responsive design",
        "QR codes automatiques",
        "Accessibilité Web",
      ],
    },
  ];

  const stats = [
    {
      name: "Quiz Créés",
      value: "12,547",
      growth: "+23%",
      icon: PuzzlePieceIcon,
    },
    {
      name: "Utilisateurs Actifs",
      value: "8,392",
      growth: "+18%",
      icon: UsersIcon,
    },
    {
      name: "Sessions Mensuelles",
      value: "34,821",
      growth: "+31%",
      icon: PlayIcon,
    },
    {
      name: "Taux de Satisfaction",
      value: "98%",
      growth: "+5%",
      icon: StarIcon,
    },
  ];

  const howItWorksSteps = [
    {
      step: "1",
      title: "Créez votre quiz",
      description:
        "Utilisez notre éditeur intuitif pour créer des questions variées en quelques minutes.",
      icon: PuzzlePieceIcon,
      color: "from-primary-500 to-primary-600",
    },
    {
      step: "2",
      title: "Lancez une session",
      description:
        "Générez un code unique et partagez-le avec vos participants via QR code ou lien.",
      icon: PlayIcon,
      color: "from-green-500 to-green-600",
    },
    {
      step: "3",
      title: "Participants rejoignent",
      description:
        "Les participants se connectent facilement avec le code de session depuis n'importe quel appareil.",
      icon: UserGroupIcon,
      color: "from-purple-500 to-purple-600",
    },
    {
      step: "4",
      title: "Analysez les résultats",
      description:
        "Suivez la performance en temps réel et exportez des rapports détaillés.",
      icon: ChartBarIcon,
      color: "from-orange-500 to-orange-600",
    },
  ];

  const testimonials = [
    {
      name: "Marie Dubois",
      role: "Formatrice Digital Learning",
      company: "TechEdu Corp",
      image: "/api/placeholder/64/64",
      content:
        "QuizFlow a révolutionné mes formations. L'engagement des apprenants a augmenté de 85% depuis que j'utilise cette plateforme.",
      rating: 5,
    },
    {
      name: "Thomas Martin",
      role: "Responsable Formation",
      company: "InnovLab",
      image: "/api/placeholder/64/64",
      content:
        "Interface intuitive, fonctionnalités avancées et support technique exceptionnel. Exactement ce qu'il nous fallait !",
      rating: 5,
    },
    {
      name: "Sarah Johnson",
      role: "Enseignante",
      company: "Université Paris-Tech",
      image: "/api/placeholder/64/64",
      content:
        "Mes étudiants adorent ! Les quiz en temps réel rendent mes cours magistraux beaucoup plus interactifs.",
      rating: 5,
    },
  ];

  const faqs = [
    {
      question: "Comment créer mon premier quiz ?",
      answer:
        "Après inscription, cliquez sur 'Créer un Quiz', ajoutez vos questions avec notre éditeur intuitif, puis lancez une session. C'est aussi simple que ça !",
    },
    {
      question: "Combien de participants peuvent rejoindre une session ?",
      answer:
        "Le plan gratuit supporte jusqu'à 25 participants par session. Le plan Pro permet jusqu'à 100 participants, et le plan Enterprise n'a pas de limite.",
    },
    {
      question: "Les participants ont-ils besoin de créer un compte ?",
      answer:
        "Non ! Les participants peuvent rejoindre une session simplement avec le code fourni, sans inscription requise.",
    },
    {
      question: "Puis-je exporter les résultats ?",
      answer:
        "Oui, vous pouvez exporter les résultats au format CSV ou PDF avec des graphiques détaillés sur les performances de chaque participant.",
    },
    {
      question: "Est-ce que QuizFlow fonctionne sur mobile ?",
      answer:
        "Absolument ! QuizFlow est entièrement responsive et fonctionne parfaitement sur smartphones, tablettes et ordinateurs.",
    },
    {
      question: "Y a-t-il une limite au nombre de quiz que je peux créer ?",
      answer:
        "Le plan gratuit permet 3 quiz actifs. Les plans payants offrent des quiz illimités avec plus de fonctionnalités avancées.",
    },
  ];

  const pricingPlans = [
    {
      name: "Gratuit",
      price: "0€",
      period: "/mois",
      description: "Parfait pour découvrir QuizFlow",
      features: [
        "3 quiz actifs",
        "25 participants max/session",
        "Types de questions de base",
        "Statistiques simples",
        "Support communauté",
      ],
      cta: "Commencer Gratuitement",
      popular: false,
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
    },
  ];

  // Auto-rotate testimonials
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTestimonial((prev) => (prev + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [testimonials.length]);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {/* Theme Toggle Button */}
      <button
        onClick={toggleTheme}
        className="fixed top-4 right-4 z-50 p-3 rounded-full bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all duration-200 hover:scale-110"
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

      {/* Hero Section - Enhanced */}
      <header className="relative bg-gradient-to-r from-primary-600 via-primary-700 to-primary-800 text-white overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-20 left-10 w-72 h-72 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-400/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>

        <div className="container mx-auto px-6 lg:px-12 py-24 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <div className="text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full mb-6">
                <SparklesIcon className="h-5 w-5 text-yellow-300" />
                <span className="text-sm font-medium">
                  Plateforme N°1 pour quiz interactifs
                </span>
              </div>

              <h1 className="text-5xl lg:text-7xl font-bold mb-6 leading-tight">
                Rendez vos cours{" "}
                <span className="bg-gradient-to-r from-yellow-300 to-orange-400 bg-clip-text text-transparent">
                  inoubliables
                </span>
              </h1>

              <p className="text-xl lg:text-2xl mb-8 text-primary-100">
                Créez des quiz en temps réel, engagez vos étudiants et suivez
                leurs progrès instantanément.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-8">
                <Link
                  to="/register"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-yellow-400 text-gray-900 font-semibold rounded-lg shadow-lg hover:bg-yellow-300 transform hover:scale-105 transition-all duration-200"
                >
                  Commencer gratuitement
                  <ArrowRightIcon className="h-5 w-5" />
                </Link>
                <Link
                  to="/quiz"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/10 backdrop-blur-sm border-2 border-white/30 rounded-lg hover:bg-white/20 transition-all duration-200"
                >
                  <PlayIcon className="h-5 w-5" />
                  Voir la démo
                </Link>
              </div>

              {/* Trust Badges */}
              <div className="flex items-center gap-6 justify-center lg:justify-start text-sm text-primary-100">
                <div className="flex items-center gap-1">
                  <CheckIcon className="h-5 w-5 text-green-400" />
                  <span>Sans carte bancaire</span>
                </div>
                <div className="flex items-center gap-1">
                  <CheckIcon className="h-5 w-5 text-green-400" />
                  <span>Installation en 2 min</span>
                </div>
              </div>
            </div>

            {/* Right Content - Quick Join Card */}
            <div className="lg:pl-12">
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 border border-gray-200 dark:border-gray-700">
                <div className="text-center mb-6">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-primary-500 to-purple-600 rounded-full mb-4">
                    <PlayIcon className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    Rejoindre un Quiz
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Entrez le code de session fourni par votre formateur
                  </p>
                </div>

                <form onSubmit={handleQuickJoin} className="space-y-4">
                  <div>
                    <input
                      type="text"
                      value={joinCode}
                      onChange={(e) =>
                        setJoinCode(e.target.value.toUpperCase())
                      }
                      placeholder="Entrez le code (ex: ABC123)"
                      className="w-full px-6 py-4 text-center text-2xl font-mono font-bold tracking-widest border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white uppercase"
                      maxLength={6}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={!joinCode.trim()}
                    className="w-full px-6 py-4 bg-gradient-to-r from-primary-600 to-purple-600 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  >
                    Rejoindre Maintenant
                  </button>
                </form>

                <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-center text-sm text-gray-600 dark:text-gray-400">
                    Vous êtes formateur ?{" "}
                    <Link
                      to="/register"
                      className="text-primary-600 dark:text-primary-400 hover:underline font-medium"
                    >
                      Créez votre compte
                    </Link>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Wave Divider */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 120" className="w-full h-auto">
            <path
              fill="currentColor"
              className="text-white dark:text-gray-900"
              d="M0,64L80,69.3C160,75,320,85,480,80C640,75,800,53,960,48C1120,43,1280,53,1360,58.7L1440,64L1440,120L1360,120C1280,120,1120,120,960,120C800,120,640,120,480,120C320,120,160,120,80,120L0,120Z"
            ></path>
          </svg>
        </div>
      </header>

      {/* Stats Section - Enhanced with Icons */}
      <section className="py-16 bg-white dark:bg-gray-900">
        <div className="container mx-auto px-6 lg:px-12">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat, index) => {
              const IconComponent = stat.icon;
              return (
                <div
                  key={index}
                  className="text-center p-6 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-300 transform hover:scale-105"
                >
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-primary-100 dark:bg-primary-900 rounded-full mb-3">
                    <IconComponent className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                  </div>
                  <h3 className="text-4xl font-bold text-primary-600 dark:text-primary-400 mb-2">
                    {stat.value}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 font-medium mb-1">
                    {stat.name}
                  </p>
                  <span className="inline-flex items-center gap-1 text-sm text-green-600 dark:text-green-400 font-semibold">
                    <TrophyIcon className="h-4 w-4" />
                    {stat.growth}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works Section - NEW */}
      <section className="py-20 bg-gray-50 dark:bg-gray-800">
        <div className="container mx-auto px-6 lg:px-12">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold mb-4 text-gray-900 dark:text-white">
              Comment ça marche ?
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Créez et lancez vos quiz en 4 étapes simples
            </p>
          </div>

          <div className="relative max-w-6xl mx-auto">
            {/* Connector Line - Desktop */}
            <div className="hidden lg:block absolute top-20 left-0 right-0 h-1">
              <div
                className="absolute inset-0 flex items-center"
                aria-hidden="true"
              >
                <div className="w-full border-t-2 border-dashed border-gray-300 dark:border-gray-600"></div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-4">
              {howItWorksSteps.map((step, index) => {
                const IconComponent = step.icon;
                return (
                  <div key={index} className="relative">
                    <div className="flex flex-col items-center text-center">
                      {/* Step Number Badge */}
                      <div className="relative mb-6">
                        <div
                          className={`w-40 h-40 rounded-full bg-gradient-to-br ${step.color} shadow-xl flex items-center justify-center transform transition-transform hover:scale-110 duration-300`}
                        >
                          <IconComponent className="h-20 w-20 text-white" />
                        </div>
                        <div className="absolute -top-2 -right-2 w-12 h-12 bg-white dark:bg-gray-800 rounded-full border-4 border-primary-500 flex items-center justify-center shadow-lg">
                          <span className="text-xl font-bold text-primary-600 dark:text-primary-400">
                            {step.step}
                          </span>
                        </div>
                      </div>

                      {/* Content */}
                      <h3 className="text-xl font-bold mb-3 text-gray-900 dark:text-white">
                        {step.title}
                      </h3>
                      <p className="text-gray-600 dark:text-gray-300 px-2">
                        {step.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section - Enhanced */}
      <section className="py-20 bg-white dark:bg-gray-900">
        <div className="container mx-auto px-6 lg:px-12">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold mb-4 text-gray-900 dark:text-white">
              Fonctionnalités Puissantes
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Tout ce dont vous avez besoin pour créer des expériences
              d'apprentissage mémorables
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => {
              const IconComponent = feature.icon;
              return (
                <div
                  key={index}
                  className="group p-8 bg-white dark:bg-gray-800 rounded-2xl shadow-md hover:shadow-2xl border border-gray-200 dark:border-gray-700 transition-all duration-300 hover:-translate-y-2"
                >
                  <div
                    className={`inline-flex items-center justify-center w-16 h-16 rounded-xl bg-gradient-to-br ${feature.color} mb-6 group-hover:scale-110 transition-transform duration-300`}
                  >
                    <IconComponent className="h-8 w-8 text-white" />
                  </div>

                  <h3 className="text-2xl font-bold mb-3 text-gray-900 dark:text-white">
                    {feature.name}
                  </h3>

                  <p className="text-gray-600 dark:text-gray-300 mb-4">
                    {feature.description}
                  </p>

                  <ul className="space-y-2">
                    {feature.benefits.map((benefit, idx) => (
                      <li
                        key={idx}
                        className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400"
                      >
                        <CheckIcon className="h-4 w-4 text-green-500 flex-shrink-0" />
                        {benefit}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Testimonials Section - Carousel */}
      <section className="py-20 bg-gradient-to-br from-primary-50 to-purple-50 dark:from-gray-800 dark:to-gray-900">
        <div className="container mx-auto px-6 lg:px-12">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold mb-4 text-gray-900 dark:text-white">
              Ils nous font confiance
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              Découvrez ce que nos utilisateurs pensent de QuizFlow
            </p>
          </div>

          <div className="relative max-w-4xl mx-auto">
            {/* Testimonial Card */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 md:p-12 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-1 mb-6 justify-center">
                {[...Array(testimonials[currentTestimonial].rating)].map(
                  (_, i) => (
                    <StarSolidIcon
                      key={i}
                      className="h-6 w-6 text-yellow-400"
                    />
                  )
                )}
              </div>

              <blockquote className="text-xl md:text-2xl text-gray-700 dark:text-gray-300 text-center mb-8 italic">
                "{testimonials[currentTestimonial].content}"
              </blockquote>

              <div className="flex items-center justify-center gap-4">
                <img
                  src={testimonials[currentTestimonial].image}
                  alt={testimonials[currentTestimonial].name}
                  className="w-16 h-16 rounded-full border-4 border-primary-500"
                />
                <div className="text-left">
                  <p className="font-bold text-gray-900 dark:text-white">
                    {testimonials[currentTestimonial].name}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {testimonials[currentTestimonial].role}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-500">
                    {testimonials[currentTestimonial].company}
                  </p>
                </div>
              </div>
            </div>

            {/* Navigation Buttons */}
            <div className="flex justify-center gap-4 mt-8">
              <button
                onClick={() =>
                  setCurrentTestimonial(
                    (prev) =>
                      (prev - 1 + testimonials.length) % testimonials.length
                  )
                }
                className="p-3 bg-white dark:bg-gray-800 rounded-full shadow-lg hover:shadow-xl transition-all border border-gray-200 dark:border-gray-700 hover:scale-110"
              >
                <ChevronLeftIcon className="h-6 w-6 text-gray-700 dark:text-gray-300" />
              </button>
              <button
                onClick={() =>
                  setCurrentTestimonial(
                    (prev) => (prev + 1) % testimonials.length
                  )
                }
                className="p-3 bg-white dark:bg-gray-800 rounded-full shadow-lg hover:shadow-xl transition-all border border-gray-200 dark:border-gray-700 hover:scale-110"
              >
                <ChevronRightIcon className="h-6 w-6 text-gray-700 dark:text-gray-300" />
              </button>
            </div>

            {/* Dots Indicator */}
            <div className="flex justify-center gap-2 mt-6">
              {testimonials.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentTestimonial(index)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    index === currentTestimonial
                      ? "w-8 bg-primary-600"
                      : "w-2 bg-gray-300 dark:bg-gray-600"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 bg-white dark:bg-gray-900">
        <div className="container mx-auto px-6 lg:px-12">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold mb-4 text-gray-900 dark:text-white">
              Tarifs Transparents
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              Choisissez le plan qui correspond à vos besoins
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {pricingPlans.map((plan, index) => (
              <div
                key={index}
                className={`relative rounded-2xl p-8 border-2 transition-all duration-300 ${
                  plan.popular
                    ? "border-primary-500 shadow-2xl scale-105 bg-gradient-to-br from-primary-50 to-purple-50 dark:from-gray-800 dark:to-gray-900"
                    : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-xl hover:scale-105"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="bg-gradient-to-r from-primary-600 to-purple-600 text-white px-4 py-1 rounded-full text-sm font-semibold shadow-lg">
                      🔥 Plus Populaire
                    </span>
                  </div>
                )}

                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">
                    {plan.name}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                    {plan.description}
                  </p>
                  {/* <div className="flex items-baseline justify-center gap-2">
                    <span className="text-5xl font-bold text-gray-900 dark:text-white">
                      {plan.price}
                    </span>
                    {plan.period && (
                      <span className="text-gray-600 dark:text-gray-400">
                        {plan.period}
                      </span>
                    )}
                  </div> */}
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <CheckIcon className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                <Link
                  to={plan.name === "Gratuit" ? "/register" : "#"}
                  className={`block w-full text-center px-6 py-4 rounded-lg font-semibold transition-all duration-200 ${
                    plan.popular
                      ? "bg-gradient-to-r from-primary-600 to-purple-600 text-white shadow-lg hover:shadow-xl transform hover:scale-105"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600"
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section - NEW */}
      <section className="py-20 bg-gray-50 dark:bg-gray-800">
        <div className="container mx-auto px-6 lg:px-12">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold mb-4 text-gray-900 dark:text-white">
              Questions Fréquentes
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              Trouvez rapidement les réponses à vos questions
            </p>
          </div>

          <div className="max-w-3xl mx-auto space-y-4">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className="w-full px-6 py-5 text-left flex items-center justify-between gap-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <span className="font-semibold text-gray-900 dark:text-white text-lg">
                    {faq.question}
                  </span>
                  <ChevronRightIcon
                    className={`h-5 w-5 text-gray-500 flex-shrink-0 transition-transform duration-300 ${
                      openFaq === index ? "rotate-90" : ""
                    }`}
                  />
                </button>

                {openFaq === index && (
                  <div className="px-6 pb-5 text-gray-600 dark:text-gray-400 border-t border-gray-100 dark:border-gray-800 pt-4">
                    {faq.answer}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Vous avez d'autres questions ?
            </p>
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 text-primary-600 dark:text-primary-400 hover:underline font-semibold"
            >
              Contactez notre équipe
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Final CTA Section - Enhanced */}
      <section className="py-20 bg-gradient-to-r from-primary-600 via-primary-700 to-primary-800 text-white relative overflow-hidden">
        {/* Background Animation */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-10 left-10 w-64 h-64 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-10 right-10 w-80 h-80 bg-purple-400/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>

        <div className="container mx-auto px-6 lg:px-12 text-center relative z-10">
          <div className="max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full mb-6">
              <SparklesIcon className="h-5 w-5 text-yellow-300" />
              <span className="text-sm font-medium">
                Essai gratuit - Sans engagement
              </span>
            </div>

            <h2 className="text-4xl lg:text-6xl font-bold mb-6 leading-tight">
              Prêt à transformer vos formations ?
            </h2>

            <p className="text-xl lg:text-2xl mb-10 text-primary-100">
              Rejoignez plus de 8,000 formateurs qui utilisent QuizFlow pour
              créer des expériences d'apprentissage mémorables.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
              <Link
                to="/register"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-yellow-400 text-gray-900 font-semibold rounded-lg shadow-2xl hover:bg-yellow-300 transform hover:scale-105 transition-all duration-200"
              >
                Commencer Gratuitement
                <ArrowRightIcon className="h-5 w-5" />
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/10 backdrop-blur-sm border-2 border-white/30 rounded-lg hover:bg-white/20 transition-all duration-200"
              >
                Se Connecter
              </Link>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-8 text-sm text-primary-100">
              <div className="flex items-center gap-2">
                <CheckIcon className="h-5 w-5 text-green-400" />
                <span>Installation en 2 minutes</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckIcon className="h-5 w-5 text-green-400" />
                <span>Sans carte bancaire</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckIcon className="h-5 w-5 text-green-400" />
                <span>Support 7j/7</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-gray-900 text-gray-400">
        <div className="container mx-auto px-6 lg:px-12">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            {/* Logo & Description */}
            <div className="md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-16 h-16 bg-gradient-to-r bg-white rounded-xl flex items-center justify-center shadow-lg">
                  <img
                    src="/images/logo.png"
                    alt="Logo"
                    className="w-16 h-16"
                  />
                </div>
                <span className="text-xl font-semibold text-white">
                  QuizFlow
                </span>
              </div>
              <p className="text-sm">
                La plateforme de quiz interactifs qui transforme vos formations.
              </p>
            </div>

            {/* Product Links */}
            <div>
              <h4 className="font-semibold text-white mb-4">Produit</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link
                    to="/features"
                    className="hover:text-white transition-colors"
                  >
                    Fonctionnalités
                  </Link>
                </li>
                <li>
                  <Link
                    to="/pricing"
                    className="hover:text-white transition-colors"
                  >
                    Tarifs
                  </Link>
                </li>
                <li>
                  <Link
                    to="/demo"
                    className="hover:text-white transition-colors"
                  >
                    Démo
                  </Link>
                </li>
                <li>
                  <Link
                    to="/updates"
                    className="hover:text-white transition-colors"
                  >
                    Nouveautés
                  </Link>
                </li>
              </ul>
            </div>

            {/* Resources Links */}
            <div>
              <h4 className="font-semibold text-white mb-4">Ressources</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link
                    to="/docs"
                    className="hover:text-white transition-colors"
                  >
                    Documentation
                  </Link>
                </li>
                <li>
                  <Link
                    to="/blog"
                    className="hover:text-white transition-colors"
                  >
                    Blog
                  </Link>
                </li>
                <li>
                  <Link
                    to="/guides"
                    className="hover:text-white transition-colors"
                  >
                    Guides
                  </Link>
                </li>
                <li>
                  <Link
                    to="/support"
                    className="hover:text-white transition-colors"
                  >
                    Support
                  </Link>
                </li>
              </ul>
            </div>

            {/* Company Links */}
            <div>
              <h4 className="font-semibold text-white mb-4">Entreprise</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link
                    to="/about"
                    className="hover:text-white transition-colors"
                  >
                    À propos
                  </Link>
                </li>
                <li>
                  <Link
                    to="/contact"
                    className="hover:text-white transition-colors"
                  >
                    Contact
                  </Link>
                </li>
                <li>
                  <Link
                    to="/privacy"
                    className="hover:text-white transition-colors"
                  >
                    Confidentialité
                  </Link>
                </li>
                <li>
                  <Link
                    to="/terms"
                    className="hover:text-white transition-colors"
                  >
                    CGU
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Footer */}
          <div className="pt-8 border-t border-gray-800 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm">
              © {new Date().getFullYear()} QuizFlow. Tous droits réservés.
            </p>
            <div className="flex items-center gap-6 text-sm">
              <a href="#" className="hover:text-white transition-colors">
                Facebook
              </a>
              <a href="#" className="hover:text-white transition-colors">
                Twitter
              </a>
              <a href="#" className="hover:text-white transition-colors">
                LinkedIn
              </a>
              <a href="#" className="hover:text-white transition-colors">
                Instagram
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
