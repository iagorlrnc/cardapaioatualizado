import { useState, useRef, useEffect } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { X, AlertCircle } from "lucide-react";

interface QRCodeReaderProps {
  onQRCodeDetected: (data: string) => void;
  onClose: () => void;
}

export function QRCodeReader({ onQRCodeDetected, onClose }: QRCodeReaderProps) {
  const [error, setError] = useState<string>("");
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [permissionChecked, setPermissionChecked] = useState(false);
  const [scannerReady, setScannerReady] = useState(false);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  // Solicitar permissão de câmera
  useEffect(() => {
    const requestCameraPermission = async () => {
      try {
        // Solicitar acesso à câmera com preferência pela câmera traseira (mobile)
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
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
          } else if (err.name === "NotReadableError") {
            setError("Câmera em uso por outro aplicativo. Tente novamente.");
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
    if (!permissionGranted || !permissionChecked || scannerReady) return;

    try {
      const scanner = new Html5QrcodeScanner(
        "qr-reader",
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
          useBarCodeDetectorIfSupported: true,
          showTorchButtonIfSupported: true,
          showZoomSliderIfSupported: true,
        },
        false,
      );

      scannerRef.current = scanner;

      const onScanSuccess = (decodedText: string) => {
        try {
          console.log("QR Code detectado:", decodedText);
          
          // Validar se é uma URL ou slug válido
          if (decodedText && decodedText.trim().length > 0) {
            onQRCodeDetected(decodedText);
            // Parar scanner após sucesso
            scanner.clear().catch((err) => {
              console.error("Erro ao parar scanner:", err);
            });
          } else {
            setError("QR Code inválido. Tente novamente.");
          }
        } catch (err) {
          console.error("Erro ao processar QR code:", err);
          setError("Erro ao processar QR code. Tente novamente.");
        }
      };

      const onScanError = (errorMessage: string) => {
        // Silenciar erros de scanner não encontrado
        if (
          !errorMessage.includes("NOT_FOUND") &&
          !errorMessage.includes("NotFoundException")
        ) {
          console.log(`Escaneando... ${errorMessage}`);
        }
      };

      try {
        scanner.render(onScanSuccess, onScanError);
        setScannerReady(true);
        setError("");
        console.log("Scanner iniciado com sucesso");
      } catch (renderErr) {
        console.error("Erro ao renderizar scanner:", renderErr);
        if (renderErr instanceof Error) {
          setError("Erro ao iniciar o scanner: " + renderErr.message);
        } else {
          setError("Erro ao iniciar o scanner. Tente novamente.");
        }
      }
    } catch (err) {
      console.error("Erro ao criar scanner:", err);
      setError("Erro ao criar o scanner. Tente novamente.");
    }

    return () => {
      if (scannerRef.current && scannerReady) {
        scannerRef.current.clear().catch((err) => {
          console.error("Erro ao limpar scanner:", err);
        });
      }
    };
  }, [onQRCodeDetected, permissionGranted, permissionChecked, scannerReady]);

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
          <div className="w-full h-full flex items-center justify-center relative">
            <div
              id="qr-reader"
              style={{
                width: "100%",
                height: "100%",
              }}
            />

            {/* Indicador de carregamento do scanner */}
            {!scannerReady && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-70">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
                <p className="text-white text-center font-semibold">
                  Inicializando câmera...
                </p>
              </div>
            )}
          </div>

          {/* Quadrado indicativo no centro */}
          {scannerReady && (
            <div
              className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 border-4 border-white pointer-events-none rounded-lg shadow-lg"
              style={{
                boxShadow: "0 0 0 2000px rgba(0, 0, 0, 0.3)",
              }}
            />
          )}

          {/* Texto informativo */}
          {scannerReady && (
            <div className="absolute bottom-8 left-0 right-0 flex justify-center">
              <p className="text-white text-center text-lg font-semibold bg-black bg-opacity-60 px-6 py-3 rounded-lg">
                Aponte a câmera para o QR code da mesa
              </p>
            </div>
          )}
        </>
      )}

      {/* Mensagem de erro */}
      {error && (
        <div className="absolute top-24 left-1/2 transform -translate-x-1/2 bg-red-600 text-white px-4 py-3 rounded-lg max-w-sm text-center shadow-lg z-20 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
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
