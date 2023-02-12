import { Text, View } from "react-native";
import Template from "./../component/Template";
import Styles from "./../component/Styles";

function Profile() {
  return (
    <Template>
      <View style={[Styles.container]}>
        <Text>Profile</Text>
      </View>
    </Template>
  );
}

export default Profile;
