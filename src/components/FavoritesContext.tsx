// FavoritesContext.js
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../../supbaseClient'

const FavoritesContext = createContext()

export const useFavorites = () => {
    const context = useContext(FavoritesContext)
    if (!context) {
        throw new Error('useFavorites must be used within a FavoritesProvider')
    }
    return context
}

export const FavoritesProvider = ({ children }) => {
    const [favorites, setFavorites] = useState([])
    const [currentUser, setCurrentUser] = useState(null)

    // Get current user
    useEffect(() => {
        const getCurrentUser = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            setCurrentUser(user)
        }
        getCurrentUser()
    }, [])

    // Fetch favorites from database
    const fetchFavorites = useCallback(async () => {
        if (!currentUser) {
            setFavorites([])
            return
        }

        try {
            const { data, error } = await supabase
                .from('favorites')
                .select('item_id')
                .eq('user_id', currentUser.id)

            if (!error && data) {
                setFavorites(data.map(fav => fav.item_id))
            }
        } catch (error) {
            console.error('Error fetching favorites:', error)
        }
    }, [currentUser])

    // Toggle favorite - SINGLE SOURCE OF TRUTH
    const toggleFavorite = useCallback(async (itemId) => {
        if (!currentUser) {
            return { success: false, message: 'Please log in to add items to favorites' }
        }

        const isFavorited = favorites.includes(itemId)

        try {
            if (isFavorited) {
                // Remove from favorites
                const { error } = await supabase
                    .from('favorites')
                    .delete()
                    .eq('user_id', currentUser.id)
                    .eq('item_id', itemId)

                if (!error) {
                    // Update local state immediately for instant UI feedback
                    setFavorites(prev => prev.filter(id => id !== itemId))
                    return { success: true, action: 'removed' }
                } else {
                    console.error('Error removing favorite:', error)
                    return { success: false, message: 'Failed to remove from favorites' }
                }
            } else {
                // Add to favorites
                const { error } = await supabase
                    .from('favorites')
                    .insert([{
                        user_id: currentUser.id,
                        item_id: itemId
                    }])

                if (!error) {
                    // Update local state immediately for instant UI feedback
                    setFavorites(prev => [...prev, itemId])
                    return { success: true, action: 'added' }
                } else {
                    console.error('Error adding favorite:', error)
                    return { success: false, message: 'Failed to add to favorites' }
                }
            }
        } catch (error) {
            console.error('Toggle favorite error:', error)
            return { success: false, message: 'An error occurred' }
        }
    }, [currentUser, favorites])

    // Check if item is favorited
    const isFavorited = useCallback((itemId) => {
        return favorites.includes(itemId)
    }, [favorites])

    // Load favorites when user changes
    useEffect(() => {
        if (currentUser) {
            fetchFavorites()
        }
    }, [currentUser, fetchFavorites])

    // Real-time subscription - SINGLE SUBSCRIPTION FOR ALL COMPONENTS
    useEffect(() => {
        if (!currentUser) return

        console.log('Setting up global favorites real-time subscription')
        const channel = supabase
            .channel("global_favorites_changes")
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "favorites",
                    filter: `user_id=eq.${currentUser.id}`
                },
                (payload) => {
                    console.log('Favorites change detected:', payload)
                    // Refresh favorites from database to ensure consistency
                    fetchFavorites()
                }
            )
            .subscribe()

        return () => {
            console.log('Cleaning up global favorites subscription')
            supabase.removeChannel(channel)
        }
    }, [currentUser, fetchFavorites])

    const value = {
        favorites,
        currentUser,
        setCurrentUser,
        toggleFavorite,
        isFavorited,
        fetchFavorites,
        favoritesCount: favorites.length
    }

    return (
        <FavoritesContext.Provider value= { value } >
        { children }
        </FavoritesContext.Provider>
  )
}