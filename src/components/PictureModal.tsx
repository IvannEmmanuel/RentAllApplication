import React from "react"
import { Modal, View, Text, Image, StyleSheet, TouchableOpacity } from "react-native"

const PictureModal = ({ visible, onClose, item }) => {
  if (!item) return null

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <Image
            source={item.imageUrl ? { uri: item.imageUrl } : require("../../assets/splash-icon.png")}
            style={styles.fullImage}
            resizeMode="contain"
          />
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.description}>{item.description || "No description available"}</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

export default PictureModal

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 12,
    width: "85%",
    alignItems: "center",
  },
  fullImage: {
    width: "100%",
    height: 250,
    marginBottom: 15,
    borderRadius: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
    textAlign: "center",
  },
  description: {
    fontSize: 14,
    color: "#444",
    marginBottom: 15,
    textAlign: "center",
  },
  closeButton: {
    backgroundColor: "#FFAB00",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  closeText: {
    color: "#fff",
    fontWeight: "bold",
  },
})
