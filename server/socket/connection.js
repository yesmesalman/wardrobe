import { Server } from 'socket.io';

const connection = (httpServer) => {
    const io = new Server(httpServer, { cors: { origin: '*' } });

    io.on('connection', (socket) => {
        console.log('a user connected');
        socket.on('disconnect', () => {
            console.log('user disconnected');
        });
    });
}

export default connection;