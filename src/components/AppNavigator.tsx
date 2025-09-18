import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LandingPage from '../pages/LandingPage';
import Login from '../pages/Login/Login';
import Register from '../pages/Register/Register';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
    return (
        <NavigationContainer>
            <Stack.Navigator initialRouteName="LandingPage" screenOptions={{ headerShown: false }}>
                <Stack.Screen name="LandingPage" component={LandingPage} />
                <Stack.Screen name="Login" component={Login} />
                <Stack.Screen name="Register" component={Register}/>
            </Stack.Navigator>
        </NavigationContainer>
    );
}