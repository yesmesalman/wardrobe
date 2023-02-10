import { Platform } from "react-native";

const CheckPlatform = () => {
  return [
    Platform.OS === "ios", //isIOS
    Platform.OS !== "ios", //isAndroid
  ];
};

export default CheckPlatform;
