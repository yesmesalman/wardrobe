import { Text, View, StyleSheet, TouchableOpacity } from "react-native";
import IoniconsIcon from "react-native-vector-icons/Ionicons";
import Styles from "./../Styles";
import { APP_BLACK, APP_WHITE } from "./../Colors";

function AddItemBar() {
  return (
    <View style={styles.barContainer}>
      <View style={styles.barInner}>
        <TouchableOpacity>
          <IoniconsIcon
            name="ios-add-circle"
            color={APP_BLACK}
            size={50}
            style={styles.icon}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default AddItemBar;

const styles = StyleSheet.create({
  barContainer: {
    paddingHorizontal: 25,
    position: "absolute",
    bottom: 15,
    height: 55,
    width: "100%",
    justifyContent: "center",
    alignItems: "flex-end",
  },
  barInner: {
    backgroundColor: APP_WHITE,
    height: 50,
    width: 50,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    paddingLeft: 2,
    shadowColor: APP_BLACK,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.4,
    shadowRadius: 3.84,
    elevation: 5,
  },
  icon: {
    marginTop: -1,
  },
});
