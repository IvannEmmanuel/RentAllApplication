import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useState, useEffect } from 'react';
import { AppState } from 'react-native';
import { supabase } from '../../supbaseClient';
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
import LessorReviewsModal from './LessorReviewsModal';
import Chat from '../pages/Screens/Chat';
import LessorReviewee from './LessorReviewee';
import ItemTrackingScreen from './ItemTrackingScreen';
import ItemTrackingLessorScreen from './ItemTrackingLessorScreen';
import Terms from '../pages/Register/Terms';
import ForgotPassword from '../pages/Login/ForgotPassword';
import SplashScreen from './SplashScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
    const [currentUser, setCurrentUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [appState, setAppState] = useState(AppState.currentState);

    useEffect(() => {
        const bootstrapAsync = async () => {
            try {
                // ✅ Check if there's an existing session
                const { data: { session } } = await supabase.auth.getSession();
                
                if (session?.user) {
                    const { data } = await supabase
                        .from('users')
                        .select('*')
                        .eq('id', session.user.id)
                        .single();
                    if (data) {
                        console.log('✅ User session restored:', data.id);
                        setCurrentUser(data);
                    }
                } else {
                    console.log('❌ No session found');
                    setCurrentUser(null);
                }
            } catch (error) {
                console.error('Bootstrap error:', error);
                setCurrentUser(null);
            } finally {
                setIsLoading(false);
            }
        };

        bootstrapAsync();

        // ✅ Auth state listener for ongoing auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                console.log('🔐 Auth Event:', event);

                if (event === 'SIGNED_IN' && session?.user) {
                    const { data } = await supabase
                        .from('users')
                        .select('*')
                        .eq('id', session.user.id)
                        .single();
                    if (data) {
                        console.log('✅ User signed in:', data.id);
                        setCurrentUser(data);
                    }
                }

                if (event === 'TOKEN_REFRESHED') {
                    console.log('✅ Access token refreshed');
                }

                if (event === 'TOKEN_REFRESH_FAILED') {
                    console.log('❌ Refresh token expired — logging out');
                    setCurrentUser(null);
                    await supabase.auth.signOut();
                }

                if (event === 'SIGNED_OUT') {
                    console.log('❌ User signed out');
                    setCurrentUser(null);
                }
            }
        );

        return () => subscription.unsubscribe();
    }, []);

    // ✅ NEW: Check session when app comes to foreground
    useEffect(() => {
        const subscription = AppState.addEventListener('change', handleAppStateChange);
        return () => {
            subscription.remove();
        };
    }, []);

    const handleAppStateChange = async (nextAppState) => {
        if (appState.match(/inactive|background/) && nextAppState === 'active') {
            console.log('🔄 App came to foreground - validating session...');
            
            // Validate session when app is brought to foreground
            const { data: { session } } = await supabase.auth.getSession();
            
            if (!session && currentUser) {
                console.log('⚠️ Session lost - logging out');
                setCurrentUser(null);
                await supabase.auth.signOut();
            } else if (session && session.user && !currentUser) {
                // Session exists but currentUser is null - restore it
                const { data } = await supabase
                    .from('users')
                    .select('*')
                    .eq('id', session.user.id)
                    .single();
                if (data) {
                    console.log('✅ Session restored from background');
                    setCurrentUser(data);
                }
            }
        }
        setAppState(nextAppState);
    };

    if (isLoading) {
        return <SplashScreen />;
    }

    return (
        <NotificationModalProvider>
            <FavoritesProvider initialUser={currentUser}>
                <RegistrationProvider>
                    <NavigationContainer>
                        <Stack.Navigator screenOptions={{ headerShown: false }}>
                            {currentUser ? (
                                // ✅ Authenticated stack
                                <>
                                    <Stack.Screen name="Dashboard" component={Dashboard} />
                                    <Stack.Screen name="Home" component={Home} />
                                    <Stack.Screen name="Favorites" component={FavoriteModal} />
                                    <Stack.Screen name="ActiveRental" component={ActiveRental} />
                                    <Stack.Screen name="LessorReviews" component={LessorReviewsModal} />
                                    <Stack.Screen name="Chat" component={Chat} />
                                    <Stack.Screen name="LessorReviewee" component={LessorReviewee} />
                                    <Stack.Screen name="ItemTrackingScreen" component={ItemTrackingScreen} />
                                    <Stack.Screen name="ItemTrackingLessorScreen" component={ItemTrackingLessorScreen} />
                                </>
                            ) : (
                                // ✅ Unauthenticated stack
                                <>
                                    <Stack.Screen name="LandingPage" component={LandingPage} />
                                    <Stack.Screen name="Login" component={Login} />
                                    <Stack.Screen name="Register" component={Register} />
                                    <Stack.Screen name="Otp" component={Otp} />
                                    <Stack.Screen name="Face" component={Face} />
                                    <Stack.Screen name="Terms" component={Terms} />
                                    <Stack.Screen name="ForgotPassword" component={ForgotPassword} />
                                </>
                            )}
                        </Stack.Navigator>
                        <AppModals currentUser={currentUser} />
                    </NavigationContainer>
                </RegistrationProvider>
            </FavoritesProvider>
        </NotificationModalProvider>
    );
}