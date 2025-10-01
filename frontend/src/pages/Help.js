import React, { useState } from "react";
import {
  QuestionMarkCircleIcon,
  UserGroupIcon,
  PlusCircleIcon,
  PlayIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ChatBubbleLeftRightIcon,
  DocumentTextIcon,
  AcademicCapIcon,
} from "@heroicons/react/24/outline";

const Help = () => {
  const [openSection, setOpenSection] = useState(null);

  const toggleSection = (section) => {
    setOpenSection(openSection === section ? null : section);
  };

  const faqSections = [
    {
      id: "getting-started",
      title: "Démarrage",
      icon: AcademicCapIcon,
      questions: [
        {
          q: "Comment créer mon premier quiz ?",
          a: "Connectez-vous à votre compte, cliquez sur 'Créer un quiz' dans le menu ou le tableau de bord. Remplissez les informations du quiz (titre, description, catégorie) puis ajoutez vos questions. Vous pouvez choisir entre QCM, Vrai/Faux, réponse libre ou nuage de mots.",
        },
        {
          q: "Comment rejoindre une session de quiz ?",
          a: "Cliquez sur 'Rejoindre une session' dans le menu principal. Entrez le code à 6 caractères fourni par l'animateur, puis saisissez votre nom de participant. Vous pouvez participer de manière anonyme ou avec votre compte.",
        },
        {
          q: "Puis-je participer sans créer de compte ?",
          a: "Oui ! Notre plateforme permet la participation anonyme. Cliquez sur 'Rejoindre une session', entrez le code fourni et choisissez un nom de participant. Vous pourrez participer au quiz sans créer de compte.",
        },
      ],
    },
    {
      id: "quiz-creation",
      title: "Création de quiz",
      icon: PlusCircleIcon,
      questions: [
        {
          q: "Quels types de questions puis-je créer ?",
          a: "Vous pouvez créer 4 types de questions : QCM (choix unique ou multiple), Vrai/Faux, Réponse libre (texte court), et Nuage de mots (mots-clés multiples).",
        },
        {
          q: "Comment ajouter des images à mes questions ?",
          a: "Lors de la création d'une question, vous trouverez un champ 'URL de l'image'. Copiez l'URL d'une image en ligne et collez-la dans ce champ. L'image s'affichera lors du quiz.",
        },
        {
          q: "Puis-je définir un temps limite par question ?",
          a: "Oui, pour chaque question vous pouvez définir une limite de temps en secondes. Si vous ne définissez pas de limite, les participants auront un temps illimité pour répondre.",
        },
        {
          q: "Comment attribuer des points aux questions ?",
          a: "Chaque question possède un champ 'Points'. Vous pouvez attribuer entre 1 et 10 points selon la difficulté ou l'importance de la question.",
        },
      ],
    },
    {
      id: "sessions",
      title: "Sessions de quiz",
      icon: PlayIcon,
      questions: [
        {
          q: "Comment démarrer une session ?",
          a: "Créez d'abord un quiz, puis cliquez sur 'Créer une session'. Configurez les paramètres (participants max, arrivées tardives, etc.), puis partagez le code généré avec vos participants. Démarrez la session quand tout le monde est prêt.",
        },
        {
          q: "Qu'est-ce que le code de session ?",
          a: "Le code de session est un code unique à 6 caractères (lettres et chiffres) généré automatiquement. Partagez-le avec vos participants pour qu'ils puissent rejoindre votre session.",
        },
        {
          q: "Puis-je mettre en pause une session ?",
          a: "Oui, en tant qu'animateur, vous pouvez mettre en pause et reprendre une session à tout moment via les contrôles de la page d'animation.",
        },
        {
          q: "Les participants peuvent-ils rejoindre en cours de route ?",
          a: "Cela dépend des paramètres de votre session. Si vous avez activé 'Autoriser les arrivées tardives', les participants pourront rejoindre même après le début. Sinon, seule la phase d'attente permet de rejoindre.",
        },
      ],
    },
    {
      id: "results",
      title: "Résultats et statistiques",
      icon: ChartBarIcon,
      questions: [
        {
          q: "Comment voir les résultats d'une session ?",
          a: "Une fois la session terminée, accédez à 'Mes sessions' et cliquez sur la session concernée. Vous verrez les résultats détaillés, le classement et les statistiques pour chaque participant.",
        },
        {
          q: "Les participants peuvent-ils voir leurs résultats ?",
          a: "Oui, à la fin d'une session, chaque participant voit automatiquement ses résultats personnels : score obtenu, taux de réussite, temps passé et classement.",
        },
        {
          q: "Puis-je exporter les résultats ?",
          a: "Les résultats sont consultables en ligne. Vous pouvez les partager via le bouton 'Partager' disponible sur la page des résultats.",
        },
      ],
    },
    {
      id: "account",
      title: "Compte et paramètres",
      icon: Cog6ToothIcon,
      questions: [
        {
          q: "Comment modifier mes informations personnelles ?",
          a: "Cliquez sur votre avatar en haut à droite, puis 'Profil'. Vous pourrez modifier votre nom, email et mot de passe.",
        },
        {
          q: "Quels sont les différents rôles utilisateur ?",
          a: "Il existe 3 rôles : Apprenant (peut participer aux sessions), Formateur (peut créer des quiz et animer des sessions), et Administrateur (accès complet à la plateforme).",
        },
        {
          q: "Comment activer le mode sombre ?",
          a: "Cliquez sur l'icône soleil/lune en haut à droite de la navigation pour basculer entre les modes clair et sombre.",
        },
      ],
    },
  ];

  const quickLinks = [
    {
      title: "Créer un quiz",
      description: "Commencez à créer votre premier quiz interactif",
      href: "/quiz/create",
      icon: PlusCircleIcon,
      color: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-900/20",
    },
    {
      title: "Rejoindre une session",
      description: "Participez à un quiz avec un code de session",
      href: "/join",
      icon: UserGroupIcon,
      color: "text-green-600",
      bgColor: "bg-green-50 dark:bg-green-900/20",
    },
    {
      title: "Mes sessions",
      description: "Consultez vos sessions et résultats",
      href: "/sessions",
      icon: ChartBarIcon,
      color: "text-purple-600",
      bgColor: "bg-purple-50 dark:bg-purple-900/20",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      {/* Header avec logo */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {/* Emplacement pour le logo */}
              <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                <QuestionMarkCircleIcon className="w-10 h-10 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  Centre d'aide
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  Trouvez des réponses à vos questions
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Liens rapides */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            Liens rapides
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {quickLinks.map((link) => (
              <a
                key={link.title}
                href={link.href}
                className="group bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-all duration-200 hover:-translate-y-1"
              >
                <div
                  className={`w-12 h-12 ${link.bgColor} rounded-lg flex items-center justify-center mb-4`}
                >
                  <link.icon className={`w-6 h-6 ${link.color}`} />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 group-hover:text-primary-600 dark:group-hover:text-primary-400">
                  {link.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {link.description}
                </p>
              </a>
            ))}
          </div>
        </div>

        {/* FAQ Sections */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            Questions fréquentes
          </h2>

          <div className="space-y-4">
            {faqSections.map((section) => (
              <div
                key={section.id}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
              >
                {/* Section Header */}
                <button
                  onClick={() => toggleSection(section.id)}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <section.icon className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                    <span className="text-lg font-semibold text-gray-900 dark:text-white">
                      {section.title}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      ({section.questions.length} questions)
                    </span>
                  </div>
                  {openSection === section.id ? (
                    <ChevronUpIcon className="w-5 h-5 text-gray-500" />
                  ) : (
                    <ChevronDownIcon className="w-5 h-5 text-gray-500" />
                  )}
                </button>

                {/* Questions */}
                {openSection === section.id && (
                  <div className="border-t border-gray-200 dark:border-gray-700">
                    {section.questions.map((item, index) => (
                      <div
                        key={index}
                        className="px-6 py-4 border-b border-gray-100 dark:border-gray-700/50 last:border-b-0"
                      >
                        <h4 className="text-base font-medium text-gray-900 dark:text-white mb-2 flex items-start">
                          <span className="text-primary-600 dark:text-primary-400 mr-2">
                            Q:
                          </span>
                          {item.q}
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 ml-6">
                          <span className="text-green-600 dark:text-green-400 font-medium mr-2">
                            R:
                          </span>
                          {item.a}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Contact Support */}
        <div className="mt-12 bg-gradient-to-r from-primary-600 to-blue-600 rounded-xl shadow-lg p-8 text-center">
          <ChatBubbleLeftRightIcon className="w-12 h-12 text-white mx-auto mb-4" />
          <h3 className="text-2xl font-bold text-white mb-2">
            Vous ne trouvez pas de réponse ?
          </h3>
          <p className="text-blue-100 mb-6">
            Notre équipe de support est là pour vous aider
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="mailto:support@quizapp.com"
              className="inline-flex items-center justify-center px-6 py-3 bg-white text-primary-600 font-medium rounded-lg hover:bg-blue-50 transition-colors"
            >
              <DocumentTextIcon className="w-5 h-5 mr-2" />
              Envoyer un email
            </a>
            <button className="inline-flex items-center justify-center px-6 py-3 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-400 transition-colors">
              <ChatBubbleLeftRightIcon className="w-5 h-5 mr-2" />
              Chat en direct
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Help;
