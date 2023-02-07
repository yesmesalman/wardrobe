import React, { useState, useEffect } from "react";
import {
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    useColorScheme,
    View,
} from "react-native";
import io from 'socket.io-client';
import Global from "./Global";
import DeviceInfo from 'react-native-device-info';

const NetworkSocket = ({ children }) => {
    const [socket, setSocket] = useState(null);

    useEffect(() => {
        setSocket(io(Global.BASE_URL));
    }, []);

    useEffect(() => {
        if (socket) {
            socket.on('connect', () => {
                console.log('connected to the server');
            });
        }
    }, [socket]);

    return (
        <>{children}</>
    );
}

export default NetworkSocket;
