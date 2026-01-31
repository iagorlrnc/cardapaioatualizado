import { useState, useRef, useEffect } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { X } from "lucide-react";

interface QRCodeReaderProps {
  onQRCodeDetected: (data: string) => void;
  onClose: () => void;
}

export function QRCodeReader({ onQRCodeDetected, onClose }: QRCodeReaderProps) {
  const [error, setError] = useState<string>("");
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [permissionChecked, setPermissionChecked] = useState(false);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  // Solicitar permissão de câmera
  useEffect(() => {
    const requestCameraPermission = async () => {
      try {
        // Solicitar acesso à câmera
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });

        // Se conseguiu, parar o stream e marcar como permitido
        stream.getTracks().forEach((track) => track.stop());
        setPermissionGranted(true);
        setError("");
      } catch (err) {
        // Se negou ou há erro
        if (err instanceof DOMException) {
          if (err.name === "NotAllowedError") {
            setError(
              "Permissão de câmera negada. Verifique as configurações do seu navegador.",
            );
          } else if (err.name === "NotFoundError") {
            setError("Nenhuma câmera encontrada neste dispositivo.");
          } else {
            setError("Erro ao acessar a câmera. " + err.message);
          }
        } else {
          setError("Erro desconhecido ao acessar a câmera.");
        }
        setPermissionGranted(false);
      } finally {
        setPermissionChecked(true);
      }
    };

    requestCameraPermission();
  }, []);

  // Iniciar scanner após permissão concedida
  useEffect(() => {
    if (!permissionGranted || !permissionChecked) return;

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
  }, [onQRCodeDetected, permissionGranted, permissionChecked]);

  const handleClose = () => {
    if (scannerRef.current) {
      scannerRef.current.clear().catch(() => {
        // Ignorar erros ao limpar
      });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center">
      {/* Botão fechar no topo */}
      <div className="absolute top-6 right-6 z-10">
        <button
          onClick={handleClose}
          className="p-2 bg-white rounded-full hover:bg-gray-100 transition shadow-lg"
        >
          <X className="w-6 h-6 text-black" />
        </button>
      </div>

      {/* Se ainda não verificou a permissão */}
      {!permissionChecked && (
        <div className="flex flex-col items-center justify-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
          <p className="text-white text-center text-lg font-semibold">
            Solicitando acesso à câmera...
          </p>
        </div>
      )}

      {/* Se permissão foi concedida, mostrar câmera */}
      {permissionGranted && permissionChecked && (
        <>
          {/* Câmera em fullscreen */}
          <div className="w-full h-full flex items-center justify-center">
            <div id="qr-reader" style={{ width: "100%", height: "100%" }} />
          </div>

          {/* Quadrado indicativo no centro */}
          <div
            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 border-4 border-white pointer-events-none rounded-lg shadow-lg"
            style={{
              boxShadow: "0 0 0 2000px rgba(0, 0, 0, 0.3)",
            }}
          />

          {/* Texto informativo */}
          <div className="absolute bottom-8 left-0 right-0 flex justify-center">
            <p className="text-white text-center text-lg font-semibold bg-black bg-opacity-60 px-6 py-3 rounded-lg">
              Aponte a câmera para o QR code da mesa
            </p>
          </div>
        </>
      )}

      {/* Mensagem de erro */}
      {error && (
        <div className="absolute top-24 left-1/2 transform -translate-x-1/2 bg-red-600 text-white px-4 py-3 rounded-lg max-w-sm text-center shadow-lg z-20">
          {error}
        </div>
      )}

      {/* Se permissão foi negada */}
      {!permissionGranted && permissionChecked && (
        <div className="flex flex-col items-center justify-center gap-4 px-6 max-w-md">
          <div className="text-6xl">📷</div>
          <p className="text-white text-center text-lg font-semibold">
            Permissão de Câmera Negada
          </p>
          <p className="text-gray-300 text-center text-sm">
            {error ||
              "Você negou o acesso à câmera. Para usar o leitor de QR code, você precisa permitir o acesso."}
          </p>
          <button
            onClick={handleClose}
            className="mt-4 px-6 py-2 bg-white text-black rounded-lg font-semibold hover:bg-gray-200 transition"
          >
            Fechar
          </button>
        </div>
      )}
    </div>
  );
}
