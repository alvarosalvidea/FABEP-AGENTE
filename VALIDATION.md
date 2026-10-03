# Validación final — 3 de octubre de 2026

## Resultado local

- `npm install --package-lock-only --ignore-scripts --offline --no-audit --no-fund`: correcto. Se reutilizaron las dependencias ya instaladas; quedaron fijadas dotenv 18.0.5, Express 5.2.1 y OpenAI 7.27.0.
- `npm test`: **21 pruebas aprobadas, 0 fallidas** en la ejecución final. Cubre dosificación para los cuatro sistemas, volumen, consumo, entradas inválidas, cookies cifradas y alteradas, vencimiento, aislamiento de conversaciones, reinicio, política por turno, File Search opcional, cálculos mediante Responses, errores HTTP y prioridad de seguridad. Se añadieron comprobaciones de compatibilidad con unidades y herramientas de GitHub, reset DELETE y sus IDs/clases de interfaz. Se acotó el script de tests a los dos archivos actuales para evitar ejecutar copias históricas de release.
- Comunicación HTTP probada con servidores locales reales en puertos efímeros. Frontend servido correctamente; archivos `.env`, código backend y rutas de documentos internos inaccesibles.
- Frontend ejecutado en DOM simulado: envío, bloqueo de consultas simultáneas, presentación como texto, errores y Nueva conversación. No hubo prueba visual en navegador real.
- SDK OpenAI instalado: serialización de petición a `/v1/responses` y extracción del texto de una respuesta simulada. Las pruebas automatizadas no utilizan credenciales reales. Por separado se ejecutó una comprobación real autorizada: GET /models aceptó la clave, pero el modelo local previo no figuraba disponible. Se actualizó únicamente `OPENAI_MODEL` en el .env local a `gpt-4.1-mini`, disponible en esa cuenta y compatible con Responses según la documentación oficial. La clave quedó intacta. El .env nunca se incorpora al paquete.
- La prueba real optativa `node scripts/smoke-live.js` fue autorizada y llegó al proveedor. La primera consulta fue rechazada con **HTTP 429**; no se completaron respuestas ni cálculos reales. No se pudo establecer a partir del código normalizado si fue un límite temporal o de cuota. No se compraron créditos ni se modificó facturación.
- `npm run build`: correcto. Verifica sintaxis, imports, JSON, lista pública y patrones de posibles secretos de **31 archivos**. Se corrigió un import de rutas Windows con `pathToFileURL`. No equivale a ejecutar `vercel build` ni a un despliegue remoto.
- Git se comprobó con un repositorio temporal de auditoría en `release/gitignore-audit/`, separado del proyecto. Sólo se admiten los archivos explícitos del runtime, `.gitignore` raíz y `DEPLOYMENT.md`. Se confirmó exclusión del `.env` existente, node_modules, knowledge, evals, Word originales, prompt interno y archivos nuevos no aprobados, incluso dentro de public/lib.
- No se detectaron claves API ni claves privadas en los archivos públicos mediante los patrones usados. El `.env` local previo permanece intacto y excluido. Esta revisión no es una certificación exhaustiva de ausencia de secretos.

## Cambios exactos

Modificados: `package.json`, `package-lock.json`, `server.js`, `.env.example`, `public/index.html`, `public/style.css`, `public/app.js`.

Añadidos:

- `api/health.js`, `api/chat.js`, `api/calculate.js`, `api/session.js`.
- `lib/config.js`, `lib/http.js`, `lib/session.js`, `lib/policy.js`, `lib/calculations.js`, `lib/legacy-calculations.js`.
- `scripts/files.js`, `scripts/check.js`, `scripts/package-public.js`, `scripts/verify-openai.js`, `scripts/smoke-live.js`.
- `test/runtime.test.js`, `test/frontend.test.js`.
- `vercel.json`, `.gitignore`, `.vercelignore`, `README.md`, `VALIDATION.md`.
- `.github/workflows/runtime.yml`: CI sin credenciales, sin llamadas reales ni despliegue.
- En la raíz consolidada: `.gitignore` y `DEPLOYMENT.md`.

Se corrigió la sintaxis inválida del servidor y se eliminó la carga del prompt interno y el modelo por defecto no verificado. El servidor local y Vercel comparten handlers. La inspección posterior de GitHub encontró cálculos que no existían en la copia local: se conservaron en `lib/legacy-calculations.js`, reexportados desde calculations y disponibles mediante API y herramientas del modelo. Se conserva la interfaz del repositorio en public y se preservan sus archivos raíz mediante el árbol Git base. Se añadió un paquete exportable con una lista explícita de archivos públicos.

Los documentos internos originales, conocimiento, evaluaciones, datos dinámicos, prompt maestro y README original del consolidado permanecen intactos. En el .env local sólo se corrigió el modelo. Se generaron carpetas locales ignoradas de auditoría y exportación dentro de `release/`.

## Pendientes reales antes de producción

1. Se inspeccionó main de `alvarosalvidea/FABEP-AGENTE`, base `2a22749d9f28b20b5ea8e74c94bae2d050739a86`, y se preparó la integración como propuesta separada, preservando archivos y funciones previos. La copia consolidada no tiene repositorio Git raíz.
2. Configurar en Vercel `OPENAI_API_KEY` y `OPENAI_MODEL`; confirmar que el modelo exista, esté habilitado para esa cuenta y soporte Responses. No hay modelo por defecto. La presencia de variables locales no prueba su validez.
3. Root Directory: `starter_web` si se conserva la estructura, o la raíz si se incorpora sólo el contenido exportado. Framework Other, Node 24.x, salida `public`.
4. La conexión real y disponibilidad del modelo fueron comprobadas; la generación real permanece sin validar por HTTP 429. No se verificaron saldo/cuota, recuperación real de File Search ni despliegue Vercel. El conector Vercel devolvió cero equipos; no hay CLI ni `.vercel/project.json` local. Hace falta identificar o enlazar el proyecto destinado a este agente. `OPENAI_VECTOR_STORE_ID` es opcional y no se cargó ningún archivo; usar sólo documentación pública aprobada.
5. El handoff orienta al usuario a Álvaro o Susana; no envía notificaciones. Nueva conversación corta el contexto pero no elimina respuestas almacenadas en OpenAI. No hay revocación individual ni rate limit global persistente: para publicación abierta configurar límites de abuso y gasto en las plataformas.

No se modificó DNS ni el sitio público de Fabep, ni se realizaron compras. La propuesta de GitHub se realiza en rama/PR borrador, sin modificar main ni publicar producción.


## Diagnóstico confirmado tras reanudar

La comprobación real devolvió HTTP 429 y credit_balance_exhausted. No se trata de un límite temporal; no se reintentará hasta que el titular restablezca créditos. No se hicieron compras. El backend distingue ese caso con HTTP 503 y un mensaje público de indisponibilidad. La prueba automatizada adicional verifica errores de saldo/cuota y mantiene HTTP 429 para límites temporales. El acceso al navegador Vercel informó Debugger unattached; abrir una sesión nueva agotó el tiempo de respuesta. No hay autenticación CLI local. El ámbito fabep sigue sin autorización del conector.
