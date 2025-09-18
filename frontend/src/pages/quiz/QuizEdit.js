import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useForm, useFieldArray } from "react-hook-form";
import { quizService } from "../../services/api";
import { useAuthStore } from "../../stores/authStore";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import toast from "react-hot-toast";
import {
  PlusIcon,
  TrashIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  PhotoIcon,
  PlayIcon,
  EyeIcon,
  CheckIcon,
  XMarkIcon,
  QuestionMarkCircleIcon,
  ClockIcon,
  StarIcon,
  TagIcon,
  Cog6ToothIcon,
  ArrowLeftIcon,
} from "@heroicons/react/24/outline";

const QuizEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("general");
  const [previewMode, setPreviewMode] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isDirty },
  } = useForm({
    defaultValues: {
      title: "",
      description: "",
      category: "",
      difficulty: "moyen",
      tags: [],
      questions: [],
      settings: {
        isPublic: false,
        allowAnonymous: true,
        showResults: true,
        showCorrectAnswers: true,
        randomizeQuestions: false,
        randomizeOptions: false,
        maxAttempts: 1,
        passingScore: 50,
      },
    },
  });

  const {
    fields: questions,
    append: addQuestion,
    remove: removeQuestion,
    move: moveQuestion,
  } = useFieldArray({
    control,
    name: "questions",
  });

  const watchedQuestions = watch("questions");
  const watchedSettings = watch("settings");

  // Charger le quiz à éditer
  useEffect(() => {
    loadQuiz();
  }, [id]);

  const loadQuiz = async () => {
    try {
      setLoading(true);
      const response = await quizService.getQuiz(id);
      const quiz = response.quiz;

      // Vérifier les permissions
      if (
        quiz.creatorId !== user.id &&
        quiz.creator?.id !== user.id &&
        user.role !== "admin"
      ) {
        toast.error("Vous n'avez pas les permissions pour modifier ce quiz");
        navigate("/quiz");
        return;
      }

      // Remplir le formulaire avec les données du quiz
      reset({
        title: quiz.title || "",
        description: quiz.description || "",
        category: quiz.category || "",
        difficulty: quiz.difficulty || "moyen",
        tags: quiz.tags || [],
        questions: quiz.questions || [],
        settings: {
          isPublic: quiz.settings?.isPublic || false,
          allowAnonymous: quiz.settings?.allowAnonymous || true,
          showResults: quiz.settings?.showResults || true,
          showCorrectAnswers: quiz.settings?.showCorrectAnswers || true,
          randomizeQuestions: quiz.settings?.randomizeQuestions || false,
          randomizeOptions: quiz.settings?.randomizeOptions || false,
          maxAttempts: quiz.settings?.maxAttempts || 1,
          passingScore: quiz.settings?.passingScore || 50,
        },
      });
    } catch (error) {
      console.error("Erreur lors du chargement du quiz:", error);
      toast.error("Erreur lors du chargement du quiz");
      navigate("/quiz");
    } finally {
      setLoading(false);
    }
  };

  // Calculer les statistiques du quiz
  const quizStats = {
    questionCount: questions.length,
    totalPoints:
      watchedQuestions?.reduce((sum, q) => sum + (q?.points || 1), 0) || 0,
    estimatedDuration:
      watchedQuestions?.reduce((sum, q) => sum + (q?.timeLimit || 30), 0) || 0,
  };

  const questionTypes = [
    { value: "qcm", label: "QCM (Choix multiples)", icon: "☑️" },
    { value: "vrai_faux", label: "Vrai / Faux", icon: "✓✗" },
    { value: "reponse_libre", label: "Réponse libre", icon: "📝" },
    { value: "nuage_mots", label: "Nuage de mots", icon: "💭" },
  ];

  const categories = [
    "Mathématiques",
    "Sciences",
    "Histoire",
    "Géographie",
    "Langues",
    "Informatique",
    "Arts",
    "Sport",
    "Culture générale",
    "Autre",
  ];

  // Gestionnaires
  const onSubmit = async (data) => {
    try {
      setSaving(true);

      // Validation des questions
      if (!data.questions || data.questions.length === 0) {
        toast.error("Le quiz doit contenir au moins une question");
        return;
      }

      // Préparation des données
      const quizData = {
        ...data,
        estimatedDuration: Math.ceil(quizStats.estimatedDuration / 60),
        questions: data.questions.map((q, index) => ({
          ...q,
          order: index + 1,
          id: q.id || `temp_${Date.now()}_${index}`,
        })),
      };

      const response = await quizService.updateQuiz(id, quizData);
      toast.success("Quiz mis à jour avec succès !");
      navigate(`/quiz/${id}`);
    } catch (error) {
      console.error("Erreur lors de la mise à jour:", error);
      toast.error("Erreur lors de la mise à jour du quiz");
    } finally {
      setSaving(false);
    }
  };

  const handleAddQuestion = () => {
    addQuestion({
      type: "qcm",
      question: "",
      options: [
        { text: "", isCorrect: false },
        { text: "", isCorrect: false },
      ],
      correctAnswer: "",
      explanation: "",
      points: 1,
      timeLimit: 30,
      media: null,
    });
  };

  const getDifficultyBadge = (difficulty) => {
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate(`/quiz/${id}`)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <ArrowLeftIcon className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Modifier le quiz
                </h1>
                <div className="flex items-center mt-2 space-x-4 text-sm text-gray-500 dark:text-gray-400">
                  <span>{quizStats.questionCount} questions</span>
                  <span>{quizStats.totalPoints} points</span>
                  <span>
                    ~{Math.ceil(quizStats.estimatedDuration / 60)} min
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={() => setPreviewMode(!previewMode)}
                className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-md transition-colors"
              >
                <EyeIcon className="h-4 w-4 mr-2" />
                Aperçu
              </button>

              <button
                type="button"
                onClick={handleSubmit(onSubmit)}
                disabled={saving || !isDirty}
                className="inline-flex items-center px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-sm font-medium rounded-md transition-colors"
              >
                {saving ? (
                  <LoadingSpinner size="sm" className="mr-2" />
                ) : (
                  <CheckIcon className="h-4 w-4 mr-2" />
                )}
                {saving ? "Enregistrement..." : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>

        {/* Onglets */}
        <div className="border-t border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex">
            {[
              { id: "general", name: "Général", icon: Cog6ToothIcon },
              {
                id: "questions",
                name: "Questions",
                icon: QuestionMarkCircleIcon,
              },
              { id: "settings", name: "Paramètres", icon: Cog6ToothIcon },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`group relative min-w-0 flex-1 overflow-hidden py-4 px-4 text-sm font-medium text-center hover:bg-gray-50 dark:hover:bg-gray-700 focus:z-10 ${
                  activeTab === tab.id
                    ? "text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
              >
                <tab.icon className="h-5 w-5 mx-auto mb-1" />
                {tab.name}
                {activeTab === tab.id && (
                  <span
                    aria-hidden="true"
                    className="bg-primary-500 absolute inset-x-0 bottom-0 h-0.5"
                  />
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Contenu des onglets */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {activeTab === "general" && (
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <div className="space-y-6">
              {/* Informations de base */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Titre du quiz *
                  </label>
                  <input
                    {...register("title", { required: "Le titre est requis" })}
                    type="text"
                    className={`input ${
                      errors.title ? "border-red-300 dark:border-red-600" : ""
                    }`}
                    placeholder="Entrez le titre de votre quiz"
                  />
                  {errors.title && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                      {errors.title.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Catégorie
                  </label>
                  <select {...register("category")} className="input">
                    <option value="">Sélectionner une catégorie</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  {...register("description")}
                  rows={3}
                  className="input"
                  placeholder="Décrivez brièvement votre quiz..."
                />
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Difficulté
                  </label>
                  <select {...register("difficulty")} className="input">
                    <option value="facile">Facile</option>
                    <option value="moyen">Moyen</option>
                    <option value="difficile">Difficile</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Tags
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Séparez les tags par des virgules"
                    onChange={(e) => {
                      const tags = e.target.value
                        .split(",")
                        .map((tag) => tag.trim())
                        .filter((tag) => tag.length > 0);
                      setValue("tags", tags);
                    }}
                    defaultValue={watch("tags")?.join(", ") || ""}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "questions" && (
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Questions ({questions.length})
              </h3>
              <button
                type="button"
                onClick={handleAddQuestion}
                className="inline-flex items-center px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-md transition-colors"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                Ajouter une question
              </button>
            </div>

            {questions.length === 0 ? (
              <div className="text-center py-8">
                <QuestionMarkCircleIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  Aucune question ajoutée. Commencez par créer votre première
                  question.
                </p>
                <button
                  type="button"
                  onClick={handleAddQuestion}
                  className="inline-flex items-center px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-md transition-colors"
                >
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Créer ma première question
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {questions.map((question, index) => (
                  <div
                    key={question.id || index}
                    className="border border-gray-200 dark:border-gray-600 rounded-lg p-4"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <span className="flex-shrink-0 flex items-center justify-center w-8 h-8 bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-400 rounded-full text-sm font-medium">
                          {index + 1}
                        </span>
                        <select
                          {...register(`questions.${index}.type`)}
                          className="input w-auto"
                        >
                          {questionTypes.map((type) => (
                            <option key={type.value} value={type.value}>
                              {type.icon} {type.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center space-x-2">
                        {index > 0 && (
                          <button
                            type="button"
                            onClick={() => moveQuestion(index, index - 1)}
                            className="p-1 text-gray-400 hover:text-gray-600"
                            title="Déplacer vers le haut"
                          >
                            <ChevronUpIcon className="h-4 w-4" />
                          </button>
                        )}
                        {index < questions.length - 1 && (
                          <button
                            type="button"
                            onClick={() => moveQuestion(index, index + 1)}
                            className="p-1 text-gray-400 hover:text-gray-600"
                            title="Déplacer vers le bas"
                          >
                            <ChevronDownIcon className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => removeQuestion(index)}
                          className="p-1 text-red-400 hover:text-red-600"
                          title="Supprimer la question"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {/* Question */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Question *
                        </label>
                        <textarea
                          {...register(`questions.${index}.question`, {
                            required: "La question est requise",
                          })}
                          rows={2}
                          className="input"
                          placeholder="Posez votre question..."
                        />
                      </div>

                      {/* Options pour QCM */}
                      {watch(`questions.${index}.type`) === "qcm" && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Options de réponse
                          </label>
                          <div className="space-y-2">
                            {question.options?.map((option, optIndex) => (
                              <div
                                key={optIndex}
                                className="flex items-center space-x-3"
                              >
                                <input
                                  type="checkbox"
                                  {...register(
                                    `questions.${index}.options.${optIndex}.isCorrect`
                                  )}
                                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                />
                                <input
                                  {...register(
                                    `questions.${index}.options.${optIndex}.text`
                                  )}
                                  type="text"
                                  className="flex-1 input"
                                  placeholder={`Option ${optIndex + 1}`}
                                />
                              </div>
                            )) || []}
                          </div>
                        </div>
                      )}

                      {/* Réponse correcte pour Vrai/Faux */}
                      {watch(`questions.${index}.type`) === "vrai_faux" && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Réponse correcte
                          </label>
                          <select
                            {...register(`questions.${index}.correctAnswer`)}
                            className="input w-auto"
                          >
                            <option value="true">Vrai</option>
                            <option value="false">Faux</option>
                          </select>
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Points
                          </label>
                          <input
                            {...register(`questions.${index}.points`)}
                            type="number"
                            min="1"
                            max="10"
                            className="input"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Temps limite (sec)
                          </label>
                          <input
                            {...register(`questions.${index}.timeLimit`)}
                            type="number"
                            min="10"
                            max="300"
                            className="input"
                          />
                        </div>
                      </div>

                      {/* Explication */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Explication (optionnelle)
                        </label>
                        <textarea
                          {...register(`questions.${index}.explanation`)}
                          rows={2}
                          className="input"
                          placeholder="Expliquez la réponse correcte..."
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "settings" && (
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  Paramètres du quiz
                </h3>
              </div>

              {/* Visibilité */}
              <div>
                <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                  Visibilité et accès
                </h4>
                <div className="space-y-3">
                  <div className="flex items-center">
                    <input
                      {...register("settings.isPublic")}
                      type="checkbox"
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <div className="ml-3">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Quiz public
                      </label>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Visible par tous les utilisateurs
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center">
                    <input
                      {...register("settings.allowAnonymous")}
                      type="checkbox"
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <div className="ml-3">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Participation anonyme
                      </label>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Autoriser la participation sans compte
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Résultats */}
              <div>
                <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                  Affichage des résultats
                </h4>
                <div className="space-y-3">
                  <div className="flex items-center">
                    <input
                      {...register("settings.showResults")}
                      type="checkbox"
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <div className="ml-3">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Afficher les résultats
                      </label>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Montrer les scores aux participants
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center">
                    <input
                      {...register("settings.showCorrectAnswers")}
                      type="checkbox"
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <div className="ml-3">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Afficher les bonnes réponses
                      </label>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Révéler les réponses correctes
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Configuration avancée */}
              <div>
                <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                  Configuration avancée
                </h4>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Tentatives maximales
                      </label>
                      <input
                        {...register("settings.maxAttempts")}
                        type="number"
                        min="1"
                        max="10"
                        className="input"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Score de passage (%)
                      </label>
                      <input
                        {...register("settings.passingScore")}
                        type="number"
                        min="0"
                        max="100"
                        className="input"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center">
                      <input
                        {...register("settings.randomizeQuestions")}
                        type="checkbox"
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <div className="ml-3">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Questions aléatoires
                        </label>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Mélanger l'ordre des questions
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center">
                      <input
                        {...register("settings.randomizeOptions")}
                        type="checkbox"
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <div className="ml-3">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Options aléatoires
                        </label>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Mélanger l'ordre des réponses
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </form>
    </div>
  );
};

export default QuizEdit;
