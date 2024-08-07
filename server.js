const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const ACTIONS = require('./Actions'); // Ensure path is correct

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const userSocketMap = {}; // Map to keep track of users

function getAllConnectedClients(roomId) {
    return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map((socketId) => ({
        socketId,
        username: userSocketMap[socketId],
    }));
}

io.on('connection', (socket) => {
    console.log('Socket connected', socket.id);

    socket.on(ACTIONS.JOIN, ({ roomId, username }) => {
        userSocketMap[socket.id] = username;
        socket.join(roomId);

        const clients = getAllConnectedClients(roomId);
        clients.forEach(({ socketId }) => {
            io.to(socketId).emit(ACTIONS.JOINED, {
                clients,
                username,
                socketId: socket.id,
            });
        });
    });

    // Handle code changes
    socket.on(ACTIONS.CODE_CHANGE, ({ roomId, code }) => {
        socket.in(roomId).emit(ACTIONS.CODE_CHANGE, { code });
    });

    // Handle code sync
    socket.on(ACTIONS.SYNC_CODE, ({ socketId, code }) => {
        io.to(socketId).emit(ACTIONS.CODE_CHANGE, { code });
    });

    socket.on('disconnecting', () => {
        const rooms = [...socket.rooms]; // Get all rooms the socket is in
        rooms.forEach((roomId) => {
            socket.in(roomId).emit(ACTIONS.USER_DISCONNECT, {
                socketId: socket.id,
                username: userSocketMap[socket.id],
            });
        });

        delete userSocketMap[socket.id];
        socket.leaveAll(); // Leave all rooms
    });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
