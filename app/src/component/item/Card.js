import { Text, View, StyleSheet, TouchableOpacity } from "react-native";
import { APP_BLACK } from "./../../component/Colors";

function Card() {
  return <View style={styles.card}></View>;
}

export default Card;

const styles = StyleSheet.create({
  card: {
    height: 170,
    width: 170,
    backgroundColor: APP_BLACK,
    marginHorizontal: 10,
  },
});
