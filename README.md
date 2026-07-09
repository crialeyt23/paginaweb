# ComedorU — Gestión del Comedor Universitario

Sistema para registrar estudiantes beneficiarios y controlar la entrega diaria
de almuerzos, con panel de estadísticas para la cocinera/administración.

## 📁 Estructura del proyecto

```
comedor-universitario/
├── index.html        ← estructura de la página (HTML)
├── css/
│   └── styles.css     ← todos los estilos
├── js/
│   ├── storage.js      ← guarda/lee los datos (ver sección "Bug arreglado")
│   └── app.js           ← toda la lógica de la app (registro, entregas, gráficos, etc.)
└── README.md
```

## 🐞 El bug de las estadísticas — qué pasaba y qué se arregló

El archivo original fue creado como un **artefacto de Claude.ai**, un entorno
especial que expone un objeto global `window.storage` para guardar datos de
forma persistente en los servidores de Anthropic.

Ese objeto **solo existe dentro de Claude.ai**. Al subir el HTML a GitHub, a
un hosting propio, o abrirlo directamente en el navegador, `window.storage`
no existe: cada `await window.storage.get(...)` fallaba, el `catch` lo
silenciaba, y la app se quedaba siempre con:

```js
DB = { students: [], deliveries: [], menu: null }
```

Es decir, nunca se guardaba ni se cargaba nada — por eso el panel de la
cocinera y, en particular, la pestaña de **Estadísticas**, siempre se veían
vacíos o en cero, aunque los estudiantes "se registraran".

**Arreglo:** se agregó `js/storage.js`, que crea un `window.storage` de
reemplazo con exactamente la misma firma (`get`, `set`, `delete`, `list`,
devolviendo `{key, value, shared}`), pero respaldado por `localStorage` del
navegador. Como la firma es idéntica, no hubo que tocar ni una línea de
`app.js`: los registros, entregas, menú, historial y gráficos (Chart.js) ya
funcionan correctamente.

### ⚠️ Limitación importante de este arreglo

`localStorage` guarda los datos **solo en el navegador/dispositivo donde se
usan**. Con esta versión:

- Si la cocinera abre el panel desde su laptop y los estudiantes se
  registran desde sus propios celulares, **cada dispositivo tiene su propia
  copia de los datos** — no se comparten en tiempo real entre sí.
- Es perfecta para: una sola computadora del comedor donde se hace todo
  (registro + entrega + estadísticas), o para pruebas/demos.
- **No sirve** si necesitas que varios dispositivos vean y actualicen los
  mismos datos a la vez (por ejemplo, punto de registro en la entrada +
  punto de entrega en la cocina, en equipos distintos).

Si necesitas datos compartidos entre dispositivos, el siguiente paso es
reemplazar `js/storage.js` por una integración real, por ejemplo:
- **Firebase Firestore / Realtime Database** (gratis para este volumen de
  datos, fácil de integrar, no requiere servidor propio).
- **Supabase** (alternativa open-source a Firebase, con Postgres).
- Un backend propio (Node/Express + base de datos) si quieres control total.

En cualquiera de los tres casos, solo tendrías que reescribir las funciones
`get`/`set` de `js/storage.js` para hablar con ese servicio — el resto de
`app.js` seguiría funcionando igual, porque no depende de cómo se guardan
los datos por dentro.

## 🚀 Cómo subirlo a GitHub y verlo en línea (GitHub Pages)

1. Crea un repositorio nuevo en GitHub (puede ser privado o público).
2. Sube estos 4 archivos/carpetas manteniendo la misma estructura:
   - `index.html`
   - `css/styles.css`
   - `js/storage.js`
   - `js/app.js`

   Por línea de comandos, desde esta carpeta:
   ```bash
   git init
   git add .
   git commit -m "Comedor universitario - primera versión"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/TU_REPOSITORIO.git
   git push -u origin main
   ```
3. En GitHub, ve a **Settings → Pages**.
4. En "Source", elige la rama `main` y la carpeta `/ (root)`.
5. Guarda. En un par de minutos tu sitio estará disponible en:
   `https://TU_USUARIO.github.io/TU_REPOSITORIO/`

Nota sobre "privado": GitHub Pages en un repositorio **privado** solo es
accesible gratis si tienes una cuenta con GitHub Pro/Team/Enterprise (los
repos privados en cuentas gratuitas no pueden publicar Pages). Si tu
repositorio es gratuito, la alternativa para mantenerlo "privado" es:
- Dejar el repo privado en GitHub (el código no es público) pero **no**
  usar GitHub Pages, y en su lugar abrir `index.html` localmente o subirlo a
  un hosting propio (por ejemplo Netlify o un servidor institucional) donde
  puedas restringir el acceso.
- O usar GitHub Pages público, pero eso significa que cualquiera con el
  link puede entrar (aunque nadie podría ver los datos de otros sin acceso
  al mismo navegador/dispositivo, ya que se guardan localmente).

## 🔑 Acceso de la cocinera (demo)

- Usuario: `cocinera`
- Contraseña: `comedor2026`

Este acceso es solo una demostración en el propio navegador (no hay
autenticación real de servidor). Si vas a usar esto en producción, te
recomendamos migrar a un backend con autenticación real, como ya se sugería
en el propio formulario de login del proyecto.

## 🧪 Probar en tu computadora antes de subirlo

No necesitas nada especial, pero abrir `index.html` con doble clic (protocolo
`file://`) puede dar problemas con `localStorage` en algunos navegadores.
Lo más seguro es levantar un servidor local simple:

```bash
# Si tienes Python instalado:
cd comedor-universitario
python3 -m http.server 8080
# luego abre http://localhost:8080 en tu navegador
```
