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

  const joinUrl = `${process.env.REACT_APP_URL}/join?code=${sessionCode}`;

  useEffect(() => {
    if (!sessionCode) return;

    // Configuration du QR Code avec style personnalisé - ROUGE BORDEAUX
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
        color: "#A51F2E",
        gradient: {
          type: "linear",
          rotation: 0,
          colorStops: [
            { offset: 0, color: "#A51F2E" },
            { offset: 1, color: "#8B1A26" },
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
      <div className="flex items-center justify-center p-8 bg-gray-50 dark:bg-gray-900 rounded-lg">
        <p className="text-gray-500 dark:text-gray-400">
          Code de session manquant
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center space-y-4">
      {/* QR Code */}
      <div className="bg-white p-6 rounded-lg shadow-md border-2 border-primary-200 dark:border-primary-800">
        <div ref={qrCodeRef} className="flex items-center justify-center" />
      </div>

      {/* Informations */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center space-x-2">
          <QrCodeIcon className="h-5 w-5 text-primary-600 dark:text-primary-400" />
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Scannez ce QR code pour rejoindre
          </p>
        </div>
        <div className="flex items-center justify-center space-x-2">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Code:
          </span>
          <code className="px-3 py-1 text-lg font-bold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 rounded border border-primary-200 dark:border-primary-800">
            {sessionCode}
          </code>
        </div>
      </div>

      {/* Actions */}
      {(showDownload || showCopy) && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {showCopy && (
            <>
              <button
                onClick={handleCopyUrl}
                className="inline-flex items-center px-3 py-2 text-sm font-medium text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/20 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors border border-primary-200 dark:border-primary-800"
              >
                <DocumentDuplicateIcon className="h-4 w-4 mr-2" />
                Copier le lien
              </button>
              <button
                onClick={handleCopyCode}
                className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors border border-gray-300 dark:border-gray-600"
              >
                <DocumentDuplicateIcon className="h-4 w-4 mr-2" />
                Copier le code
              </button>
            </>
          )}

          {showDownload && (
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handleDownload("png")}
                className="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
              >
                <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                PNG
              </button>
              <button
                onClick={() => handleDownload("svg")}
                className="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
              >
                <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                SVG
              </button>
            </div>
          )}
        </div>
      )}

      {/* URL affichée */}
      <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 max-w-md w-full">
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center break-all">
          {joinUrl}
        </p>
      </div>
    </div>
  );
};

export default QRCodeGenerator;
