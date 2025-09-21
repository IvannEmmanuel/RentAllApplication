import * as React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Image, StyleSheet, View } from 'react-native';
import Home from '../Screens/Home';
import Inbox from '../Screens/Inbox';
import Notification from '../Screens/Notification';
import Profile from '../Screens/Profile';
import AddItem from '../Screens/AddItem';
import Chat from '../Screens/Chat';
import { createStackNavigator } from '@react-navigation/stack';

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

const Dashboard = () => {
    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: '#FFF4E6',
                    borderTopLeftRadius: 20,
                    borderTopRightRadius: 20,
                    height: 80,
                },
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
                                tintColor: focused ? '#1E1E1E' : 'gray', // optional tint
                            }}
                            resizeMode="contain"
                        />
                    );
                },
                tabBarActiveTintColor: '#1E1E1E',
                tabBarInactiveTintColor: 'gray',
            })}
        >
            <Tab.Screen name="Home" component={HomeStack} />
            <Tab.Screen name="Inbox" component={InboxStack} />
            <Tab.Screen
                name="AddItem"
                component={AddItem}
                options={{
                    tabBarLabel: () => null, // hide text
                }}
            />
            <Tab.Screen name="Notification" component={Notification} />
            <Tab.Screen name="Profile" component={Profile} />
        </Tab.Navigator>
    );
};

export default Dashboard;

const styles = StyleSheet.create({});
