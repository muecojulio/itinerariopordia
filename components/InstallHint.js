"use client";

import { useEffect, useState } from "react";

export default function InstallHint() {
  const [deferred, setDeferred] = useState(null);
  const [ios, setIos] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [url, setUrl] = useState("");

  useEffect(() => {
    setUrl(window.location.origin);
    const nav = window.navigator;
    setStandalone(
      nav.standalone === true ||
        window.matchMedia("(display-mode: standalone)").matches
    );
    const ua = nav.userAgent || "";
    setIos(/iPad|iPhone|iPod/.test(ua) && !window.MSStream);

    const onPrompt = (e) => {
      e.preventDefault();
      setDeferred(e);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const qr = url
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
        url
      )}`
    : "";

  async function install() {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  }

  return (
    <section className="panel">
      <h2>Instalar en cualquier dispositivo</h2>
      <p className="muted">
        No pasa por una tienda. Se instala desde el navegador y queda con icono,
        como una app normal.
      </p>

      {standalone ? (
        <p className="ok">Ya está instalada en este aparato.</p>
      ) : deferred ? (
        <button className="btn primary" onClick={install}>
          Instalar RutaDías
        </button>
      ) : ios ? (
        <ol className="steps">
          <li>Pulsa el botón Compartir de Safari.</li>
          <li>Elige <strong>Añadir a pantalla de inicio</strong>.</li>
          <li>Confirma. El icono queda en tu escritorio.</li>
        </ol>
      ) : (
        <ol className="steps">
          <li>Abre esta misma página en Chrome o Edge.</li>
          <li>
            Menú <strong>⋮</strong> → <strong>Instalar aplicación</strong> o
            Añadir a la pantalla de inicio.
          </li>
        </ol>
      )}

      <div className="qr-box">
        {qr ? <img src={qr} alt="Código QR para abrir RutaDías" /> : null}
        <div>
          <p className="muted">
            Comparte este QR. Quien lo escanee abre la app y puede instalarla.
          </p>
          <p className="url">{url || "Se genera al publicar"}</p>
        </div>
      </div>
    </section>
  );
}
