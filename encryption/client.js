const io = require("socket.io-client");
const readline = require("readline");
const crypto = require("crypto"); // Used for RSA encryption and decryption


const socket = io("http://localhost:3000");

const rl = readline.createInterface({
  input: process.stdin,  
  output: process.stdout, 
  prompt: "> ", 
});

let targetUsername = ""; // Stores the username of the person to chat with privately (new !secret)
let username = ""; // Stores the user's own username
const users = new Map(); // Map to store users and their public keys
let privateKey = ""; // The private RSA key of the user
let publicKey = ""; // The public RSA key of the user

// Function to generate a pair of RSA keys (public and private)
function generateKeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048, // Length of the RSA key; 2048 bits is secure enough
    publicKeyEncoding: { type: "spki", format: "pem" }, // Public key encoding format
    privateKeyEncoding: { type: "pkcs8", format: "pem" }, // Private key encoding format
  });
  return { publicKey, privateKey };
}

// Function to encrypt a message using the recipient's public key
function encryptMessage(message, targetPublicKey) {
  return crypto.publicEncrypt(targetPublicKey, Buffer.from(message)).toString("base64"); 
  // Encrypt the message and convert to base64
}

// Function to decrypt a message using the user's private key
function decryptMessage(ciphertext) {
  try {
    // Decrypt the message using the private key and convert from base64 back to text
    return crypto.privateDecrypt(privateKey, Buffer.from(ciphertext, "base64")).toString();
  } catch (err) {
    return "Failed to decrypt message."; // Return an error message if decryption fails
  }
}

// Generate the RSA key pair when the app starts
({ publicKey, privateKey } = generateKeyPair()); // Destructure the generated keys

// On socket connection (when the client connects to the server)
socket.on("connect", () => {
  console.log("Connected to the server");

  socket.on("init", (keys) => {
    keys.forEach(([user, key]) => users.set(user, key)); // Store the users and their public keys
    console.log(`\nThere are currently ${users.size} users in the chat`);
    rl.prompt();

    // Prompt the user to enter their username
    rl.question("Enter your username: ", (input) => {
      username = input; // Store the user's username
      console.log(`Welcome, ${username} to the chat`);

      // Send the public key to the server so others can encrypt messages for this user
      socket.emit("registerPublicKey", {
        username,
        publicKey,
      });

      rl.prompt();

      // Listen for user input (messages)
      rl.on("line", (message) => {
        if (message.trim()) {
          // If the message starts with !secret, start a private chat with the specified user
          if ((match = message.match(/^!secret (\w+)$/))) {
            targetUsername = match[1];
            console.log(`Now secretly chatting with ${targetUsername}`);
          }
          // If the message is !exit, stop the secret chat
          else if (message.match(/^!exit$/)) {
            console.log(`No more secretly chatting with ${targetUsername}`);
            targetUsername = "";
          } else {
            let encryptedMessage = message;
            // If a secret chat is active, encrypt the message using the recipient's public key
            if (targetUsername) {
              const targetPublicKey = users.get(targetUsername); 
              if (targetPublicKey) {
                encryptedMessage = encryptMessage(message, targetPublicKey); // Encrypt the message
              } else {
                console.log(`Public key for ${targetUsername} not found.`); // If the recipient's public key is not available
              }
            }
            // Send the encrypted message to the server
            socket.emit("message", { username, message: encryptedMessage, targetUsername });
          }
        }
        rl.prompt();
      });
    });
  });
});

// When a new user joins the chat
socket.on("newUser", (data) => {
  const { username, publicKey } = data;
  users.set(username, publicKey); // Add the new user's public key to the map
  console.log(`${username} joined the chat`);
  rl.prompt();
});

// Handle incoming messages
socket.on("message", (data) => {
  const { username: senderUsername, message: senderMessage, targetUsername } = data;

  // If the message is a secret message from the current user, do not display it
  if (username === senderUsername && targetUsername) {
    return;
  }

  if (targetUsername && targetUsername !== username) {
    // If the message is for another user, display it as ciphertext (encrypted message)
    console.log(`${senderUsername}: ${senderMessage}`);
  } else {
    let outputMessage;
    // If the message is a secret message for this user, decrypt it
    if (targetUsername === username) {
      outputMessage = decryptMessage(senderMessage);
    } else {
      outputMessage = senderMessage; // Display the message as is if it's a public message
    }

    // Display the message in the chat
    console.log(`${senderUsername}: ${outputMessage}`);
  }

  rl.prompt();
});

// When the server disconnects
socket.on("disconnect", () => {
  console.log("Server disconnected, Exiting...");
  rl.close();
  process.exit(0);
});

// Handle process termination (Ctrl+C)
rl.on("SIGINT", () => {
  console.log("\nExiting...");
  socket.disconnect();
  rl.close();
  process.exit(0);
});
