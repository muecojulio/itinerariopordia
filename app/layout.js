import "./globals.css";
import "./ui-motion.css";

export const metadata = {
  title: "RutaDías",
  description: "Itinerario por días con voz, mapa y distancias.",
  applicationName: "RutaDías",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "RutaDías",
    statusBarStyle: "black-translucent"
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg"
  },
  other: {
    "mobile-web-app-capable": "yes"
  }
};

// Accesibilidad: no se limita la escala máxima ni se bloquea el pellizco.
// Bloquear el zoom impide ampliar a quien lo necesita.
export const viewport = {
  themeColor: "#f53d6e",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
