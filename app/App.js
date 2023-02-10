import React from "react";
import { Text } from "react-native";
import Template from "./src/component/Template";
import DeviceInfo from "./src/helpers/DeviceInfo";
import CheckPlatform from "./src/helpers/CheckPlatform";
import Global from "./src/component/Global";

const App = () => {
  const fetchData = async () => {
    try {
      const deviceInformations = await DeviceInfo();
      
      var body = new FormData();
      for (const item in deviceInformations) {
        body.append(item, deviceInformations[item]);
      }

      var response = await Global.apiRequest("register-device", body);
      response = await response.json();
      console.log("response", response);
    } catch (e) {
      console.log(e);
    }
  };

  fetchData();

  return (
    <Template>
      <Text>Wardrobe 2</Text>
    </Template>
  );
};

export default App;
