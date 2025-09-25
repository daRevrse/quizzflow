// frontend/src/pages/quiz/QuizPublicView.js
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";
import { quizService } from "../../services/api";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import toast from "react-hot-toast";
import {
  ArrowLeftIcon,
  ShareIcon,
  ClockIcon,
  QuestionMarkCircleIcon,
  TrophyIcon,
  UsersIcon,
  CalendarIcon,
  StarIcon,
  AcademicCapIcon,
  ChartBarIcon,
  LockClosedIcon,
  EyeIcon,
} from "@heroicons/react/24/outline";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const QuizPublicView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadQuiz();
  }, [id]);

  const loadQuiz = async () => {
    try {
      setLoading(true);
      const response = await quizService.getQuizPublic(id);

      // Vérifier si le quiz est public ou si l'utilisateur a les permissions
      const quiz = response.quiz;
      const canView =
        quiz.settings?.isPublic ||
        user?.role === "formateur" ||
        user?.role === "admin" ||
        quiz.creatorId === user?.id;

      if (!canView) {
        setError("Ce quiz n'est pas accessible publiquement.");
        return;
      }

      // Pour les étudiants, masquer les questions
      if (user?.role === "etudiant" && !quiz.settings?.isPublic) {
        setError("Accès non autorisé à ce quiz.");
        return;
      }

      // Créer une version publique sans les réponses
      const publicQuiz = {
        ...quiz,
        questions: quiz.questions?.map((question) => ({
          id: question.id,
          type: question.type,
          question: question.question,
          image: question.image,
          // Masquer les réponses et solutions pour les étudiants
          options:
            question.type === "qcm"
              ? question.options?.map((opt) => ({ text: opt.text }))
              : undefined,
          // Ne pas exposer correctAnswer, explanation, etc.
        })),
      };

      setQuiz(publicQuiz);
    } catch (error) {
      console.error("Erreur lors du chargement du quiz:", error);
      setError(error.message || "Quiz non trouvé ou inaccessible");
    } finally {
      setLoading(false);
    }
  };

  const handleShare = () => {
    const shareUrl = `${window.location.origin}/quiz/${id}/public`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      toast.success("Lien copié dans le presse-papiers");
    });
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

  const getQuestionTypeLabel = (type) => {
    switch (type) {
      case "qcm":
        return "QCM";
      case "vrai_faux":
        return "Vrai/Faux";
      case "reponse_libre":
        return "Réponse libre";
      case "nuage_mots":
        return "Nuage de mots";
      default:
        return "Question";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !quiz) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto">
          <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mb-4">
            <LockClosedIcon className="h-8 w-8 text-red-600 dark:text-red-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Quiz non accessible
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            {error}
          </p>
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <ArrowLeftIcon className="w-4 h-4 mr-2" />
            Retour
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-6">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate(-1)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <ArrowLeftIcon className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Aperçu du Quiz
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Vue publique • Informations générales
                </p>
              </div>
            </div>
            <button
              onClick={handleShare}
              className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <ShareIcon className="w-4 h-4 mr-2" />
              Partager
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Informations principales */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 mb-8">
          <div className="p-8">
            {/* Header du quiz */}
            <div className="flex items-start justify-between mb-6">
              <div className="flex-1">
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
                  {quiz.title}
                </h2>
                {quiz.description && (
                  <p className="text-lg text-gray-600 dark:text-gray-400 leading-relaxed">
                    {quiz.description}
                  </p>
                )}
              </div>
              <div className="ml-6 flex flex-col items-end space-y-2">
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getDifficultyColor(
                    quiz.difficulty
                  )}`}
                >
                  {quiz.difficulty}
                </span>
                {quiz.settings?.isPublic && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                    <EyeIcon className="w-3 h-3 mr-1" />
                    Public
                  </span>
                )}
              </div>
            </div>

            {/* Métadonnées */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
              <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <QuestionMarkCircleIcon className="h-8 w-8 text-blue-600 dark:text-blue-400 mx-auto mb-2" />
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {quiz.questionCount || quiz.questions?.length || 0}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Questions
                </p>
              </div>

              <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <TrophyIcon className="h-8 w-8 text-green-600 dark:text-green-400 mx-auto mb-2" />
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {quiz.totalPoints || 0}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Points max
                </p>
              </div>

              <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <ClockIcon className="h-8 w-8 text-yellow-600 dark:text-yellow-400 mx-auto mb-2" />
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  ~{quiz.estimatedDuration || 0}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Minutes
                </p>
              </div>

              <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <UsersIcon className="h-8 w-8 text-purple-600 dark:text-purple-400 mx-auto mb-2" />
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {quiz.stats?.totalSessions || 0}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Sessions
                </p>
              </div>
            </div>

            {/* Informations additionnelles */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                    Détails
                  </h3>
                  <div className="space-y-3">
                    {quiz.category && (
                      <div className="flex items-center">
                        <AcademicCapIcon className="h-4 w-4 text-gray-400 mr-3" />
                        <span className="text-sm text-gray-600 dark:text-gray-300">
                          Catégorie: {quiz.category}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center">
                      <CalendarIcon className="h-4 w-4 text-gray-400 mr-3" />
                      <span className="text-sm text-gray-600 dark:text-gray-300">
                        Créé le{" "}
                        {format(new Date(quiz.createdAt), "dd MMMM yyyy", {
                          locale: fr,
                        })}
                      </span>
                    </div>

                    {quiz.creator && (
                      <div className="flex items-center">
                        <UsersIcon className="h-4 w-4 text-gray-400 mr-3" />
                        <span className="text-sm text-gray-600 dark:text-gray-300">
                          Par {quiz.creator.firstName || quiz.creator.username}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {quiz.tags &&
                  Array.isArray(quiz.tags) &&
                  quiz.tags.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                        Tags
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {quiz.tags.map((tag, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
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
        </div>

        {/* Aperçu des types de questions */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 mb-8">
          <div className="p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-6 flex items-center">
              <ChartBarIcon className="h-5 w-5 mr-2" />
              Types de questions
            </h3>

            {quiz.questions && quiz.questions.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {Object.entries(
                  quiz.questions.reduce((acc, q) => {
                    acc[q.type] = (acc[q.type] || 0) + 1;
                    return acc;
                  }, {})
                ).map(([type, count]) => (
                  <div
                    key={type}
                    className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg text-center"
                  >
                    <div className="text-2xl mb-2">
                      {type === "qcm" && "☑️"}
                      {type === "vrai_faux" && "✓✗"}
                      {type === "reponse_libre" && "📝"}
                      {type === "nuage_mots" && "💭"}
                    </div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {getQuestionTypeLabel(type)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {count} question{count > 1 ? "s" : ""}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                Aucune information sur les questions disponible.
              </p>
            )}
          </div>
        </div>

        {/* Statistiques (si disponibles) */}
        {quiz.stats && quiz.stats.totalSessions > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 mb-8">
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-6 flex items-center">
                <ChartBarIcon className="h-5 w-5 mr-2" />
                Statistiques publiques
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <StarIcon className="h-8 w-8 text-blue-600 dark:text-blue-400 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {quiz.stats.averageScore?.toFixed(1) || "--"}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Score moyen
                  </p>
                </div>

                <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <TrophyIcon className="h-8 w-8 text-green-600 dark:text-green-400 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {quiz.stats.totalParticipants || 0}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Participants
                  </p>
                </div>

                <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                  <UsersIcon className="h-8 w-8 text-yellow-600 dark:text-yellow-400 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {Math.round(quiz.stats.completionRate || 0)}%
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Taux de complétion
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Message d'information pour les étudiants */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 p-6 text-center">
          <LockClosedIcon className="h-12 w-12 text-blue-600 dark:text-blue-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-blue-900 dark:text-blue-200 mb-2">
            Aperçu public
          </h3>
          <p className="text-blue-700 dark:text-blue-300 mb-4">
            Cette vue publique vous donne un aperçu du quiz sans révéler les
            questions ou les réponses. Pour participer au quiz complet, attendez
            qu'une session soit organisée par le formateur.
          </p>
          <div className="flex justify-center space-x-3">
            <button
              onClick={() => navigate("/join")}
              className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors"
            >
              Rejoindre une session
            </button>
            <button
              onClick={() => navigate("/dashboard")}
              className="inline-flex items-center px-4 py-2 border border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-sm font-medium rounded-md transition-colors"
            >
              Retour au tableau de bord
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuizPublicView;
