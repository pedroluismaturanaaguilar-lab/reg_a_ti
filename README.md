# 🎁 Regalo Interactivo

Mini web app para un regalo con código QR: al escanearlo aparece una foto al azar,
con doble toque se revela un mensaje, y hay un "sistema solar" donde cada planeta
guarda una frase distinta.

## Dos formas de manejar las fotos

**1. Carpeta `public/fotos/` (recomendada, gratis, permanente)**
Cualquier imagen que pongas en esta carpeta aparece automáticamente en el regalo
y **nunca se borra**, porque queda guardada como parte del propio proyecto en
GitHub. Para agregar o cambiar una foto:
1. Entra a tu repositorio en GitHub.
2. Abre la carpeta `public/fotos`.
3. Click en **"Add file" → "Upload files"**.
4. Arrastra tu foto (nómbrala como quieras, ej. `foto1.jpg`; para reemplazar una
   ya existente, sube un archivo con el mismo nombre).
5. Dale a **"Commit changes"**.

Render detecta el cambio y redespliega solo en 1-2 minutos. No necesitas tocar
el panel de administración para esto — solo entra a asignarle qué experiencia
quieres que dispare esa foto (sistema solar, carta, frases de amor, etc.), si no
quieres que sea aleatoria.

**2. Botón "Subir foto rápida" del panel admin (temporal)**
Sirve para pruebas rápidas sin tocar GitHub, pero en el plan gratuito de Render
esas fotos se pueden borrar cuando el servicio se reinicia (ver sección de
Render más abajo). Para que sean permanentes también, necesitarías el disco
persistente pago.

## Cómo funciona

- **Página pública** (`/`): pantalla de carga → foto al azar → doble toque → una
  de estas experiencias, elegida por ti para cada foto: sistema solar, carta,
  frases de amor, motivación, recuerdos, sorpresa, galería o "aleatoria".
- **Sistema solar**: el Sol y 8 planetas, cada uno con su propio color y frase(s).
  Se toca un planeta y este "vuela" hacia el centro mostrando su mensaje.
- **Panel de administración** (`/#admin`): protegido con contraseña. Ahí asignas
  qué experiencia dispara cada foto, editas todas las frases y textos, cambias
  colores/tipografía y puedes exportar/importar una copia de seguridad en JSON.
- Cada foto tiene una animación de entrada y de salida distinta (aleatoria o fija,
  configurable), y hay partículas al tocar.

El panel de administración **no aparece** para quien escanea el QR normal: solo se
ve si entras a la URL con `#admin` al final.

## Estructura del proyecto

```
regalo-interactivo/
├── server.js              # Servidor Express + API
├── default-content.json   # Frases y tema por defecto (primer arranque)
├── public/
│   ├── fotos/              # <-- pon aquí tus fotos permanentes
│   └── index.html          # Toda la interfaz (público + admin)
├── package.json
└── data/                   # Se crea solo: content.json y fotos "temporales" subidas desde el panel
```

## Ejecutarlo en tu computador

Necesitas [Node.js](https://nodejs.org) 18 o superior.

```bash
npm install
ADMIN_PASSWORD=tu-clave-secreta npm start
```

Abre `http://localhost:3000` para ver el regalo, y
`http://localhost:3000/#admin` para entrar al panel (con la contraseña que
pusiste en `ADMIN_PASSWORD`).

Si no defines `ADMIN_PASSWORD`, se usa `cambiame123` — cámbiala siempre antes de
compartir el link real.

## Desplegarlo en Render

1. Sube esta carpeta a un repositorio de GitHub (incluyendo tus fotos ya puestas
   en `public/fotos`, si quieres que salgan desde el primer despliegue).
2. En [Render](https://render.com), crea un **Web Service** nuevo apuntando a
   ese repositorio.
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
3. En "Environment", agrega la variable `ADMIN_PASSWORD` con la clave que
   quieras usar para el panel.
4. **Sobre la persistencia:**
   - Las fotos en `public/fotos` **siempre son permanentes**, en cualquier plan,
     porque viajan con el código — no dependen de disco persistente.
   - Las frases/colores que edites desde el panel, y las fotos "temporales" que
     subas ahí mismo, se guardan en un disco que el plan **gratuito** de Render
     borra cada vez que el servicio se reinicia (pasa solo tras ~15 min sin
     visitas). Si quieres que esos cambios también sean permanentes sin tener
     que reeditarlos, necesitas subir a un plan pago (Starter, $7/mes) y
     agregar un disco:
     - En Settings del servicio, cambia el plan a **Starter**.
     - Agrega un **Disk** de 1 GB con mount path `/var/data`.
     - Agrega la variable de entorno `DATA_DIR=/var/data`.
     - El archivo `render.yaml` incluido ya trae esta configuración lista si
       despliegas con "New → Blueprint".
5. Cuando el servicio esté activo, Render te da una URL como
   `https://tu-app.onrender.com`. Genera el código QR apuntando a esa URL
   (cualquier generador de QR gratuito en línea sirve, solo pega el link).
6. Entra a `https://tu-app.onrender.com/#admin` para asignar experiencias a tus
   fotos y ajustar frases y colores a tu gusto.

## Personalizar el contenido

Desde el panel puedes editar libremente cada frase (una por línea en las listas,
o el texto completo en Sol / Tierra / Neptuno / Carta). Ya dejé escritas frases
de ejemplo en todos los espacios para que el regalo funcione completo desde el
primer momento; siéntete libre de reemplazarlas por las tuyas.

También puedes exportar un respaldo en JSON desde la pestaña "Datos" y volver a
importarlo cuando quieras (por ejemplo, para restaurar un contenido anterior).
