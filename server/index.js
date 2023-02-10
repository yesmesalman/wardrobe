import express from 'express';
const app = express();

import http from 'http';
const server = http.createServer(app);

import bodyParser from 'body-parser';
const { json, urlencoded } = bodyParser;
import multer from 'multer';
var upload = multer();

import { default as SocketConnection } from './socket/connection.js';
import authRoutes from './routes/auth/index.js';

// Socket Module
SocketConnection(server);

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

server.listen(3000, () => {
  console.log('listening on *:3000');
});