export const metadata = {
  title: "Privacidad · RutaDías",
  description: "Política de privacidad de RutaDías: tus viajes viven en tu dispositivo."
};

export default function Privacidad() {
  return (
    <main className="legal">
      <h1>Política de privacidad</h1>
      <p>Última actualización: 9 de octubre de 2026.</p>
      <p>
        RutaDías es una aplicación de itinerarios pensada para viajar con
        tranquilidad: <strong>tus datos viven en tu dispositivo</strong>. Esta
        política explica, sin letra pequeña, qué información se usa, dónde se
        guarda y con quién se comparte.
      </p>

      <h2>En resumen</h2>
      <ul>
        <li>No hay cuentas, ni registro, ni cookies de seguimiento.</li>
        <li>Tus viajes se guardan solo en tu navegador (IndexedDB y localStorage).</li>
        <li>El GPS se usa únicamente si tú lo autorizas y no sale del navegador.</li>
        <li>Para mapas, clima y rutas se consultan servicios públicos de terceros;
          cada petición lleva solo lo necesario para responder.</li>
      </ul>

      <h2>Qué se guarda en tu dispositivo</h2>
      <ul>
        <li>Viajes, lugares, fechas y notas que cargas desde tu Excel/CSV.</li>
        <li>Caché de coordenadas para no repetir búsquedas de geocodificación.</li>
        <li>Preferencias de uso: avisos, voz y tono de lectura elegidos.</li>
      </ul>
      <p>
        Este contenido se almacena en IndexedDB y, como respaldo, en
        localStorage de tu navegador. <strong>No se envía a ninguna base de
        datos nuestra</strong>: RutaDías no tiene servidores de cuentas.
      </p>

      <h2>Ubicación</h2>
      <p>
        El GPS solo se activa si lo autorizas expresamente y se usa para
        calcular distancias y rutas desde tu punto de partida. La posición se
        procesa en tu navegador y <strong>no se almacena en ningún
        servidor</strong>. Solo las coordenadas aproximadas se envían a los
        servicios de mapas cuando la app necesita calcular una ruta, el clima o
        paradas de transporte cercanas.
      </p>

      <h2>Servicios de terceros</h2>
      <p>
        Para ofrecer mapa, clima, rutas, fotos y datos públicos, la app consulta
        estas APIs desde el navegador o a través de nuestros propios
        intermediarios:
      </p>
      <ul>
        <li><strong>Open-Meteo</strong> (geocodificación, clima y calidad del aire) — consulta y coordenadas.</li>
        <li><strong>Photon (Komoot)</strong> y <strong>Nominatim (OpenStreetMap)</strong> — búsqueda de lugares.</li>
        <li><strong>Overpass API</strong> — paradas de transporte público cercanas.</li>
        <li><strong>Valhalla (openstreetmap.de)</strong> y <strong>OSRM (project-osrm.org)</strong> — cálculo de rutas.</li>
        <li><strong>Nager.Date</strong> — festivos del país del viaje.</li>
        <li><strong>Wikipedia / Wikimedia</strong> — resúmenes y fotos de dominio público.</li>
        <li><strong>Teselas de OpenStreetMap</strong> y recursos de Leaflet (unpkg) — visualización del mapa.</li>
        <li><strong>api.qrserver.com</strong> — genera el código QR de la pestaña «App» con la dirección pública de la página.</li>
      </ul>
      <p>
        Cada petición lleva únicamente el lugar, las coordenadas o la consulta
        necesaria para responder. Cada servicio aplica su propia política de
        privacidad.
      </p>

      <h2>Claves opcionales</h2>
      <p>
        Si la persona que despliega la app activa mejoras opcionales,
        <code>GROQ_API_KEY</code> (textos con IA) y
        <code>UNSPLASH_ACCESS_KEY</code> (fotos) viven solo en variables de
        entorno del servidor (por ejemplo, Vercel) y nunca se exponen al
        navegador. Con Groq se envía el nombre, tipo y dirección de la parada;
        con Unsplash, la consulta de búsqueda.
      </p>

      <h2>Notificaciones</h2>
      <p>
        Los avisos de «siguiente parada» son locales: se calculan en tu
        dispositivo comparando la hora actual con la de tus paradas. El permiso
        se solicita siempre y se puede revocar desde el navegador. No se usan
        notificaciones push ni servidores de mensajería.
      </p>

      <h2>Compartir</h2>
      <p>
        Al pulsar «Compartir» el texto del día se entrega a la hoja de
        compartir del sistema o se abre WhatsApp con el contenido prefijado. Tú
        decides qué se envía y a quién.
      </p>

      <h2>Funcionamiento offline (PWA)</h2>
      <p>
        El service worker guarda en caché los recursos de la propia aplicación
        (interfaz, iconos) para que funcione sin conexión. Las llamadas a las
        APIs externas nunca se cachean. Esa caché vive en tu navegador y se
        borra al limpiar los datos del sitio.
      </p>

      <h2>Cookies, cuentas y analítica</h2>
      <p>
        No hay inicio de sesión, no se usan cookies y no existe ningún sistema
        de analítica o publicidad. Nadie perfila tu comportamiento.
      </p>

      <h2>Seguridad</h2>
      <p>
        La aplicación se sirve por HTTPS, aplica cabeceras de seguridad
        (Content-Security-Policy, HSTS, protección contra clickjacking) y limita
        la frecuencia de peticiones en sus endpoints para evitar abusos. Las
        entradas se recortan y validan antes de consultar servicios externos.
      </p>

      <h2>Conservación y borrado de datos</h2>
      <ul>
        <li>Tus datos se conservan solo mientras tú quieras: están en tu dispositivo.</li>
        <li>Puedes borrar un viaje concreto desde la propia app (botón «Borrar» en la tarjeta Viaje).</li>
        <li>Para borrarlo todo: ajustes del navegador → datos del sitio → eliminar
          (borra IndexedDB, localStorage y la caché del service worker).</li>
      </ul>

      <h2>Menores</h2>
      <p>La app no está dirigida a menores de 13 años.</p>

      <h2>Cambios en esta política</h2>
      <p>
        Si la política cambia, se actualizará la fecha indicada arriba y se
        publicará en esta misma página antes de entrar en vigor.
      </p>

      <h2>Contacto</h2>
      <p>
        Para dudas sobre privacidad puedes abrir una incidencia en el
        repositorio del proyecto (GitHub).
      </p>

      <p>
        <a className="legal-back" href="/">← Volver a RutaDías</a>
      </p>
    </main>
  );
}
