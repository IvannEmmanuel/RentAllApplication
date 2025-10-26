import { useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { baseURL } from '../api/api';

const BEHAVIOR_KEY = 'user_rental_behavior';
const CACHE_KEY = 'recommendation_cache';

export function useRecommendations(userId) {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  
  // Cache to prevent unnecessary API calls
  const [recommendationCache, setRecommendationCache] = useState({
    recommendations: [],
    profile: null,
    timestamp: 0,
    behaviorHash: null
  });

  // Load cache from AsyncStorage on mount
  useEffect(() => {
    const loadCache = async () => {
      try {
        const cached = await AsyncStorage.getItem(CACHE_KEY);
        if (cached) {
          setRecommendationCache(JSON.parse(cached));
          console.log('✅ Loaded cache from AsyncStorage');
        }
      } catch (e) {
        console.warn('Could not load cache from AsyncStorage:', e);
      }
    };
    loadCache();
  }, []);

  const getUserBehavior = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(BEHAVIOR_KEY);
      if (stored) return JSON.parse(stored);
    } catch (error) {
      console.error('Error reading user behavior:', error);
    }
    return {
      viewedItems: [],
      favoritedItems: [],
      searchTerms: [],
      categoryViews: {},
      priceRangeHistory: [],
      locationPreferences: {},
      lastUpdated: Date.now()
    };
  }, []);

  const saveUserBehavior = useCallback(async (behavior) => {
    try {
      await AsyncStorage.setItem(BEHAVIOR_KEY, JSON.stringify({
        ...behavior,
        lastUpdated: Date.now()
      }));
      console.log('📊 Behavior saved:', {
        viewedItems: behavior.viewedItems.length,
        favoritedItems: behavior.favoritedItems.length,
        searchTerms: behavior.searchTerms.length
      });
    } catch (error) {
      console.error('Error saving user behavior:', error);
    }
  }, []);

  const trackItemView = useCallback(async (item) => {
    console.log('👁️ Tracking item view:', item.title);
    const behavior = await getUserBehavior();
    const viewedItems = [
      {
        item_id: item.item_id,
        category_id: item.category_id,
        price: item.price_per_day || item.price,
        location: item.location,
        title: item.title,
        timestamp: Date.now()
      },
      ...behavior.viewedItems.filter(v => v.item_id !== item.item_id)
    ].slice(0, 50);

    const categoryViews = { ...behavior.categoryViews };
    const categoryId = item.category_id?.toString();
    if (categoryId) categoryViews[categoryId] = (categoryViews[categoryId] || 0) + 1;

    const locationPreferences = { ...behavior.locationPreferences };
    if (item.location) locationPreferences[item.location] = (locationPreferences[item.location] || 0) + 1;

    const priceRangeHistory = [
      Number(item.price_per_day || item.price || 0),
      ...behavior.priceRangeHistory
    ].slice(0, 20);

    await saveUserBehavior({
      ...behavior,
      viewedItems,
      categoryViews,
      locationPreferences,
      priceRangeHistory
    });
  }, [getUserBehavior, saveUserBehavior]);

  const trackFavorite = useCallback(async (item, isFavorited) => {
    console.log('❤️ Tracking favorite:', item.title, 'Favorited:', isFavorited);
    const behavior = await getUserBehavior();
    let favoritedItems = isFavorited
      ? [
          {
            item_id: item.item_id,
            category_id: item.category_id,
            price: item.price_per_day || item.price,
            title: item.title,
            timestamp: Date.now()
          },
          ...behavior.favoritedItems.filter(f => f.item_id !== item.item_id)
        ]
      : behavior.favoritedItems.filter(f => f.item_id !== item.item_id);

    await saveUserBehavior({ ...behavior, favoritedItems });
  }, [getUserBehavior, saveUserBehavior]);

  const trackSearch = useCallback(async (searchTerm) => {
    if (!searchTerm?.trim()) return;
    console.log('🔍 Tracking search:', searchTerm);
    const behavior = await getUserBehavior();
    const searchTerms = [
      { term: searchTerm.toLowerCase(), timestamp: Date.now() },
      ...behavior.searchTerms.filter(s => s.term !== searchTerm.toLowerCase())
    ].slice(0, 30);

    await saveUserBehavior({ ...behavior, searchTerms });
  }, [getUserBehavior, saveUserBehavior]);

  // Generate a hash of user behavior to detect changes
  const getBehaviorHash = useCallback((behavior) => {
    const str = JSON.stringify({
      views: behavior.viewedItems.length,
      favs: behavior.favoritedItems.length,
      searches: behavior.searchTerms.length,
      topCategories: Object.keys(behavior.categoryViews || {}).slice(0, 3).sort()
    });
    return str;
  }, []);

  const fetchRecommendations = useCallback(async (availableItems, categories, currentItem = null) => {
    if (!userId || availableItems.length === 0) {
      console.log('⏭️ Skipping recommendations: userId=', userId, 'items=', availableItems.length);
      return;
    }

    try {
      const behavior = await getUserBehavior();
      const totalInteractions =
        behavior.viewedItems.length +
        behavior.favoritedItems.length +
        behavior.searchTerms.length;

      if (totalInteractions < 2) {
        console.log('⚠️ Not enough data (need 2, have ' + totalInteractions + ')');
        return;
      }

      // Check if user behavior has changed significantly
      const currentHash = getBehaviorHash(behavior);
      const timeSinceLastCall = Date.now() - recommendationCache.timestamp;
      
      // Use cache if:
      // 1. Behavior hasn't changed AND
      // 2. Cache is less than 5 minutes old
      if (recommendationCache.behaviorHash === currentHash && timeSinceLastCall < 5 * 60 * 1000) {
        console.log('✅ Using cached recommendations (age: ' + Math.round(timeSinceLastCall / 1000) + 's)');
        setRecommendations(recommendationCache.recommendations);
        setUserProfile(recommendationCache.profile);
        return;
      }

      console.log('🚀 Fetching fresh recommendations (behavior changed or cache expired)');
      setLoading(true);

      const apiUrl = `${baseURL}/api/recommendations`;
      console.log('📡 API URL:', apiUrl);
      console.log('📤 Sending request with:', {
        viewedItems: behavior.viewedItems.length,
        favoritedItems: behavior.favoritedItems.length,
        searchTerms: behavior.searchTerms.length,
        availableItems: availableItems.length
      });

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userBehavior: behavior,
          availableItems,
          categories,
          currentItem
        })
      });

      const data = await response.json();
      console.log('📥 API Response:', data);

      if (data.success) {
        const recommendedIds = data.recommendations.recommendedItemIds;
        console.log('✅ Got recommendations:', recommendedIds);

        const recommendedItems = availableItems.filter(item =>
          recommendedIds.includes(item.item_id)
        );

        console.log('📦 Filtered to', recommendedItems.length, 'matching items');

        recommendedItems.sort((a, b) => {
          const aId = a.item_id;
          const bId = b.item_id;
          return recommendedIds.indexOf(aId) - recommendedIds.indexOf(bId);
        });

        setRecommendations(recommendedItems);
        setUserProfile({
          primaryInterests: data.recommendations.primaryInterests || [],
          reasoning: data.recommendations.reasoning || ''
        });

        // Update cache
        const cacheData = {
          recommendations: recommendedItems,
          profile: {
            primaryInterests: data.recommendations.primaryInterests || [],
            reasoning: data.recommendations.reasoning || ''
          },
          timestamp: Date.now(),
          behaviorHash: currentHash
        };

        setRecommendationCache(cacheData);

        // Persist to AsyncStorage
        try {
          await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
        } catch (e) {
          console.warn('Could not cache recommendations:', e);
        }

        console.log('🎉 Recommendations set and cached:', recommendedItems.length);
      } else {
        console.log('❌ API returned success=false:', data);
        setRecommendations([]);
      }
    } catch (error) {
      console.error('💥 Error fetching recommendations:', error);
      setRecommendations([]);
    } finally {
      setLoading(false);
    }
  }, [userId, getUserBehavior, getBehaviorHash, recommendationCache]);

  return {
    recommendations,
    loading,
    userProfile,
    trackItemView,
    trackFavorite,
    trackSearch,
    fetchRecommendations
  };
}