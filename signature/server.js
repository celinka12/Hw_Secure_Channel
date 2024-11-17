
const http = require("http");
const socketIo = require("socket.io");
const server = http.createServer();
const io = socketIo(server);

// Menyimpan pengguna yang terhubung dalam Map (username -> public key)
const users = new Map();

// ketika ada klien yang terhubung ke server
io.on("connection", (socket) => {
  console.log(`Client ${socket.id} connected`); // Mencatat ID klien yang terhubung

  // Setelah klien terhubung, server mengirimkan daftar pengguna yang sudah terdaftar
  socket.emit("init", Array.from(users.entries())); 

  socket.on("registerPublicKey", (data) => {
    const { username, publicKey } = data; // Mengambil username dan public key dari data
    users.set(username, publicKey); // Menyimpan pasangan username dan public key ke Map
    console.log(`${username} registered with public key.`); // Mencatat pendaftaran pengguna baru

    io.emit("newUser", { username, publicKey });
  });

  // message yang berisi pesan dari pengguna
  socket.on("message", (data) => {
    const { username, message, signature } = data; // Mendapatkan data pesan dan signature
    // Mengirimkan pesan ke semua klien yang terhubung
    io.emit("message", { username, message, signature });
  });

  // Event ketika klien terputus (disconnect)
  socket.on("disconnect", () => {
    console.log(`Client ${socket.id} disconnected`); // Mencatat klien yang terputus
  });
});

// Menentukan port tempat server 
const port = 3000;
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
