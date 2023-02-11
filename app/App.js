// import React from "react";
// import { Text, View } from "react-native";
// import {
//   SafeAreaView,
//   ScrollView,
//   StatusBar,
//   useColorScheme,
// } from "react-native";
// import Template from "./src/component/Template";
// import DeviceInfo from "./src/helpers/DeviceInfo";
// import CheckPlatform from "./src/helpers/CheckPlatform";
// import Global from "./src/component/Global";

// const App = () => {
// const fetchData = async () => {
//   try {
//     const deviceInformations = await DeviceInfo();

//     var body = new FormData();
//     for (const item in deviceInformations) {
//       body.append(item, deviceInformations[item]);
//     }

//     var response = await Global.apiRequest("register-device", body);
//     response = await response.json();
//     console.log("response", response);
//   } catch (e) {
//     console.log(e);
//   }
// };

// fetchData();

// return (
//   <Template>
//     <Text>Wardrobe 2</Text>
//   </Template>
// );

//   return (
//     <SafeAreaView>
//       <Text>Wardrobe 2</Text>
//     </SafeAreaView>
//   );
// };

// export default App;

import * as React from "react";
import { Text, StyleSheet, TouchableOpacity } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import Explore from "./src/screens/Explore";
import Costume from "./src/screens/Costume";
import Profile from "./src/screens/Profile";
import { commonHeaderStyles } from "./src/component/HeaderItems";
import EntypoIcon from "react-native-vector-icons/Entypo";
import IoniconsIcon from "react-native-vector-icons/Ionicons";
import MaterialIconsIcon from "react-native-vector-icons/MaterialIcons";
import SimpleLineIconsIcon from "react-native-vector-icons/SimpleLineIcons";
import { APP_BLACK, APP_BLACK_2 } from "./src/component/Colors";

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        initialRouteName="costume"
        screenOptions={{ tabBarLabel: () => {} }}
      >
        <Tab.Screen
          name="explore"
          component={Explore}
          options={{
            ...commonHeaderStyles,
            headerRight: () => (
              <TouchableOpacity>
                <MaterialIconsIcon name="menu" color={APP_BLACK} size={26} />
              </TouchableOpacity>
            ),
            tabBarIcon: ({ focused }) => (
              <EntypoIcon
                name="documents"
                color={focused ? APP_BLACK : APP_BLACK_2}
                size={focused ? 30 : 22}
                style={styles.shadow}
              />
            ),
            tabBarLabel: () => false,
          }}
        />
        <Tab.Screen
          name="costume"
          component={Costume}
          options={{
            ...commonHeaderStyles,
            headerRight: () => (
              <TouchableOpacity>
                <MaterialIconsIcon name="menu" color={APP_BLACK} size={26} />
              </TouchableOpacity>
            ),
            tabBarIcon: ({ focused }) => (
              <IoniconsIcon
                name="ios-shirt-outline"
                color={focused ? APP_BLACK : APP_BLACK_2}
                size={focused ? 30 : 22}
                style={styles.shadow}
              />
            ),
            tabBarLabel: () => false,
          }}
        />
        <Tab.Screen
          name="profile"
          component={Profile}
          options={{
            ...commonHeaderStyles,
            headerRight: () => (
              <TouchableOpacity>
                <MaterialIconsIcon name="menu" color={APP_BLACK} size={26} />
              </TouchableOpacity>
            ),
            tabBarIcon: ({ focused }) => (
              <SimpleLineIconsIcon
                name="user"
                color={focused ? APP_BLACK : APP_BLACK_2}
                size={focused ? 30 : 22}
                style={styles.shadow}
              />
            ),
            tabBarLabel: () => false,
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  shadow: {
    shadowColor: APP_BLACK,
    shadowOpacity: 0.6,
    shadowRadius: 3,
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOffset: {
      width: 0,
      height: 1,
    },
  },
});
