import { Text, View, StyleSheet, TouchableOpacity } from "react-native";

function AddItemBar() {
  return (
    <View style={styles.bar}>
      <Text>AddItemBar</Text>
    </View>
  );
}

export default AddItemBar;

const styles = StyleSheet.create({
  bar: {
    height: 50,
    width: "100%",
    backgroundColor: "pink",
    position: "absolute",
    bottom: 0,
  },
});
