import { useState, useEffect, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";
import { quizService } from "../../services/api";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import toast from "react-hot-toast";
import {
  PlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon,
  DocumentDuplicateIcon,
  PlayIcon,
  ChartBarIcon,
  AdjustmentsHorizontalIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const QuizList = () => {
  const { user } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();

  // États
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedQuizzes, setSelectedQuizzes] = useState([]);

  // Filtres et pagination
  const [filters, setFilters] = useState({
    search: searchParams.get("search") || "",
    category: searchParams.get("category") || "",
    difficulty: searchParams.get("difficulty") || "",
    sort: searchParams.get("sort") || "recent",
  });

  const [pagination, setPagination] = useState({
    current: 1,
    pages: 1,
    total: 0,
    limit: 12,
  });

  // Charger les quiz
  const loadQuizzes = useCallback(
    async (page = 1) => {
      try {
        setLoading(true);
        const params = {
          ...filters,
          page,
          limit: pagination.limit,
        };

        // Nettoyer les paramètres vides
        Object.keys(params).forEach((key) => {
          if (!params[key]) delete params[key];
        });

        const response =
          user?.role === "etudiant"
            ? await quizService.getQuizzes({ ...params, public: true })
            : await quizService.getMyQuizzes(params);

        setQuizzes(response.quizzes || []);
        setPagination(response.pagination || pagination);

        // Mettre à jour l'URL
        const urlParams = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
          if (value) urlParams.set(key, value);
        });
        if (page > 1) urlParams.set("page", page);
        setSearchParams(urlParams);
      } catch (error) {
        console.error("Erreur lors du chargement des quiz:", error);
        toast.error("Erreur lors du chargement des quiz");
      } finally {
        setLoading(false);
      }
    },
    [filters, pagination.limit, user?.role, setSearchParams]
  );

  // Charger les catégories
  const loadCategories = useCallback(async () => {
    try {
      const response = await quizService.getCategories();
      setCategories(response.categories || []);
    } catch (error) {
      console.error("Erreur lors du chargement des catégories:", error);
    }
  }, []);

  // Effets
  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    const page = parseInt(searchParams.get("page")) || 1;
    loadQuizzes(page);
  }, [loadQuizzes, searchParams]);

  // Gestionnaires
  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPagination((prev) => ({ ...prev, current: 1 }));
  };

  const handleSearch = (e) => {
    e.preventDefault();
    loadQuizzes(1);
  };

  const handleDeleteQuiz = async (quizId) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer ce quiz ?")) {
      return;
    }

    try {
      await quizService.deleteQuiz(quizId);
      toast.success("Quiz supprimé avec succès");
      loadQuizzes(pagination.current);
    } catch (error) {
      console.error("Erreur lors de la suppression:", error);
      toast.error("Erreur lors de la suppression du quiz");
    }
  };

  const handleDuplicateQuiz = async (quizId) => {
    try {
      const response = await quizService.duplicateQuiz(quizId);
      toast.success("Quiz dupliqué avec succès");
      loadQuizzes(pagination.current);
    } catch (error) {
      console.error("Erreur lors de la duplication:", error);
      toast.error("Erreur lors de la duplication du quiz");
    }
  };

  const handleBulkAction = async (action) => {
    if (selectedQuizzes.length === 0) {
      toast.error("Veuillez sélectionner au moins un quiz");
      return;
    }

    if (action === "delete") {
      if (
        !window.confirm(
          `Êtes-vous sûr de vouloir supprimer ${selectedQuizzes.length} quiz ?`
        )
      ) {
        return;
      }

      try {
        await Promise.all(
          selectedQuizzes.map((id) => quizService.deleteQuiz(id))
        );
        toast.success(`${selectedQuizzes.length} quiz supprimés`);
        setSelectedQuizzes([]);
        loadQuizzes(pagination.current);
      } catch (error) {
        toast.error("Erreur lors de la suppression");
      }
    }
  };

  const getDifficultyBadge = (difficulty) => {
    const badges = {
      facile: "badge-success",
      moyen: "badge-warning",
      difficile: "badge-danger",
    };
    return badges[difficulty] || "badge-gray";
  };

  const formatDate = (dateString) => {
    return format(new Date(dateString), "dd MMM yyyy", { locale: fr });
  };

  // Composants
  const FiltersPanel = () => (
    <div
      className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-6 transition-all duration-200 ${
        showFilters ? "block" : "hidden lg:block"
      }`}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Recherche */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Recherche
          </label>
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <input
              type="text"
              className="input pl-9"
              placeholder="Titre, description..."
              value={filters.search}
              onChange={(e) => handleFilterChange("search", e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSearch(e)}
            />
          </div>
        </div>

        {/* Catégorie */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Catégorie
          </label>
          <select
            className="input"
            value={filters.category}
            onChange={(e) => handleFilterChange("category", e.target.value)}
          >
            <option value="">Toutes</option>
            {categories.map((cat) => (
              <option key={cat.name} value={cat.name}>
                {cat.name} ({cat.count})
              </option>
            ))}
          </select>
        </div>

        {/* Difficulté */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Difficulté
          </label>
          <select
            className="input"
            value={filters.difficulty}
            onChange={(e) => handleFilterChange("difficulty", e.target.value)}
          >
            <option value="">Toutes</option>
            <option value="facile">Facile</option>
            <option value="moyen">Moyen</option>
            <option value="difficile">Difficile</option>
          </select>
        </div>

        {/* Tri */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Trier par
          </label>
          <select
            className="input"
            value={filters.sort}
            onChange={(e) => handleFilterChange("sort", e.target.value)}
          >
            <option value="recent">Plus récents</option>
            <option value="alphabetical">A-Z</option>
            <option value="popular">Plus populaires</option>
          </select>
        </div>
      </div>

      <div className="flex justify-between items-center mt-4">
        <button
          onClick={() => {
            setFilters({
              search: "",
              category: "",
              difficulty: "",
              sort: "recent",
            });
            setPagination((prev) => ({ ...prev, current: 1 }));
          }}
          className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          Réinitialiser les filtres
        </button>
        <button onClick={handleSearch} className="btn-primary btn-sm">
          Appliquer
        </button>
      </div>
    </div>
  );

  const QuizCard = ({ quiz }) => (
    <div className="card hover:shadow-lg transition-shadow duration-300 overflow-hidden">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              checked={selectedQuizzes.includes(quiz.id)}
              onChange={(e) => {
                if (e.target.checked) {
                  setSelectedQuizzes((prev) => [...prev, quiz.id]);
                } else {
                  setSelectedQuizzes((prev) =>
                    prev.filter((id) => id !== quiz.id)
                  );
                }
              }}
            />
          </div>
          <span className={`badge ${getDifficultyBadge(quiz.difficulty)}`}>
            {quiz.difficulty}
          </span>
        </div>

        {/* Titre */}
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 line-clamp-2">
          {quiz.title}
        </h3>

        {/* Description */}
        {quiz.description && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
            {quiz.description}
          </p>
        )}

        {/* Métadonnées */}
        <div className="flex flex-wrap gap-2 mb-4 text-xs text-gray-500 dark:text-gray-400">
          <span className="flex items-center">
            <span className="w-2 h-2 bg-primary-400 rounded-full mr-1"></span>
            {quiz.questionCount} questions
          </span>
          <span className="flex items-center">
            <span className="w-2 h-2 bg-secondary-400 rounded-full mr-1"></span>
            {quiz.totalPoints} points
          </span>
          <span className="flex items-center">
            <span className="w-2 h-2 bg-success-400 rounded-full mr-1"></span>~
            {quiz.estimatedDuration}min
          </span>
          {quiz.stats?.totalSessions > 0 && (
            <span className="flex items-center">
              <span className="w-2 h-2 bg-warning-400 rounded-full mr-1"></span>
              {quiz.stats.totalSessions} sessions
            </span>
          )}
        </div>

        {/* Tags */}
        {quiz.tags && Array.isArray(quiz.tags) && quiz.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {quiz.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded"
              >
                #{tag}
              </span>
            ))}
            {quiz.tags.length > 3 && (
              <span className="px-2 py-1 text-xs text-gray-400">
                +{quiz.tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {quiz.category && (
              <span className="font-medium">{quiz.category}</span>
            )}
            <span className="mx-1">•</span>
            <span>{formatDate(quiz.createdAt)}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="bg-gray-50 dark:bg-gray-700 px-6 py-3 flex justify-between items-center">
        <div className="flex space-x-2">
          <Link
            to={`/quiz/${quiz.id}`}
            className="p-2 text-gray-400 hover:text-primary-600 transition-colors"
            title="Voir"
          >
            <EyeIcon className="h-4 w-4" />
          </Link>

          {(user?.role === "formateur" || user?.role === "admin") && (
            <>
              <Link
                to={`/quiz/${quiz.id}/edit`}
                className="p-2 text-gray-400 hover:text-secondary-600 transition-colors"
                title="Modifier"
              >
                <PencilIcon className="h-4 w-4" />
              </Link>

              <button
                onClick={() => handleDuplicateQuiz(quiz.id)}
                className="p-2 text-gray-400 hover:text-success-600 transition-colors"
                title="Dupliquer"
              >
                <DocumentDuplicateIcon className="h-4 w-4" />
              </button>

              <button
                onClick={() => handleDeleteQuiz(quiz.id)}
                className="p-2 text-gray-400 hover:text-danger-600 transition-colors"
                title="Supprimer"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </>
          )}
        </div>

        {(user?.role === "formateur" || user?.role === "admin") && (
          <Link
            to={`/session/create?quiz=${quiz.id}`}
            className="btn-primary btn-sm flex items-center"
          >
            <PlayIcon className="h-4 w-4 mr-1" />
            Lancer
          </Link>
        )}
      </div>
    </div>
  );

  const Pagination = () => (
    <div className="flex items-center justify-between mt-8">
      <div className="flex-1 flex justify-between sm:hidden">
        <button
          onClick={() => loadQuizzes(pagination.current - 1)}
          disabled={pagination.current <= 1}
          className="btn-outline disabled:opacity-50"
        >
          Précédent
        </button>
        <button
          onClick={() => loadQuizzes(pagination.current + 1)}
          disabled={pagination.current >= pagination.pages}
          className="btn-outline disabled:opacity-50"
        >
          Suivant
        </button>
      </div>

      <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Affichage de{" "}
            <span className="font-medium">
              {(pagination.current - 1) * pagination.limit + 1}
            </span>{" "}
            à{" "}
            <span className="font-medium">
              {Math.min(
                pagination.current * pagination.limit,
                pagination.total
              )}
            </span>{" "}
            sur <span className="font-medium">{pagination.total}</span>{" "}
            résultats
          </p>
        </div>
        <div>
          <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
            <button
              onClick={() => loadQuizzes(pagination.current - 1)}
              disabled={pagination.current <= 1}
              className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              Précédent
            </button>

            {/* Pages */}
            {[...Array(Math.min(pagination.pages, 5))].map((_, i) => {
              const pageNum =
                pagination.current <= 3 ? i + 1 : pagination.current + i - 2;

              if (pageNum > pagination.pages) return null;

              return (
                <button
                  key={pageNum}
                  onClick={() => loadQuizzes(pageNum)}
                  className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                    pagination.current === pageNum
                      ? "z-10 bg-primary-50 dark:bg-primary-900 border-primary-500 text-primary-600 dark:text-primary-200"
                      : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}

            <button
              onClick={() => loadQuizzes(pagination.current + 1)}
              disabled={pagination.current >= pagination.pages}
              className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              Suivant
            </button>
          </nav>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {user?.role === "etudiant" ? "Quiz Publics" : "Mes Quiz"}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {user?.role === "etudiant"
              ? "Découvrez les quiz publics disponibles"
              : "Gérez et organisez vos quiz interactifs"}
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {/* Actions en lot */}
          {selectedQuizzes.length > 0 &&
            (user?.role === "formateur" || user?.role === "admin") && (
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {selectedQuizzes.length} sélectionnés
                </span>
                <button
                  onClick={() => handleBulkAction("delete")}
                  className="btn-danger btn-sm"
                >
                  <TrashIcon className="h-4 w-4 mr-1" />
                  Supprimer
                </button>
              </div>
            )}

          {/* Bouton filtres mobile */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="lg:hidden btn-outline btn-sm"
          >
            <FunnelIcon className="h-4 w-4 mr-1" />
            Filtres
          </button>

          {/* Bouton créer */}
          {(user?.role === "formateur" || user?.role === "admin") && (
            <Link to="/quiz/create" className="btn-primary">
              <PlusIcon className="h-4 w-4 mr-2" />
              Nouveau Quiz
            </Link>
          )}
        </div>
      </div>

      {/* Filtres */}
      <FiltersPanel />

      {/* Contenu */}
      {loading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" text="Chargement des quiz..." />
        </div>
      ) : quizzes.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <MagnifyingGlassIcon className="h-12 w-12 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {Object.values(filters).some((f) => f)
              ? "Aucun quiz trouvé"
              : "Aucun quiz disponible"}
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            {Object.values(filters).some((f) => f)
              ? "Essayez de modifier vos critères de recherche"
              : user?.role === "etudiant"
              ? "Aucun quiz public n'est disponible pour le moment"
              : "Commencez par créer votre premier quiz"}
          </p>
          {!Object.values(filters).some((f) => f) &&
            (user?.role === "formateur" || user?.role === "admin") && (
              <Link to="/quiz/create" className="btn-primary">
                <PlusIcon className="h-4 w-4 mr-2" />
                Créer mon premier quiz
              </Link>
            )}
        </div>
      ) : (
        <>
          {/* Grille des quiz */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {quizzes.map((quiz) => (
              <QuizCard key={quiz.id} quiz={quiz} />
            ))}
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && <Pagination />}
        </>
      )}
    </div>
  );
};

export default QuizList;
