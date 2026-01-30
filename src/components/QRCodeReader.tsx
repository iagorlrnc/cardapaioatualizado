import { useState, useRef, useEffect } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { X } from "lucide-react";

interface QRCodeReaderProps {
  onQRCodeDetected: (data: string) => void;
  onClose: () => void;
}

export function QRCodeReader({ onQRCodeDetected, onClose }: QRCodeReaderProps) {
  const [error, setError] = useState<string>("");
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    const html5QrCode = new Html5Qrcode("qr-reader");

    scannerRef.current = html5QrCode;

    const onScanSuccess = (decodedText: string) => {
      try {
        // Tenta fazer parse do JSON
        JSON.parse(decodedText);
        onQRCodeDetected(decodedText);
        // Parar scanner após sucesso
        html5QrCode.stop().then(() => {
          html5QrCode.clear();
        });
      } catch {
        setError("QR Code inválido. Tente novamente.");
      }
    };

    const onScanError = (errorMessage: string) => {
      // Silenciar erros de scanner não encontrado
      if (!errorMessage.includes("NotFoundException")) {
        console.log(`Código QR não encontrado: ${errorMessage}`);
      }
    };

    html5QrCode.start(
      { facingMode: "environment" },
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
      },
      onScanSuccess,
      onScanError,
    );

    return () => {
      html5QrCode
        .stop()
        .then(() => {
          html5QrCode.clear();
        })
        .catch(() => {
          // Ignorar erros ao limpar
        });
    };
  }, [onQRCodeDetected]);

  const handleClose = () => {
    if (scannerRef.current) {
      scannerRef.current
        .stop()
        .then(() => {
          scannerRef.current?.clear();
        })
        .catch(() => {
          // Ignorar erros ao limpar
        });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black z-50">
      <div className="relative w-full h-full">
        <div id="qr-reader" className="w-full h-full" />

        <button
          onClick={handleClose}
          className="absolute top-4 right-4 bg-white bg-opacity-20 text-white p-2 rounded-full hover:bg-opacity-30 transition"
        >
          <X className="w-6 h-6" />
        </button>

        {error && (
          <div className="absolute bottom-20 left-4 right-4 bg-red-500 text-white px-4 py-3 rounded-lg shadow-lg">
            {error}
          </div>
        )}

        <div className="absolute bottom-4 left-4 right-4 text-center">
          <p className="text-white text-lg font-medium bg-black bg-opacity-50 px-4 py-2 rounded-full inline-block">
            Aponte a câmera para o QR code para fazer login
          </p>
        </div>
      </div>
    </div>
  );
}
