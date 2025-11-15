import { ImageBackground, StyleSheet, Text, TextInput, View, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Alert, Dimensions, Image } from 'react-native';
import React, { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../../supbaseClient';
import { useRegistration } from '../../hooks/RegistrationContext';
import { Calendar } from "react-native-calendars";
import Modal from "react-native-modal";

const Register = () => {
    const [isDatePickerVisible, setDatePickerVisible] = useState(false);
    const [birthdate, setBirthdate] = useState('');
    const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [location, setLocation] = useState<{ lat: number | null; lng: number | null }>({ lat: null, lng: null });
    const { updateRegistrationData } = useRegistration();
    const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const phoneRegex = /^(09\d{9}|(\+63)\d{10})$/;
    const [isCalendarVisible, setCalendarVisible] = useState(false);
    const [birthday, setBirthday] = useState("");
    const [calendarKey, setCalendarKey] = useState(0);
    const [isImagePickerModalVisible, setImagePickerModalVisible] = useState(false);

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
        setImagePickerModalVisible(true);
    };

    const takePhoto = async () => {
        setImagePickerModalVisible(false);

        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Required', 'Permission to access camera is required!');
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 1,
        });

        if (!result.canceled) {
            const uri = result.assets[0].uri;
            const fileName = `ID_${Date.now()}.jpg`;
            setSelectedFileName(fileName);

            const imageFile = {
                uri: uri,
                type: 'image/jpeg',
                name: fileName,
            };
            setFormData(prev => ({ ...prev, idImage: imageFile }));
        }
    };

    const chooseFromGallery = async () => {
        setImagePickerModalVisible(false);

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
                        <TouchableOpacity
                            style={styles.dateButton}
                            onPress={() => setCalendarVisible(true)}
                        >
                            <Text style={{ color: birthday ? "#000" : "#A1A1A1" }}>
                                {birthday || "Select Birthday"}
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
                            <View style={{ position: 'relative' }}>
                                <TextInput
                                    placeholder="Password"
                                    placeholderTextColor="#A1A1A1"
                                    style={styles.fullWidthInput}
                                    value={formData.password}
                                    onChangeText={(text) => setFormData(prev => ({ ...prev, password: text }))}
                                    secureTextEntry={!showPassword}
                                />

                                <TouchableOpacity
                                    onPress={() => setShowPassword(!showPassword)}
                                    style={{ position: 'absolute', right: 15, top: 12 }}
                                >
                                    <Image
                                        source={
                                            showPassword
                                                ? require('../../../assets/hidePassword.png')
                                                : require('../../../assets/showPassword.png')
                                        }
                                        style={{ width: 24, height: 24 }}
                                    />
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View style={styles.emailColumn}>
                            <Text style={styles.fieldLabel}>Confirm Password</Text>
                            <View style={{ position: 'relative' }}>
                                <TextInput
                                    placeholder="Confirm Password"
                                    placeholderTextColor="#A1A1A1"
                                    style={styles.fullWidthInput}
                                    value={formData.confirmPassword}
                                    onChangeText={(text) => setFormData(prev => ({ ...prev, confirmPassword: text }))}
                                    secureTextEntry={!showConfirmPassword}
                                />

                                <TouchableOpacity
                                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                                    style={{ position: 'absolute', right: 15, top: 12 }}
                                >
                                    <Image
                                        source={
                                            showConfirmPassword
                                                ? require('../../../assets/hidePassword.png')
                                                : require('../../../assets/showPassword.png')
                                        }
                                        style={{ width: 24, height: 24 }}
                                    />
                                </TouchableOpacity>
                            </View>
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

            <Modal
                isVisible={isCalendarVisible}
                onBackdropPress={() => setCalendarVisible(false)}
                style={{ margin: 0, justifyContent: "flex-end" }}
                swipeDirection={['down']}
                onSwipeComplete={() => setCalendarVisible(false)}
            >
                <ScrollView
                    style={{
                        backgroundColor: "white",
                        borderTopLeftRadius: 24,
                        borderTopRightRadius: 24,
                        maxHeight: '85%',
                    }}
                    contentContainerStyle={{ padding: 20, paddingBottom: 30 }}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Handle Bar */}
                    <View
                        style={{
                            width: 50,
                            height: 5,
                            backgroundColor: '#CCCCCC',
                            borderRadius: 2.5,
                            alignSelf: 'center',
                            marginBottom: 20,
                        }}
                    />

                    <Text style={{ fontSize: 20, fontWeight: "bold", marginBottom: 20 }}>
                        Select Your Birthday
                    </Text>

                    {/* Year Selector */}
                    <View style={{ marginBottom: 20 }}>
                        <Text style={{ fontSize: 14, color: '#666', marginBottom: 10, fontWeight: '600' }}>
                            Year
                        </Text>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={{ paddingVertical: 10 }}
                        >
                            {Array.from({ length: 100 }, (_, i) => new Date().getFullYear() - i).map((year) => {
                                const birthdayYear = birthday ? new Date(birthday).getFullYear().toString() : '';
                                return (
                                    <TouchableOpacity
                                        key={year}
                                        onPress={() => {
                                            let newDate;
                                            if (birthday) {
                                                newDate = new Date(birthday);
                                                newDate.setFullYear(year);
                                            } else {
                                                newDate = new Date();
                                                newDate.setFullYear(year);
                                            }
                                            const dateString = newDate.toISOString().split('T')[0];
                                            setBirthday(dateString);
                                            setCalendarKey(prev => prev + 1); // Force calendar re-render
                                        }}
                                        style={{
                                            paddingHorizontal: 16,
                                            paddingVertical: 10,
                                            marginRight: 10,
                                            borderRadius: 20,
                                            backgroundColor: birthdayYear === year.toString() ? '#FFAB00' : '#F0F0F0',
                                            minWidth: 60,
                                            alignItems: 'center',
                                        }}
                                    >
                                        <Text
                                            style={{
                                                fontSize: 16,
                                                fontWeight: '600',
                                                color: birthdayYear === year.toString() ? 'white' : '#333',
                                            }}
                                        >
                                            {year}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>

                    {/* Month & Day Selector */}
                    <View style={{ marginBottom: 20 }}>
                        <Text style={{ fontSize: 14, color: '#666', marginBottom: 10, fontWeight: '600' }}>
                            Month & Day
                        </Text>
                        <Calendar
                            key={calendarKey}
                            onDayPress={(day) => {
                                setBirthday(day.dateString);
                                setCalendarVisible(false);
                            }}
                            maxDate={new Date().toISOString().split("T")[0]}
                            markedDates={{
                                [birthday]: {
                                    selected: true,
                                    selectedColor: "#FFAB00",
                                },
                            }}
                            theme={{
                                todayTextColor: "#FFAB00",
                                arrowColor: "#FFAB00",
                                selectedDayBackgroundColor: "#FFAB00",
                                textDayFontSize: 16,
                                textMonthFontSize: 18,
                                textDayHeaderFontSize: 13,
                                backgroundColor: '#fff',
                                calendarBackground: '#fff',
                            }}
                            current={birthday || new Date().toISOString().split("T")[0]}
                        />
                    </View>

                    {/* Confirm Button */}
                    <TouchableOpacity
                        onPress={() => {
                            // Update formData with the selected birthday
                            if (birthday) {
                                const selectedDate = new Date(birthday);
                                setFormData(prev => ({ ...prev, dob: selectedDate }));
                            }
                            setCalendarVisible(false);
                        }}
                        style={{
                            backgroundColor: "#FFAB00",
                            paddingVertical: 14,
                            borderRadius: 20,
                            alignItems: 'center',
                            marginTop: 10,
                        }}
                    >
                        <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold' }}>
                            Confirm Birthday
                        </Text>
                    </TouchableOpacity>
                </ScrollView>
            </Modal>

            <Modal
                isVisible={isImagePickerModalVisible}
                onBackdropPress={() => setImagePickerModalVisible(false)}
                style={{ margin: 0, justifyContent: 'flex-end' }}
                swipeDirection={['down']}
                onSwipeComplete={() => setImagePickerModalVisible(false)}
            >
                <View
                    style={{
                        backgroundColor: 'white',
                        borderTopLeftRadius: 24,
                        borderTopRightRadius: 24,
                        paddingHorizontal: 20,
                        paddingTop: 20,
                        paddingBottom: 40,
                    }}
                >
                    {/* Handle Bar */}
                    <View
                        style={{
                            width: 50,
                            height: 5,
                            backgroundColor: '#CCCCCC',
                            borderRadius: 2.5,
                            alignSelf: 'center',
                            marginBottom: 20,
                        }}
                    />

                    <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 5 }}>
                        Capture Your ID
                    </Text>
                    <Text style={{ fontSize: 14, color: '#666', marginBottom: 20 }}>
                        Choose how you want to upload your ID photo
                    </Text>

                    {/* Camera Option */}
                    <TouchableOpacity
                        onPress={takePhoto}
                        style={{
                            backgroundColor: "#FFAB00",
                            borderRadius: 20,
                            paddingVertical: 20,
                            marginBottom: 15,
                            flexDirection: 'row',
                            alignItems: 'center',
                            paddingHorizontal: 20,
                        }}
                    >
                        <Image
                            source={require('../../../assets/camera.png')} // or use an icon library
                            style={{ width: 28, height: 28, marginRight: 15, tintColor: 'white' }}
                        />
                        <View style={{ flex: 1 }}>
                            <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold' }}>
                                Take a Photo
                            </Text>
                            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 4 }}>
                                Use your camera to capture ID
                            </Text>
                        </View>
                    </TouchableOpacity>

                    {/* Gallery Option */}
                    <TouchableOpacity
                        onPress={chooseFromGallery}
                        style={{
                            backgroundColor: '#F0F0F0',
                            borderRadius: 20,
                            paddingVertical: 20,
                            marginBottom: 20,
                            flexDirection: 'row',
                            alignItems: 'center',
                            paddingHorizontal: 20,
                        }}
                    >
                        <Image
                            source={require('../../../assets/gallery.png')} // or use an icon library
                            style={{ width: 28, height: 28, marginRight: 15, tintColor: '#333' }}
                        />
                        <View style={{ flex: 1 }}>
                            <Text style={{ color: '#333', fontSize: 16, fontWeight: 'bold' }}>
                                Choose from Gallery
                            </Text>
                            <Text style={{ color: '#666', fontSize: 12, marginTop: 4 }}>
                                Select from your existing photos
                            </Text>
                        </View>
                    </TouchableOpacity>

                    {/* Cancel Button */}
                    <TouchableOpacity
                        onPress={() => setImagePickerModalVisible(false)}
                        style={{
                            backgroundColor: '#F0F0F0',
                            borderRadius: 20,
                            paddingVertical: 14,
                            alignItems: 'center',
                        }}
                    >
                        <Text style={{ color: '#333', fontSize: 16, fontWeight: '600' }}>
                            Cancel
                        </Text>
                    </TouchableOpacity>
                </View>
            </Modal>
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