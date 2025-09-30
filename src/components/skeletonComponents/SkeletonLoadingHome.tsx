import React from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import SkeletonPlaceholder from "react-native-skeleton-placeholder";

const { width } = Dimensions.get("window");
const itemWidth = (width - 60) / 2;

const SkeletonLoadingHome = () => {
  return (
    <View style={styles.itemsGrid}>
      {[1, 2, 3, 4, 5, 6].map((_, index) => (
        <View key={index} style={styles.itemContainer}>
          <SkeletonPlaceholder borderRadius={10}>
            <View style={styles.itemBox}>
              {/* Image */}
              <View style={styles.image} />
              
              {/* Rating */}
              <View style={styles.rating} />
              
              {/* Item Name */}
              <View style={styles.title} />
              
              {/* Lessor Info */}
              <View style={styles.lessorInfo} />
              
              {/* Location, Date, Quantity */}
              <View style={styles.text} />
              <View style={styles.text} />
              <View style={styles.text} />
              
              {/* Price and Icons */}
              <View style={styles.moneyRateContainer}>
                <View style={styles.money} />
                <View style={styles.iconGroup}>
                  <View style={styles.icon} />
                  <View style={styles.icon} />
                </View>
              </View>
              
              {/* Rent Button */}
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
    paddingHorizontal: 10,
  },
  itemContainer: {
    width: "48%",
    marginBottom: 15,
  },
  itemBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 10,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
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
    width: "80%",
    height: 16,
    marginBottom: 5,
  },
  lessorInfo: {
    width: "70%",
    height: 12,
    marginBottom: 8,
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
    width: "100%",
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
  },
  rentButton: {
    width: "70%",
    height: 30,
    borderRadius: 10,
    marginTop: 10,
    alignSelf: "flex-end",
  },
});

export default SkeletonLoadingHome;