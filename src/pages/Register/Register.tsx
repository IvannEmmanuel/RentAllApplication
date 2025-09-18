import { ImageBackground, StyleSheet, Text, TextInput, View, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import React, { useState } from 'react';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';

const Register = () => {
    const [isDatePickerVisible, setDatePickerVisible] = useState(false);
    const [birthdate, setBirthdate] = useState('');
    const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

    const showDatePicker = () => setDatePickerVisible(true);
    const hideDatePicker = () => setDatePickerVisible(false);

    const handleConfirm = (date: Date) => {
        const formatted = date.toLocaleDateString();
        setBirthdate(formatted);
        hideDatePicker();
    };

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            alert('Permission to access media library is required!');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 1,
        });

        if (!result.canceled) {
            const uri = result.assets[0].uri;
            const fileName = uri.split('/').pop() || 'Selected Image';
            setSelectedFileName(fileName);
        }
    };

    const navigation = useNavigation();

    const handleLogin = () => {
        navigation.navigate('Login')
    }

    return (
        <KeyboardAvoidingView
            style={{ flex: 1 }}
        >
            <ScrollView
                contentContainerStyle={{ paddingBottom: 40 }}
                keyboardShouldPersistTaps="handled"
            >
                <ImageBackground
                    source={require('../../../assets/registerBackground.png')}
                    style={styles.background}
                >
                    <Text style={styles.header}>Registration</Text>

                    <View style={styles.nameRow}>
                        <View style={styles.nameColumn}>
                            <Text style={styles.fieldLabel}>First Name</Text>
                            <TextInput
                                placeholder="First Name"
                                placeholderTextColor="#A1A1A1"
                                style={styles.inputLeft}
                            />
                        </View>

                        <View style={styles.nameColumn}>
                            <Text style={styles.fieldLabel}>Last Name</Text>
                            <TextInput
                                placeholder="Last Name"
                                placeholderTextColor="#A1A1A1"
                                style={styles.inputRight}
                            />
                        </View>
                    </View>

                    <View style={styles.birthdateContainer}>
                        <Text style={styles.label}>Birthdate</Text>
                        <TouchableOpacity style={styles.dateButton} onPress={showDatePicker}>
                            <Text style={styles.dateText}>
                                {birthdate || 'Select Date'}
                            </Text>
                        </TouchableOpacity>

                        <View style={styles.emailColumn}>
                            <Text style={styles.fieldLabel}>Email</Text>
                            <TextInput
                                placeholder="Email"
                                placeholderTextColor="#A1A1A1"
                                style={styles.fullWidthInput}
                            />
                        </View>

                        <Text style={styles.fieldLabel}>Upload a capture image</Text>
                        <TouchableOpacity style={styles.uploadButton} onPress={pickImage}>
                            <Text style={styles.uploadButtonText}>
                                {selectedFileName || 'Upload image'}
                            </Text>
                        </TouchableOpacity>

                        <View style={styles.emailColumn}>
                            <Text style={styles.fieldLabel}>Password</Text>
                            <TextInput
                                placeholder="Password"
                                placeholderTextColor="#A1A1A1"
                                style={styles.fullWidthInput}
                            />
                        </View>
                        <View style={styles.emailColumn}>
                            <Text style={styles.fieldLabel}>Confirm Password</Text>
                            <TextInput
                                placeholder="Confirm Password"
                                placeholderTextColor="#A1A1A1"
                                style={styles.fullWidthInput}
                            />
                        </View>
                        <View style={{ flexDirection: 'row', marginBottom: 20 }}>
                            <Text>By clicking next, you agree to our</Text>
                            <TouchableOpacity>
                                <Text style={{ color: '#FFAB00', paddingLeft: 10 }}>Terms and Conditions</Text>
                            </TouchableOpacity>
                        </View>
                        <TouchableOpacity style={{ backgroundColor: '#1E1E1E', height: 60, borderRadius: 20, justifyContent: 'center' }}>
                            <Text style={{ color: 'white', alignSelf: 'center', fontSize: 15, fontFamily: 'DM-Bold' }}>Next</Text>
                        </TouchableOpacity>
                        <View style={{ flexDirection: 'row', marginTop: 20 }}>
                            <Text style={{ fontFamily: 'DM-Medium', fontSize: 15 }}>Already have an account?</Text>
                            <TouchableOpacity style={{ marginBottom: 20 }} onPress={handleLogin}>
                                <Text style={{ color: '#FFAB00', fontFamily: 'DM-Bold', fontSize: 15, paddingLeft: 5 }}>Login</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <DateTimePickerModal
                        isVisible={isDatePickerVisible}
                        mode="date"
                        onConfirm={handleConfirm}
                        onCancel={hideDatePicker}
                    />
                </ImageBackground>
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

export default Register;

const styles = StyleSheet.create({
    background: {
        flex: 1,
        top: 30,
    },
    header: {
        color: 'white',
        fontFamily: 'DM-Bold',
        fontSize: 32,
        top: 20,
        paddingHorizontal: 20,
    },
    nameRow: {
        marginTop: 100,
        flexDirection: 'row',
        alignSelf: 'center',
    },
    inputLeft: {
        paddingLeft: 10,
        height: 50,
        borderWidth: 1,
        borderColor: '#000',
        borderRadius: 20,
        marginRight: 10,
        color: 'black',
    },
    inputRight: {
        paddingLeft: 10,
        height: 50,
        borderWidth: 1,
        borderColor: '#000',
        borderRadius: 20,
        color: 'black',
    },
    fullWidthInput: {
        paddingLeft: 10,
        height: 50,
        borderWidth: 1,
        borderColor: '#000',
        borderRadius: 20,
        color: 'black',
        width: '100%',
    },
    birthdateContainer: {
        marginTop: 20,
        paddingHorizontal: 20,
    },
    label: {
        color: 'black',
        fontSize: 16,
        marginBottom: 5,
        fontFamily: 'DM-Bold',
    },
    dateButton: {
        height: 50,
        borderWidth: 1,
        borderColor: '#000',
        borderRadius: 20,
        justifyContent: 'center',
        paddingLeft: 10,
        marginBottom: 20,
    },
    dateText: {
        color: 'black',
        fontSize: 16,
    },
    nameColumn: {
        flexDirection: 'column',
        width: '45%',
    },
    fieldLabel: {
        color: 'black',
        fontSize: 16,
        marginBottom: 5,
        fontFamily: 'DM-Bold',
    },
    emailColumn: {
        flexDirection: 'column',
        width: '100%',
        marginBottom: 20,
    },
    uploadButton: {
        borderWidth: 1,
        borderColor: "#1E1E1E",
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
        marginBottom: 20,
    },
    uploadButtonText: {
        color: 'black',
        fontSize: 16,
    },
});