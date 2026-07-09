/* =========================================================
   POLYFILL DE ALMACENAMIENTO (window.storage)
   ---------------------------------------------------------
   El código original de este proyecto fue creado como un
   "artefacto" de Claude.ai, donde existe un objeto global
   `window.storage` que guarda datos de forma persistente en
   los servidores de Anthropic (window.storage.get / .set / ...).

   Fuera de Claude.ai (por ejemplo al subir esto a GitHub Pages
   o a tu propio hosting) ese objeto NO EXISTE. Por eso el panel
   de la cocinera se veía "vacío" y las estadísticas nunca
   funcionaban: cada `await window.storage.get(...)` lanzaba un
   error, el catch lo silenciaba, y la app se quedaba siempre con
   DB = { students: [], deliveries: [], menu: null }.

   Este archivo crea un `window.storage` de reemplazo con la
   MISMA firma (get/set/delete/list, devolviendo {key,value,shared})
   pero respaldado por localStorage del navegador. Así el resto
   del código (app.js) no necesita cambiar ni una línea.

   ⚠️ LIMITACIÓN IMPORTANTE:
   localStorage guarda los datos SOLO en el navegador/dispositivo
   donde se usan. Si la cocinera usa la app en una PC y los
   estudiantes se registran desde otros celulares, cada uno verá
   SU PROPIA copia de los datos, no una compartida.

   Si necesitas que todos (estudiantes + cocinera, desde distintos
   dispositivos) vean los mismos datos en tiempo real, necesitas un
   backend real (por ejemplo Firebase Firestore, Supabase, o una
   API propia con una base de datos). Revisa el README.md del
   proyecto para más detalles y una guía rápida de cómo migrar.
========================================================= */
(function () {
  const PREFIX = "comedoru:";

  function storageKey(key, shared) {
    return PREFIX + (shared ? "shared:" : "local:") + key;
  }

  window.storage = {
    async get(key, shared = false) {
      try {
        const raw = localStorage.getItem(storageKey(key, shared));
        if (raw === null) return null;
        return { key, value: raw, shared };
      } catch (e) {
        console.error("storage.get error:", e);
        return null;
      }
    },

    async set(key, value, shared = false) {
      try {
        localStorage.setItem(storageKey(key, shared), value);
        return { key, value, shared };
      } catch (e) {
        console.error("storage.set error:", e);
        return null;
      }
    },

    async delete(key, shared = false) {
      try {
        localStorage.removeItem(storageKey(key, shared));
        return { key, deleted: true, shared };
      } catch (e) {
        console.error("storage.delete error:", e);
        return null;
      }
    },

    async list(prefix = "", shared = false) {
      try {
        const fullPrefix = storageKey(prefix, shared);
        const base = PREFIX + (shared ? "shared:" : "local:");
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith(fullPrefix)) keys.push(k.slice(base.length));
        }
        return { keys, prefix, shared };
      } catch (e) {
        console.error("storage.list error:", e);
        return null;
      }
    },
  };
})();
