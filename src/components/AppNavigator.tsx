import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LandingPage from '../pages/LandingPage';
import Login from '../pages/Login/Login';
import Register from '../pages/Register/Register';
import Otp from '../pages/Register/Otp';
import Face from '../pages/Register/Face';
import { RegistrationProvider } from '../hooks/RegistrationContext';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
    return (
        <RegistrationProvider>
            <NavigationContainer>
                <Stack.Navigator initialRouteName="LandingPage" screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="LandingPage" component={LandingPage} />
                    <Stack.Screen name="Login" component={Login} />
                    <Stack.Screen name="Register" component={Register} />
                    <Stack.Screen name="Otp" component={Otp} />
                    <Stack.Screen name="Face" component={Face} />
                </Stack.Navigator>
            </NavigationContainer>
        </RegistrationProvider>
    );
}