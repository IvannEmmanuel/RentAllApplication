// src/hooks/useHomeData.js
import { useState, useCallback, useEffect } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
    ItemsService,
    CategoriesService,
    BookingsService,
    RatingsService,
    ITEMS_PER_PAGE,
} from "../services/supabaseServices"; // Adjust path

const deduplicateItems = (items) => {
    const map = new Map();
    items.forEach((item) => map.set(item.item_id, item));
    return Array.from(map.values());
};

export const useHomeData = (currentUser, navigation, route) => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [categories, setCategories] = useState([]);
    const [selectedCategoryId, setSelectedCategoryId] = useState("");
    const [userBookings, setUserBookings] = useState([]);
    const [itemRatings, setItemRatings] = useState({});
    const [lessorRatings, setLessorRatings] = useState({});
    const [loadingMore, setLoadingMore] = useState(false);

    const fetchRatings = useCallback(async (fetchedItems) => {
        const itemIds = fetchedItems.map((item) => item.item_id).filter(Boolean);
        const lessorIds = fetchedItems.map((item) => item.lessorId).filter(Boolean);

        if (itemIds.length === 0 && lessorIds.length === 0) return;

        const [itemRatingsData, lessorRatingsData] = await Promise.all([
            RatingsService.fetchItemRatings(itemIds),
            RatingsService.fetchLessorRatings(lessorIds),
        ]);

        setItemRatings((prev) => ({ ...prev, ...itemRatingsData }));
        setLessorRatings((prev) => ({ ...prev, ...lessorRatingsData }));
    }, []);

    const loadItems = useCallback(
        async (pageNum = 1, append = false) => {
            if (pageNum === 1) setLoading(true);
            try {
                const fetchedItems = await ItemsService.fetchItems(pageNum, selectedCategoryId);
                await fetchRatings(fetchedItems);

                setItems((prev) => {
                    const newItems = append ? [...prev, ...fetchedItems] : fetchedItems;
                    return deduplicateItems(newItems);
                });
                setHasMore(fetchedItems.length === ITEMS_PER_PAGE);
            } catch (error) {
                console.error("Failed to load items:", error);
            } finally {
                setLoading(false);
            }
        },
        [selectedCategoryId, fetchRatings]
    );

    const loadUserBookings = useCallback(async () => {
        if (currentUser) {
            const bookings = await BookingsService.fetchUserBookings(currentUser.id);
            setUserBookings(bookings);
        }
    }, [currentUser]);

    useEffect(() => {
        CategoriesService.fetchCategories().then(setCategories);
    }, []);

    useEffect(() => {
        setPage(1); // Reset page when category changes
        loadItems(1, false);
    }, [selectedCategoryId]);

    useEffect(() => {
        loadUserBookings();
    }, [currentUser, loadUserBookings]);

    useFocusEffect(
        useCallback(() => {
            if (route?.params?.resetToAll) {
                setSelectedCategoryId("");
                navigation.setParams({ resetToAll: false }); // Clear the param
            }
        }, [route?.params?.resetToAll, navigation])
    );

    const handleLoadMore = useCallback(async () => {
        if (hasMore && !loading && !loadingMore) {
            setLoadingMore(true);
            const nextPage = page + 1;
            setPage(nextPage);
            await loadItems(nextPage, true);
            setLoadingMore(false);
        }
    }, [hasMore, loading, loadingMore, page, loadItems]);

    const refresh = useCallback(() => {
        setPage(1);
        loadItems(1, false);
        loadUserBookings();
    }, [loadItems, loadUserBookings]);

    return {
        items, loading, hasMore, categories, selectedCategoryId, setSelectedCategoryId,
        userBookings, itemRatings, lessorRatings, handleLoadMore, refresh, loadingMore
    };
};