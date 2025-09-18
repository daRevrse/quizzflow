import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useAuthStore } from "../../stores/authStore";
import { quizService, sessionService } from "../../services/api";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import toast from "react-hot-toast";
import {
  PlayIcon,
  MagnifyingGlassIcon,
  ClockIcon,
  UserGroupIcon,
  EyeIcon,
  Cog6ToothIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
  QuestionMarkCircleIcon,
} from "@heroicons/react/24/outline";

const SessionCreate = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuthStore();

  const [loading, setLoading] = useState(false);
  const [quizzes, setQuizzes] = useState([]);
  const [loadingQuizzes, setLoadingQuizzes] = useState(true);
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    defaultValues: {
      quizId: searchParams.get("quizId") || "",
      title: "",
      settings: {
        allowLateJoin: true,
        showLeaderboard: true,
        autoAdvance: false,
        questionTimeLimit: null,
        maxParticipants: 100,
        showCorrectAnswers: true,
        randomizeQuestions: false,
        enableChat: false,
      },
    },
  });

  const watchedQuizId = watch("quizId");
  const watchedSettings = watch("settings");

  // Charger les quiz disponibles
  useEffect(() => {
    loadQuizzes();
  }, []);

  // Charger les détails du quiz sélectionné
  useEffect(() => {
    if (watchedQuizId) {
      loadQuizDetails(watchedQuizId);
    } else {
      setSelectedQuiz(null);
    }
  }, [watchedQuizId]);

  const loadQuizzes = async () => {
    try {
      setLoadingQuizzes(true);
      const response = await quizService.getMyQuizzes({
        limit: 100,
        status: "active",
      });
      setQuizzes(response.quizzes || []);
    } catch (error) {
      console.error("Erreur lors du chargement des quiz:", error);
      toast.error("Erreur lors du chargement des quiz");
    } finally {
      setLoadingQuizzes(false);
    }
  };

  const loadQuizDetails = async (quizId) => {
    try {
      const response = await quizService.getQuiz(quizId);
      setSelectedQuiz(response.quiz);

      // Pré-remplir le titre de la session
      if (!watch("title")) {
        setValue("title", `Session - ${response.quiz.title}`);
      }
    } catch (error) {
      console.error("Erreur lors du chargement du quiz:", error);
      toast.error("Erreur lors du chargement du quiz");
    }
  };

  const onSubmit = async (data) => {
    try {
      setLoading(true);

      if (!data.quizId) {
        toast.error("Veuillez sélectionner un quiz");
        return;
      }

      const sessionData = {
        quizId: data.quizId,
        title: data.title || `Session - ${selectedQuiz?.title}`,
        settings: data.settings,
      };

      const response = await sessionService.createSession(sessionData);

      toast.success("Session créée avec succès !");
      navigate(`/session/${response.session.id}/host`);
    } catch (error) {
      console.error("Erreur lors de la création de la session:", error);
      toast.error("Erreur lors de la création de la session");
    } finally {
      setLoading(false);
    }
  };

  // Filtrer les quiz selon la recherche
  const filteredQuizzes = quizzes.filter(
    (quiz) =>
      quiz.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      quiz.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleQuizSelect = (quiz) => {
    setValue("quizId", quiz.id);
    setValue("title", `Session - ${quiz.title}`);
  };

  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case "facile":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "moyen":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "difficile":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
        <div className="px-6 py-4">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate("/dashboard")}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <ArrowLeftIcon className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Créer une session
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Lancez une session de quiz en temps réel
              </p>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sélection du quiz */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    Sélectionner un quiz
                  </h3>
                  <div className="relative">
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Rechercher un quiz..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                </div>
              </div>

              <div className="p-6">
                {loadingQuizzes ? (
                  <div className="flex items-center justify-center py-8">
                    <LoadingSpinner />
                  </div>
                ) : filteredQuizzes.length === 0 ? (
                  <div className="text-center py-8">
                    <QuestionMarkCircleIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500 dark:text-gray-400">
                      {searchQuery
                        ? "Aucun quiz trouvé"
                        : "Aucun quiz disponible"}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredQuizzes.map((quiz) => (
                      <div
                        key={quiz.id}
                        onClick={() => handleQuizSelect(quiz)}
                        className={`cursor-pointer p-4 border-2 rounded-lg transition-all ${
                          watchedQuizId === quiz.id
                            ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20"
                            : "border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500"
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-medium text-gray-900 dark:text-white line-clamp-2">
                            {quiz.title}
                          </h4>
                          {watchedQuizId === quiz.id && (
                            <CheckCircleIcon className="h-5 w-5 text-primary-600 dark:text-primary-400 ml-2" />
                          )}
                        </div>

                        <div className="flex items-center space-x-2 mb-3">
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(
                              quiz.difficulty
                            )}`}
                          >
                            {quiz.difficulty}
                          </span>
                          {quiz.category && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {quiz.category}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                          <span>{quiz.questions?.length || 0} questions</span>
                          <span>
                            ~{Math.ceil((quiz.estimatedDuration || 0) / 60)} min
                          </span>
                        </div>

                        {quiz.stats?.totalSessions > 0 && (
                          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                            {quiz.stats.totalSessions} session
                            {quiz.stats.totalSessions > 1 ? "s" : ""} précédente
                            {quiz.stats.totalSessions > 1 ? "s" : ""}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Configuration de la session */}
          <div>
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Configuration
                </h3>
              </div>

              <div className="p-6 space-y-6">
                {/* Titre de la session */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Titre de la session
                  </label>
                  <input
                    {...register("title", {
                      required: "Le titre est requis",
                    })}
                    type="text"
                    className={`input ${
                      errors.title ? "border-red-300 dark:border-red-600" : ""
                    }`}
                    placeholder="Nom de votre session..."
                  />
                  {errors.title && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                      {errors.title.message}
                    </p>
                  )}
                </div>

                {/* Paramètres de session */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                    Paramètres
                  </h4>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm text-gray-700 dark:text-gray-300">
                          Rejointe tardive autorisée
                        </label>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Permettre aux participants de rejoindre en cours
                        </p>
                      </div>
                      <input
                        {...register("settings.allowLateJoin")}
                        type="checkbox"
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm text-gray-700 dark:text-gray-300">
                          Afficher le classement
                        </label>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Montrer le leaderboard en temps réel
                        </p>
                      </div>
                      <input
                        {...register("settings.showLeaderboard")}
                        type="checkbox"
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm text-gray-700 dark:text-gray-300">
                          Avancement automatique
                        </label>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Passer automatiquement à la question suivante
                        </p>
                      </div>
                      <input
                        {...register("settings.autoAdvance")}
                        type="checkbox"
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm text-gray-700 dark:text-gray-300">
                          Afficher les bonnes réponses
                        </label>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Révéler les réponses correctes
                        </p>
                      </div>
                      <input
                        {...register("settings.showCorrectAnswers")}
                        type="checkbox"
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm text-gray-700 dark:text-gray-300">
                          Questions aléatoires
                        </label>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Mélanger l'ordre des questions
                        </p>
                      </div>
                      <input
                        {...register("settings.randomizeQuestions")}
                        type="checkbox"
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm text-gray-700 dark:text-gray-300">
                          Chat en direct
                        </label>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Permettre le chat entre participants
                        </p>
                      </div>
                      <input
                        {...register("settings.enableChat")}
                        type="checkbox"
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Limites */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                    Limites
                  </h4>

                  <div>
                    <label className="block text-sm text-gray-700 dark:text-gray-300 mb-2">
                      Nombre max de participants
                    </label>
                    <input
                      {...register("settings.maxParticipants")}
                      type="number"
                      min="1"
                      max="1000"
                      className="input"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-700 dark:text-gray-300 mb-2">
                      Temps limite par question (secondes)
                    </label>
                    <input
                      {...register("settings.questionTimeLimit")}
                      type="number"
                      min="10"
                      max="300"
                      placeholder="Temps du quiz par défaut"
                      className="input"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Laissez vide pour utiliser les temps du quiz
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Aperçu du quiz sélectionné */}
            {selectedQuiz && (
              <div className="bg-white dark:bg-gray-800 shadow rounded-lg mt-6">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    Aperçu du quiz
                  </h3>
                </div>

                <div className="p-6">
                  <div className="space-y-3">
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white">
                        {selectedQuiz.title}
                      </h4>
                      {selectedQuiz.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {selectedQuiz.description}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">
                          Questions:
                        </span>
                        <span className="ml-2 font-medium text-gray-900 dark:text-white">
                          {selectedQuiz.questions?.length || 0}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">
                          Points:
                        </span>
                        <span className="ml-2 font-medium text-gray-900 dark:text-white">
                          {selectedQuiz.questions?.reduce(
                            (sum, q) => sum + (q.points || 1),
                            0
                          ) || 0}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">
                          Durée:
                        </span>
                        <span className="ml-2 font-medium text-gray-900 dark:text-white">
                          ~
                          {Math.ceil(
                            (selectedQuiz.estimatedDuration || 0) / 60
                          )}{" "}
                          min
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">
                          Difficulté:
                        </span>
                        <span
                          className={`ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(
                            selectedQuiz.difficulty
                          )}`}
                        >
                          {selectedQuiz.difficulty}
                        </span>
                      </div>
                    </div>

                    {selectedQuiz.tags && selectedQuiz.tags.length > 0 && (
                      <div>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          Tags:
                        </span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {selectedQuiz.tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex items-center px-2 py-1 rounded-md text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {selectedQuiz
                ? `Quiz sélectionné: ${selectedQuiz.title}`
                : "Sélectionnez un quiz pour continuer"}
            </div>

            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={() => navigate("/dashboard")}
                className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-md transition-colors"
              >
                Annuler
              </button>

              <button
                type="submit"
                disabled={loading || !watchedQuizId}
                className="inline-flex items-center px-6 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-sm font-medium rounded-md transition-colors"
              >
                {loading ? (
                  <LoadingSpinner size="sm" className="mr-2" />
                ) : (
                  <PlayIcon className="h-4 w-4 mr-2" />
                )}
                {loading ? "Création..." : "Créer la session"}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

export default SessionCreate;
