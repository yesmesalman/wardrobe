import React from "react";
import { ScrollView } from "react-native";
import NetworkSocket from "./NetworkSocket";
import { Text, View, StyleSheet, TouchableOpacity } from "react-native";
import AddItemBar from "./../component/item/AddItemBar";
import { APP_WHITE } from "./Colors";

const Template = ({ children }) => {
  return (
    <NetworkSocket>
      <View style={{ width: "100%", height: "100%" }}>
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ flexGrow: 1 }}
          style={{
            backgroundColor: APP_WHITE,
          }}
        >
          {children}
        </ScrollView>
        <AddItemBar />
      </View>
    </NetworkSocket>
  );
};

export default Template;
