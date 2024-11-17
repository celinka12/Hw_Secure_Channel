
const io = require("socket.io-client");
const readline = require("readline");
const crypto = require("crypto"); 

const socket = io("http://localhost:3000");


const rl = readline.createInterface({
  input: process.stdin,  // Input berasal dari terminal
  output: process.stdout, // Output ke terminal
  prompt: "> ",  // Menampilkan prompt '>'
});

let registeredUsername = "";
let username = "";
const users = new Map(); // Menyimpan data pengguna terdaftar (username dan public key)

// pasangan kunci RSA untuk otentikasi dan penandatanganan
const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,  // Panjang kunci RSA, semakin panjang semakin aman
});

// saat klien berhasil terhubung ke server
socket.on("connect", () => {
  console.log("Connected to the server");

  // Menerima daftar pengguna dari server (event 'init')
  socket.on("init", (keys) => {
    keys.forEach(([user, key]) => users.set(user, key));  // Menyimpan pengguna yang sudah ada
    console.log(`There are currently ${users.size} users in the chat`);

    // Meminta username dari pengguna
    rl.question("Enter your username: ", (input) => {
      username = input;
      registeredUsername = input; // Menyimpan username yang didaftarkan
      console.log(`Welcome, ${username} to the chat`);

      // Mendaftarkan public key pengguna ke server
      socket.emit("registerPublicKey", {
        username,
        publicKey: publicKey.export({ type: "pkcs1", format: "pem" }), // Mengirim public key dalam format PEM
      });
      rl.prompt();  // Menampilkan prompt input

      // user mengetikkan pesan
      rl.on("line", (message) => {
        if (message.trim()) {  // Mengabaikan pesan kosong
          // Cek jika perintah impersonate dipanggil
          if ((match = message.match(/^!impersonate (\w+)$/))) {
            username = match[1];  // Mengganti username sementara
            console.log(`Now impersonating as ${username}`);
          } else if (message.match(/^!exit$/)) {
            username = registeredUsername; // Kembali ke username yang terdaftar
            console.log(`Now you are ${username}`);
          } else {
            // Membuat signature untuk pesan
            const sign = crypto.createSign("sha256");
            sign.update(message); 
            sign.end();
            const signature = sign.sign(privateKey, "hex"); // Membuat signature menggunakan private key

            // Mengirim pesan yang telah ditandatangani ke server
            socket.emit("message", {
              username,
              message,
              signature, // Mengirim signature bersama pesan
            });
          }
        }
        rl.prompt(); // Menunggu input selanjutnya
      });
    });
  });
});

// Event ketika ada pengguna baru yang terhubung
socket.on("newUser", (data) => {
  const { username, publicKey } = data;  // Mengambil data pengguna baru
  users.set(username, publicKey); // Menambahkan pengguna baru ke Map
  console.log(`${username} joined the chat`); // Menampilkan pesan bahwa pengguna baru telah bergabung
  rl.prompt(); // Menunggu input selanjutnya
});

// Event saat menerima pesan dari server
socket.on("message", (data) => {
    const { username: senderUsername, message: senderMessage, signature } = data;

    // Mengecek apakah pesan diterima dari pengguna yang benar (bukan peniruan)
    if (senderUsername !== username) {
      const senderPublicKey = users.get(senderUsername);  // Mengambil public key pengirim pesan

      if (senderPublicKey && signature) {  // Cek apakah public key dan signature tersedia
        const verify = crypto.createVerify("sha256");  // Membuat instance untuk memverifikasi signature
        verify.update(senderMessage); // Memverifikasi pesan
        verify.end();

        // Verifikasi signature menggunakan public key pengirim
        const isVerified = verify.verify(senderPublicKey, signature, "hex");

        if (isVerified) {
          console.log(`${senderUsername}: ${senderMessage}`);  // Jika signature valid, tampilkan pesan
        } else {
          console.log(`${senderUsername}: ${senderMessage}`);  // Pesan tetap ditampilkan meski signature tidak valid
          console.log(`Warning: This user is fake`);  // Peringatan jika signature tidak valid
        }
      } else if (!signature) {
        console.log(`Warning: ${senderUsername} sent a message without a signature`);  // Pesan tanpa signature
      } else {
        console.log(`Warning: No public key found for ${senderUsername}`);  // Public key tidak ditemukan
      }
    }

    rl.prompt(); // Menunggu input selanjutnya
});

// Event saat server terputus
socket.on("disconnect", () => {
  console.log("Server disconnected, Exiting...");
  rl.close(); // Menutup interface readline
  process.exit(0); // Keluar dari aplikasi
});

// Event untuk menangani SIGINT (Ctrl+C untuk keluar)
rl.on("SIGINT", () => {
  console.log("\nExiting...");
  socket.disconnect();  // Memutuskan koneksi dengan server
  rl.close();  // Menutup readline
  process.exit(0); // Keluar dari aplikasi
});
