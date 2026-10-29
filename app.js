const API = 'https://jsonplaceholder.typicode.com';
const formBuscar      = document.querySelector('#form-buscar');
const formCrear       = document.querySelector('#form-crear');
const formComentar    = document.querySelector('#form-comentar');
const inputUsuario    = document.querySelector('#input-usuario');
const selectLimite    = document.querySelector('#select-limite');
const inputBusqueda   = document.querySelector('#input-busqueda');
const inputTitulo     = document.querySelector('#input-titulo');
const inputCuerpo     = document.querySelector('#input-cuerpo');
const btnCrear        = document.querySelector('#btn-crear');
const btnComentar     = document.querySelector('#btn-comentar');
const errorTitulo     = document.querySelector('#error-titulo');
const errorCuerpo     = document.querySelector('#error-cuerpo');
const errorComentario = document.querySelector('#error-comentario');
const estado          = document.querySelector('#estado');
const lista           = document.querySelector('#lista');

// Publicaciones traídas del servidor (sobre ellas se aplica el filtro)
let publicaciones = [];

// 1. Petición genérica: sirve para GET y para POST
async function peticion(url, opciones = {}) {
    const res = await fetch(url, opciones);
    if (!res.ok) throw new Error(`Error HTTP ${res.status}`);
    return { status: res.status, datos: await res.json() };
}

// 2. Funciones de interfaz
function crearTarjeta(post, esNuevo = false) {
    const art = document.createElement('article');
    art.className = esNuevo ? 'post nuevo' : 'post';
    const h3 = document.createElement('h3');
    h3.className = 'titulo';
    h3.title = 'Clic para ver los comentarios';
    h3.textContent = `#${post.id} ${post.title}`;
    h3.addEventListener('click', () => alternarComentarios(art, post.id));
    const p = document.createElement('p');
    p.textContent = post.body;
    art.append(h3, p);
    return art;
}

function mostrarEstado(texto, esError = false) {
    estado.textContent = texto;
    estado.className = esError ? 'error' : '';
}

// Filtra en el navegador (sin nueva petición) y vuelve a dibujar la lista
function mostrarLista() {
    const texto = inputBusqueda.value.trim().toLowerCase();
    const filtradas = publicaciones.filter(p =>
        p.title.toLowerCase().includes(texto));

    if (filtradas.length === 0) {
        const vacio = document.createElement('p');
        vacio.textContent = 'No hay publicaciones que coincidan.';
        lista.replaceChildren(vacio);
        return;
    }
    lista.replaceChildren(...filtradas.map(p => crearTarjeta(p, p.esNuevo)));
}

// Validación de la publicación: devuelve un objeto con los mensajes de error
function validarPublicacion(titulo, cuerpo) {
    const errores = {};
    if (titulo.length < 5) {
        errores.titulo = 'El título debe tener al menos 5 caracteres.';
    }
    if (cuerpo.length === 0) {
        errores.cuerpo = 'El contenido no puede estar vacío.';
    }
    return errores;
}

// 3. GET: listar las publicaciones de un usuario
formBuscar.addEventListener('submit', async (e) => {
    e.preventDefault();
    const params = new URLSearchParams({
        userId: inputUsuario.value,
        _limit: selectLimite.value
    });
    mostrarEstado('Cargando...');
    try {
        const { status, datos } = await peticion(`${API}/posts?${params}`);
        publicaciones = datos;
        mostrarLista();
        mostrarEstado(`GET ${status}: ${datos.length} publicaciones`);
    } catch (error) {
        mostrarEstado(error.message, true);
    }
});

// 3.1 El filtro por título actúa mientras se escribe
inputBusqueda.addEventListener('input', mostrarLista);

// 3.2 GET: comentarios de una publicación (clic para mostrar u ocultar)
async function alternarComentarios(art, postId) {
    let caja = art.querySelector('.comentarios');
    if (caja) {                         // ya cargados: solo mostrar u ocultar
        caja.hidden = !caja.hidden;
        return;
    }
    caja = document.createElement('div');
    caja.className = 'comentarios';
    caja.textContent = 'Cargando comentarios...';
    art.append(caja);

    try {
        const { status, datos } = await peticion(`${API}/posts/${postId}/comments`);
        if (datos.length === 0) {
            caja.textContent = 'Esta publicación no tiene comentarios.';
        } else {
            caja.replaceChildren(...datos.map(c => {
                const div = document.createElement('div');
                div.className = 'comentario';
                const autor = document.createElement('strong');
                autor.textContent = `${c.name} (${c.email})`;
                const texto = document.createElement('p');
                texto.textContent = c.body;
                div.append(autor, texto);
                return div;
            }));
        }
        mostrarEstado(`GET ${status}: ${datos.length} comentarios de la publicación ${postId}`);
    } catch (error) {
        caja.remove();
        mostrarEstado(error.message, true);
    }
}

// 4. POST: crear una publicación (con validación previa)
formCrear.addEventListener('submit', async (e) => {
    e.preventDefault();
    const titulo = inputTitulo.value.trim();
    const cuerpo = inputCuerpo.value.trim();

    const errores = validarPublicacion(titulo, cuerpo);
    errorTitulo.textContent = errores.titulo || '';
    errorCuerpo.textContent = errores.cuerpo || '';
    if (Object.keys(errores).length > 0) {
        mostrarEstado('Corrija los errores del formulario.', true);
        return;                             // no se envía nada al servidor
    }

    const nuevo = {
        title: titulo,
        body: cuerpo,
        userId: Number(inputUsuario.value)
    };
    //btnCrear.disabled = true;               // evita envíos duplicados
    mostrarEstado('Enviando...');
    try {
        const { status, datos } = await peticion(`${API}/posts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(nuevo)
        });
        publicaciones.unshift({ ...datos, esNuevo: true });
        mostrarLista();
        mostrarEstado(`POST ${status}: creada con id ${datos.id}`);
        formCrear.reset();
    } catch (error) {
        mostrarEstado(error.message, true);
    } finally {
        btnCrear.disabled = false;
    }
});

// 4.1 POST: comentar una publicación (FormData + Object.fromEntries)
formComentar.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Todos los campos con atributo name pasan a un objeto
    const objeto = Object.fromEntries(new FormData(formComentar));
    objeto.postId = Number(objeto.postId);
    objeto.name   = objeto.name.trim();
    objeto.email  = objeto.email.trim();
    objeto.body   = objeto.body.trim();

    const errores = [];
    if (!Number.isInteger(objeto.postId) || objeto.postId < 1 || objeto.postId > 100) {
        errores.push('El ID de la publicación debe estar entre 1 y 100.');
    }
    if (objeto.name === '') errores.push('El nombre es obligatorio.');
    if (!/^\S+@\S+\.\S+$/.test(objeto.email)) errores.push('El correo no es válido.');
    if (objeto.body === '') errores.push('El comentario no puede estar vacío.');

    errorComentario.textContent = errores.join(' ');
    if (errores.length > 0) return;

    btnComentar.disabled = true;
    mostrarEstado('Enviando comentario...');
    try {
        const { status, datos } = await peticion(`${API}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(objeto)
        });
        mostrarEstado(`POST ${status}: comentario creado con id ${datos.id}`);
        formComentar.reset();
    } catch (error) {
        mostrarEstado(error.message, true);
    } finally {
        btnComentar.disabled = false;
    }
});

// 5. Carga inicial
formBuscar.requestSubmit();
