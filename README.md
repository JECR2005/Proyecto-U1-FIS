# JECR Task Manager

JECR Task Manager es una aplicación de gestión de tareas moderna, diseñada con una interfaz atractiva y con soporte para sincronización en la nube a través de Supabase.

## Características Principales

1.  **Gestión de Tareas Completa (CRUD)**:
    *   **Crear**: Añade nuevas tareas especificando un título, una descripción detallada (opcional) y una fecha y hora de vencimiento.
    *   **Leer**: Visualiza todas tus tareas en una lista interactiva.
    *   **Actualizar**: Edita el contenido, la fecha y el estado (completado/activo) de las tareas existentes.
    *   **Eliminar**: Borra tareas que ya no necesitas o limpia las tareas completadas en masa.

2.  **Sincronización en la Nube con Supabase**:
    *   La aplicación utiliza Supabase como backend as-a-service (BaaS) para almacenar y recuperar tareas de forma segura en la base de datos PostgreSQL en la nube.
    *   Esto permite acceder a tus tareas desde cualquier dispositivo, siempre que accedas con tu cuenta.
    *   Se muestra un útil indicador de estado ("Syncing...") durante el proceso de actualización para asegurar que los datos han sido consistidos en Supabase.

3.  **Sistema de Autenticación de Usuarios**:
    *   Integrado completamente con Supabase Auth.
    *   **Email y Contraseña**: Soporta registro e inicio de sesión tradicional.
    *   **OAuth (Social Login)**: Integrado con Google y GitHub (preparado y codificado).
    *   Los datos están aislados por usuario; cada quien solo ve sus propias tareas.

4.  **Notificaciones y Recordatorios**:
    *   Las tareas pueden tener un vencimiento programado.
    *   Ofrece opciones para enviar un recordatorio con anticipación (ej. 5 min, 1 hora, 1 día antes).
    *   La aplicación usa la API de Notificaciones del Navegador (`Notification API`) para alertar al usuario antes y durante el vencimiento de la tarea.
    *   También existe el filtro de estado "Caducadas" (Expired) para las tareas que hayan sobrepasado su fecha y hora sin ser completadas.

5.  **Filtros de Vista**:
    *   **All (Todas)**: Muestra todas las tareas.
    *   **Active (Activas)**: Muestra tareas pendientes (que no han caducado).
    *   **Completed (Completadas)**: Muestra las tareas finalizadas.
    *   **Caducadas (Expired)**: Muestra las tareas que pasaron su fecha sin finalizar.

6.  **Soporte de Temas (Themes)**:
    *   Incluye un selector de temas (Claro, Oscuro y Default) construido limpiamente en HTML y CSS puro mediante atributos `data-theme` y variables CSS.
    *   Guarda la preferencia del tema localmente en el navegador usando `localStorage`.

## Estructura y Tecnologías del Proyecto

El proyecto está construido usando **Vanilla JavaScript, HTML5 y CSS3**, demostrando una estructura moderna sin depender de pesados frameworks frontend de terceros (como Vue o React). Solo utiliza la librería cliente de Supabase para su backend.

Los archivos principales que componen el proyecto son:

*   **`index.html`**:
    Contiene toda la estructura visual, incluyendo el Overlay de Autenticación (`#auth-overlay`), el formulario principal para ingresar tareas (`#todo-form`), los controles de filtros, la lista de tareas (`#todo-list`) y el modal oculto para editar las tareas (`#edit-modal`). Accede al CDN remoto para obtener la librería Javascript de Supabase (`@supabase/supabase-js@2`).

*   **`styles.css`** (No explícito en este resumen pero asumido por su enlace `<link ... href="styles.css">`):
    Contiene la lógica principal de estilos usando propiedades modernas (como flexbox, variables css y animaciones). Note que algunos estilos como los del framework de auth están directamente como `<style>` dentro de `index.html`.

*   **`app.js`**:
    Este es el corazón lógico de la aplicación. Está dividido en áreas clave:
    1.  **Configuración Supabase**: Inicializa el cliente `db` usando credenciales estáticas (Nota en producción: se recomienda usar variables de entorno).
    2.  **Helpers**: Funciones utilitarias como convertidores de fechas entre el formato local (`toLocalInputFormat`) y UTC de base de datos (`toUTC`).
    3.  **Auth (Autenticación)**: Lógica para manejar `login`, `register`, `logout` y los inicios de sesión sociales, manipulando el DOM para simular "pantallas" según el estado de la sesión obtenida de `db.auth.getSession()` y `db.auth.onAuthStateChange`.
    4.  **Operaciones CRUD de Supabase**: Funciones asíncronas (`loadFromSupabase`, `saveToSupabase`, `updateInSupabase`, `deleteFromSupabase`) que se comunican con las tablas `todos`.
    5.  **Lógica del DOM & Eventos**: Múltiples Listeners que reaccionan al envío de formularios, clics en la lista de tareas (delegación de eventos para mayor rendimiento), cambio de tema, etc., y luego invocan a las funciones CRUD. Todo está dentro del handler `DOMContentLoaded`.
    6.  **Recordatorios Locales (`checkAlerts`)**: Un verificador ejecutado usando `setInterval` que revisa las tareas actuales cada 30 segundos usando las fechas límites de alerta configuradas, llamando al servicio local de notificaciones de Sistema Operativo del navegador `new Notification()` si así aplica.

## ¿Cómo Funciona la Interacción con Base de Datos?

Cuando interactúas con la UI, `app.js` maneja una matriz local llamada `todos`.
Por cada acción, la aplicación actualiza el estado local de este array primero (`todos.unshift` o `.filter` o `.map`), forzando una re-renderización visual rápida (con `renderTodos`) para el usuario (Optimistic UI), y en paralelo inicia la petición a Supabase asíncronamente (mostrando la pequeña animación *"Syncing..."*).
Esta arquitectura provee una respuesta instantánea y fluida para el usuario asegurando la integridad a largo plazo en la nube.
