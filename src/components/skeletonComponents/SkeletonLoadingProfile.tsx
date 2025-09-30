import React from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import SkeletonPlaceholder from "react-native-skeleton-placeholder";

const { width } = Dimensions.get("window");
const itemWidth = (width - 60) / 2;

const SkeletonLoadingProfile = () => {
  return (
    <View style={styles.itemsGrid}>
      {[1, 2, 3, 4].map((_, index) => (
        <View key={index} style={styles.itemContainer}>
          <SkeletonPlaceholder borderRadius={10}>
            <View style={styles.itemBox}>
              <View style={styles.image} />
              <View style={styles.rating} />
              <View style={styles.title} />
              <View style={styles.text} />
              <View style={styles.text} />
              <View style={styles.text} />
              <View style={styles.moneyRateContainer}>
                <View style={styles.money} />
                <View style={styles.iconGroup}>
                  <View style={styles.icon} />
                  <View style={styles.icon} />
                </View>
              </View>
              <View style={styles.rentButton} />
            </View>
          </SkeletonPlaceholder>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  itemsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  itemContainer: {
    width: "49%",
    marginBottom: 20,
  },
  itemBox: {
    backgroundColor: "#FFF",
    borderRadius: 10,
    padding: 10,
  },
  image: {
    width: "100%",
    height: 120,
    borderRadius: 10,
    marginBottom: 10,
  },
  rating: {
    width: 60,
    height: 12,
    marginBottom: 5,
  },
  title: {
    width: "70%",
    height: 14,
    marginBottom: 5,
  },
  text: {
    width: "90%",
    height: 12,
    marginBottom: 3,
  },
  moneyRateContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  money: {
    width: 50,
    height: 16,
  },
  iconGroup: {
    flexDirection: "row",
  },
  icon: {
    width: 20,
    height: 20,
    marginLeft: 10,
    borderRadius: 5,
  },
  rentButton: {
    width: "70%",
    height: 30,
    borderRadius: 10,
    marginTop: 10,
    alignSelf: "flex-end",
  },
});

export default SkeletonLoadingProfile;