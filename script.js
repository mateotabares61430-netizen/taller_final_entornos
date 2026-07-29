// API pública que vamos a consumir
const URL_API_ATRACCIONES =
  "https://api-colombia.com/api/v1/TouristicAttraction";

// detalle de una ciudad (lo usamos para completar el departamento
const URL_API_CIUDAD_BASE = "https://api-colombia.com/api/v1/City/";

// Imagen de respaldo
const IMAGEN_DE_RESPALDO =
  "https://placehold.co/600x400/1B4332/FAF6EC?text=Patrimonio+Cultural";

const contenedorTarjetas = document.getElementById("contenedorTarjetas");
const indicadorCarga = document.getElementById("indicadorCarga");
const textoIndicadorCarga = document.getElementById("textoIndicadorCarga");
const mensajeError = document.getElementById("mensajeError");
const mensajeSinResultados = document.getElementById("mensajeSinResultados");
const contadorResultados = document.getElementById("contadorResultados");
const botonReintentar = document.getElementById("botonReintentar");

const campoBusqueda = document.getElementById("campoBusqueda");
const filtroDepartamento = document.getElementById("filtroDepartamento");
const filtroSoloConImagen = document.getElementById("filtroSoloConImagen");

const fondoModal = document.getElementById("fondoModal");
const cajaModal = document.getElementById("cajaModal");
const botonCerrarModal = document.getElementById("botonCerrarModal");
const imagenModal = document.getElementById("imagenModal");
const lugarModal = document.getElementById("lugarModal");
const tituloModal = document.getElementById("tituloModal");
const descripcionModal = document.getElementById("descripcionModal");
const contenedorRecomendaciones = document.getElementById(
  "contenedorRecomendaciones",
);

const botonModoOscuro = document.getElementById("botonModoOscuro");
const iconoModoOscuro = document.getElementById("iconoModoOscuro");

// Lista completa de lugares
let listaCompletaDeLugares = [];

// Lista que se muestra en pantalla después de aplicar búsqueda y filtros
let listaFiltrada = [];

async function obtenerAtraccionesDesdeLaApi() {
  mostrarEstadoCarga();

  try {
    const respuesta = await fetch(URL_API_ATRACCIONES);

    if (!respuesta.ok) {
      throw new Error("La API respondió con un error: " + respuesta.status);
    }

    const datos = await respuesta.json();

    // Guardar solo los lugares que tienen nombre válido
    listaCompletaDeLugares = datos.filter(function (lugar) {
      return lugar.name && lugar.name.trim().length > 0;
    });

    // Esta función hace peticiones extra a la API, solo para las ciudades.
    await completarDepartamentosFaltantes(listaCompletaDeLugares);

    listaFiltrada = listaCompletaDeLugares;

    poblarSelectorDeDepartamentos(listaCompletaDeLugares);
    aplicarBusquedaYFiltros();
    ocultarEstadoCarga();
  } catch (error) {
    console.error("Error al consumir la API de Patrimonio Cultural:", error);
    ocultarEstadoCarga();
    mensajeError.classList.remove("hidden");
  }
}

async function completarDepartamentosFaltantes(lugares) {
  actualizarTextoDeCarga("Completando información de departamentos...");

  // Guardar por cityId, la ciudad completa que ya descargamos, para no pedir la misma ciudad dos veces

  const cacheDeCiudades = new Map();

  // Detectamos qué lugares tienen el departamento incompleto
  function leFaltaElDepartamento(lugar) {
    return !(lugar.city && lugar.city.department && lugar.city.department.name);
  }

  // Sacar sin repetir los cityId que necesitamos consultar
  const idsDeCiudadesPorConsultar = new Set();
  lugares.forEach(function (lugar) {
    if (leFaltaElDepartamento(lugar) && lugar.cityId) {
      idsDeCiudadesPorConsultar.add(lugar.cityId);
    }
  });

  // Pedir todas las ciudades faltantes EN PARALELO (no una por una) para que no se vuelva lenta la carga
  const peticionesDeCiudades = Array.from(idsDeCiudadesPorConsultar).map(
    async function (idCiudad) {
      try {
        const respuestaCiudad = await fetch(URL_API_CIUDAD_BASE + idCiudad);
        if (!respuestaCiudad.ok) return; // si esta ciudad puntual falla, seguimos con las demás
        const ciudadCompleta = await respuestaCiudad.json();
        cacheDeCiudades.set(idCiudad, ciudadCompleta);
      } catch (error) {
        // Un error en una ciudad no debe tumbar el resto del catálogo, por eso el try/catch está aquí
        console.warn(
          "No se pudo completar la ciudad con id " + idCiudad,
          error,
        );
      }
    },
  );

  await Promise.all(peticionesDeCiudades);

  // Con la información ya descargada la situamos en cada lugar
  lugares.forEach(function (lugar) {
    const ciudadDescargada = cacheDeCiudades.get(lugar.cityId);
    if (!ciudadDescargada) return; // esta ciudad ya estaba completa o no se pudo descargar

    if (!lugar.city) {
      lugar.city = ciudadDescargada;
    } else {
      lugar.city.department = ciudadDescargada.department;
      if (!lugar.city.name) {
        lugar.city.name = ciudadDescargada.name;
      }
    }
  });

  actualizarTextoDeCarga("Cargando el catálogo desde la API...");
}

// Cambia el texto que se ve debajo del spinner mientras carga
function actualizarTextoDeCarga(texto) {
  textoIndicadorCarga.textContent = texto;
}

// Extraer el nombre de la ciudad de forma segura
function obtenerNombreCiudad(lugar) {
  if (lugar.city && lugar.city.name) {
    return lugar.city.name;
  }
  return "Ubicación sin definir";
}

// Extraer el nombre del departamento de forma segura
function obtenerNombreDepartamento(lugar) {
  if (lugar.city && lugar.city.department && lugar.city.department.name) {
    return lugar.city.department.name;
  }
  return "Sin departamento";
}

// Obtener la primera imagen disponible del lugar o la imagen de respaldo
function obtenerImagenPrincipal(lugar) {
  if (lugar.images && lugar.images.length > 0 && lugar.images[0]) {
    return lugar.images[0];
  }
  return IMAGEN_DE_RESPALDO;
}

// Construir el HTML de una sola tarjeta
function crearTarjetaHTML(lugar, indice) {
  const nombreCiudad = obtenerNombreCiudad(lugar);
  const nombreDepartamento = obtenerNombreDepartamento(lugar);
  const imagenPrincipal = obtenerImagenPrincipal(lugar);
  const descripcionCorta =
    lugar.description ||
    "Este lugar todavía no tiene una descripción registrada.";

  // El delay escalonado hace que las tarjetas aparezcan en cascada
  const retrasoAnimacion = "style='animation-delay:" + indice * 0.04 + "s'";

  return `
    <article
      class="tarjeta-lugar cursor-pointer bg-white dark:bg-selva/30 rounded-2xl overflow-hidden border border-selva/10 dark:border-crema/10 hover:-translate-y-1 hover:shadow-xl transition duration-300"
      data-id="${lugar.id}"
      ${retrasoAnimacion}
    >
      <img
        src="${imagenPrincipal}"
        alt="Fotografía de ${lugar.name}"
        class="w-full h-48 object-cover"
        onerror="this.src='${IMAGEN_DE_RESPALDO}'"
      >
      <div class="p-5">
        <p class="text-xs font-semibold uppercase tracking-wide text-arcilla dark:text-oro">
          📍 ${nombreCiudad}, ${nombreDepartamento}
        </p>
        <h3 class="font-display font-bold text-lg mt-1">${lugar.name}</h3>
        <p class="recorte-tres-lineas mt-2 text-sm text-selva/70 dark:text-crema/60">
          ${descripcionCorta}
        </p>
      </div>
    </article>
  `;
}

// Pintar en pantalla la lista de lugares que recibe como parámetro
function mostrarLugaresEnPantalla(lugares) {
  contadorResultados.textContent = lugares.length + " lugar(es) encontrado(s)";

  if (lugares.length === 0) {
    contenedorTarjetas.innerHTML = "";
    mensajeSinResultados.classList.remove("hidden");
    return;
  }

  mensajeSinResultados.classList.add("hidden");

  const tarjetasHTML = lugares.map(function (lugar, indice) {
    return crearTarjetaHTML(lugar, indice);
  });

  contenedorTarjetas.innerHTML = tarjetasHTML.join("");

  // Cada tarjeta abre el modal de detalle al hacer clic
  const todasLasTarjetas =
    contenedorTarjetas.querySelectorAll(".tarjeta-lugar");
  todasLasTarjetas.forEach(function (tarjeta) {
    tarjeta.addEventListener("click", function () {
      const idLugar = Number(tarjeta.dataset.id);
      const lugarSeleccionado = listaCompletaDeLugares.find(function (item) {
        return item.id === idLugar;
      });
      abrirModalDeDetalle(lugarSeleccionado);
    });
  });
}

function mostrarEstadoCarga() {
  indicadorCarga.classList.remove("hidden");
  mensajeError.classList.add("hidden");
  contenedorTarjetas.innerHTML = "";
}

function ocultarEstadoCarga() {
  indicadorCarga.classList.add("hidden");
}

// Llenar el <select> de departamentos con los valores únicos que trae la API
function poblarSelectorDeDepartamentos(lugares) {
  const nombresUnicos = new Set();

  lugares.forEach(function (lugar) {
    nombresUnicos.add(obtenerNombreDepartamento(lugar));
  });

  const listaOrdenada = Array.from(nombresUnicos).sort();

  listaOrdenada.forEach(function (nombreDepartamento) {
    const opcion = document.createElement("option");
    opcion.value = nombreDepartamento;
    opcion.textContent = nombreDepartamento;
    filtroDepartamento.appendChild(opcion);
  });
}

/*Funcionalidad extra #1: búsqueda por texto
  Funcionalidad extra #2: filtros múltiples (departamento + imagen) */

function aplicarBusquedaYFiltros() {
  const textoBuscado = campoBusqueda.value.trim().toLowerCase();
  const departamentoElegido = filtroDepartamento.value;
  const soloConImagen = filtroSoloConImagen.checked;

  listaFiltrada = listaCompletaDeLugares.filter(function (lugar) {
    const coincideConBusqueda =
      lugar.name.toLowerCase().includes(textoBuscado) ||
      obtenerNombreCiudad(lugar).toLowerCase().includes(textoBuscado);

    const coincideConDepartamento =
      departamentoElegido === "todos" ||
      obtenerNombreDepartamento(lugar) === departamentoElegido;

    const coincideConFiltroImagen =
      !soloConImagen || (lugar.images && lugar.images.length > 0);

    return (
      coincideConBusqueda && coincideConDepartamento && coincideConFiltroImagen
    );
  });

  mostrarLugaresEnPantalla(listaFiltrada);
}

/* Funcionalidad extra #3: recomendaciones de lugares similares*/

function abrirModalDeDetalle(lugar) {
  if (!lugar) return;

  imagenModal.src = obtenerImagenPrincipal(lugar);
  imagenModal.alt = "Fotografía de " + lugar.name;
  lugarModal.textContent =
    "📍 " +
    obtenerNombreCiudad(lugar) +
    ", " +
    obtenerNombreDepartamento(lugar);
  tituloModal.textContent = lugar.name;
  descripcionModal.textContent =
    lugar.description ||
    "Este lugar todavía no tiene una descripción registrada.";

  mostrarRecomendaciones(lugar);

  fondoModal.classList.remove("hidden");
  document.body.style.overflow = "hidden"; // evitar el scroll del fondo
}

function cerrarModalDeDetalle() {
  fondoModal.classList.add("hidden");
  document.body.style.overflow = "";
}

// Buscar hasta 3 lugares del mismo departamento para sugerir
function mostrarRecomendaciones(lugarActual) {
  const departamentoActual = obtenerNombreDepartamento(lugarActual);

  const lugaresRelacionados = listaCompletaDeLugares
    .filter(function (lugar) {
      return (
        lugar.id !== lugarActual.id &&
        obtenerNombreDepartamento(lugar) === departamentoActual
      );
    })
    .slice(0, 3);

  if (lugaresRelacionados.length === 0) {
    contenedorRecomendaciones.innerHTML =
      "<p class='text-sm text-selva/50 dark:text-crema/40 col-span-3'>No hay más lugares registrados en este departamento.</p>";
    return;
  }

  contenedorRecomendaciones.innerHTML = lugaresRelacionados
    .map(function (lugar) {
      return `
      <button
        class="boton-recomendacion text-left rounded-xl overflow-hidden border border-selva/10 dark:border-crema/10 hover:shadow-md transition"
        data-id="${lugar.id}"
      >
        <img src="${obtenerImagenPrincipal(lugar)}" alt="${lugar.name}" class="w-full h-20 object-cover" onerror="this.src='${IMAGEN_DE_RESPALDO}'">
        <span class="block text-xs font-semibold p-2">${lugar.name}</span>
      </button>
    `;
    })
    .join("");

  // Al hacer clic en una recomendación, esta se convierte en el nuevo lugar
  const botonesRecomendacion = contenedorRecomendaciones.querySelectorAll(
    ".boton-recomendacion",
  );
  botonesRecomendacion.forEach(function (boton) {
    boton.addEventListener("click", function () {
      const idLugar = Number(boton.dataset.id);
      const nuevoLugar = listaCompletaDeLugares.find(function (item) {
        return item.id === idLugar;
      });
      abrirModalDeDetalle(nuevoLugar);
    });
  });
}

/* Funcionalidad extra #4: alternar entre tema claro y oscuro*/

function alternarModoOscuro() {
  document.documentElement.classList.toggle("dark");
  const modoOscuroActivo = document.documentElement.classList.contains("dark");
  iconoModoOscuro.textContent = modoOscuroActivo ? "☀️" : "🌙";
}

/*Conectamos cada elemento de la interfaz con su función.*/

campoBusqueda.addEventListener("input", aplicarBusquedaYFiltros);
filtroDepartamento.addEventListener("change", aplicarBusquedaYFiltros);
filtroSoloConImagen.addEventListener("change", aplicarBusquedaYFiltros);

botonCerrarModal.addEventListener("click", cerrarModalDeDetalle);

// Cerrar el modal si el usuario hace clic por fuera de la tarjeta blanca
fondoModal.addEventListener("click", function (evento) {
  if (evento.target === fondoModal) {
    cerrarModalDeDetalle();
  }
});

// Cerrar el modal con la tecla Escape
document.addEventListener("keydown", function (evento) {
  if (evento.key === "Escape") {
    cerrarModalDeDetalle();
  }
});

botonModoOscuro.addEventListener("click", alternarModoOscuro);
botonReintentar.addEventListener("click", obtenerAtraccionesDesdeLaApi);

// Punto de entrada: apenas carga la página, pedimos los datos a la API
obtenerAtraccionesDesdeLaApi();
