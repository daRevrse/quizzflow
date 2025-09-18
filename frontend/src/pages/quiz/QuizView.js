import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";
import { quizService, sessionService } from "../../services/api";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import toast from "react-hot-toast";
import {
  PencilIcon,
  TrashIcon,
  PlayIcon,
  EyeIcon,
  ShareIcon,
  DocumentDuplicateIcon,
  ChartBarIcon,
  ClockIcon,
  StarIcon,
  TagIcon,
  UserGroupIcon,
  QuestionMarkCircleIcon,
  CheckCircleIcon,
  XCircleIcon,
  InformationCircleIcon,
  PhotoIcon,
  ArrowLeftIcon,
  Cog6ToothIcon,
} from "@heroicons/react/24/outline";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const QuizView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // États
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [sessions, setSessions] = useState([]);

  // Charger le quiz
  const loadQuiz = useCallback(async () => {
    try {
      setLoading(true);
      const response = await quizService.getQuiz(id);
      setQuiz(response.quiz);
    } catch (error) {
      console.error("Erreur lors du chargement du quiz:", error);
      if (error.response?.status === 404) {
        toast.error("Quiz non trouvé");
        navigate("/quiz");
      } else {
        toast.error("Erreur lors du chargement du quiz");
      }
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  // Charger les sessions du quiz
  const loadSessions = useCallback(async () => {
    try {
      const response = await sessionService.getSessions({ quizId: id });
      setSessions(response.sessions || []);
    } catch (error) {
      console.error("Erreur lors du chargement des sessions:", error);
    }
  }, [id]);

  useEffect(() => {
    loadQuiz();
    loadSessions();
  }, [loadQuiz, loadSessions]);

  // Actions
  const handleStartSession = async () => {
    try {
      setActionLoading(true);
      const response = await sessionService.createSession({
        quizId: id,
        title: `Session ${quiz.title}`,
        settings: {
          showTimer: true,
          showLeaderboard: true,
          allowLateJoin: true,
        },
      });
      toast.success("Session créée avec succès");
      navigate(`/session/${response.session.id}/host`);
    } catch (error) {
      console.error("Erreur lors de la création de la session:", error);
      toast.error("Erreur lors de la création de la session");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDuplicate = async () => {
    try {
      setActionLoading(true);
      const response = await quizService.duplicateQuiz(id);
      toast.success("Quiz dupliqué avec succès");
      navigate(`/quiz/${response.quiz.id}`);
    } catch (error) {
      console.error("Erreur lors de la duplication:", error);
      toast.error("Erreur lors de la duplication du quiz");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      setActionLoading(true);
      await quizService.deleteQuiz(id);
      toast.success("Quiz supprimé avec succès");
      navigate("/quiz");
    } catch (error) {
      console.error("Erreur lors de la suppression:", error);
      toast.error("Erreur lors de la suppression du quiz");
    } finally {
      setActionLoading(false);
      setShowDeleteModal(false);
    }
  };

  const handleShare = () => {
    const shareUrl = `${window.location.origin}/quiz/${id}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      toast.success("Lien copié dans le presse-papiers");
    });
  };

  // Vérifications des permissions
  const isOwner =
    user &&
    quiz &&
    (user.id === quiz.creatorId || user.id === quiz.creator?.id);
  const canEdit = isOwner || user?.role === "admin";
  const canDelete = canEdit;
  const canCreateSession = canEdit || user?.role === "formateur";

  // Utilitaires
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

  const getQuestionTypeIcon = (type) => {
    switch (type) {
      case "qcm":
        return "☑️";
      case "vrai_faux":
        return "✓✗";
      case "reponse_libre":
        return "📝";
      case "nuage_mots":
        return "💭";
      default:
        return "❓";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="text-center py-12">
        <QuestionMarkCircleIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          Quiz non trouvé
        </h3>
        <p className="text-gray-500 dark:text-gray-400 mb-4">
          Le quiz que vous cherchez n'existe pas ou a été supprimé.
        </p>
        <Link
          to="/quiz"
          className="inline-flex items-center px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md transition-colors"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-2" />
          Retour à la liste
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
        <div className="px-6 py-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-4">
                <Link
                  to="/quiz"
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <ArrowLeftIcon className="h-5 w-5" />
                </Link>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getDifficultyColor(
                    quiz.difficulty
                  )}`}
                >
                  {quiz.difficulty}
                </span>
                {quiz.category && (
                  <span className="inline-flex items-center text-sm text-gray-500 dark:text-gray-400">
                    <TagIcon className="h-4 w-4 mr-1" />
                    {quiz.category}
                  </span>
                )}
              </div>

              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
                {quiz.title}
              </h1>

              {quiz.description && (
                <p className="text-lg text-gray-600 dark:text-gray-400 mb-4">
                  {quiz.description}
                </p>
              )}

              {/* Métadonnées */}
              <div className="flex flex-wrap gap-4 text-sm text-gray-500 dark:text-gray-400">
                <span className="flex items-center">
                  <QuestionMarkCircleIcon className="h-4 w-4 mr-1" />
                  {quiz.questions?.length || 0} questions
                </span>
                <span className="flex items-center">
                  <StarIcon className="h-4 w-4 mr-1" />
                  {quiz.questions?.reduce(
                    (sum, q) => sum + (q.points || 1),
                    0
                  ) || 0}{" "}
                  points
                </span>
                <span className="flex items-center">
                  <ClockIcon className="h-4 w-4 mr-1" />~
                  {Math.ceil((quiz.estimatedDuration || 0) / 60)} min
                </span>
                {quiz.stats?.totalSessions > 0 && (
                  <span className="flex items-center">
                    <ChartBarIcon className="h-4 w-4 mr-1" />
                    {quiz.stats.totalSessions} sessions
                  </span>
                )}
                <span className="flex items-center">
                  Créé le{" "}
                  {format(new Date(quiz.createdAt), "dd MMMM yyyy", {
                    locale: fr,
                  })}
                </span>
              </div>

              {/* Tags */}
              {quiz.tags && quiz.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {quiz.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-3">
              {canCreateSession && (
                <button
                  onClick={handleStartSession}
                  disabled={actionLoading}
                  className="inline-flex items-center px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-sm font-medium rounded-md transition-colors"
                >
                  <PlayIcon className="h-4 w-4 mr-2" />
                  Lancer une session
                </button>
              )}

              <button
                onClick={handleShare}
                className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-md transition-colors"
              >
                <ShareIcon className="h-4 w-4 mr-2" />
                Partager
              </button>

              {canEdit && (
                <>
                  <Link
                    to={`/quiz/${id}/edit`}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-md transition-colors"
                  >
                    <PencilIcon className="h-4 w-4 mr-2" />
                    Modifier
                  </Link>

                  <button
                    onClick={handleDuplicate}
                    disabled={actionLoading}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-md transition-colors"
                  >
                    <DocumentDuplicateIcon className="h-4 w-4 mr-2" />
                    Dupliquer
                  </button>
                </>
              )}

              {canDelete && (
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="inline-flex items-center px-3 py-2 border border-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-700 dark:text-red-400 text-sm font-medium rounded-md transition-colors"
                >
                  <TrashIcon className="h-4 w-4 mr-2" />
                  Supprimer
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Onglets */}
        <div className="border-t border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex">
            {[
              { id: "overview", name: "Vue d'ensemble", icon: EyeIcon },
              {
                id: "questions",
                name: "Questions",
                icon: QuestionMarkCircleIcon,
              },
              { id: "sessions", name: "Sessions", icon: UserGroupIcon },
              { id: "analytics", name: "Statistiques", icon: ChartBarIcon },
              ...(canEdit
                ? [{ id: "settings", name: "Paramètres", icon: Cog6ToothIcon }]
                : []),
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
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
        {activeTab === "overview" && (
          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Informations générales */}
              <div className="lg:col-span-2">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  Informations générales
                </h3>
                <div className="space-y-4">
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Créateur
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                      {quiz.creator?.firstName && quiz.creator?.lastName
                        ? `${quiz.creator.firstName} ${quiz.creator.lastName}`
                        : quiz.creator?.username || "Utilisateur inconnu"}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Visibilité
                    </dt>
                    <dd className="mt-1">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          quiz.settings?.isPublic
                            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                            : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
                        }`}
                      >
                        {quiz.settings?.isPublic ? "Public" : "Privé"}
                      </span>
                    </dd>
                  </div>

                  {quiz.settings?.passingScore && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Score de passage
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                        {quiz.settings.passingScore}%
                      </dd>
                    </div>
                  )}

                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Dernière modification
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                      {format(
                        new Date(quiz.updatedAt),
                        "dd MMMM yyyy à HH:mm",
                        { locale: fr }
                      )}
                    </dd>
                  </div>
                </div>
              </div>

              {/* Statistiques */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  Statistiques
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      Sessions
                    </span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {quiz.stats?.totalSessions || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      Participants
                    </span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {quiz.stats?.totalParticipants || 0}
                    </span>
                  </div>
                  {quiz.stats?.averageScore !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        Score moyen
                      </span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {quiz.stats.averageScore}%
                      </span>
                    </div>
                  )}
                  {quiz.stats?.lastUsed && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        Dernière utilisation
                      </span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {format(new Date(quiz.stats.lastUsed), "dd/MM/yyyy", {
                          locale: fr,
                        })}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "questions" && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Questions ({quiz.questions?.length || 0})
              </h3>
            </div>

            {!quiz.questions || quiz.questions.length === 0 ? (
              <div className="text-center py-8">
                <QuestionMarkCircleIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">
                  Ce quiz ne contient aucune question.
                </p>
                {canEdit && (
                  <Link
                    to={`/quiz/${id}/edit`}
                    className="mt-2 inline-flex items-center text-sm font-medium text-primary-600 hover:text-primary-500"
                  >
                    Ajouter des questions
                  </Link>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {quiz.questions.map((question, index) => (
                  <div
                    key={index}
                    className="border border-gray-200 dark:border-gray-600 rounded-lg p-4"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-start space-x-3">
                        <span className="flex-shrink-0 flex items-center justify-center w-8 h-8 bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-400 rounded-full text-sm font-medium">
                          {index + 1}
                        </span>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                              {getQuestionTypeIcon(question.type)}{" "}
                              {question.type.replace("_", " ")}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {question.points || 1} pt
                              {(question.points || 1) > 1 ? "s" : ""}
                            </span>
                            {question.timeLimit && (
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {question.timeLimit}s
                              </span>
                            )}
                          </div>
                          <p className="text-gray-900 dark:text-white font-medium mb-3">
                            {question.question}
                          </p>

                          {question.media && (
                            <div className="mb-3">
                              <img
                                src={question.media.url}
                                alt="Media de la question"
                                className="max-w-xs h-auto rounded-lg"
                              />
                            </div>
                          )}

                          {/* Options pour QCM */}
                          {question.type === "qcm" && question.options && (
                            <div className="space-y-2">
                              {question.options.map((option, optIndex) => (
                                <div
                                  key={optIndex}
                                  className={`flex items-center space-x-2 p-2 rounded ${
                                    option.isCorrect
                                      ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
                                      : "bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
                                  }`}
                                >
                                  {option.isCorrect ? (
                                    <CheckCircleIcon className="h-4 w-4 text-green-600 dark:text-green-400" />
                                  ) : (
                                    <XCircleIcon className="h-4 w-4 text-gray-400" />
                                  )}
                                  <span
                                    className={`text-sm ${
                                      option.isCorrect
                                        ? "text-green-800 dark:text-green-200 font-medium"
                                        : "text-gray-700 dark:text-gray-300"
                                    }`}
                                  >
                                    {option.text}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Réponse correcte pour Vrai/Faux */}
                          {question.type === "vrai_faux" && (
                            <div className="flex items-center space-x-2">
                              <span className="text-sm text-gray-500 dark:text-gray-400">
                                Réponse correcte :
                              </span>
                              <span
                                className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                  question.correctAnswer === "true"
                                    ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                    : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                                }`}
                              >
                                {question.correctAnswer === "true"
                                  ? "Vrai"
                                  : "Faux"}
                              </span>
                            </div>
                          )}

                          {/* Explication */}
                          {question.explanation && (
                            <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                              <div className="flex items-start space-x-2">
                                <InformationCircleIcon className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5" />
                                <div>
                                  <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
                                    Explication
                                  </p>
                                  <p className="text-sm text-blue-700 dark:text-blue-300">
                                    {question.explanation}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "sessions" && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Sessions ({sessions.length})
              </h3>
              {canCreateSession && (
                <button
                  onClick={handleStartSession}
                  disabled={actionLoading}
                  className="inline-flex items-center px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-sm font-medium rounded-md transition-colors"
                >
                  <PlayIcon className="h-4 w-4 mr-2" />
                  Nouvelle session
                </button>
              )}
            </div>

            {sessions.length === 0 ? (
              <div className="text-center py-8">
                <UserGroupIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  Aucune session n'a encore été créée pour ce quiz.
                </p>
                {canCreateSession && (
                  <button
                    onClick={handleStartSession}
                    disabled={actionLoading}
                    className="inline-flex items-center px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-sm font-medium rounded-md transition-colors"
                  >
                    <PlayIcon className="h-4 w-4 mr-2" />
                    Créer la première session
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <h4 className="text-lg font-medium text-gray-900 dark:text-white">
                            {session.title}
                          </h4>
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              session.status === "active"
                                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                : session.status === "completed"
                                ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                                : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
                            }`}
                          >
                            {session.status === "active"
                              ? "En cours"
                              : session.status === "completed"
                              ? "Terminée"
                              : session.status === "paused"
                              ? "En pause"
                              : "En attente"}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                          <span>Code: {session.code}</span>
                          <span>
                            {session.stats?.participantCount || 0} participant
                            {(session.stats?.participantCount || 0) !== 1
                              ? "s"
                              : ""}
                          </span>
                          <span>
                            Créée le{" "}
                            {format(
                              new Date(session.createdAt),
                              "dd/MM/yyyy à HH:mm",
                              { locale: fr }
                            )}
                          </span>
                          {session.endedAt && (
                            <span>
                              Terminée le{" "}
                              {format(
                                new Date(session.endedAt),
                                "dd/MM/yyyy à HH:mm",
                                { locale: fr }
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Link
                          to={`/session/${session.id}`}
                          className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-md transition-colors"
                        >
                          <EyeIcon className="h-4 w-4 mr-1" />
                          Voir
                        </Link>
                        {(session.status === "active" ||
                          session.status === "paused") &&
                          canCreateSession && (
                            <Link
                              to={`/session/${session.id}/host`}
                              className="inline-flex items-center px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-md transition-colors"
                            >
                              <PlayIcon className="h-4 w-4 mr-1" />
                              Gérer
                            </Link>
                          )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "analytics" && (
          <div className="p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-6">
              Statistiques détaillées
            </h3>

            {!quiz.stats || quiz.stats.totalSessions === 0 ? (
              <div className="text-center py-8">
                <ChartBarIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">
                  Aucune donnée disponible. Lancez une session pour voir les
                  statistiques.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Cartes de statistiques */}
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-6 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-blue-100 text-sm font-medium">
                        Sessions totales
                      </p>
                      <p className="text-3xl font-bold">
                        {quiz.stats.totalSessions}
                      </p>
                    </div>
                    <UserGroupIcon className="h-8 w-8 text-blue-200" />
                  </div>
                </div>

                <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg p-6 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-green-100 text-sm font-medium">
                        Participants totaux
                      </p>
                      <p className="text-3xl font-bold">
                        {quiz.stats.totalParticipants}
                      </p>
                    </div>
                    <UserGroupIcon className="h-8 w-8 text-green-200" />
                  </div>
                </div>

                {quiz.stats.averageScore !== undefined && (
                  <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 rounded-lg p-6 text-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-yellow-100 text-sm font-medium">
                          Score moyen
                        </p>
                        <p className="text-3xl font-bold">
                          {quiz.stats.averageScore}%
                        </p>
                      </div>
                      <StarIcon className="h-8 w-8 text-yellow-200" />
                    </div>
                  </div>
                )}

                <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg p-6 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-purple-100 text-sm font-medium">
                        Taux de réussite
                      </p>
                      <p className="text-3xl font-bold">
                        {quiz.settings?.passingScore && quiz.stats.averageScore
                          ? Math.round(
                              (quiz.stats.averageScore >=
                              quiz.settings.passingScore
                                ? 1
                                : 0) * 100
                            )
                          : "--"}
                        %
                      </p>
                    </div>
                    <CheckCircleIcon className="h-8 w-8 text-purple-200" />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "settings" && canEdit && (
          <div className="p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-6">
              Paramètres du quiz
            </h3>

            <div className="space-y-6">
              {/* Visibilité */}
              <div>
                <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                  Visibilité et accès
                </h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        Quiz public
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Visible par tous les utilisateurs
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        quiz.settings?.isPublic
                          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                          : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
                      }`}
                    >
                      {quiz.settings?.isPublic ? "Activé" : "Désactivé"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        Participation anonyme
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Autoriser la participation sans compte
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        quiz.settings?.allowAnonymous
                          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                          : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
                      }`}
                    >
                      {quiz.settings?.allowAnonymous ? "Activé" : "Désactivé"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Résultats */}
              <div>
                <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                  Affichage des résultats
                </h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        Afficher les résultats
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Montrer les scores aux participants
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        quiz.settings?.showResults
                          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                          : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
                      }`}
                    >
                      {quiz.settings?.showResults ? "Activé" : "Désactivé"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        Afficher les bonnes réponses
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Révéler les réponses correctes
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        quiz.settings?.showCorrectAnswers
                          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                          : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
                      }`}
                    >
                      {quiz.settings?.showCorrectAnswers
                        ? "Activé"
                        : "Désactivé"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Configuration */}
              <div>
                <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                  Configuration avancée
                </h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        Questions aléatoires
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Mélanger l'ordre des questions
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        quiz.settings?.randomizeQuestions
                          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                          : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
                      }`}
                    >
                      {quiz.settings?.randomizeQuestions
                        ? "Activé"
                        : "Désactivé"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        Options aléatoires
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Mélanger l'ordre des réponses
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        quiz.settings?.randomizeOptions
                          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                          : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
                      }`}
                    >
                      {quiz.settings?.randomizeOptions ? "Activé" : "Désactivé"}
                    </span>
                  </div>

                  {quiz.settings?.maxAttempts && (
                    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          Tentatives maximales
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Nombre de fois qu'un participant peut refaire le quiz
                        </p>
                      </div>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                        {quiz.settings.maxAttempts} tentative
                        {quiz.settings.maxAttempts > 1 ? "s" : ""}
                      </span>
                    </div>
                  )}

                  {quiz.settings?.passingScore && (
                    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          Score de passage
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Score minimum pour réussir le quiz
                        </p>
                      </div>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                        {quiz.settings.passingScore}%
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <Link
                  to={`/quiz/${id}/edit`}
                  className="inline-flex items-center px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-md transition-colors"
                >
                  <Cog6ToothIcon className="h-4 w-4 mr-2" />
                  Modifier les paramètres
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal de confirmation de suppression */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen">
              &#8203;
            </span>

            <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white dark:bg-gray-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900 sm:mx-0 sm:h-10 sm:w-10">
                    <TrashIcon className="h-6 w-6 text-red-600 dark:text-red-400" />
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
                      Supprimer le quiz
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Êtes-vous sûr de vouloir supprimer ce quiz ? Cette
                        action est irréversible et supprimera également toutes
                        les sessions associées.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={actionLoading}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                >
                  {actionLoading ? "Suppression..." : "Supprimer"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-600 shadow-sm px-4 py-2 bg-white dark:bg-gray-800 text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuizView;
