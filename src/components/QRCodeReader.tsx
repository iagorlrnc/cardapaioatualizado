import { useState, useRef, useEffect } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { X } from "lucide-react";

interface QRCodeReaderProps {
  onQRCodeDetected: (data: string) => void;
  onClose: () => void;
}

export function QRCodeReader({ onQRCodeDetected, onClose }: QRCodeReaderProps) {
  const [error, setError] = useState<string>("");
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
      },
      false,
    );

    scannerRef.current = scanner;

    const onScanSuccess = (decodedText: string) => {
      try {
        // Para URL/slug do QR code, não precisa fazer parse JSON
        onQRCodeDetected(decodedText);
        // Parar scanner após sucesso
        scanner.clear();
      } catch {
        setError("QR Code inválido. Tente novamente.");
      }
    };

    const onScanError = (errorMessage: string) => {
      // Silenciar erros de scanner não encontrado
      if (!errorMessage.includes("NOT_FOUND")) {
        console.log(`Código QR não encontrado: ${errorMessage}`);
      }
    };

    scanner.render(onScanSuccess, onScanError);

    return () => {
      scanner.clear().catch(() => {
        // Ignorar erros ao limpar
      });
    };
  }, [onQRCodeDetected]);

  const handleClose = () => {
    if (scannerRef.current) {
      scannerRef.current.clear().catch(() => {
        // Ignorar erros ao limpar
      });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Ler QR Code</h2>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-4">
          <div id="qr-reader" style={{ width: "100%" }} />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <p className="text-gray-600 text-sm text-center mb-4">
          Aponte a câmera para o QR code para fazer login
        </p>

        <button
          onClick={handleClose}
          className="w-full bg-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:bg-gray-300 transition"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
