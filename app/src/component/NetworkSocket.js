import React, { useState, useEffect } from "react";
import io from 'socket.io-client';
import Global from "./Global";

const NetworkSocket = ({ children }) => {
    const [socket, setSocket] = useState(null);

    // useEffect(() => {
    //     setSocket(io(Global.BASE_URL));
    // }, []);

    // useEffect(() => {
    //     if (socket) {
    //         socket.on('connect', () => {
    //             console.log('connected to the server');
    //         });
    //     }
    // }, [socket]);

    return (
        <>{children}</>
    );
}

export default NetworkSocket;
