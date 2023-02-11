import {
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
} from "react-native";

function Card() {
  return <View style={styles.card}></View>;
}

export default Card;

const styles = StyleSheet.create({
  card: {
    height: 170,
    width: 170,
    backgroundColor: "red",
    marginHorizontal: 10,
  },
});
