import { useState, useRef, useEffect } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { X, Camera, AlertCircle, Loader2 } from "lucide-react";

interface QRCodeReaderProps {
  onQRCodeDetected: (data: string) => void;
  onClose: () => void;
}

export function QRCodeReader({ onQRCodeDetected, onClose }: QRCodeReaderProps) {
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [scannerReady, setScannerReady] = useState(false);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    setLoading(true);
    setError("");
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
      onQRCodeDetected(decodedText);
      // Parar scanner após sucesso
      scanner.clear();
    };

    const onScanError = (errorMessage: string) => {
      // Silenciar erros de scanner não encontrado
      if (!errorMessage.includes("NOT_FOUND")) {
        console.log(`Código QR não encontrado: ${errorMessage}`);
      }
    };

    const timeout = setTimeout(() => {
      if (!scannerReady) {
        setError("Tempo limite excedido ao inicializar câmera. Verifique se a câmera está conectada e as permissões estão concedidas.");
        setLoading(false);
      }
    }, 5000);

    scanner.render(onScanSuccess, onScanError).then(() => {
      clearTimeout(timeout);
      setLoading(false);
      setScannerReady(true);
    }).catch((err) => {
      clearTimeout(timeout);
      setError("Erro ao inicializar câmera. Verifique se a câmera está disponível e as permissões estão concedidas.");
      setLoading(false);
      console.error("Erro ao renderizar scanner:", err);
    });

    return () => {
      clearTimeout(timeout);
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
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
        <div className="bg-gradient-to-r from-[#aa341c] to-[#8f2e18] text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Camera className="w-6 h-6" />
            <h2 className="text-xl font-bold">Ler QR Code</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="relative mb-6">
            {loading && (
              <div className="absolute inset-0 bg-gray-100 rounded-lg flex items-center justify-center z-10">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-[#aa341c]" />
                  <p className="text-gray-600 font-medium">Inicializando câmera...</p>
                </div>
              </div>
            )}
            {!scannerReady && !loading && (
              <div className="w-full h-64 bg-gray-50 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300">
                <div className="text-center">
                  <Camera className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500">Câmera não disponível</p>
                </div>
              </div>
            )}
            <div
              id="qr-reader"
              className={`w-full h-64 bg-gray-50 rounded-lg overflow-hidden border-2 border-dashed border-gray-300 ${scannerReady ? '' : 'hidden'}`}
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="text-center mb-6">
            <p className="text-gray-700 font-medium mb-2">Posicione o QR code dentro da área de escaneamento</p>
            <p className="text-gray-500 text-sm">Certifique-se de que a câmera tem permissão para acessar</p>
          </div>

          <button
            onClick={handleClose}
            className="w-full bg-gray-200 text-gray-800 px-4 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
