import { format } from "date-fns";
import { fr } from "date-fns/locale";

/**
 * Exporte les résultats d'une session au format CSV
 * @param {Object} sessionData - Données de la session avec résultats
 * @param {string} filename - Nom du fichier (optionnel)
 */
export const exportToCSV = (sessionData, filename = null) => {
  const { session, results, quiz } = sessionData;

  if (!results || !results.leaderboard) {
    throw new Error("Données de résultats manquantes");
  }

  // Générer le nom de fichier
  const defaultFilename = `resultats-${session.code}-${format(
    new Date(),
    "yyyy-MM-dd-HHmm"
  )}.csv`;
  const finalFilename = filename || defaultFilename;

  // Préparer les données CSV
  const headers = [
    "Rang",
    "Participant",
    "Score",
    "Réponses correctes",
    "Total questions",
    "Taux de réussite (%)",
    "Type de participation",
    "Heure d'arrivée",
  ];

  const rows = results.leaderboard.map((participant) => [
    participant.rank,
    participant.name,
    participant.score,
    participant.correctAnswers,
    participant.totalQuestions,
    participant.accuracyRate,
    participant.isAnonymous ? "Anonyme" : "Authentifié",
    participant.joinedAt
      ? format(new Date(participant.joinedAt), "dd/MM/yyyy HH:mm", {
          locale: fr,
        })
      : "N/A",
  ]);

  // Ajouter les statistiques globales en fin de fichier
  const statsRows = [
    [],
    ["STATISTIQUES GLOBALES"],
    ["Session", session.title],
    ["Code", session.code],
    ["Quiz", quiz?.title || "N/A"],
    [
      "Date",
      format(new Date(session.createdAt), "dd/MM/yyyy HH:mm", { locale: fr }),
    ],
    ["Total participants", results.stats?.totalParticipants || 0],
    ["Score moyen", (results.stats?.averageScore || 0).toFixed(2)],
    ["Meilleur score", results.stats?.bestScore || 0],
    ["Taux de réussite moyen", `${results.stats?.accuracyRate || 0}%`],
    [
      "Temps moyen par question",
      `${results.stats?.averageTimePerQuestion || 0}s`,
    ],
  ];

  // Convertir en CSV
  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ...statsRows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
  ].join("\n");

  // Ajouter le BOM UTF-8 pour Excel
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csvContent], {
    type: "text/csv;charset=utf-8;",
  });

  // Télécharger le fichier
  downloadBlob(blob, finalFilename);
};

/**
 * Exporte les résultats détaillés par question au format CSV
 * @param {Object} sessionData - Données de la session avec résultats
 * @param {string} filename - Nom du fichier (optionnel)
 */
export const exportDetailedCSV = (sessionData, filename = null) => {
  const { session, results, quiz } = sessionData;

  const defaultFilename = `resultats-detailles-${session.code}-${format(
    new Date(),
    "yyyy-MM-dd-HHmm"
  )}.csv`;
  const finalFilename = filename || defaultFilename;

  const headers = [
    "Participant",
    "Question N°",
    "Question",
    "Type",
    "Réponse donnée",
    "Réponse correcte",
    "Correct",
    "Points obtenus",
    "Temps passé (s)",
  ];

  const rows = [];

  // Pour chaque participant
  results.leaderboard.forEach((participant) => {
    // Pour chaque question
    Object.entries(results.questionResults || {}).forEach(
      ([questionId, questionData]) => {
        const response = questionData.responses.find(
          (r) => r.participantId === participant.id
        );

        if (response) {
          const question = quiz?.questions?.find(
            (q) => q.id === questionId || q.order === questionId
          );

          rows.push([
            participant.name,
            question?.order || questionId,
            question?.question || "Question inconnue",
            question?.type || "N/A",
            formatAnswer(response.answer, question?.type),
            formatAnswer(
              question?.correctAnswer ||
                question?.options?.find((o) => o.isCorrect)?.text,
              question?.type
            ),
            response.isCorrect ? "Oui" : "Non",
            response.points || 0,
            response.timeSpent || 0,
          ]);
        }
      }
    );
  });

  // Convertir en CSV
  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
  ].join("\n");

  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csvContent], {
    type: "text/csv;charset=utf-8;",
  });

  downloadBlob(blob, finalFilename);
};

/**
 * Exporte les résultats au format PDF (version simple avec jsPDF)
 * @param {Object} sessionData - Données de la session avec résultats
 * @param {string} filename - Nom du fichier (optionnel)
 */
export const exportToPDF = async (sessionData, filename = null) => {
  // Importation dynamique de jsPDF
  const { default: jsPDF } = await import("jspdf");
  await import("jspdf-autotable");

  const { session, results, quiz } = sessionData;

  const defaultFilename = `resultats-${session.code}-${format(
    new Date(),
    "yyyy-MM-dd-HHmm"
  )}.pdf`;
  const finalFilename = filename || defaultFilename;

  const doc = new jsPDF();

  // En-tête
  doc.setFontSize(20);
  doc.setTextColor(79, 70, 229); // Primary color
  doc.text("Résultats de Session Quiz", 14, 20);

  // Informations de la session
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text(`Session: ${session.title}`, 14, 35);
  doc.text(`Code: ${session.code}`, 14, 42);
  doc.text(`Quiz: ${quiz?.title || "N/A"}`, 14, 49);
  doc.text(
    `Date: ${format(new Date(session.createdAt), "dd/MM/yyyy HH:mm", {
      locale: fr,
    })}`,
    14,
    56
  );

  // Statistiques globales
  doc.setFontSize(14);
  doc.setTextColor(79, 70, 229);
  doc.text("Statistiques globales", 14, 70);

  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  const statsY = 78;
  doc.text(
    `Participants: ${results.stats?.totalParticipants || 0}`,
    14,
    statsY
  );
  doc.text(
    `Score moyen: ${(results.stats?.averageScore || 0).toFixed(2)}`,
    14,
    statsY + 6
  );
  doc.text(`Meilleur score: ${results.stats?.bestScore || 0}`, 14, statsY + 12);
  doc.text(
    `Taux de réussite: ${results.stats?.accuracyRate || 0}%`,
    14,
    statsY + 18
  );

  // Tableau des résultats
  const tableData = results.leaderboard.map((p) => [
    p.rank,
    p.name,
    p.score,
    p.correctAnswers,
    p.totalQuestions,
    `${p.accuracyRate}%`,
  ]);

  doc.autoTable({
    startY: statsY + 30,
    head: [["Rang", "Participant", "Score", "Correctes", "Total", "Taux (%)"]],
    body: tableData,
    theme: "striped",
    headStyles: {
      fillColor: [79, 70, 229],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
  });

  // Pied de page
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(
      `Page ${i} sur ${pageCount} - Généré le ${format(
        new Date(),
        "dd/MM/yyyy HH:mm"
      )}`,
      14,
      doc.internal.pageSize.height - 10
    );
  }

  // Sauvegarder le PDF
  doc.save(finalFilename);
};

/**
 * Formate une réponse selon le type de question
 */
const formatAnswer = (answer, questionType) => {
  if (!answer) return "N/A";

  if (Array.isArray(answer)) {
    return answer.join(", ");
  }

  if (questionType === "vrai_faux") {
    if (answer === 0 || answer === "true" || answer === "vrai") return "Vrai";
    if (answer === 1 || answer === "false" || answer === "faux") return "Faux";
  }

  return String(answer);
};

/**
 * Télécharge un blob comme fichier
 */
const downloadBlob = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

/**
 * Exporte les statistiques par question au format JSON
 */
export const exportQuestionStatsJSON = (sessionData, filename = null) => {
  const { session, results } = sessionData;

  const defaultFilename = `stats-questions-${session.code}-${format(
    new Date(),
    "yyyy-MM-dd-HHmm"
  )}.json`;
  const finalFilename = filename || defaultFilename;

  const data = {
    session: {
      code: session.code,
      title: session.title,
      date: session.createdAt,
    },
    questionStats: results.stats?.questionStats || {},
    questionResults: results.questionResults || {},
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });

  downloadBlob(blob, finalFilename);
};
