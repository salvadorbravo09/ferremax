const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");
const app = express();
const port = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Servir archivos estáticos (index.html, script.js, etc.)
app.use(express.static(path.join(__dirname)));

// --- Base de datos simulada ---
const db = {
  sucursales: [
    { id: 1, nombre: "Sucursal 1" },
    { id: 2, nombre: "Sucursal 2" },
    { id: 3, nombre: "Sucursal 3" },
    { id: 4, nombre: "Casa Matriz" },
  ],
  productos: [
    { id: 1, nombre: "Producto A", descripcion: "Descripción del producto A" },
    { id: 2, nombre: "Producto B", descripcion: "Descripción del producto B" },
    { id: 3, nombre: "Producto C", descripcion: "Descripción del producto C" },
  ],
  inventario: [
    { productoId: 1, sucursalId: 1, stock: 31, precio: 333 },
    { productoId: 1, sucursalId: 2, stock: 23, precio: 222 },
    { productoId: 1, sucursalId: 3, stock: 100, precio: 1111 },
    { productoId: 1, sucursalId: 4, stock: 10, precio: 999 },
    { productoId: 2, sucursalId: 1, stock: 0, precio: 500 },
    { productoId: 2, sucursalId: 2, stock: 15, precio: 450 },
    { productoId: 3, sucursalId: 3, stock: 5, precio: 800 },
  ],
  stockBajoMensajes: [],
};

let sseClients = [];

const obtenerTasaUSD = () => 20.5;

// --- Rutas API (igual que antes) ---
app.get("/api/sucursales", (req, res) => res.json(db.sucursales));

app.get("/api/productos", (req, res) => res.json(db.productos));

app.get("/api/productos/buscar", (req, res) => {
  const { termino } = req.query;
  if (!termino) return res.json(db.productos);
  const resultados = db.productos.filter((p) =>
    (p.nombre + p.descripcion).toLowerCase().includes(termino.toLowerCase())
  );
  res.json(resultados);
});

app.get("/api/inventario/producto/:productoId", (req, res) => {
  const productoId = parseInt(req.params.productoId);
  const inventario = db.inventario.filter(i => i.productoId === productoId);
  if (!inventario.length) return res.status(404).json({ mensaje: "Producto no encontrado" });
  const resultado = inventario.map(item => {
    const sucursal = db.sucursales.find(s => s.id === item.sucursalId);
    return {
      ...item,
      sucursal: sucursal.nombre,
      precioUSD: parseFloat((item.precio / obtenerTasaUSD()).toFixed(2)),
    };
  });
  res.json(resultado);
});

app.get("/api/inventario/sucursal/:sucursalId", (req, res) => {
  const sucursalId = parseInt(req.params.sucursalId);
  const inventario = db.inventario.filter(i => i.sucursalId === sucursalId);
  if (!inventario.length) return res.status(404).json({ mensaje: "No hay productos" });
  const resultado = inventario.map(item => {
    const producto = db.productos.find(p => p.id === item.productoId);
    return {
      ...item,
      producto: producto.nombre,
      precioUSD: parseFloat((item.precio / obtenerTasaUSD()).toFixed(2)),
    };
  });
  res.json(resultado);
});

app.post("/api/venta", (req, res) => {
  const { productoId, sucursalId, cantidad } = req.body;
  const index = db.inventario.findIndex(i => i.productoId === productoId && i.sucursalId === sucursalId);
  if (index === -1) return res.status(404).json({ error: true, mensaje: "No disponible en sucursal" });

  const item = db.inventario[index];
  if (item.stock < cantidad) return res.status(400).json({ error: true, mensaje: `Stock insuficiente: ${item.stock}` });

  db.inventario[index].stock -= cantidad;

  if (db.inventario[index].stock === 0) {
    const sucursal = db.sucursales.find(s => s.id === sucursalId);
    const producto = db.productos.find(p => p.id === productoId);
    const mensaje = {
      mensaje: `Stock Bajo en ${sucursal.nombre}`,
      productoId,
      productoNombre: producto.nombre,
      sucursalId,
      sucursalNombre: sucursal.nombre,
      fecha: new Date(),
    };
    db.stockBajoMensajes.push(mensaje);
    sseClients.forEach(client => client.write(`data: ${JSON.stringify(mensaje)}\n\n`));
  }

  const total = cantidad * item.precio;
  const totalUSD = parseFloat((total / obtenerTasaUSD()).toFixed(2));

  res.json({
    error: false,
    mensaje: "Venta procesada",
    detalles: {
      producto: db.productos.find(p => p.id === productoId).nombre,
      sucursal: db.sucursales.find(s => s.id === sucursalId).nombre,
      cantidad,
      precioUnitario: item.precio,
      total,
      totalUSD,
      stockRestante: db.inventario[index].stock,
    },
  });
});

app.get("/api/notificaciones/stock-bajo", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  db.stockBajoMensajes.forEach(m => {
    res.write(`data: ${JSON.stringify(m)}\n\n`);
  });

  sseClients.push(res);
  req.on("close", () => {
    sseClients = sseClients.filter(c => c !== res);
  });
});

app.get("/api/conversion/usd", (req, res) => {
  const { monto } = req.query;
  if (!monto || isNaN(monto)) return res.status(400).json({ error: true, mensaje: "Monto inválido" });
  const tasa = obtenerTasaUSD();
  res.json({
    montoOriginal: parseFloat(monto),
    tasaConversion: tasa,
    montoUSD: parseFloat((monto / tasa).toFixed(2)),
  });
});

// Iniciar servidor
app.listen(3000, () => {
  console.log(`Servidor en el puerto 3000`);
});