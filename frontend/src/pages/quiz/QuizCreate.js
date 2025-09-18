import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, useFieldArray } from "react-hook-form";
import { quizService } from "../../services/api";
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
} from "@heroicons/react/24/outline";

const QuizCreate = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("general");
  const [previewMode, setPreviewMode] = useState(false);

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
  } = useFieldArray({
    control,
    name: "questions",
  });

  const watchedQuestions = watch("questions");
  const watchedSettings = watch("settings");

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

  const difficulties = [
    { value: "facile", label: "Facile", color: "text-success-600" },
    { value: "moyen", label: "Moyen", color: "text-warning-600" },
    { value: "difficile", label: "Difficile", color: "text-danger-600" },
  ];

  // Gestionnaires
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
      // QCM: permettre plusieurs réponses correctes
      const newOptions = currentOptions.map((option, i) => ({
        ...option,
        isCorrect: i === optionIndex ? !option.isCorrect : option.isCorrect,
      }));
      setValue(`questions.${questionIndex}.options`, newOptions);
    } else if (questionType === "vrai_faux") {
      // Vrai/Faux: une seule réponse correcte
      const newOptions = currentOptions.map((option, i) => ({
        ...option,
        isCorrect: i === optionIndex,
      }));
      setValue(`questions.${questionIndex}.options`, newOptions);
    }
  };

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

  const onSubmit = async (data) => {
    try {
      setLoading(true);

      // Validation des questions
      const validationErrors = [];

      data.questions.forEach((question, index) => {
        if (!question.question?.trim()) {
          validationErrors.push(`Question ${index + 1}: Le texte est requis`);
        }

        if (question.type === "qcm" || question.type === "vrai_faux") {
          const validOptions =
            question.options?.filter((opt) => opt.text?.trim()) || [];
          const correctOptions = validOptions.filter((opt) => opt.isCorrect);

          if (validOptions.length < 2) {
            validationErrors.push(
              `Question ${index + 1}: Au moins 2 options requises`
            );
          }
          if (correctOptions.length === 0) {
            validationErrors.push(
              `Question ${index + 1}: Au moins une réponse correcte requise`
            );
          }
        }

        if (
          question.type === "reponse_libre" &&
          !question.correctAnswer?.trim()
        ) {
          validationErrors.push(
            `Question ${index + 1}: Réponse correcte requise`
          );
        }
      });

      if (validationErrors.length > 0) {
        toast.error("Erreurs de validation détectées");
        console.error("Erreurs:", validationErrors);
        return;
      }

      // Nettoyer les données
      const cleanData = {
        ...data,
        questions: data.questions.map((q) => ({
          ...q,
          options: q.options?.filter((opt) => opt.text?.trim()) || [],
          order: data.questions.indexOf(q) + 1,
        })),
      };

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
          <input
            {...register("category")}
            type="text"
            className="input"
            placeholder="Ex: Sciences, Histoire, Sport..."
          />
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

        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
          <h4 className="font-medium text-gray-900 dark:text-white mb-2">
            Statistiques
          </h4>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="text-center">
              <div className="font-semibold text-primary-600 dark:text-primary-400">
                {quizStats.questionCount}
              </div>
              <div className="text-gray-500">Questions</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-secondary-600 dark:text-secondary-400">
                {quizStats.totalPoints}
              </div>
              <div className="text-gray-500">Points</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-success-600 dark:text-success-400">
                {Math.ceil(quizStats.estimatedDuration / 60)}min
              </div>
              <div className="text-gray-500">Durée</div>
            </div>
          </div>
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
          </div>

          {/* Options selon le type */}
          {(watch(`questions.${questionIndex}.type`) === "qcm" ||
            watch(`questions.${questionIndex}.type`) === "vrai_faux") && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Options de réponse
              </label>
              <div className="space-y-2">
                {watch(`questions.${questionIndex}.options`)?.map(
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
                          `questions.${questionIndex}.options.${optionIndex}.text`
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

          {/* Réponse libre */}
          {watch(`questions.${questionIndex}.type`) === "reponse_libre" && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Réponse correcte *
              </label>
              <input
                {...register(`questions.${questionIndex}.correctAnswer`)}
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
                Points
              </label>
              <input
                {...register(`questions.${questionIndex}.points`, {
                  valueAsNumber: true,
                  min: 1,
                  max: 100,
                })}
                type="number"
                min="1"
                max="100"
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Temps (sec)
              </label>
              <input
                {...register(`questions.${questionIndex}.timeLimit`, {
                  valueAsNumber: true,
                  min: 5,
                  max: 300,
                })}
                type="number"
                min="5"
                max="300"
                className="input"
              />
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

      {/* Ajouter une question */}
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
        className="w-full btn-outline py-4 border-dashed"
      >
        <PlusIcon className="h-5 w-5 mr-2" />
        Ajouter une question
      </button>
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
                  <span>
                    ~{Math.ceil(quizStats.estimatedDuration / 60)} minutes
                  </span>
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

                  {(question.type === "qcm" ||
                    question.type === "vrai_faux") && (
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
    </div>
  );
};

export default QuizCreate;
