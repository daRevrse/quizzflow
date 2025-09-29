import { useState, useEffect } from "react";
import {
  PlusIcon,
  XMarkIcon,
  CheckCircleIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/outline";
import toast from "react-hot-toast";

const WordCloudQuestion = ({
  question,
  onSubmit, // Fonction appelée pour mettre à jour selectedAnswer dans le parent
  isSubmitted = false,
  submittedAnswer = [],
  timeRemaining = null,
}) => {
  const [words, setWords] = useState([]);
  const [currentWord, setCurrentWord] = useState("");

  // Charger les mots déjà soumis (si rechargement de page)
  useEffect(() => {
    if (Array.isArray(submittedAnswer) && submittedAnswer.length > 0) {
      setWords(submittedAnswer);
    }
  }, [submittedAnswer]);

  // 🔴 CRITIQUE: Synchroniser avec le parent à chaque changement
  useEffect(() => {
    if (!isSubmitted) {
      onSubmit(words);
    }
  }, [words, onSubmit, isSubmitted]);

  const maxWords = question.maxWords || 10;

  const handleAddWord = () => {
    const trimmedWord = currentWord.trim().toLowerCase();

    // Validations
    if (!trimmedWord) {
      toast.error("Veuillez saisir un mot");
      return;
    }

    if (trimmedWord.length < 2) {
      toast.error("Le mot doit faire au moins 2 caractères");
      return;
    }

    if (trimmedWord.length > 30) {
      toast.error("Le mot ne doit pas dépasser 30 caractères");
      return;
    }

    if (words.includes(trimmedWord)) {
      toast.error("Ce mot a déjà été ajouté");
      return;
    }

    if (words.length >= maxWords) {
      toast.error(`Maximum ${maxWords} mots`);
      return;
    }

    // Ajouter le mot
    setWords([...words, trimmedWord]);
    setCurrentWord("");

    toast.success("Mot ajouté !", {
      duration: 1000,
      icon: "✓",
    });
  };

  const handleRemoveWord = (wordToRemove) => {
    if (isSubmitted) return;
    setWords(words.filter((w) => w !== wordToRemove));
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !isSubmitted) {
      e.preventDefault();
      handleAddWord();
    }
  };

  return (
    <div className="space-y-4">
      {/* Instruction */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <InformationCircleIcon className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-blue-800 dark:text-blue-200 font-medium">
              Ajoutez entre 1 et {maxWords} mots-clés
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
              Les mots sont enregistrés automatiquement. Cliquez sur "Confirmer"
              quand vous avez terminé.
            </p>
          </div>
        </div>
      </div>

      {/* Champ de saisie */}
      {!isSubmitted && (
        <div className="flex gap-2">
          <input
            type="text"
            value={currentWord}
            onChange={(e) => setCurrentWord(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Entrez un mot-clé..."
            maxLength={30}
            disabled={isSubmitted}
            autoFocus
            className="flex-1 px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg 
              focus:border-blue-500 focus:ring-2 focus:ring-blue-200 
              dark:bg-gray-800 dark:text-white 
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-all"
          />
          <button
            onClick={handleAddWord}
            disabled={isSubmitted || !currentWord.trim()}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg 
              disabled:opacity-50 disabled:cursor-not-allowed 
              transition-colors flex items-center gap-2 font-medium
              shadow-sm hover:shadow-md"
          >
            <PlusIcon className="w-5 h-5" />
            <span className="hidden sm:inline">Ajouter</span>
          </button>
        </div>
      )}

      {/* Liste des mots */}
      {words.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Vos mots-clés
            </h4>
            <span
              className={`text-sm font-medium ${
                words.length >= maxWords
                  ? "text-red-600 dark:text-red-400"
                  : "text-gray-500 dark:text-gray-400"
              }`}
            >
              {words.length}/{maxWords}
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {words.map((word, index) => (
              <div
                key={index}
                className="inline-flex items-center gap-2 px-4 py-2 
                  bg-gradient-to-r from-blue-100 to-purple-100 
                  dark:from-blue-900/30 dark:to-purple-900/30 
                  text-blue-800 dark:text-blue-200 
                  rounded-full border-2 border-blue-200 dark:border-blue-800
                  shadow-sm hover:shadow-md transition-all"
              >
                <span className="font-medium">{word}</span>
                {!isSubmitted && (
                  <button
                    onClick={() => handleRemoveWord(word)}
                    className="hover:bg-blue-200 dark:hover:bg-blue-800 
                      rounded-full p-1 transition-colors"
                    title="Supprimer ce mot"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Message d'aide */}
      {!isSubmitted && words.length === 0 && (
        <div className="text-center py-6 text-gray-500 dark:text-gray-400">
          <p className="text-sm">Commencez par ajouter des mots-clés...</p>
        </div>
      )}

      {/* État soumis */}
      {isSubmitted && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <CheckCircleIcon className="w-8 h-8 text-green-600 dark:text-green-400 flex-shrink-0" />
            <div>
              <p className="text-green-800 dark:text-green-200 font-medium">
                {words.length} mot{words.length > 1 ? "s" : ""} enregistré
                {words.length > 1 ? "s" : ""} !
              </p>
              <p className="text-sm text-green-600 dark:text-green-300 mt-1">
                En attente des autres participants...
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WordCloudQuestion;
