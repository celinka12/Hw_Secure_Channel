const http = require("http");                
const socketIo = require("socket.io");      

const server = http.createServer();         
const io = socketIo(server);                 

const users = new Map();                     
io.on("connection", (socket) => {            
  console.log(`Client ${socket.id} connected`);  

  //  Send current users' list (username and public key) to the new client
  socket.emit("init", Array.from(users.entries()));  //  Convert the 'users' Map to an array for broadcasting

  //  Listen for the event where a client registers their public key
  socket.on("registerPublicKey", (data) => {
    const { username, publicKey } = data;    //  Extract the username and public key from the incoming data
    users.set(username, publicKey);           //  Store the public key associated with the username in the Map
    console.log(`${username} registered with public key.`); //  Log the registration event

    //  Broadcast to all clients that a new user has joined with their public key
    io.emit("newUser", { username, publicKey });  //  Emit a 'newUser' event to notify others about the new user
  });

  //  Listen for incoming messages from clients
  socket.on("message", (data) => {
    const { username, message, targetUsername } = data;  //  Extract message details from the client
    io.emit("message", { username, message, targetUsername });  //  Broadcast the message to all clients
  });

  //  When a client disconnects, log the disconnection event
  socket.on("disconnect", () => {
    console.log(`Client ${socket.id} disconnected`);  //  Log client disconnection
  });
});

//  Set the server to listen on port 3000
const port = 3000;
server.listen(port, () => {
  console.log(`Server running on port ${port}`);  //  Log the server startup
});
