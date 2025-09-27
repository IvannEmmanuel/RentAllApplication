import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useState, useEffect } from 'react';
import { supabase } from '../../supbaseClient'; // Adjust path as needed
import LandingPage from '../pages/LandingPage';
import Login from '../pages/Login/Login';
import Register from '../pages/Register/Register';
import Otp from '../pages/Register/Otp';
import Face from '../pages/Register/Face';
import { RegistrationProvider } from '../hooks/RegistrationContext';
import Home from '../pages/Screens/Home';
import Dashboard from '../pages/Dashboard/Dashboard';
import FavoriteModal from './FavoriteModal';
import ActiveRental from './ActiveRentalModal';
import { NotificationModalProvider } from './NotificationModalContext';
import AppModals from './AppModals';
import { FavoritesProvider } from './FavoritesContext';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
    const [currentUser, setCurrentUser] = useState(null);

    // Get current user on app start
    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
                // Fetch full user data
                supabase
                    .from('users')
                    .select('*')
                    .eq('id', session.user.id)
                    .single()
                    .then(({ data }) => {
                        if (data) setCurrentUser(data);
                    });
            }
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session?.user) {
                // Fetch full user data
                const { data } = await supabase
                    .from('users')
                    .select('*')
                    .eq('id', session.user.id)
                    .single();
                
                if (data) setCurrentUser(data);
            } else if (event === 'SIGNED_OUT') {
                setCurrentUser(null);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    return (
        <NotificationModalProvider>
            <FavoritesProvider>
                <RegistrationProvider>
                    <NavigationContainer>
                        <Stack.Navigator initialRouteName="LandingPage" screenOptions={{ headerShown: false }}>
                            <Stack.Screen name="LandingPage" component={LandingPage} />
                            <Stack.Screen name="Login" component={Login} />
                            <Stack.Screen name="Register" component={Register} />
                            <Stack.Screen name="Otp" component={Otp} />
                            <Stack.Screen name="Face" component={Face} />
                            <Stack.Screen name="Home" component={Home} />
                            <Stack.Screen name="Dashboard" component={Dashboard} />
                            <Stack.Screen name="Favorites" component={FavoriteModal} />
                            <Stack.Screen name="ActiveRental" component={ActiveRental} />
                        </Stack.Navigator>
                    </NavigationContainer>
                    <AppModals currentUser={currentUser} />
                </RegistrationProvider>
            </FavoritesProvider>
        </NotificationModalProvider>
    );
}