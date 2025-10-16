// src/services/supabaseService.js
import { supabase } from "../../supbaseClient";

const ITEMS_PER_PAGE = 6;
const SEARCH_LIMIT = 10;

// --- UTILITY FUNCTIONS ---
export const formatPrice = (price) => `₱${price}`;
export const formatDate = (dateString) => new Date(dateString).toLocaleDateString();
export const getInitials = (firstName, lastName) => {
    const first = firstName?.[0] || "";
    const last = lastName?.[0] || "";
    return `${first}${last}`.toUpperCase();
};

// --- IMAGE SERVICE ---
export class ImageService {
    static async getImageUrl(userId, itemId) {
        try {
            const dir = `${userId}/${itemId}`;
            const { data: files, error } = await supabase.storage
                .from("Items-photos")
                .list(dir, { limit: 1, sortBy: { column: "name", order: "desc" } });

            if (error || !files?.length) return undefined;

            const fullPath = `${dir}/${files[0].name}`;
            const { data: pub } = supabase.storage
                .from("Items-photos")
                .getPublicUrl(fullPath);

            return pub?.publicUrl;
        } catch (error) {
            console.warn("Image fetch failed:", error.message);
            return undefined;
        }
    }
}

// --- RATINGS SERVICE ---
export class RatingsService {
    static async fetchItemRatings(itemIds) {
        if (!itemIds?.length) return {};

        try {
            const { data, error } = await supabase
                .from("reviews")
                .select("item_id, rating")
                .in("item_id", itemIds);

            if (error) throw error;

            return this._calculateAverageRatings(data, "item_id");
        } catch (error) {
            console.error("Error fetching item ratings:", error);
            return {};
        }
    }

    static async fetchLessorRatings(lessorIds) {
        if (!lessorIds?.length) return {};

        try {
            const { data, error } = await supabase
                .from("lessor_reviews")
                .select("lessor_id, rating")
                .in("lessor_id", lessorIds);

            if (error) throw error;

            return this._calculateAverageRatings(data, "lessor_id");
        } catch (error) {
            console.error("Error fetching lessor ratings:", error);
            return {};
        }
    }

    static _calculateAverageRatings(data, idKey) {
        const ratingsMap = {};

        data.forEach((review) => {
            const id = review[idKey];
            if (!ratingsMap[id]) {
                ratingsMap[id] = { total: 0, count: 0 };
            }
            ratingsMap[id].total += review.rating;
            ratingsMap[id].count += 1;
        });

        const averageRatings = {};
        Object.entries(ratingsMap).forEach(([id, { total, count }]) => {
            averageRatings[id] = count > 0 ? (total / count).toFixed(1) : null;
        });

        return averageRatings;
    }
}


// --- ITEMS SERVICE ---
export class ItemsService {
    static async fetchItems(page, categoryId) {
        try {
            const baseSelect =
                "item_id,user_id,category_id,title,description,price_per_day,deposit_fee,location,available,created_at,item_status,quantity";

            let query = supabase
                .from("items")
                .select(baseSelect)
                .eq("available", true)
                .eq("item_status", "approved")
                .order("created_at", { ascending: false })
                .range((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE - 1);

            if (categoryId) {
                query = query.eq("category_id", Number(categoryId));
            }

            const { data, error } = await query;
            if (error) throw error;

            return await this._enrichItemsData(data || []);
        } catch (error) {
            console.error("Error fetching items:", error);
            throw error;
        }
    }

    static async _enrichItemsData(items) {
        const enrichedItems = await Promise.all(
            items.map(async (item) => {
                const [imageUrl, userData] = await Promise.all([
                    ImageService.getImageUrl(item.user_id, item.item_id),
                    this._fetchUserData(item.user_id),
                ]);

                const lessorName = userData
                    ? `${userData.first_name} ${userData.last_name}`
                    : "Unknown";

                return {
                    ...item,
                    imageUrl,
                    lessorId: userData?.id,
                    lessorName,
                    formattedPrice: formatPrice(item.price_per_day),
                    formattedDate: formatDate(item.created_at),
                };
            })
        );

        return enrichedItems;
    }

    static async _fetchUserData(userId) {
        try {
            const { data, error } = await supabase
                .from("users")
                .select("id, first_name, last_name")
                .eq("id", userId)
                .single();

            return error ? null : data;
        } catch (error) {
            console.error("Error fetching user data:", error);
            return null;
        }
    }
}

// --- SEARCH SERVICE ---
export class SearchService {
    static async search(searchTerm) {
        try {
            const [usersData, itemsData] = await Promise.all([
                this._searchUsers(searchTerm),
                this._searchItems(searchTerm),
            ]);

            return {
                users: usersData || [],
                items: itemsData || [],
            };
        } catch (error) {
            console.error("Search failed:", error);
            throw error;
        }
    }
    static async _searchUsers(searchTerm) {
        const { data, error } = await supabase
            .from("users")
            .select("id, first_name, last_name, face_image_url")
            .or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%`)
            .limit(SEARCH_LIMIT);

        if (error) throw error;
        return data;
    }
    static async _searchItems(searchTerm) {
        const { data, error } = await supabase
            .from("items")
            .select(
                "item_id, user_id, category_id, title, description, price_per_day, deposit_fee, location, available, created_at, item_status, quantity"
            )
            .eq("available", true)
            .eq("item_status", "approved")
            .or(
                `title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,location.ilike.%${searchTerm}%`
            )
            .limit(SEARCH_LIMIT);

        if (error) throw error;
        return await ItemsService._enrichItemsData(data || []);
    }
}


// --- BOOKINGS SERVICE ---
export class BookingsService {
    static async fetchUserBookings(userId) {
        if (!userId) return [];

        try {
            const { data, error } = await supabase
                .from("rental_transactions")
                .select("item_id, status")
                .eq("renter_id", userId)
                .in("status", ["pending", "confirmed", "ongoing"]);

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error("Error fetching user bookings:", error);
            return [];
        }
    }
}

// --- CATEGORIES SERVICE ---
export class CategoriesService {
    static async fetchCategories() {
        try {
            const { data, error } = await supabase
                .from("categories")
                .select("category_id, name")
                .order("name");

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error("Error fetching categories:", error);
            return [];
        }
    }
}

export { ITEMS_PER_PAGE };