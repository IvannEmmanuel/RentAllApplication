// import * as React from 'react';
// import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
// import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
// import { Image, StyleSheet, View } from 'react-native';
// import Home from '../Screens/Home';
// import Inbox from '../Screens/Inbox';
// import Notification from '../Screens/Notification';
// import Profile from '../Screens/Profile';
// import AddItem from '../Screens/AddItem';
// import Chat from '../Screens/Chat';
// import { createStackNavigator } from '@react-navigation/stack';
// import { useNotification } from '../../notifications/notifications';
// import { useFavorites } from '../../components/FavoritesContext';

// const Tab = createBottomTabNavigator();
// const Stack = createStackNavigator();

// const InboxStack = () => {
//     return (
//         <Stack.Navigator screenOptions={{ headerShown: false }}>
//             <Stack.Screen name="InboxMain" component={Inbox} />
//             <Stack.Screen name="Chat" component={Chat} />
//         </Stack.Navigator>
//     );
// };

// const HomeStack = () => {
//     return (
//         <Stack.Navigator screenOptions={{ headerShown: false }}>
//             <Stack.Screen name="HomeMain" component={Home} />
//             <Stack.Screen name="Chat" component={Chat} />
//         </Stack.Navigator>
//     );
// };

// const ProfileStack = () => {
//     return (
//         <Stack.Navigator screenOptions={{ headerShown: false }}>
//             <Stack.Screen name="ProfileMain" component={Profile} />
//             <Stack.Screen name="Chat" component={Chat} />
//         </Stack.Navigator>
//     )
// }

// // Helper function to determine if tab bar should be shown
// const getTabBarVisibility = (route) => {
//     const routeName = getFocusedRouteNameFromRoute(route);

//     if (routeName === 'Chat') {
//         return { display: 'none' };
//     }

//     return {
//         backgroundColor: '#FFF4E6',
//         borderTopLeftRadius: 20,
//         borderTopRightRadius: 20,
//         height: 80,
//     };
// };

// const Dashboard = () => {
//     const { currentUser } = useFavorites();
//     useNotification(currentUser); // now it gets the user

//     return (
//         <Tab.Navigator
//             screenOptions={({ route }) => ({
//                 headerShown: false,
//                 tabBarStyle: getTabBarVisibility(route),
//                 tabBarIconStyle: {
//                     marginTop: 10,
//                     marginBottom: 10
//                 },
//                 tabBarLabelStyle: {
//                     fontSize: 12,
//                     marginBottom: 5,
//                 },
//                 tabBarIcon: ({ focused, color, size }) => {
//                     let iconSource;

//                     if (route.name === 'Home') {
//                         iconSource = require('../../../assets/home.png');
//                     } else if (route.name === 'Inbox') {
//                         iconSource = require('../../../assets/inboxM.png');
//                     } else if (route.name === 'AddItem') {
//                         iconSource = require('../../../assets/plus.png');
//                     } else if (route.name === 'Notification') {
//                         iconSource = require('../../../assets/notification.png');
//                     } else if (route.name === 'Profile') {
//                         iconSource = require('../../../assets/profile.png');
//                     }

//                     if (route.name === 'AddItem') {
//                         return (
//                             <View
//                                 style={{
//                                     marginTop: 10
//                                 }}
//                             >
//                                 <Image
//                                     source={iconSource}
//                                     style={{
//                                         width: 60,
//                                         height: 60,
//                                     }}
//                                     resizeMode="contain"
//                                 />
//                             </View>
//                         );
//                     }

//                     return (
//                         <Image
//                             source={iconSource}
//                             style={{
//                                 width: size,
//                                 height: size,
//                                 tintColor: focused ? '#1E1E1E' : 'gray',
//                             }}
//                             resizeMode="contain"
//                         />
//                     );
//                 },
//                 tabBarActiveTintColor: '#1E1E1E',
//                 tabBarInactiveTintColor: 'gray',
//             })}
//         >
//             <Tab.Screen
//                 name="Home"
//                 component={HomeStack}
//                 options={({ route }) => ({
//                     tabBarStyle: getTabBarVisibility(route),
//                 })}
//             />
//             <Tab.Screen
//                 name="Inbox"
//                 component={InboxStack}
//                 options={({ route }) => ({
//                     tabBarStyle: getTabBarVisibility(route),
//                 })}
//             />
//             <Tab.Screen
//                 name="AddItem"
//                 component={AddItem}
//                 options={{
//                     tabBarLabel: () => null,
//                 }}
//             />
//             <Tab.Screen name="Notification" component={Notification} />
//             <Tab.Screen name="Profile" component={ProfileStack} />
//         </Tab.Navigator>
//     );
// };

// export default Dashboard;

// const styles = StyleSheet.create({});

import * as React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { Image, StyleSheet, View, Text } from 'react-native';
import Home from '../Screens/Home';
import Inbox from '../Screens/Inbox';
import Notification from '../Screens/Notification';
import Profile from '../Screens/Profile';
import AddItem from '../Screens/AddItem';
import Chat from '../Screens/Chat';
import { createStackNavigator } from '@react-navigation/stack';
import { useNotification } from '../../notifications/notifications';
import { useFavorites } from '../../components/FavoritesContext';
import { UnreadMessagesProvider, useUnread } from '../../hooks/useUnreadMessages';

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

const TabBarBadge = ({ count }) => {
    const num = Number(count) || 0;
    if (num <= 0) return null;
    return (
        <View style={styles.badge}>
            <Text style={styles.badgeText}>
                {num > 99 ? '99+' : num.toString()}
            </Text>
        </View>
    );
};

// Render Tabs inside a consumer so unreadCount updates cause re-render
const Tabs = () => {
    const { unreadCount } = useUnread();
    const { currentUser } = useFavorites();
    useNotification(currentUser);

    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarStyle: getFocusedRouteNameFromRoute(route) ? getTabBarVisibility(route) : getTabBarVisibility(route),
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
                    if (route.name === 'Home') iconSource = require('../../../assets/home.png');
                    else if (route.name === 'Inbox') iconSource = require('../../../assets/inboxM.png');
                    else if (route.name === 'AddItem') iconSource = require('../../../assets/plus.png');
                    else if (route.name === 'Notification') iconSource = require('../../../assets/notification.png');
                    else if (route.name === 'Profile') iconSource = require('../../../assets/profile.png');

                    if (route.name === 'AddItem') {
                        return (
                            <View style={{ marginTop: 10 }}>
                                <Image source={iconSource} style={{ width: 60, height: 60 }} resizeMode="contain" />
                            </View>
                        );
                    }

                    if (route.name === 'Inbox') {
                        return (
                            <View style={{ position: 'relative' }}>
                                <Image
                                    source={iconSource}
                                    style={{
                                        width: size,
                                        height: size,
                                        tintColor: focused ? '#1E1E1E' : 'gray',
                                    }}
                                    resizeMode="contain"
                                />
                                <TabBarBadge count={unreadCount} />
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
            <Tab.Screen name="Home" component={HomeStack} options={({ route }) => ({ tabBarStyle: getTabBarVisibility(route) })} />
            <Tab.Screen name="Inbox" component={InboxStack} options={({ route }) => ({ tabBarStyle: getTabBarVisibility(route) })} />
            <Tab.Screen name="AddItem" component={AddItem} options={{ tabBarLabel: () => null }} />
            <Tab.Screen name="Notification" component={Notification} />
            <Tab.Screen name="Profile" component={ProfileStack} />
        </Tab.Navigator>
    )
}

const Dashboard = () => {
    // Wrap the tab navigator with provider so all tabs and screens share the same unread state
    return (
        <UnreadMessagesProvider>
            <Tabs />
        </UnreadMessagesProvider>
    );
};

export default Dashboard;

const styles = StyleSheet.create({
    badge: {
        position: 'absolute',
        top: -8,
        right: -8,
        backgroundColor: '#FF4444',
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
    },
    badgeText: {
        color: 'white',
        fontSize: 12,
        fontWeight: 'bold',
        textAlign: 'center',
    },
});