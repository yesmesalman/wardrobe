const express = require('express');
const app = express();
const http = require('http').createServer(app);
const SocketConnection = require('./socket/connection');
const authRoutes = require('./routes/auth');

// Socket Module
SocketConnection(http);

// routes
app.use('/api', authRoutes); // Auth routes

http.listen(3000, () => {
  console.log('listening on *:3000');
});