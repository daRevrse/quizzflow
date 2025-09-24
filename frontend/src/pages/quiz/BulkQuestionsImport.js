// src/components/quiz/BulkQuestionsImport.js
import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import {
  parseBulkQuestions,
  validateQuestion,
  generateCSVTemplate,
  BULK_IMPORT_FORMATS,
} from "../../utils/quizUtils";
import toast from "react-hot-toast";
import {
  DocumentArrowUpIcon,
  DocumentTextIcon,
  XMarkIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowDownTrayIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/outline";

const BulkQuestionsImport = ({ onImport, onClose }) => {
  const [importMode, setImportMode] = useState("file"); // 'file', 'text', 'paste'
  const [textContent, setTextContent] = useState("");
  const [format, setFormat] = useState(BULK_IMPORT_FORMATS.CSV);
  const [parsedQuestions, setParsedQuestions] = useState([]);
  const [validationErrors, setValidationErrors] = useState([]);
  const [loading, setLoading] = useState(false);

  // Gestion du drag & drop
  const onDrop = useCallback(async (acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setLoading(true);
    try {
      const content = await file.text();
      const fileFormat = file.name.endsWith(".json")
        ? BULK_IMPORT_FORMATS.JSON
        : BULK_IMPORT_FORMATS.CSV;

      setFormat(fileFormat);
      setTextContent(content);
      await parseContent(content, fileFormat);
    } catch (error) {
      toast.error(`Erreur lors de la lecture du fichier: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv"],
      "application/json": [".json"],
      "text/plain": [".txt"],
    },
    maxFiles: 1,
  });

  const parseContent = async (content, selectedFormat) => {
    if (!content.trim()) {
      setParsedQuestions([]);
      setValidationErrors([]);
      return;
    }

    try {
      setLoading(true);
      const questions = parseBulkQuestions(content, selectedFormat);

      // Validation des questions
      const allErrors = [];
      questions.forEach((question, index) => {
        const errors = validateQuestion(question, index);
        allErrors.push(...errors);
      });

      setParsedQuestions(questions);
      setValidationErrors(allErrors);

      if (allErrors.length === 0) {
        toast.success(`${questions.length} questions parsées avec succès`);
      } else {
        toast.warn(
          `${questions.length} questions parsées avec ${allErrors.length} erreurs`
        );
      }
    } catch (error) {
      toast.error(`Erreur de parsing: ${error.message}`);
      setParsedQuestions([]);
      setValidationErrors([error.message]);
    } finally {
      setLoading(false);
    }
  };

  const handleTextChange = (e) => {
    const content = e.target.value;
    setTextContent(content);

    // Debounce du parsing
    clearTimeout(window.parseTimeout);
    window.parseTimeout = setTimeout(() => {
      parseContent(content, format);
    }, 500);
  };

  const handleFormatChange = (newFormat) => {
    setFormat(newFormat);
    if (textContent) {
      parseContent(textContent, newFormat);
    }
  };

  const handleImport = () => {
    if (validationErrors.length > 0) {
      toast.error("Veuillez corriger les erreurs avant d'importer");
      return;
    }

    if (parsedQuestions.length === 0) {
      toast.error("Aucune question à importer");
      return;
    }

    onImport(parsedQuestions);
    onClose();
  };

  const downloadTemplate = () => {
    const template = generateCSVTemplate();
    const blob = new Blob([template], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "questions_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const getQuestionTypeIcon = (type) => {
    const icons = {
      qcm: "☑️",
      vrai_faux: "✓✗",
      reponse_libre: "📝",
      nuage_mots: "💭",
    };
    return icons[type] || "❓";
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-full overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Import en masse de questions
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          {/* Mode d'import */}
          <div className="mb-6">
            <div className="flex space-x-4 mb-4">
              <button
                onClick={() => setImportMode("file")}
                className={`px-4 py-2 rounded-md font-medium transition-colors ${
                  importMode === "file"
                    ? "bg-primary-600 text-white"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                }`}
              >
                <DocumentArrowUpIcon className="h-4 w-4 inline mr-2" />
                Fichier
              </button>
              <button
                onClick={() => setImportMode("paste")}
                className={`px-4 py-2 rounded-md font-medium transition-colors ${
                  importMode === "paste"
                    ? "bg-primary-600 text-white"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                }`}
              >
                <DocumentTextIcon className="h-4 w-4 inline mr-2" />
                Coller
              </button>
            </div>

            {/* Sélection du format */}
            <div className="flex items-center space-x-4 mb-4">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Format:
              </label>
              <select
                value={format}
                onChange={(e) => handleFormatChange(e.target.value)}
                className="input w-auto"
              >
                <option value={BULK_IMPORT_FORMATS.CSV}>CSV</option>
                <option value={BULK_IMPORT_FORMATS.JSON}>JSON</option>
                <option value={BULK_IMPORT_FORMATS.TEXT}>Texte simple</option>
              </select>

              <button onClick={downloadTemplate} className="btn-outline btn-sm">
                <ArrowDownTrayIcon className="h-4 w-4 mr-1" />
                Télécharger template
              </button>
            </div>
          </div>

          {/* Zone d'import */}
          <div className="mb-6">
            {importMode === "file" ? (
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isDragActive
                    ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20"
                    : "border-gray-300 dark:border-gray-600 hover:border-primary-400"
                }`}
              >
                <input {...getInputProps()} />
                <DocumentArrowUpIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  {isDragActive
                    ? "Déposez le fichier ici"
                    : "Glissez-déposez votre fichier"}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Formats supportés: CSV, JSON, TXT (max 10MB)
                </p>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Contenu à importer:
                </label>
                <textarea
                  value={textContent}
                  onChange={handleTextChange}
                  placeholder={getPlaceholderForFormat(format)}
                  className="input h-48 font-mono text-sm"
                />
              </div>
            )}
          </div>

          {/* Aide et informations */}
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-start space-x-2">
              <InformationCircleIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-blue-800 dark:text-blue-200 mb-1">
                  Format {format.toUpperCase()}:
                </p>
                <div className="text-blue-700 dark:text-blue-300">
                  {getFormatHelp(format)}
                </div>
              </div>
            </div>
          </div>

          {/* Résultats du parsing */}
          {(parsedQuestions.length > 0 || validationErrors.length > 0) && (
            <div className="mb-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Résultats du parsing
              </h3>

              {/* Statistiques */}
              <div className="flex items-center space-x-4 mb-4">
                <div className="flex items-center space-x-2 text-sm">
                  <CheckCircleIcon className="h-4 w-4 text-green-600" />
                  <span className="text-gray-700 dark:text-gray-300">
                    {parsedQuestions.length} questions détectées
                  </span>
                </div>
                {validationErrors.length > 0 && (
                  <div className="flex items-center space-x-2 text-sm">
                    <ExclamationTriangleIcon className="h-4 w-4 text-red-600" />
                    <span className="text-red-700 dark:text-red-400">
                      {validationErrors.length} erreurs
                    </span>
                  </div>
                )}
              </div>

              {/* Erreurs de validation */}
              {validationErrors.length > 0 && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                  <h4 className="font-medium text-red-800 dark:text-red-200 mb-2">
                    Erreurs de validation:
                  </h4>
                  <ul className="text-sm text-red-700 dark:text-red-300 space-y-1">
                    {validationErrors.slice(0, 10).map((error, index) => (
                      <li key={index}>• {error}</li>
                    ))}
                    {validationErrors.length > 10 && (
                      <li className="text-red-600 dark:text-red-400">
                        ... et {validationErrors.length - 10} autres erreurs
                      </li>
                    )}
                  </ul>
                </div>
              )}

              {/* Aperçu des questions */}
              {parsedQuestions.length > 0 && (
                <div className="max-h-96 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg">
                  <div className="p-4 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      Aperçu des questions ({parsedQuestions.length})
                    </h4>
                  </div>
                  <div className="divide-y divide-gray-200 dark:divide-gray-600">
                    {parsedQuestions.slice(0, 5).map((question, index) => (
                      <div key={index} className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <span className="text-sm font-medium text-gray-500">
                                #{index + 1}
                              </span>
                              <span className="text-sm font-medium">
                                {getQuestionTypeIcon(question.type)}{" "}
                                {question.type}
                              </span>
                              <span className="text-xs text-gray-500">
                                {question.points}pt • {question.timeLimit}s
                              </span>
                            </div>
                            <p className="text-gray-900 dark:text-white font-medium mb-2">
                              {question.question}
                            </p>
                            {question.options &&
                              question.options.length > 0 && (
                                <div className="text-sm text-gray-600 dark:text-gray-400">
                                  {question.options.map((opt, i) => (
                                    <div
                                      key={i}
                                      className={`flex items-center space-x-1 ${
                                        opt.isCorrect
                                          ? "font-medium text-green-600 dark:text-green-400"
                                          : ""
                                      }`}
                                    >
                                      <span>{opt.isCorrect ? "✓" : "○"}</span>
                                      <span>{opt.text}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            {question.correctAnswer &&
                              question.type !== "qcm" && (
                                <div className="text-sm text-green-600 dark:text-green-400">
                                  ✓ {question.correctAnswer}
                                </div>
                              )}
                          </div>
                        </div>
                      </div>
                    ))}
                    {parsedQuestions.length > 5 && (
                      <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                        ... et {parsedQuestions.length - 5} questions
                        supplémentaires
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between">
            <button onClick={onClose} className="btn-outline">
              Annuler
            </button>

            <div className="flex items-center space-x-3">
              {loading && (
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
                  <span>Parsing en cours...</span>
                </div>
              )}

              <button
                onClick={handleImport}
                disabled={
                  loading ||
                  parsedQuestions.length === 0 ||
                  validationErrors.length > 0
                }
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCircleIcon className="h-4 w-4 mr-2" />
                Importer {parsedQuestions.length} questions
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Fonctions utilitaires
const getPlaceholderForFormat = (format) => {
  switch (format) {
    case BULK_IMPORT_FORMATS.CSV:
      return `Question,Type,Option1,Option2,Option3,Option4,CorrectAnswer,Points,TimeLimit,Explanation
Quelle est la capitale de la France?,qcm,Paris,London,Berlin,Madrid,Paris,2,30,Paris est la capitale de France
La Terre est ronde,vrai_faux,,,,,true,1,15,La Terre a une forme sphérique`;

    case BULK_IMPORT_FORMATS.JSON:
      return `[
  {
    "question": "Quelle est la capitale de la France?",
    "type": "qcm",
    "options": [
      {"text": "Paris", "isCorrect": true},
      {"text": "London", "isCorrect": false},
      {"text": "Berlin", "isCorrect": false}
    ],
    "points": 2,
    "timeLimit": 30,
    "explanation": "Paris est la capitale de la France"
  }
]`;

    case BULK_IMPORT_FORMATS.TEXT:
      return `Quelle est la capitale de la France?|qcm|Paris,London,Berlin,Madrid|Paris|2|30
La Terre est ronde|vrai_faux|||true|1|15
Combien font 2+2?|reponse_libre|||4|1|20`;

    default:
      return "";
  }
};

const getFormatHelp = (format) => {
  switch (format) {
    case BULK_IMPORT_FORMATS.CSV:
      return (
        <div>
          <p>Format CSV avec colonnes:</p>
          <ul className="mt-1 ml-4 space-y-1">
            <li>• Question (requis)</li>
            <li>• Type: qcm, vrai_faux, reponse_libre, nuage_mots</li>
            <li>• Option1-4: pour les QCM</li>
            <li>• CorrectAnswer: réponse correcte</li>
            <li>• Points (1-100)</li>
            <li>• TimeLimit en secondes (5-300)</li>
            <li>• Explanation (optionnel)</li>
          </ul>
        </div>
      );

    case BULK_IMPORT_FORMATS.JSON:
      return (
        <div>
          <p>Format JSON avec tableau d'objets question:</p>
          <ul className="mt-1 ml-4 space-y-1">
            <li>• question: texte de la question</li>
            <li>• type: type de question</li>
            <li>• options: tableau pour QCM avec text et isCorrect</li>
            <li>• correctAnswer: pour vrai_faux et reponse_libre</li>
            <li>• points, timeLimit, explanation</li>
          </ul>
        </div>
      );

    case BULK_IMPORT_FORMATS.TEXT:
      return (
        <div>
          <p>Format texte simple, une question par ligne:</p>
          <p className="mt-1 font-mono text-xs">
            Question|Type|Options|CorrectAnswer|Points|TimeLimit
          </p>
          <ul className="mt-1 ml-4 space-y-1">
            <li>• Séparez par | (pipe)</li>
            <li>• Options pour QCM séparées par virgules</li>
            <li>• Types: qcm, vrai_faux, reponse_libre</li>
          </ul>
        </div>
      );

    default:
      return null;
  }
};

export default BulkQuestionsImport;
