import * as React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { Image, StyleSheet, View } from 'react-native';
import Home from '../Screens/Home';
import Inbox from '../Screens/Inbox';
import Notification from '../Screens/Notification';
import Profile from '../Screens/Profile';
import AddItem from '../Screens/AddItem';
import Chat from '../Screens/Chat';
import { createStackNavigator } from '@react-navigation/stack';
import { useNotification } from '../../notifications/notifications';
import { useFavorites } from '../../components/FavoritesContext';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const InboxStack = () => {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="InboxMain" component={Inbox} />
            <Stack.Screen name="Chat" component={Chat} />
        </Stack.Navigator>
    );
};

const HomeStack = () => {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="HomeMain" component={Home} />
            <Stack.Screen name="Chat" component={Chat} />
        </Stack.Navigator>
    );
};

const ProfileStack = () => {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="ProfileMain" component={Profile} />
            <Stack.Screen name="Chat" component={Chat} />
        </Stack.Navigator>
    )
}

// Helper function to determine if tab bar should be shown
const getTabBarVisibility = (route) => {
    const routeName = getFocusedRouteNameFromRoute(route);

    if (routeName === 'Chat') {
        return { display: 'none' };
    }

    return {
        backgroundColor: '#FFF4E6',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        height: 80,
    };
};

const Dashboard = () => {
    const { currentUser } = useFavorites();
    useNotification(currentUser); // now it gets the user
    
    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarStyle: getTabBarVisibility(route),
                tabBarIconStyle: {
                    marginTop: 10,
                    marginBottom: 10
                },
                tabBarLabelStyle: {
                    fontSize: 12,
                    marginBottom: 5,
                },
                tabBarIcon: ({ focused, color, size }) => {
                    let iconSource;

                    if (route.name === 'Home') {
                        iconSource = require('../../../assets/home.png');
                    } else if (route.name === 'Inbox') {
                        iconSource = require('../../../assets/inboxM.png');
                    } else if (route.name === 'AddItem') {
                        iconSource = require('../../../assets/plus.png');
                    } else if (route.name === 'Notification') {
                        iconSource = require('../../../assets/notification.png');
                    } else if (route.name === 'Profile') {
                        iconSource = require('../../../assets/profile.png');
                    }

                    if (route.name === 'AddItem') {
                        return (
                            <View
                                style={{
                                    marginTop: 10
                                }}
                            >
                                <Image
                                    source={iconSource}
                                    style={{
                                        width: 60,
                                        height: 60,
                                    }}
                                    resizeMode="contain"
                                />
                            </View>
                        );
                    }

                    return (
                        <Image
                            source={iconSource}
                            style={{
                                width: size,
                                height: size,
                                tintColor: focused ? '#1E1E1E' : 'gray',
                            }}
                            resizeMode="contain"
                        />
                    );
                },
                tabBarActiveTintColor: '#1E1E1E',
                tabBarInactiveTintColor: 'gray',
            })}
        >
            <Tab.Screen
                name="Home"
                component={HomeStack}
                options={({ route }) => ({
                    tabBarStyle: getTabBarVisibility(route),
                })}
            />
            <Tab.Screen
                name="Inbox"
                component={InboxStack}
                options={({ route }) => ({
                    tabBarStyle: getTabBarVisibility(route),
                })}
            />
            <Tab.Screen
                name="AddItem"
                component={AddItem}
                options={{
                    tabBarLabel: () => null,
                }}
            />
            <Tab.Screen name="Notification" component={Notification} />
            <Tab.Screen name="Profile" component={ProfileStack} />
        </Tab.Navigator>
    );
};

export default Dashboard;

const styles = StyleSheet.create({});