import { QRCodeSVG } from "qrcode.react";
import { X, Download, Share2, Copy } from "lucide-react";
import { useRef, useState } from "react";

interface UserQRCodeDisplayProps {
  username: string;
  userSlug: string;
  onClose: () => void;
}

export function UserQRCodeDisplay({
  username,
  userSlug,
  onClose,
}: UserQRCodeDisplayProps) {
  const qrRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  // Gerar URL completa do usuário (domínio + slug)
  const userUrl = `${window.location.origin}/${userSlug}`;

  const handleDownload = () => {
    const svg = qrRef.current?.querySelector("svg");
    if (!svg) return;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = `mesa-${username}-qrcode.png`;
      link.click();
    };

    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  const handleShare = async () => {
    const text = `QR Code da Mesa ${username}: ${userUrl}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Mesa ${username}`,
          text: text,
          url: userUrl,
        });
      } catch (error) {
        console.error("Erro ao compartilhar:", error);
      }
    } else {
      handleCopy();
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(userUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-md w-full p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">QR Code da Mesa</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-gray-50 p-6 rounded-lg mb-6 flex flex-col items-center">
          <p className="text-gray-600 mb-4 font-semibold">
            Mesa <span className="text-xl">{username}</span>
          </p>
          <div ref={qrRef} className="bg-white p-4 rounded">
            <QRCodeSVG
              value={userUrl}
              size={256}
              level="H"
              includeMargin={true}
            />
          </div>
          <p className="text-xs text-gray-500 mt-4 text-center break-all">
            {userUrl}
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={handleDownload}
            className="w-full bg-black text-white px-4 py-3 rounded-lg font-semibold hover:bg-gray-800 transition flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            Baixar QR Code
          </button>

          <button
            onClick={handleShare}
            className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg font-semibold hover:bg-blue-700 transition flex items-center justify-center gap-2"
          >
            <Share2 className="w-4 h-4" />
            Compartilhar
          </button>

          <button
            onClick={handleCopy}
            className="w-full bg-gray-200 text-gray-800 px-4 py-3 rounded-lg font-semibold hover:bg-gray-300 transition flex items-center justify-center gap-2"
          >
            <Copy className="w-4 h-4" />
            {copied ? "Copiado!" : "Copiar Link"}
          </button>
        </div>

        <button
          onClick={onClose}
          className="w-full mt-4 text-gray-600 hover:text-gray-800 transition"
        >
          Fechar
        </button>
      </div>
    </div>
  );
}
