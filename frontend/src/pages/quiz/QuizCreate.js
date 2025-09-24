import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, useFieldArray } from "react-hook-form";
import { quizService } from "../../services/api";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import {
  calculateQuizStats,
  validateQuestion,
  cleanQuestionData,
} from "../../utils/quizUtils";
import toast from "react-hot-toast";
import {
  PlusIcon,
  TrashIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  PhotoIcon,
  EyeIcon,
  CheckIcon,
  XMarkIcon,
  QuestionMarkCircleIcon,
  ClockIcon,
  StarIcon,
  TagIcon,
  Cog6ToothIcon,
  DocumentArrowUpIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/outline";
import BulkQuestionsImport from "./BulkQuestionsImport";

const QuizCreate = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("general");
  const [previewMode, setPreviewMode] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useForm({
    defaultValues: {
      title: "",
      description: "",
      category: "",
      difficulty: "moyen",
      tags: [],
      questions: [
        {
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
        },
      ],
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
    replace: replaceQuestions,
  } = useFieldArray({
    control,
    name: "questions",
  });

  const watchedQuestions = watch("questions");
  const watchedSettings = watch("settings");

  // CORRECTION: Utiliser la fonction utilitaire pour les statistiques
  const quizStats = calculateQuizStats(watchedQuestions);

  const questionTypes = [
    { value: "qcm", label: "QCM (Choix multiples)", icon: "☑️" },
    { value: "vrai_faux", label: "Vrai / Faux", icon: "✓✗" },
    { value: "reponse_libre", label: "Réponse libre", icon: "📝" },
    { value: "nuage_mots", label: "Nuage de mots", icon: "💭" },
  ];

  const difficulties = [
    { value: "facile", label: "Facile", color: "text-success-600" },
    { value: "moyen", label: "Moyen", color: "text-warning-600" },
    { value: "difficile", label: "Difficile", color: "text-danger-600" },
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

  // Gestionnaire du changement de type de question
  const handleQuestionTypeChange = (questionIndex, newType) => {
    console.log(
      `🔄 Changement de type pour question ${questionIndex}: ${newType}`
    );

    if (newType === "vrai_faux") {
      setValue(`questions.${questionIndex}.type`, newType);
      setValue(`questions.${questionIndex}.options`, []);
      setValue(`questions.${questionIndex}.correctAnswer`, "true");
    } else if (newType === "qcm") {
      setValue(`questions.${questionIndex}.type`, newType);
      setValue(`questions.${questionIndex}.options`, [
        { text: "", isCorrect: false },
        { text: "", isCorrect: false },
      ]);
      setValue(`questions.${questionIndex}.correctAnswer`, "");
    } else if (newType === "reponse_libre") {
      setValue(`questions.${questionIndex}.type`, newType);
      setValue(`questions.${questionIndex}.options`, []);
      setValue(`questions.${questionIndex}.correctAnswer`, "");
    } else if (newType === "nuage_mots") {
      setValue(`questions.${questionIndex}.type`, newType);
      setValue(`questions.${questionIndex}.options`, []);
      setValue(`questions.${questionIndex}.correctAnswer`, "");
    }
  };

  // Gestionnaires pour les options
  const handleAddOption = (questionIndex) => {
    const currentOptions =
      getValues(`questions.${questionIndex}.options`) || [];
    setValue(`questions.${questionIndex}.options`, [
      ...currentOptions,
      { text: "", isCorrect: false },
    ]);
  };

  const handleRemoveOption = (questionIndex, optionIndex) => {
    const currentOptions =
      getValues(`questions.${questionIndex}.options`) || [];
    if (currentOptions.length > 2) {
      const newOptions = currentOptions.filter((_, i) => i !== optionIndex);
      setValue(`questions.${questionIndex}.options`, newOptions);
    }
  };

  const handleCorrectAnswerChange = (
    questionIndex,
    optionIndex,
    questionType
  ) => {
    const currentOptions =
      getValues(`questions.${questionIndex}.options`) || [];

    if (questionType === "qcm") {
      const newOptions = currentOptions.map((option, i) => ({
        ...option,
        isCorrect: i === optionIndex ? !option.isCorrect : option.isCorrect,
      }));
      setValue(`questions.${questionIndex}.options`, newOptions);
    } else if (questionType === "vrai_faux") {
      const newOptions = currentOptions.map((option, i) => ({
        ...option,
        isCorrect: i === optionIndex,
      }));
      setValue(`questions.${questionIndex}.options`, newOptions);
    }
  };

  // Gestionnaires pour les tags
  const handleAddTag = (tagValue) => {
    if (!tagValue.trim()) return;
    const currentTags = getValues("tags") || [];
    const newTag = tagValue.trim().toLowerCase();
    if (!currentTags.includes(newTag)) {
      setValue("tags", [...currentTags, newTag]);
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    const currentTags = getValues("tags") || [];
    setValue(
      "tags",
      currentTags.filter((tag) => tag !== tagToRemove)
    );
  };

  // NOUVEAU: Gestionnaire pour l'import en masse
  const handleBulkImport = (importedQuestions) => {
    const currentQuestions = getValues("questions") || [];
    const newQuestions = [...currentQuestions, ...importedQuestions];
    replaceQuestions(newQuestions);

    toast.success(
      `${importedQuestions.length} questions importées avec succès`
    );

    // Passer automatiquement à l'onglet questions
    setActiveTab("questions");
  };

  // CORRECTION: Fonction onSubmit avec validation améliorée
  const onSubmit = async (data) => {
    try {
      setLoading(true);

      // Validation globale
      if (!data.questions || data.questions.length === 0) {
        toast.error("Le quiz doit contenir au moins une question");
        return;
      }

      // CORRECTION: Utiliser la fonction de validation utilitaire
      const allValidationErrors = [];
      data.questions.forEach((question, index) => {
        const errors = validateQuestion(question, index);
        allValidationErrors.push(...errors);
      });

      if (allValidationErrors.length > 0) {
        toast.error("Erreurs de validation détectées");
        console.error("Erreurs:", allValidationErrors);
        // Optionnel: afficher les erreurs dans une modal
        return;
      }

      // CORRECTION: Utiliser la fonction de nettoyage utilitaire
      const cleanData = {
        ...data,
        estimatedDuration: quizStats.estimatedMinutes, // Utiliser les stats calculées
        questions: data.questions.map((q, index) =>
          cleanQuestionData(q, index)
        ),
      };

      console.log("📤 Données nettoyées à envoyer:", cleanData);

      const response = await quizService.createQuiz(cleanData);
      toast.success("Quiz créé avec succès !");
      navigate(`/quiz/${response.quiz.id}`);
    } catch (error) {
      console.error("Erreur lors de la création:", error);
      toast.error("Erreur lors de la création du quiz");
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = () => {
    setPreviewMode(!previewMode);
  };

  // Composants
  const GeneralTab = () => (
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
            className={`input ${errors.title ? "input-error" : ""}`}
            placeholder="Ex: Connaissances générales niveau 1"
          />
          {errors.title && (
            <p className="mt-1 text-sm text-danger-600">
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

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Description
        </label>
        <textarea
          {...register("description")}
          className="input"
          rows={4}
          placeholder="Décrivez le contenu et les objectifs de votre quiz..."
        />
      </div>

      {/* Difficulté et statistiques */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Difficulté
          </label>
          <select {...register("difficulty")} className="input">
            {difficulties.map((diff) => (
              <option key={diff.value} value={diff.value}>
                {diff.label}
              </option>
            ))}
          </select>
        </div>

        {/* CORRECTION: Affichage amélioré des statistiques */}
        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
          <h4 className="font-medium text-gray-900 dark:text-white mb-3">
            Statistiques du quiz
          </h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="text-center">
              <div className="font-semibold text-primary-600 dark:text-primary-400 text-lg">
                {quizStats.questionCount}
              </div>
              <div className="text-gray-500">Questions</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-secondary-600 dark:text-secondary-400 text-lg">
                {quizStats.totalPoints}
              </div>
              <div className="text-gray-500">Points</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-success-600 dark:text-success-400 text-lg">
                {quizStats.estimatedMinutes}min
              </div>
              <div className="text-gray-500">Durée estimée</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-warning-600 dark:text-warning-400 text-lg">
                {quizStats.averagePointsPerQuestion}
              </div>
              <div className="text-gray-500">Pts/Question</div>
            </div>
          </div>

          {/* Indicateur de durée */}
          {quizStats.estimatedMinutes > 0 && (
            <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
              <div className="flex items-center text-xs text-blue-700 dark:text-blue-300">
                <InformationCircleIcon className="h-4 w-4 mr-1" />
                <span>
                  Durée moyenne par question: {quizStats.averageTimePerQuestion}
                  s
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tags */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Tags
        </label>
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2 mb-2">
            {watch("tags")?.map((tag, index) => (
              <span
                key={index}
                className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300"
              >
                #{tag}
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  className="ml-2 hover:text-primary-900 dark:hover:text-primary-100"
                >
                  <XMarkIcon className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          <input
            type="text"
            className="input"
            placeholder="Ajouter un tag et appuyer sur Entrée"
            onKeyPress={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddTag(e.target.value);
                e.target.value = "";
              }
            }}
          />
        </div>
      </div>
    </div>
  );

  const QuestionsTab = () => (
    <div className="space-y-6">
      {/* Header avec actions */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
          Questions ({questions.length})
        </h3>
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={() => setShowBulkImport(true)}
            className="btn-outline btn-sm"
          >
            <DocumentArrowUpIcon className="h-4 w-4 mr-1" />
            Import en masse
          </button>
          <button
            type="button"
            onClick={() =>
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
              })
            }
            className="btn-primary btn-sm"
          >
            <PlusIcon className="h-4 w-4 mr-1" />
            Ajouter une question
          </button>
        </div>
      </div>

      {/* Liste des questions */}
      {questions.map((field, questionIndex) => (
        <div key={field.id} className="card p-6 relative">
          {/* Header de la question */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <span className="flex items-center justify-center w-8 h-8 bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 rounded-full text-sm font-medium">
                {questionIndex + 1}
              </span>
              <select
                {...register(`questions.${questionIndex}.type`)}
                onChange={(e) =>
                  handleQuestionTypeChange(questionIndex, e.target.value)
                }
                className="input py-1"
              >
                {questionTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.icon} {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-2">
              {/* Déplacer la question */}
              <button
                type="button"
                onClick={() => moveQuestion(questionIndex, questionIndex - 1)}
                disabled={questionIndex === 0}
                className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
              >
                <ChevronUpIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => moveQuestion(questionIndex, questionIndex + 1)}
                disabled={questionIndex === questions.length - 1}
                className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
              >
                <ChevronDownIcon className="h-4 w-4" />
              </button>

              {/* Supprimer la question */}
              {questions.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeQuestion(questionIndex)}
                  className="p-1 text-gray-400 hover:text-danger-600"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Texte de la question */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Question *
            </label>
            <textarea
              {...register(`questions.${questionIndex}.question`, {
                required: "Le texte de la question est requis",
              })}
              className="input"
              rows={3}
              placeholder="Posez votre question..."
            />
            {errors.questions?.[questionIndex]?.question && (
              <p className="mt-1 text-sm text-danger-600">
                {errors.questions[questionIndex].question.message}
              </p>
            )}
          </div>

          {/* Options pour QCM seulement */}
          {watch(`questions.${questionIndex}.type`) === "qcm" && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Options de réponse *
              </label>
              <div className="space-y-2">
                {(watch(`questions.${questionIndex}.options`) || []).map(
                  (option, optionIndex) => (
                    <div
                      key={optionIndex}
                      className="flex items-center space-x-2"
                    >
                      <input
                        type="checkbox"
                        checked={option.isCorrect || false}
                        onChange={() =>
                          handleCorrectAnswerChange(
                            questionIndex,
                            optionIndex,
                            watch(`questions.${questionIndex}.type`)
                          )
                        }
                        className="rounded border-gray-300 text-success-600 focus:ring-success-500"
                      />
                      <input
                        {...register(
                          `questions.${questionIndex}.options.${optionIndex}.text`,
                          { required: "Le texte de l'option est requis" }
                        )}
                        type="text"
                        className="flex-1 input"
                        placeholder={`Option ${optionIndex + 1}`}
                      />
                      {watch(`questions.${questionIndex}.options`)?.length >
                        2 && (
                        <button
                          type="button"
                          onClick={() =>
                            handleRemoveOption(questionIndex, optionIndex)
                          }
                          className="p-1 text-gray-400 hover:text-danger-600"
                        >
                          <XMarkIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  )
                )}
                <button
                  type="button"
                  onClick={() => handleAddOption(questionIndex)}
                  className="text-sm text-primary-600 hover:text-primary-500 flex items-center"
                >
                  <PlusIcon className="h-4 w-4 mr-1" />
                  Ajouter une option
                </button>
              </div>
            </div>
          )}

          {/* Réponse correcte pour Vrai/Faux */}
          {watch(`questions.${questionIndex}.type`) === "vrai_faux" && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Réponse correcte *
              </label>
              <select
                {...register(`questions.${questionIndex}.correctAnswer`, {
                  required: "La réponse correcte est requise",
                })}
                className="input w-auto"
              >
                <option value="">-- Choisir --</option>
                <option value="true">Vrai</option>
                <option value="false">Faux</option>
              </select>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Les options "Vrai" et "Faux" seront générées automatiquement
                lors de la session.
              </p>
            </div>
          )}

          {/* Réponse libre */}
          {watch(`questions.${questionIndex}.type`) === "reponse_libre" && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Réponse correcte *
              </label>
              <input
                {...register(`questions.${questionIndex}.correctAnswer`, {
                  required: "La réponse correcte est requise",
                })}
                type="text"
                className="input"
                placeholder="Réponse attendue"
              />
            </div>
          )}

          {/* Configuration avancée */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Points *
              </label>
              <input
                {...register(`questions.${questionIndex}.points`, {
                  valueAsNumber: true,
                  min: { value: 1, message: "Minimum 1 point" },
                  max: { value: 100, message: "Maximum 100 points" },
                })}
                type="number"
                min="1"
                max="100"
                className="input"
              />
              {errors.questions?.[questionIndex]?.points && (
                <p className="mt-1 text-xs text-danger-600">
                  {errors.questions[questionIndex].points.message}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Temps limite (sec) *
              </label>
              <input
                {...register(`questions.${questionIndex}.timeLimit`, {
                  valueAsNumber: true,
                  min: { value: 5, message: "Minimum 5 secondes" },
                  max: { value: 300, message: "Maximum 300 secondes" },
                })}
                type="number"
                min="5"
                max="300"
                className="input"
              />
              {errors.questions?.[questionIndex]?.timeLimit && (
                <p className="mt-1 text-xs text-danger-600">
                  {errors.questions[questionIndex].timeLimit.message}
                </p>
              )}
            </div>
            <div className="flex items-end">
              <button
                type="button"
                className="btn-outline btn-sm w-full"
                title="Ajouter un média (image, vidéo)"
              >
                <PhotoIcon className="h-4 w-4 mr-1" />
                Média
              </button>
            </div>
          </div>

          {/* Explication */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Explication (optionnelle)
            </label>
            <textarea
              {...register(`questions.${questionIndex}.explanation`)}
              className="input"
              rows={2}
              placeholder="Expliquez pourquoi cette réponse est correcte..."
            />
          </div>
        </div>
      ))}

      {/* Message si aucune question */}
      {questions.length === 0 && (
        <div className="text-center py-12 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
          <QuestionMarkCircleIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Aucune question ajoutée
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Commencez par ajouter une question ou importez plusieurs questions
            en une fois.
          </p>
          <div className="flex justify-center space-x-3">
            <button
              type="button"
              onClick={() => setShowBulkImport(true)}
              className="btn-outline"
            >
              <DocumentArrowUpIcon className="h-4 w-4 mr-2" />
              Import en masse
            </button>
            <button
              type="button"
              onClick={() =>
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
                })
              }
              className="btn-primary"
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              Créer ma première question
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const SettingsTab = () => (
    <div className="space-y-6">
      {/* Visibilité */}
      <div className="card p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Visibilité et accès
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white">
                Quiz public
              </h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Les autres utilisateurs peuvent voir et dupliquer ce quiz
              </p>
            </div>
            <input
              {...register("settings.isPublic")}
              type="checkbox"
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white">
                Participation anonyme
              </h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Permettre la participation sans compte utilisateur
              </p>
            </div>
            <input
              {...register("settings.allowAnonymous")}
              type="checkbox"
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
          </div>
        </div>
      </div>

      {/* Résultats */}
      <div className="card p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Affichage des résultats
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white">
                Montrer les résultats
              </h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Afficher les scores aux participants
              </p>
            </div>
            <input
              {...register("settings.showResults")}
              type="checkbox"
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white">
                Montrer les bonnes réponses
              </h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Révéler les réponses correctes après le quiz
              </p>
            </div>
            <input
              {...register("settings.showCorrectAnswers")}
              type="checkbox"
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
          </div>
        </div>
      </div>

      {/* Comportement */}
      <div className="card p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Comportement du quiz
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white">
                Mélanger les questions
              </h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Présenter les questions dans un ordre aléatoire
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
              <h4 className="font-medium text-gray-900 dark:text-white">
                Mélanger les options
              </h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Présenter les options de réponse dans un ordre aléatoire
              </p>
            </div>
            <input
              {...register("settings.randomizeOptions")}
              type="checkbox"
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mt-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Tentatives maximum
            </label>
            <select {...register("settings.maxAttempts")} className="input">
              <option value={1}>1 tentative</option>
              <option value={2}>2 tentatives</option>
              <option value={3}>3 tentatives</option>
              <option value={5}>5 tentatives</option>
              <option value={-1}>Illimitées</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Score de passage (%)
            </label>
            <input
              {...register("settings.passingScore", {
                valueAsNumber: true,
                min: 0,
                max: 100,
              })}
              type="number"
              min="0"
              max="100"
              className="input"
            />
          </div>
        </div>
      </div>
    </div>
  );

  const PreviewModal = () => {
    if (!previewMode) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-full overflow-y-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Aperçu du Quiz
              </h2>
              <button
                onClick={() => setPreviewMode(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Info du quiz */}
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  {watch("title") || "Titre du quiz"}
                </h3>
                {watch("description") && (
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    {watch("description")}
                  </p>
                )}
                <div className="flex flex-wrap gap-4 text-sm text-gray-500 dark:text-gray-400">
                  <span>{quizStats.questionCount} questions</span>
                  <span>{quizStats.totalPoints} points</span>
                  <span>~{quizStats.estimatedMinutes} minutes</span>
                  <span
                    className={`badge ${getDifficultyBadge(
                      watch("difficulty")
                    )}`}
                  >
                    {watch("difficulty")}
                  </span>
                </div>
              </div>

              {/* Questions */}
              {watchedQuestions?.map((question, index) => (
                <div
                  key={index}
                  className="border border-gray-200 dark:border-gray-600 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between mb-3">
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      {index + 1}. {question.question || "Question sans titre"}
                    </h4>
                    <div className="flex items-center space-x-2 text-sm text-gray-500">
                      <ClockIcon className="h-4 w-4" />
                      <span>{question.timeLimit}s</span>
                      <StarIcon className="h-4 w-4" />
                      <span>{question.points}pts</span>
                    </div>
                  </div>

                  {question.type === "qcm" && (
                    <div className="space-y-2">
                      {question.options?.map((option, optIndex) => (
                        <div
                          key={optIndex}
                          className={`p-3 rounded-lg border ${
                            option.isCorrect
                              ? "border-success-300 bg-success-50 dark:bg-success-900 dark:border-success-700"
                              : "border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800"
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            <div
                              className={`w-4 h-4 rounded-full border-2 ${
                                option.isCorrect
                                  ? "bg-success-500 border-success-500"
                                  : "border-gray-300"
                              }`}
                            ></div>
                            <span>
                              {option.text || `Option ${optIndex + 1}`}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {question.type === "vrai_faux" && (
                    <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Réponse correcte :{" "}
                        <span className="font-medium text-success-600 dark:text-success-400">
                          {question.correctAnswer === "true" ? "Vrai" : "Faux"}
                        </span>
                      </p>
                    </div>
                  )}

                  {question.type === "reponse_libre" && (
                    <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Réponse attendue :{" "}
                        <span className="font-medium text-success-600 dark:text-success-400">
                          {question.correctAnswer || "Non définie"}
                        </span>
                      </p>
                    </div>
                  )}

                  {question.explanation && (
                    <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900 rounded-lg">
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        <QuestionMarkCircleIcon className="h-4 w-4 inline mr-1" />
                        {question.explanation}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const getDifficultyBadge = (difficulty) => {
    const badges = {
      facile: "badge-success",
      moyen: "badge-warning",
      difficile: "badge-danger",
    };
    return badges[difficulty] || "badge-gray";
  };

  const tabs = [
    { id: "general", label: "Général", icon: TagIcon },
    {
      id: "questions",
      label: "Questions",
      icon: QuestionMarkCircleIcon,
      count: questions.length,
    },
    { id: "settings", label: "Paramètres", icon: Cog6ToothIcon },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Créer un nouveau quiz
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Concevez un quiz interactif pour vos formations
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button type="button" onClick={handlePreview} className="btn-outline">
            <EyeIcon className="h-4 w-4 mr-2" />
            Aperçu
          </button>
          <button
            type="submit"
            form="quiz-form"
            disabled={loading}
            className="btn-primary"
          >
            {loading ? (
              <LoadingSpinner size="sm" inline />
            ) : (
              <>
                <CheckIcon className="h-4 w-4 mr-2" />
                Créer le quiz
              </>
            )}
          </button>
        </div>
      </div>

      {/* Navigation par onglets */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => {
            const IconComponent = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                  activeTab === tab.id
                    ? "border-primary-500 text-primary-600 dark:text-primary-400"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
                }`}
              >
                <IconComponent className="h-4 w-4" />
                <span>{tab.label}</span>
                {tab.count && (
                  <span className="bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-300 py-0.5 px-2 rounded-full text-xs">
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Contenu du formulaire */}
      <form id="quiz-form" onSubmit={handleSubmit(onSubmit)}>
        {activeTab === "general" && <GeneralTab />}
        {activeTab === "questions" && <QuestionsTab />}
        {activeTab === "settings" && <SettingsTab />}
      </form>

      {/* Modal d'aperçu */}
      <PreviewModal />

      {/* Modal d'import en masse */}
      {showBulkImport && (
        <BulkQuestionsImport
          onImport={handleBulkImport}
          onClose={() => setShowBulkImport(false)}
        />
      )}
    </div>
  );
};

export default QuizCreate;
