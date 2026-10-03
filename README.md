# Asistente web Fabep

Runtime público independiente de los documentos del paquete consolidado. Node.js 24, Express para desarrollo local y funciones Node.js en Vercel. No carga archivos fuera de esta carpeta.

## Ejecución local

Desde esta carpeta: `npm ci`, configurar `.env` a partir de `.env.example` y ejecutar `npm start`. Abrir http://localhost:3000. Sin credenciales el frontend y los cálculos funcionan, pero chat y sesión indican falta de configuración.

`npm run check` revisa sintaxis, imports y posibles secretos del paquete público. `npm test` ejecuta cálculos, seguridad, sesiones, llamadas HTTP y frontend con proveedor simulado. `npm run build` realiza las comprobaciones previas al despliegue. `npm run package:public` exporta una carpeta nueva dentro de `release/` con una lista explícita de archivos públicos; no copia `.env` ni documentos internos.

## GitHub → Vercel

Repositorio: alvarosalvidea/FABEP-AGENTE. Se inspeccionó su rama main y se incorporaron sus cálculos y diseño. La propuesta utiliza el contenido de esta carpeta en la raíz del repositorio, conservando los archivos raíz previos mediante el árbol Git base. La copia consolidada local sigue separada y sin `.git` raíz.

Si el repositorio contiene el paquete consolidado, configurar **Root Directory: starter_web**. Si se incorpora únicamente el contenido del paquete público exportado, dejar Root Directory en la raíz del repositorio. Framework: Other; Node.js: 24.x; build: `npm run build`; salida: `public`. `api/*.js` se despliega como funciones. No cambiar DNS ni asignar el dominio público actual; validar primero en la URL de Vercel.

Variables obligatorias del servidor:

- `OPENAI_API_KEY`: clave del proyecto OpenAI.
- `OPENAI_MODEL`: identificador disponible en esa cuenta compatible con Responses API. No existe modelo por defecto.

Variables opcionales:

- `OPENAI_VECTOR_STORE_ID`: vector store con **únicamente documentación pública aprobada**. Nunca cargar automáticamente `knowledge/`, Word originales, pruebas privadas o formulaciones.
- `MAX_MESSAGE_CHARS`: 6000 por defecto, rango 1–12000.
- `MAX_OUTPUT_TOKENS`: 2000 por defecto, rango 128–8000.
- `FILE_SEARCH_MAX_RESULTS`: 6 por defecto, rango 1–50.

Configurar variables en Preview y Production según corresponda y volver a desplegar. No agregar prefijos que publiquen variables en el navegador. `/api/health` informa si la configuración existe y sus límites son válidos; no verifica credenciales, saldo, acceso al modelo ni vector store.

## Sesiones y privacidad

La cookie de sesión se cifra y autentica con AES-256-GCM, tiene HttpOnly, SameSite=Strict y Secure en Vercel/producción. Sólo contiene un identificador aleatorio, el ID de la respuesta previa, vencimiento y contador; no contiene textos ni claves. La clave de cifrado deriva de la clave API con separación de dominio. Rotar la clave API invalida las sesiones. Se renuevan automáticamente después de 8 horas o 40 turnos.

El backend usa `previous_response_id`, `store: true` y reenvía la política en cada llamada a Responses. OpenAI procesa y almacena la conversación según la configuración y retención de la cuenta. “Nueva conversación” reemplaza la cookie y corta el contexto; no borra respuestas almacenadas en OpenAI ni revoca copias previas de la cookie. Las cookies son credenciales: evitar equipos compartidos. Sin una base compartida no hay revocación individual, serialización entre pestañas ni límite global de consultas. El frontend serializa las consultas de su pestaña. Para una publicación de alto tráfico, configurar límites de abuso y gasto en Vercel/OpenAI; no se simula un rate limit en memoria que falle entre instancias.

No se registran mensajes ni errores completos del proveedor. El frontend presenta texto con `textContent`, sin ejecutar HTML. No se incluyen documentos internos en el runtime y no se suben archivos al vector store.

## API y cálculos

`GET /api/health`, `POST /api/session` con `{}`, `POST /api/chat` con `{"message":"..."}`. La sesión se transporta únicamente en cookie; el cliente no puede elegir IDs de Responses.

`POST /api/calculate` admite:

```json
{"type":"mixture","product":"alta_dureza","totalGrams":1600}
```

Devuelve A=1000 g y B=600 g. Productos: `plus_art`, `alta_dureza`, `mesas_de_rio`, `multiproposito_2_1`. La masa es siempre el total A+B.

```json
{"type":"volume","lengthCm":100,"widthCm":50,"thicknessCm":1}
```

Devuelve 5 litros geométricos. No convierte a kg.

```json
{"type":"consumption","product":"alta_dureza","areaM2":2,"thicknessMm":1}
```

Devuelve una referencia de 2 kg, sin pérdidas y sin aprobar espesores. Los mismos cálculos se ofrecen al modelo mediante `calculate_quantity`.

Se conservaron las funciones existentes de GitHub `runCalculation` y `CALCULATION_TOOLS` en `lib/legacy-calculations.js`, con una capa de validación para resultados no finitos. `/api/calculate` también acepta `area` con `length_m`/`width_m`, `volume` con `length_m`/`width_m`/`thickness_mm` y `alta_dureza_reference` con `area_m2`/`thickness_mm`; conserva los campos de salida originales `area_m2`, `volume_l` y `reference_kg`. Los tres nombres originales de herramientas siguen disponibles para el modelo. `/api/session` acepta tanto POST con `{}` como DELETE sin cuerpo.

El frontend publicado conserva las clases, IDs y diseño de GitHub, con mejoras de accesibilidad y bloqueo durante consultas. Los archivos raíz originales `index.html` y `style.css` se preservan en Git para trazabilidad; la salida desplegada es únicamente `public`.

`node scripts/verify-openai.js` verifica credenciales y disponibilidad del modelo mediante GET /models, sin generar respuestas. `node scripts/smoke-live.js` es una prueba optativa que realiza hasta tres consultas reales y consume cuota existente; no forma parte de build, tests ni CI. La integración GitHub Actions ejecuta sólo instalación, pruebas simuladas y build, sin secretos.

La derivación humana orienta a Álvaro o Susana por el canal habitual del usuario. No hay integración para enviar avisos, gestionar ventas o confirmar pagos. Las reglas del prompt reducen respuestas incorrectas pero no constituyen una garantía de exactitud del modelo.

Los errores de saldo, cuota o límites de gasto del proveedor devuelven HTTP 503 con un mensaje público de indisponibilidad, sin revelar datos financieros. Los límites temporales de solicitudes devuelven HTTP 429. No se hacen reintentos automáticos ni se modifican créditos o facturación. El diagnóstico local confirmó `credit_balance_exhausted`: para validar el chat real el titular debe restablecer créditos en su cuenta OpenAI; cambiar de modelo no elimina ese bloqueo.

Fuentes de implementación: [Responses y estado de conversación](https://developers.openai.com/api/docs/guides/conversation-state), [File Search](https://developers.openai.com/api/docs/guides/tools-file-search), [configuración Vercel](https://vercel.com/docs/project-configuration/vercel-json).
