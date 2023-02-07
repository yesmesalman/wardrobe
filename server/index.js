const express = require('express');
const app = express();
const http = require('http').createServer(app);
const SocketConnection = require('./socket/connection');
const authRoutes = require('./routes/auth');
const bodyParser = require('body-parser');
var multer = require('multer');
var upload = multer();

// Socket Module
SocketConnection(http);

// for parsing application/json
app.use(bodyParser.json()); 

// for parsing application/xwww-
app.use(bodyParser.urlencoded({ extended: true })); 
//form-urlencoded

// for parsing multipart/form-data
app.use(upload.array()); 
app.use(express.static('public'));

// routes
app.use('/api', authRoutes); // Auth routes

http.listen(3000, () => {
  console.log('listening on *:3000');
});