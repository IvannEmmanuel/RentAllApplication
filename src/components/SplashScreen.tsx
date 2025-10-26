import React, { useEffect, useRef } from 'react'
import { View, StyleSheet, Animated, Dimensions } from 'react-native'

const { width, height } = Dimensions.get('window')

const SplashScreen = () => {
    const scaleValue = useRef(new Animated.Value(0)).current
    const opacityValue = useRef(new Animated.Value(0)).current
    const rotateValue = useRef(new Animated.Value(0)).current

    useEffect(() => {
        // Main pulse animation
        Animated.parallel([
            Animated.timing(scaleValue, {
                toValue: 1,
                duration: 1200,
                useNativeDriver: true,
            }),
            Animated.timing(opacityValue, {
                toValue: 1,
                duration: 800,
                useNativeDriver: true,
            }),
        ]).start()

        // Continuous rotation
        Animated.loop(
            Animated.timing(rotateValue, {
                toValue: 1,
                duration: 3000,
                useNativeDriver: true,
            })
        ).start()
    }, [scaleValue, opacityValue, rotateValue])

    const rotate = rotateValue.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    })

    const accentWidth = opacityValue.interpolate({
        inputRange: [0, 1],
        outputRange: [0, width * 0.6],
    })

    return (
        <View style={styles.container}>
            {/* Animated gradient background */}
            <View style={styles.backgroundGradient} />

            {/* Glowing orbs */}
            <Animated.View
                style={[
                    styles.glow1,
                    {
                        opacity: opacityValue.interpolate({
                            inputRange: [0, 0.5, 1],
                            outputRange: [0, 0.3, 0.1],
                        }),
                    },
                ]}
            />
            <Animated.View
                style={[
                    styles.glow2,
                    {
                        opacity: opacityValue.interpolate({
                            inputRange: [0, 0.5, 1],
                            outputRange: [0, 0.2, 0.05],
                        }),
                    },
                ]}
            />

            {/* Main content */}
            <Animated.View
                style={[
                    styles.content,
                    {
                        opacity: opacityValue,
                        transform: [{ scale: scaleValue }],
                    },
                ]}
            >
                {/* Loading ring */}
                <Animated.View
                    style={[
                        styles.outerRing,
                        {
                            transform: [{ rotate }],
                        },
                    ]}
                />

                {/* Inner circle */}
                <View style={styles.innerCircle}>
                    {/* Pulsing dot */}
                    <Animated.View
                        style={[
                            styles.pulsingDot,
                            {
                                opacity: opacityValue.interpolate({
                                    inputRange: [0, 0.5, 1],
                                    outputRange: [0.3, 1, 0.3],
                                }),
                            },
                        ]}
                    />
                </View>
            </Animated.View>

            {/* Loading text */}
            <Animated.View
                style={[
                    styles.textContainer,
                    {
                        opacity: opacityValue,
                    },
                ]}
            >
                <View style={styles.dots}>
                    <Animated.View
                        style={[
                            styles.dot,
                            {
                                opacity: opacityValue.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [0, 1],
                                }),
                            },
                        ]}
                    />
                    <Animated.View
                        style={[
                            styles.dot,
                            {
                                opacity: opacityValue.interpolate({
                                    inputRange: [0, 0.5, 1],
                                    outputRange: [0, 1, 0.3],
                                }),
                            },
                        ]}
                    />
                    <Animated.View
                        style={[
                            styles.dot,
                            {
                                opacity: opacityValue.interpolate({
                                    inputRange: [0.5, 1],
                                    outputRange: [0, 1],
                                }),
                            },
                        ]}
                    />
                </View>
            </Animated.View>

            {/* Bottom accent line */}
            <Animated.View
                style={[
                    styles.glow1,
                    {
                        opacity: opacityValue.interpolate({
                            inputRange: [0, 0.5, 1],
                            outputRange: [0, 0.3, 0.1],
                        }),
                    },
                ]}
            />
            <Animated.View
                style={[
                    styles.glow2,
                    {
                        opacity: opacityValue.interpolate({
                            inputRange: [0, 0.5, 1],
                            outputRange: [0, 0.2, 0.05],
                        }),
                    },
                ]}
            />
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f1f1f1f1', //#0F0F0F <- FORMER COLOR
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    backgroundGradient: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'linear-gradient(135deg, #1a1a2e 0%, #0f0f1e 50%, #0a0a14 100%)',
    },
    glow1: {
        position: 'absolute',
        width: 400,
        height: 400,
        borderRadius: 200,
        backgroundColor: '#FFAB00',
        top: -100,
        right: -100,
        opacity: 0.1,
    },
    glow2: {
        position: 'absolute',
        width: 300,
        height: 300,
        borderRadius: 150,
        backgroundColor: '#FF6B35',
        bottom: -50,
        left: -50,
        opacity: 0.05,
    },
    content: {
        justifyContent: 'center',
        alignItems: 'center',
        width: 160,
        height: 160,
    },
    outerRing: {
        position: 'absolute',
        width: '100%',
        height: '100%',
        borderRadius: 80,
        borderWidth: 3,
        borderColor: '#FFAB00',
        borderTopColor: 'transparent',
        borderRightColor: 'transparent',
    },
    innerCircle: {
        position: 'absolute',
        width: '60%',
        height: '60%',
        borderRadius: 48,
        backgroundColor: 'rgba(255, 171, 0, 0.05)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 171, 0, 0.2)',
    },
    pulsingDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#FFAB00',
        shadowColor: '#FFAB00',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 8,
        elevation: 8,
    },
    textContainer: {
        position: 'absolute',
        bottom: height * 0.25,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dots: {
        flexDirection: 'row',
        gap: 6,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#FFAB00',
    },
    bottomAccent: {
        position: 'absolute',
        bottom: 60,
        height: 2,
        backgroundColor: 'rgba(255, 171, 0, 0.4)',
        borderRadius: 1,
    },
})

export default SplashScreen