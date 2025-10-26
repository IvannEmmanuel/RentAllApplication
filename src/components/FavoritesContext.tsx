"use client"

import { createContext, useContext, useState, useEffect, useCallback } from "react"
import { supabase } from "../../supbaseClient"
import AsyncStorage from "@react-native-async-storage/async-storage"

const FavoritesContext = createContext()

export const useFavorites = () => {
    const context = useContext(FavoritesContext)
    if (!context) {
        throw new Error("useFavorites must be used within a FavoritesProvider")
    }
    return context
}

export const FavoritesProvider = ({ children, initialUser = null }) => {
    const [favorites, setFavorites] = useState([])
    const [currentUser, setCurrentUser] = useState(initialUser)

    // ✅ Remove the old useEffect that fetched the user
    // We'll get it from AppNavigator instead

    // Fetch favorites from database
    const fetchFavorites = useCallback(async () => {
        if (!currentUser) {
            setFavorites([])
            return
        }

        try {
            const { data, error } = await supabase.from("favorites").select("item_id").eq("user_id", currentUser.id)

            if (!error && data) {
                setFavorites(data.map((fav) => fav.item_id))
            }
        } catch (error) {
            console.error("Error fetching favorites:", error)
        }
    }, [currentUser])

    const logout = async () => {
        if (!currentUser) return

        try {
            await supabase.from("user_fcm_tokens").delete().eq("user_id", currentUser.id)

            const { error } = await supabase.auth.signOut()
            if (error) throw error

            setCurrentUser(null)
            setFavorites([])

            await AsyncStorage.removeItem('supabase.auth.token')

            console.log("✅ Logged out successfully, tokens cleared")
        } catch (err) {
            console.error("Logout failed:", err)
            throw err
        }
    }

    // Toggle favorite - SINGLE SOURCE OF TRUTH
    const toggleFavorite = useCallback(
        async (itemId) => {
            if (!currentUser) {
                return { success: false, message: "Please log in to add items to favorites" }
            }

            const isFavorited = favorites.includes(itemId)

            try {
                if (isFavorited) {
                    const { error } = await supabase
                        .from("favorites")
                        .delete()
                        .eq("user_id", currentUser.id)
                        .eq("item_id", itemId)

                    if (!error) {
                        setFavorites((prev) => prev.filter((id) => id !== itemId))
                        return { success: true, action: "removed" }
                    } else {
                        console.error("Error removing favorite:", error)
                        return { success: false, message: "Failed to remove from favorites" }
                    }
                } else {
                    const { error } = await supabase.from("favorites").insert([
                        {
                            user_id: currentUser.id,
                            item_id: itemId,
                        },
                    ])

                    if (!error) {
                        setFavorites((prev) => [...prev, itemId])
                        return { success: true, action: "added" }
                    } else {
                        console.error("Error adding favorite:", error)
                        return { success: false, message: "Failed to add to favorites" }
                    }
                }
            } catch (error) {
                console.error("Toggle favorite error:", error)
                return { success: false, message: "An error occurred" }
            }
        },
        [currentUser, favorites],
    )

    const isFavorited = useCallback(
        (itemId) => {
            return favorites.includes(itemId)
        },
        [favorites],
    )

    // ✅ Load favorites when user changes (from AppNavigator)
    useEffect(() => {
        if (currentUser) {
            fetchFavorites()
        }
    }, [currentUser, fetchFavorites])

    // Real-time subscription
    useEffect(() => {
        if (!currentUser) return

        console.log("Setting up global favorites real-time subscription")
        const channel = supabase
            .channel("global_favorites_changes")
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "favorites",
                    filter: `user_id=eq.${currentUser.id}`,
                },
                (payload) => {
                    console.log("Favorites change detected:", payload)
                    fetchFavorites()
                },
            )
            .subscribe()

        return () => {
            console.log("Cleaning up global favorites subscription")
            supabase.removeChannel(channel)
        }
    }, [currentUser, fetchFavorites])

    const updateItemQuantity = useCallback(
        async (itemId, newQuantity) => {
            if (!currentUser) {
                return { success: false, message: "Please log in to update quantity" }
            }

            try {
                const { error } = await supabase.from("items").update({ quantity: newQuantity }).eq("item_id", itemId)

                if (!error) {
                    return { success: true }
                } else {
                    console.error("Error updating quantity:", error)
                    return { success: false, message: "Failed to update quantity" }
                }
            } catch (error) {
                console.error("Update quantity error:", error)
                return { success: false, message: "An error occurred" }
            }
        },
        [currentUser],
    )

    const value = {
        favorites,
        currentUser,
        setCurrentUser, // ✅ Now receives user from AppNavigator
        toggleFavorite,
        isFavorited,
        fetchFavorites,
        favoritesCount: favorites.length,
        logout,
        updateItemQuantity,
    }

    return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>
}