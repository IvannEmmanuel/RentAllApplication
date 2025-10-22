import { ImageBackground, StyleSheet, Text, TextInput, View, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Alert, Dimensions } from 'react-native';
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
    const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    const phoneRegex = /^(09\d{9}|(\+63)\d{10})$/;

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

    const today = new Date();
    const birthDate = new Date(formData.dob);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }

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

    const handleTerms = () => {
        navigation.navigate('Terms' as never);
    }

    const handleLogin = () => {
        navigation.navigate('Login' as never);
    };

    const handleNext = async () => {
        // Validations (keep your existing ones)
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
        if (!strongPasswordRegex.test(formData.password)) {
            Alert.alert(
                'Weak Password',
                'Password must have:\n• At least 8 characters\n• 1 uppercase letter (A-Z)\n• 1 lowercase letter (a-z)\n• 1 number (0-9)\n• 1 special character (!@#$%^&*)'
            );
            return;
        }
        if (age < 18) {
            Alert.alert('Age Restriction', 'You must be at least 18 years old to register.');
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
        if (!phoneRegex.test(formData.phone)) {
            Alert.alert(
                'Invalid Phone Number',
                'Please enter a valid Philippine phone number.\nAccepted formats:\n• 09123456789 (11 digits)\n• +639123456789'
            );
            return;
        }

        try {
            setLoading(true);

            // ✅ Step 1: Check if email already exists in Supabase
            const { error: existingUserError } = await supabase.auth.signInWithOtp({
                email: formData.email,
                options: { shouldCreateUser: false }, // do NOT create user if email doesn't exist
            });

            if (!existingUserError) {
                // Means email already exists, stop registration
                Alert.alert('Email Exists', 'This email is already registered. Please use a different email or login.');
                setLoading(false);
                return;
            }

            // If error.code == 'user_not_found', it means email is new → proceed with sending OTP

            // ✅ Step 2: Save data to context
            updateRegistrationData({
                ...formData,
                dob: formData.dob?.toISOString(),
                location: location,
            });

            // ✅ Step 3: Send OTP & create user
            const { error } = await supabase.auth.signInWithOtp({
                email: formData.email,
                options: {
                    shouldCreateUser: true,
                },
            });

            if (error) throw error;

            Alert.alert('Success', `OTP sent to ${formData.email}`);
            navigation.navigate('Otp' as never, { formData: { email: formData.email } } as never);

        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : -100}
        >
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContentContainer}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                bounces={false}
            >
                <ImageBackground
                    source={require('../../../assets/registerBackground.png')}
                    style={styles.background}
                    resizeMode="cover"
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
                                keyboardType="phone-pad"
                                onChangeText={(text) => {
                                    // Remove all non-numeric except +
                                    let cleaned = text.replace(/[^0-9+]/g, '');

                                    // Auto-add +63 if user starts typing 9
                                    if (cleaned.startsWith('9')) {
                                        cleaned = '+63' + cleaned;
                                    }

                                    // Prevent extra characters beyond +639XXXXXXXXX
                                    if (cleaned.startsWith('+63') && cleaned.length > 13) return;
                                    if (!cleaned.startsWith('+63') && cleaned.length > 11) return;

                                    setFormData(prev => ({ ...prev, phone: cleaned }));
                                }}
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
                            <TouchableOpacity onPress={handleTerms}>
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

                        <View style={{ flexDirection: 'row', marginTop: 20, marginBottom: 20 }}>
                            <Text style={{ fontFamily: 'DM-Medium', fontSize: 15 }}>Already have an account?</Text>
                            <TouchableOpacity onPress={handleLogin}>
                                <Text style={{ color: '#FFAB00', fontFamily: 'DM-Bold', fontSize: 15, paddingLeft: 5 }}>Login</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </ImageBackground>
            </ScrollView>

            <DateTimePickerModal
                isVisible={isDatePickerVisible}
                mode="date"
                onConfirm={handleConfirm}
                onCancel={hideDatePicker}
                maximumDate={new Date()}
            />
        </KeyboardAvoidingView>
    );
};

export default Register;

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollView: {
        flex: 1,
    },
    scrollContentContainer: {
        // No extra properties to avoid conflicts
    },
    background: {
        minHeight: Dimensions.get('window').height,
        paddingTop: 30,
    },
    header: {
        color: 'white',
        fontFamily: 'DM-Bold',
        fontSize: 32,
        marginTop: 20,
        paddingHorizontal: 20,
    },
    nameRow: {
        marginTop: 50,
        flexDirection: 'row',
        alignSelf: 'center',
        paddingHorizontal: 20,
    },
    inputLeft: {
        paddingLeft: 10,
        height: 50,
        borderWidth: 1,
        borderColor: '#000',
        borderRadius: 20,
        marginRight: 10,
        color: 'black',
        backgroundColor: 'white',
    },
    inputRight: {
        paddingLeft: 10,
        height: 50,
        borderWidth: 1,
        borderColor: '#000',
        borderRadius: 20,
        color: 'black',
        backgroundColor: 'white',
    },
    fullWidthInput: {
        paddingLeft: 10,
        height: 50,
        borderWidth: 1,
        borderColor: '#000',
        borderRadius: 20,
        color: 'black',
        width: '100%',
        backgroundColor: 'white',
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
        backgroundColor: 'white',
    },
    dateText: {
        color: 'black',
        fontSize: 16,
    },
    nameColumn: {
        flexDirection: 'column',
        width: '50%'
    },
    fieldLabel: {
        color: 'black',
        fontSize: 16,
        marginBottom: 5,
        fontFamily: 'DM-Bold'
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
        backgroundColor: 'white',
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