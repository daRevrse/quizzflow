import { useEffect, useRef } from "react";
import QRCodeStyling from "qr-code-styling";
import {
  ArrowDownTrayIcon,
  QrCodeIcon,
  DocumentDuplicateIcon,
} from "@heroicons/react/24/outline";
import toast from "react-hot-toast";

/**
 * Composant générateur de QR Code pour rejoindre une session
 * Utilise qr-code-styling pour un QR code personnalisé et esthétique
 */
const QRCodeGenerator = ({
  sessionCode,
  sessionUrl = null,
  size = 300,
  showDownload = true,
  showCopy = true,
}) => {
  const qrCodeRef = useRef(null);
  const qrCodeInstance = useRef(null);

  // 🔴 CORRECTION: URL directe vers /join avec le code (pas de login requis)
  //   const joinUrl = sessionUrl || `${window.location.origin}/join?code=${sessionCode}`;
  const joinUrl = `${process.env.REACT_APP_URL}/join?code=${sessionCode}`;

  useEffect(() => {
    if (!sessionCode) return;

    // Configuration du QR Code avec style personnalisé
    qrCodeInstance.current = new QRCodeStyling({
      width: size,
      height: size,
      data: joinUrl,
      margin: 10,
      qrOptions: {
        typeNumber: 0,
        mode: "Byte",
        errorCorrectionLevel: "H",
      },
      imageOptions: {
        hideBackgroundDots: true,
        imageSize: 0.4,
        margin: 5,
      },
      dotsOptions: {
        type: "rounded",
        color: "#4f46e5",
        gradient: {
          type: "linear",
          rotation: 0,
          colorStops: [
            { offset: 0, color: "#4f46e5" },
            { offset: 1, color: "#7c3aed" },
          ],
        },
      },
      backgroundOptions: {
        color: "#ffffff",
      },
      cornersSquareOptions: {
        type: "extra-rounded",
        color: "#1e293b",
      },
      cornersDotOptions: {
        type: "dot",
        color: "#1e293b",
      },
    });

    if (qrCodeRef.current) {
      qrCodeRef.current.innerHTML = "";
      qrCodeInstance.current.append(qrCodeRef.current);
    }

    return () => {
      if (qrCodeRef.current) {
        qrCodeRef.current.innerHTML = "";
      }
    };
  }, [sessionCode, joinUrl, size]);

  const handleDownload = (format = "png") => {
    if (!qrCodeInstance.current) return;

    const fileName = `qr-code-session-${sessionCode}.${format}`;

    qrCodeInstance.current.download({
      name: fileName,
      extension: format,
    });

    toast.success(`QR Code téléchargé : ${fileName}`);
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(joinUrl);
    toast.success("Lien copié dans le presse-papier !");
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(sessionCode);
    toast.success("Code copié dans le presse-papier !");
  };

  if (!sessionCode) {
    return (
      <div className="flex items-center justify-center p-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <p className="text-gray-500 dark:text-gray-400">
          Code de session non disponible
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* QR Code */}
      <div className="flex justify-center p-6 bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700">
        <div ref={qrCodeRef} />
      </div>

      {/* Informations */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <QrCodeIcon className="h-5 w-5 text-gray-500" />
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Scannez ce QR code pour rejoindre la session
          </p>
        </div>

        <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
          <span className="font-mono text-2xl font-bold text-primary-600 dark:text-primary-400">
            {sessionCode}
          </span>
          {showCopy && (
            <button
              onClick={handleCopyCode}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
              title="Copier le code"
            >
              <DocumentDuplicateIcon className="h-4 w-4 text-gray-600 dark:text-gray-400" />
            </button>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-2">
        {showDownload && (
          <>
            <button
              onClick={() => handleDownload("png")}
              className="flex-1 btn-secondary flex items-center justify-center gap-2"
            >
              <ArrowDownTrayIcon className="h-4 w-4" />
              Télécharger PNG
            </button>
            <button
              onClick={() => handleDownload("svg")}
              className="flex-1 btn-secondary flex items-center justify-center gap-2"
            >
              <ArrowDownTrayIcon className="h-4 w-4" />
              Télécharger SVG
            </button>
          </>
        )}
        {showCopy && (
          <button
            onClick={handleCopyUrl}
            className="flex-1 btn-secondary flex items-center justify-center gap-2"
          >
            <DocumentDuplicateIcon className="h-4 w-4" />
            Copier le lien
          </button>
        )}
      </div>

      {/* URL complète */}
      <details className="text-sm">
        <summary className="cursor-pointer text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
          Afficher l'URL complète
        </summary>
        <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
          <code className="text-xs break-all text-gray-700 dark:text-gray-300">
            {joinUrl}
          </code>
        </div>
      </details>
    </div>
  );
};

export default QRCodeGenerator;
