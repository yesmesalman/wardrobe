import React from "react";
import { Text } from "react-native";
import Template from "./src/component/Template";
import Global from "./src/component/Global";

const App = () => {

  const fetchData = async () => {
    console.log("fetchData")
    try {
      const deviceInformations = await Global.getDeviceInfo();
      
      var body = new FormData();
      
      for (const item in deviceInformations) {
        body.append(item, deviceInformations[item]);
      }
      
      var response = await Global.apiRequest('register-device', body);
      response = await response.json()
      console.log("response", response)

    } catch (e) {
      console.log(e)
    }

    // console.log(await Global.getDeviceInfo())
  }

  fetchData()

  return (
    <Template>
      <Text>Wardrobe 2</Text>
    </Template>
  );
}

export default App;
