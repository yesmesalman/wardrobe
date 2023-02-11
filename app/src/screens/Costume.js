import {
  Text,
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import Template from "./../component/Template";
import Styles from "./../component/Styles";
import Card from "./../component/item/Card";
import AddItemBar from "./../component/item/AddItemBar";

function Costume() {
  return (
    <Template>
      <View style={[Styles.container, {backgroundColor: "green"}]}>
        <View style={[Styles.margin5]} />
        <View style={styles.itemHeadingRow}>
          <Text style={Styles.h1}>Shirts</Text>
          <TouchableOpacity style={Styles.button}>
            <Text style={Styles.text}>Show All</Text>
          </TouchableOpacity>
        </View>
        <ScrollView
          style={styles.itemContainer}
          horizontal={true}
          contentContainerStyle={{ alignItems: "center" }}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
        >
          <Card />
          <Card />
          <Card />
          <Card />
        </ScrollView>
        <View style={[Styles.margin10]} />
        <Text style={Styles.h1}>Pants</Text>
        <ScrollView
          style={styles.itemContainer}
          horizontal={true}
          contentContainerStyle={{ alignItems: "center" }}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
        >
          <Card />
          <Card />
          <Card />
          <Card />
        </ScrollView>
        <AddItemBar />
      </View>
    </Template>
  );
}

export default Costume;

const styles = StyleSheet.create({
  itemHeadingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  itemContainer: {
    height: 200,
    width: "100%",
  },
});
