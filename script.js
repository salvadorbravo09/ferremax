document.addEventListener("DOMContentLoaded", () => {
    const API_URL = "http://localhost:3000";
  
    const searchInput = document.getElementById("searchInput");
    const searchButton = document.getElementById("searchButton");
    const inventarioContainer = document.getElementById("inventarioContainer");
    const ventaContainer = document.getElementById("ventaContainer");
    const sucursalSelect = document.getElementById("sucursalSelect");
    const cantidadInput = document.getElementById("cantidadInput");
    const totalInput = document.getElementById("totalInput");
    const totalUsdInput = document.getElementById("totalUsdInput");
    const productoIdVenta = document.getElementById("productoIdVenta");
    const ventaForm = document.getElementById("ventaForm");
    const notificacionesContainer = document.getElementById("notificacionesContainer");
    const notificationBox = document.getElementById("stockBajoNotificacion");
    const notificationMessage = document.getElementById("notificationMessage");
  
    fetch(`${API_URL}/api/sucursales`)
      .then(res => res.ok ? actualizarEstadoAPI("apiStatus", true) : actualizarEstadoAPI("apiStatus", false))
      .catch(() => actualizarEstadoAPI("apiStatus", false));
  
    fetch(`${API_URL}/api/sucursales`)
      .then(res => res.json())
      .then(data => {
        data.forEach(sucursal => {
          const option = document.createElement("option");
          option.value = sucursal.id;
          option.textContent = sucursal.nombre;
          sucursalSelect.appendChild(option);
        });
      });
  
    searchButton.addEventListener("click", () => {
      const termino = searchInput.value.trim();
      if (!termino) return;
  
      fetch(`${API_URL}/api/productos/buscar?termino=${termino}`)
        .then(res => res.json())
        .then(productos => {
          if (!productos.length) {
            inventarioContainer.innerHTML = "<div>No se encontraron productos.</div>";
            return;
          }
  
          const producto = productos[0];
          productoIdVenta.value = producto.id;
  
          fetch(`${API_URL}/api/inventario/producto/${producto.id}`)
            .then(res => res.json())
            .then(inventario => {
              mostrarInventario(inventario);
              ventaContainer.classList.remove("hidden");
            });
        });
    });
  
    function mostrarInventario(inventario) {
      inventarioContainer.innerHTML = "";
      inventario.forEach(item => {
        const div = document.createElement("div");
        div.classList.add("sucursal-item");
        if (item.stock === 0) div.classList.add("stock-bajo");
  
        div.innerHTML = `<strong>${item.sucursal}</strong> - Stock: ${item.stock} - Precio: $${item.precio} (${item.precioUSD} USD)`;
        inventarioContainer.appendChild(div);
      });
    }
  
    cantidadInput.addEventListener("input", () => {
      const cantidad = parseInt(cantidadInput.value);
      const sucursalId = parseInt(sucursalSelect.value);
      const productoId = parseInt(productoIdVenta.value);
      if (!cantidad || !sucursalId) return;
  
      fetch(`${API_URL}/api/inventario/producto/${productoId}`)
        .then(res => res.json())
        .then(inventario => {
          const item = inventario.find(i => i.sucursalId === sucursalId);
          if (!item) return;
  
          const total = item.precio * cantidad;
          totalInput.value = `$${total}`;
  
          fetch(`${API_URL}/api/conversion/usd?monto=${total}`)
            .then(res => res.json())
            .then(data => {
              totalUsdInput.value = `$${data.montoUSD} USD`;
            });
        });
    });
  
    ventaForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const data = {
        productoId: parseInt(productoIdVenta.value),
        sucursalId: parseInt(sucursalSelect.value),
        cantidad: parseInt(cantidadInput.value),
      };
  
      fetch(`${API_URL}/api/venta`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
        .then(res => res.json())
        .then(result => {
          alert(result.mensaje);
        });
    });
  
    const sse = new EventSource(`${API_URL}/api/notificaciones/stock-bajo`);
    sse.onmessage = (e) => {
      const mensaje = JSON.parse(e.data);
      mostrarNotificacion(mensaje.mensaje);
      agregarNotificacion(mensaje);
      actualizarEstadoAPI("sseStatus", true);
    };
    sse.onerror = () => actualizarEstadoAPI("sseStatus", false);
  
    function mostrarNotificacion(texto) {
      notificationMessage.textContent = texto;
      notificationBox.classList.remove("hidden");
      setTimeout(() => {
        notificationBox.classList.add("hidden");
      }, 5000);
    }
  
    function agregarNotificacion(mensaje) {
      const div = document.createElement("div");
      div.innerHTML = `<strong>${mensaje.productoNombre}</strong> en <em>${mensaje.sucursalNombre}</em> - ${new Date(mensaje.fecha).toLocaleString()}`;
      notificacionesContainer.prepend(div);
    }
  
    function actualizarEstadoAPI(id, conectado) {
      const el = document.getElementById(id);
      el.textContent = conectado ? "Conectado" : "Desconectado";
      el.className = conectado ? "badge bg-success" : "badge bg-danger";
    }
  });
  