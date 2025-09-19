// import { ImageBackground, StyleSheet, Text, TextInput, View, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
// import React, { useState } from 'react';
// import DateTimePickerModal from 'react-native-modal-datetime-picker';
// import * as ImagePicker from 'expo-image-picker';
// import { useNavigation } from '@react-navigation/native';

// const Register = () => {
//     const [isDatePickerVisible, setDatePickerVisible] = useState(false);
//     const [birthdate, setBirthdate] = useState('');
//     const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

//     const showDatePicker = () => setDatePickerVisible(true);
//     const hideDatePicker = () => setDatePickerVisible(false);

//     const handleConfirm = (date: Date) => {
//         const formatted = date.toLocaleDateString();
//         setBirthdate(formatted);
//         hideDatePicker();
//     };

//     const pickImage = async () => {
//         const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
//         if (status !== 'granted') {
//             alert('Permission to access media library is required!');
//             return;
//         }

//         const result = await ImagePicker.launchImageLibraryAsync({
//             mediaTypes: ImagePicker.MediaTypeOptions.Images,
//             allowsEditing: true,
//             aspect: [4, 3],
//             quality: 1,
//         });

//         if (!result.canceled) {
//             const uri = result.assets[0].uri;
//             const fileName = uri.split('/').pop() || 'Selected Image';
//             setSelectedFileName(fileName);
//         }
//     };

//     const navigation = useNavigation();

//     const handleLogin = () => {
//         navigation.navigate('Login')
//     }

//     const handleNext = () => {
//         navigation.navigate('Otp')
//     }

//     return (
//         <KeyboardAvoidingView
//             style={{ flex: 1 }}
//         >
//             <ScrollView
//                 contentContainerStyle={{ paddingBottom: 40 }}
//                 keyboardShouldPersistTaps="handled"
//             >
//                 <ImageBackground
//                     source={require('../../../assets/registerBackground.png')}
//                     style={styles.background}
//                 >
//                     <Text style={styles.header}>Registration</Text>

//                     <View style={styles.nameRow}>
//                         <View style={styles.nameColumn}>
//                             <Text style={styles.fieldLabel}>First Name</Text>
//                             <TextInput
//                                 placeholder="First Name"
//                                 placeholderTextColor="#A1A1A1"
//                                 style={styles.inputLeft}
//                             />
//                         </View>

//                         <View style={styles.nameColumn}>
//                             <Text style={styles.fieldLabel}>Last Name</Text>
//                             <TextInput
//                                 placeholder="Last Name"
//                                 placeholderTextColor="#A1A1A1"
//                                 style={styles.inputRight}
//                             />
//                         </View>
//                     </View>

//                     <View style={styles.birthdateContainer}>
//                         <Text style={styles.label}>Birthdate</Text>
//                         <TouchableOpacity style={styles.dateButton} onPress={showDatePicker}>
//                             <Text style={styles.dateText}>
//                                 {birthdate || 'Select Date'}
//                             </Text>
//                         </TouchableOpacity>

//                         <View style={styles.emailColumn}>
//                             <Text style={styles.fieldLabel}>Email</Text>
//                             <TextInput
//                                 placeholder="Email"
//                                 placeholderTextColor="#A1A1A1"
//                                 style={styles.fullWidthInput}
//                             />
//                         </View>

//                         <Text style={styles.fieldLabel}>Upload a capture image</Text>
//                         <TouchableOpacity style={styles.uploadButton} onPress={pickImage}>
//                             <Text style={styles.uploadButtonText}>
//                                 {selectedFileName || 'Upload image'}
//                             </Text>
//                         </TouchableOpacity>

//                         <View style={styles.emailColumn}>
//                             <Text style={styles.fieldLabel}>Password</Text>
//                             <TextInput
//                                 placeholder="Password"
//                                 placeholderTextColor="#A1A1A1"
//                                 style={styles.fullWidthInput}
//                             />
//                         </View>
//                         <View style={styles.emailColumn}>
//                             <Text style={styles.fieldLabel}>Confirm Password</Text>
//                             <TextInput
//                                 placeholder="Confirm Password"
//                                 placeholderTextColor="#A1A1A1"
//                                 style={styles.fullWidthInput}
//                             />
//                         </View>
//                         <View style={{ flexDirection: 'row', marginBottom: 20 }}>
//                             <Text>By clicking next, you agree to our</Text>
//                             <TouchableOpacity>
//                                 <Text style={{ color: '#FFAB00', paddingLeft: 10 }}>Terms and Conditions</Text>
//                             </TouchableOpacity>
//                         </View>
//                         <TouchableOpacity style={{ backgroundColor: '#1E1E1E', height: 60, borderRadius: 20, justifyContent: 'center' }} onPress={handleNext}>
//                             <Text style={{ color: 'white', alignSelf: 'center', fontSize: 15, fontFamily: 'DM-Bold' }}>Next</Text>
//                         </TouchableOpacity>
//                         <View style={{ flexDirection: 'row', marginTop: 20 }}>
//                             <Text style={{ fontFamily: 'DM-Medium', fontSize: 15 }}>Already have an account?</Text>
//                             <TouchableOpacity style={{ marginBottom: 20 }} onPress={handleLogin}>
//                                 <Text style={{ color: '#FFAB00', fontFamily: 'DM-Bold', fontSize: 15, paddingLeft: 5 }}>Login</Text>
//                             </TouchableOpacity>
//                         </View>
//                     </View>

//                     <DateTimePickerModal
//                         isVisible={isDatePickerVisible}
//                         mode="date"
//                         onConfirm={handleConfirm}
//                         onCancel={hideDatePicker}
//                     />
//                 </ImageBackground>
//             </ScrollView>
//         </KeyboardAvoidingView>
//     );
// };

// export default Register;

// const styles = StyleSheet.create({
//     background: {
//         flex: 1,
//         top: 30,
//     },
//     header: {
//         color: 'white',
//         fontFamily: 'DM-Bold',
//         fontSize: 32,
//         top: 20,
//         paddingHorizontal: 20,
//     },
//     nameRow: {
//         marginTop: 100,
//         flexDirection: 'row',
//         alignSelf: 'center',
//     },
//     inputLeft: {
//         paddingLeft: 10,
//         height: 50,
//         borderWidth: 1,
//         borderColor: '#000',
//         borderRadius: 20,
//         marginRight: 10,
//         color: 'black',
//     },
//     inputRight: {
//         paddingLeft: 10,
//         height: 50,
//         borderWidth: 1,
//         borderColor: '#000',
//         borderRadius: 20,
//         color: 'black',
//     },
//     fullWidthInput: {
//         paddingLeft: 10,
//         height: 50,
//         borderWidth: 1,
//         borderColor: '#000',
//         borderRadius: 20,
//         color: 'black',
//         width: '100%',
//     },
//     birthdateContainer: {
//         marginTop: 20,
//         paddingHorizontal: 20,
//     },
//     label: {
//         color: 'black',
//         fontSize: 16,
//         marginBottom: 5,
//         fontFamily: 'DM-Bold',
//     },
//     dateButton: {
//         height: 50,
//         borderWidth: 1,
//         borderColor: '#000',
//         borderRadius: 20,
//         justifyContent: 'center',
//         paddingLeft: 10,
//         marginBottom: 20,
//     },
//     dateText: {
//         color: 'black',
//         fontSize: 16,
//     },
//     nameColumn: {
//         flexDirection: 'column',
//         width: '45%',
//     },
//     fieldLabel: {
//         color: 'black',
//         fontSize: 16,
//         marginBottom: 5,
//         fontFamily: 'DM-Bold',
//     },
//     emailColumn: {
//         flexDirection: 'column',
//         width: '100%',
//         marginBottom: 20,
//     },
//     uploadButton: {
//         borderWidth: 1,
//         borderColor: "#1E1E1E",
//         paddingVertical: 12,
//         borderRadius: 10,
//         alignItems: 'center',
//         marginBottom: 20,
//     },
//     uploadButtonText: {
//         color: 'black',
//         fontSize: 16,
//     },
// });

import { ImageBackground, StyleSheet, Text, TextInput, View, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import React, { useState } from 'react';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../../supbaseClient';
import { useRegistration } from '../../hooks/RegistrationContext';

const Register = () => {
    const [isDatePickerVisible, setDatePickerVisible] = useState(false);
    const [birthdate, setBirthdate] = useState('');
    const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [location, setLocation] = useState<{ lat: number | null; lng: number | null }>({ lat: null, lng: null });
    const { updateRegistrationData } = useRegistration();

    // Form data state
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        confirmPassword: '',
        phone: '',
        dob: null as Date | null,
        idImage: null as any,
    });

    const navigation = useNavigation();

    const showDatePicker = () => setDatePickerVisible(true);
    const hideDatePicker = () => setDatePickerVisible(false);

    const handleConfirm = (date: Date) => {
        const formatted = date.toLocaleDateString();
        setBirthdate(formatted);
        setFormData(prev => ({ ...prev, dob: date }));
        hideDatePicker();
    };

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Required', 'Permission to access media library is required!');
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

            // Create a file-like object for the image
            const imageFile = {
                uri: uri,
                type: result.assets[0].type || 'image/jpeg',
                name: fileName,
            };
            setFormData(prev => ({ ...prev, idImage: imageFile }));
        }
    };

    const getUserLocation = async () => {
        try {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Denied', 'Permission to access location was denied');
                return;
            }

            let locationResult = await Location.getCurrentPositionAsync({});
            setLocation({
                lat: locationResult.coords.latitude,
                lng: locationResult.coords.longitude,
            });
            Alert.alert('Success', 'Location captured successfully!');
        } catch (error) {
            Alert.alert('Error', 'Failed to get location');
        }
    };

    const handleLogin = () => {
        navigation.navigate('Login' as never);
    };

    const handleNext = async () => {
        // Validation
        if (!formData.firstName || !formData.lastName) {
            Alert.alert('Error', 'Please enter your first and last name.');
            return;
        }
        if (!formData.email) {
            Alert.alert('Error', 'Please enter your email.');
            return;
        }
        if (!formData.password || !formData.confirmPassword) {
            Alert.alert('Error', 'Please enter and confirm your password.');
            return;
        }
        if (formData.password !== formData.confirmPassword) {
            Alert.alert('Error', 'Passwords do not match.');
            return;
        }
        if (formData.password.length < 8) {
            Alert.alert('Error', 'Password must be at least 8 characters.');
            return;
        }
        if (!formData.dob) {
            Alert.alert('Error', 'Please select your birthdate.');
            return;
        }
        if (!formData.idImage) {
            Alert.alert('Error', 'Please upload your ID image.');
            return;
        }

        try {
            setLoading(true);

            const dataToStore = {
                firstName: formData.firstName,
                lastName: formData.lastName,
                email: formData.email,
                password: formData.password,
                phone: formData.phone,
                dob: formData.dob?.toISOString(), // Serialize date
                idImage: formData.idImage,
                location: location
            };

            updateRegistrationData(dataToStore);

            // Send OTP using Supabase
            const { error } = await supabase.auth.signInWithOtp({
                email: formData.email,
                options: {
                    shouldCreateUser: true,
                },
            });

            if (error) throw error;

            Alert.alert('Success', `OTP sent to ${formData.email}`);

            // Navigate to OTP screen with form data
            navigation.navigate('Otp' as never, {
                formData: {
                    email: formData.email
                }
            } as never);

        } catch (error: any) {
            Alert.alert('Error', `Failed to send OTP: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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
                                value={formData.firstName}
                                onChangeText={(text) => setFormData(prev => ({ ...prev, firstName: text }))}
                            />
                        </View>

                        <View style={styles.nameColumn}>
                            <Text style={styles.fieldLabel}>Last Name</Text>
                            <TextInput
                                placeholder="Last Name"
                                placeholderTextColor="#A1A1A1"
                                style={styles.inputRight}
                                value={formData.lastName}
                                onChangeText={(text) => setFormData(prev => ({ ...prev, lastName: text }))}
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
                            <Text style={styles.fieldLabel}>Phone</Text>
                            <TextInput
                                placeholder="Phone Number"
                                placeholderTextColor="#A1A1A1"
                                style={styles.fullWidthInput}
                                value={formData.phone}
                                onChangeText={(text) => setFormData(prev => ({ ...prev, phone: text }))}
                                keyboardType="phone-pad"
                            />
                        </View>

                        <View style={styles.emailColumn}>
                            <Text style={styles.fieldLabel}>Email</Text>
                            <TextInput
                                placeholder="Email"
                                placeholderTextColor="#A1A1A1"
                                style={styles.fullWidthInput}
                                value={formData.email}
                                onChangeText={(text) => setFormData(prev => ({ ...prev, email: text }))}
                                keyboardType="email-address"
                                autoCapitalize="none"
                            />
                        </View>

                        {/* Location Button */}
                        <View style={styles.emailColumn}>
                            <Text style={styles.fieldLabel}>Location</Text>
                            <TouchableOpacity style={styles.locationButton} onPress={getUserLocation}>
                                <Text style={styles.locationButtonText}>
                                    {location.lat ? `Lat: ${location.lat.toFixed(4)}, Lng: ${location.lng?.toFixed(4)}` : 'Get My Location'}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.fieldLabel}>Upload a valid ID image</Text>
                        <TouchableOpacity style={styles.uploadButton} onPress={pickImage}>
                            <Text style={styles.uploadButtonText}>
                                {selectedFileName || 'Upload ID image'}
                            </Text>
                        </TouchableOpacity>

                        <View style={styles.emailColumn}>
                            <Text style={styles.fieldLabel}>Password</Text>
                            <TextInput
                                placeholder="Password"
                                placeholderTextColor="#A1A1A1"
                                style={styles.fullWidthInput}
                                value={formData.password}
                                onChangeText={(text) => setFormData(prev => ({ ...prev, password: text }))}
                                secureTextEntry
                            />
                        </View>

                        <View style={styles.emailColumn}>
                            <Text style={styles.fieldLabel}>Confirm Password</Text>
                            <TextInput
                                placeholder="Confirm Password"
                                placeholderTextColor="#A1A1A1"
                                style={styles.fullWidthInput}
                                value={formData.confirmPassword}
                                onChangeText={(text) => setFormData(prev => ({ ...prev, confirmPassword: text }))}
                                secureTextEntry
                            />
                        </View>

                        <View style={{ flexDirection: 'row', marginBottom: 20 }}>
                            <Text>By clicking next, you agree to our</Text>
                            <TouchableOpacity>
                                <Text style={{ color: '#FFAB00', paddingLeft: 10 }}>Terms and Conditions</Text>
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity
                            style={[
                                { backgroundColor: '#1E1E1E', height: 60, borderRadius: 20, justifyContent: 'center' },
                                loading && { opacity: 0.6 }
                            ]}
                            onPress={handleNext}
                            disabled={loading}
                        >
                            <Text style={{ color: 'white', alignSelf: 'center', fontSize: 15, fontFamily: 'DM-Bold' }}>
                                {loading ? 'Sending OTP...' : 'Next'}
                            </Text>
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
                        maximumDate={new Date()}
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
    locationButton: {
        height: 50,
        borderWidth: 1,
        borderColor: '#000',
        borderRadius: 20,
        justifyContent: 'center',
        paddingLeft: 10,
        backgroundColor: 'white',
    },
    locationButtonText: {
        color: 'black',
        fontSize: 16,
    },
});