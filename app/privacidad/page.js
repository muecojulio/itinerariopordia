export const metadata = { title: "Privacidad · RutaDías" };

export default function Privacidad() {
  return (
    <main className="legal">
      <h1>Política de privacidad</h1>
      <p>Última actualización: 29 de septiembre de 2026.</p>
      <p>
        RutaDías es una aplicación de itinerarios. Esta política describe qué datos se
        usan y dónde se quedan.
      </p>
      <h2>Qué se guarda en tu dispositivo</h2>
      <ul>
        <li>Viajes, lugares, fechas y notas que subes (Excel/CSV).</li>
        <li>Caché de coordenadas para no repetir búsquedas.</li>
        <li>Preferencias (avisos, voz).</li>
      </ul>
      <p>
        Ese contenido vive en IndexedDB y, como respaldo, en localStorage de tu
        navegador. No se envía a una base de datos nuestra.
      </p>
      <h2>Ubicación</h2>
      <p>
        El GPS solo se usa si lo autorizas, para calcular distancias desde tu punto
        de partida. No se almacena en un servidor.
      </p>
      <h2>Servicios de terceros</h2>
      <p>
        Para mapa, clima, rutas, fotos y datos públicos la app consulta APIs
        (Open-Meteo, Nominatim/OSM, Overpass, Valhalla, OSRM, Wikipedia/Wikimedia,
        Nager.Date y, si configuras keys, Groq y Unsplash). Esas peticiones llevan
        el lugar o la consulta necesaria para responder. Cada servicio aplica su
        propia política.
      </p>
      <h2>Keys opcionales</h2>
      <p>
        GROQ_API_KEY y UNSPLASH_ACCESS_KEY viven solo en variables de entorno del
        servidor (Vercel). No se exponen al navegador.
      </p>
      <h2>Cookies y cuentas</h2>
      <p>No hay login ni cookies de seguimiento publicitario.</p>
      <h2>Tus controles</h2>
      <p>
        Puedes borrar viajes en la app o limpiar los datos del sitio en el
        navegador. Las notificaciones se piden y se pueden desactivar.
      </p>
      <h2>Menores</h2>
      <p>La app no está dirigida a menores de 13 años.</p>
      <p>
        <a className="legal-back" href="/">← Volver a RutaDías</a>
      </p>
    </main>
  );
}
