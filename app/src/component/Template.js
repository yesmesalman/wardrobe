import React from "react";
import {
    SafeAreaView,
    ScrollView,
    StatusBar,
    useColorScheme,
} from "react-native";
import NetworkSocket from "./NetworkSocket";

const Template = ({ children }) => {
    const isDarkMode = useColorScheme() === "dark";

    return (
        <NetworkSocket>
            <SafeAreaView>
                <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
                <ScrollView contentInsetAdjustmentBehavior="automatic">
                    {children}
                </ScrollView>
            </SafeAreaView>
        </NetworkSocket>
    );
}

export default Template;
