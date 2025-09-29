import { useMemo } from "react";
import { CloudIcon } from "@heroicons/react/24/outline";

/**
 * Composant pour afficher un nuage de mots interactif
 * Taille des mots proportionnelle à leur fréquence
 */
const WordCloudDisplay = ({ responses = [], maxWords = 50 }) => {
  // Calculer la fréquence des mots
  const wordFrequency = useMemo(() => {
    const frequency = {};

    responses.forEach((response) => {
      if (Array.isArray(response.answer)) {
        response.answer.forEach((word) => {
          const normalizedWord = word.toLowerCase().trim();
          if (normalizedWord) {
            frequency[normalizedWord] = (frequency[normalizedWord] || 0) + 1;
          }
        });
      }
    });

    // Trier par fréquence décroissante
    return Object.entries(frequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, maxWords);
  }, [responses, maxWords]);

  // Calculer les tailles de police
  const getWordStyle = (frequency) => {
    if (wordFrequency.length === 0) return {};

    const maxFreq = wordFrequency[0][1];
    const minFreq = wordFrequency[wordFrequency.length - 1][1];
    const range = maxFreq - minFreq || 1;

    // Échelle de 16px à 64px
    const minSize = 16;
    const maxSize = 64;
    const size =
      minSize + ((frequency - minFreq) / range) * (maxSize - minSize);

    // Échelle d'opacité
    const opacity = 0.5 + ((frequency - minFreq) / range) * 0.5;

    // Couleurs aléatoires mais cohérentes
    const colors = [
      "text-blue-600 dark:text-blue-400",
      "text-purple-600 dark:text-purple-400",
      "text-pink-600 dark:text-pink-400",
      "text-indigo-600 dark:text-indigo-400",
      "text-cyan-600 dark:text-cyan-400",
      "text-teal-600 dark:text-teal-400",
      "text-green-600 dark:text-green-400",
      "text-orange-600 dark:text-orange-400",
    ];

    return {
      fontSize: `${size}px`,
      opacity,
      color: null, // On utilisera les classes Tailwind
    };
  };

  const getColorClass = (index) => {
    const colors = [
      "text-blue-600 dark:text-blue-400",
      "text-purple-600 dark:text-purple-400",
      "text-pink-600 dark:text-pink-400",
      "text-indigo-600 dark:text-indigo-400",
      "text-cyan-600 dark:text-cyan-400",
      "text-teal-600 dark:text-teal-400",
      "text-green-600 dark:text-green-400",
      "text-orange-600 dark:text-orange-400",
    ];
    return colors[index % colors.length];
  };

  if (wordFrequency.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <CloudIcon className="h-16 w-16 mb-4" />
        <p className="text-lg">Aucun mot soumis pour le moment</p>
        <p className="text-sm">Les mots apparaîtront ici en temps réel</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistiques */}
      <div className="grid grid-cols-3 gap-4 text-center">
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {wordFrequency.length}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Mots uniques
          </p>
        </div>
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {responses.length}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Réponses</p>
        </div>
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {wordFrequency[0][1]}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Fréquence max
          </p>
        </div>
      </div>

      {/* Nuage de mots */}
      <div className="relative min-h-[400px] p-8 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-xl overflow-hidden">
        <div className="flex flex-wrap justify-center items-center gap-4">
          {wordFrequency.map(([word, frequency], index) => {
            const style = getWordStyle(frequency);
            return (
              <div
                key={word}
                className={`font-bold transition-all hover:scale-110 cursor-default ${getColorClass(
                  index
                )}`}
                style={{
                  fontSize: style.fontSize,
                  opacity: style.opacity,
                  lineHeight: 1.2,
                }}
                title={`${word} (${frequency} fois)`}
              >
                {word}
              </div>
            );
          })}
        </div>
      </div>

      {/* Top 10 des mots */}
      <div>
        <h4 className="font-medium text-gray-900 dark:text-white mb-3">
          Top 10 des mots les plus fréquents
        </h4>
        <div className="space-y-2">
          {wordFrequency.slice(0, 10).map(([word, frequency], index) => (
            <div
              key={word}
              className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <span className="flex items-center justify-center w-8 h-8 bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-200 rounded-full text-sm font-bold">
                  {index + 1}
                </span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {word}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-32 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-primary-600 h-2 rounded-full transition-all"
                    style={{
                      width: `${(frequency / wordFrequency[0][1]) * 100}%`,
                    }}
                  />
                </div>
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400 w-12 text-right">
                  {frequency}×
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WordCloudDisplay;
