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

export const viewport = {
  themeColor: "#163222",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover"
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
