// import { Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
// import React from 'react'

// const Home = () => {
//   return (
//     <View style={styles.container}>
//       <View style={styles.topMenuBar}>
//         <TextInput
//           placeholder='Search'
//           placeholderTextColor={'#000'}
//           style={styles.searchContainer}
//         />
//         <TouchableOpacity>
//           <View style={styles.heartContainer}>
//             <Image source={require('../../../assets/heart.png')} style={styles.heartLogo} />
//             <Text>Likes</Text>
//           </View>
//         </TouchableOpacity>
//       </View>
//       <View style={styles.categoriesContainer}>
//         <TouchableOpacity>
//           <Text style={styles.categoriesText}>Tools</Text>
//         </TouchableOpacity>
//         <TouchableOpacity>
//           <Text style={styles.categoriesText}>Cars</Text>
//         </TouchableOpacity>
//         <TouchableOpacity>
//           <Text style={styles.categoriesText}>Clothing & Accesories</Text>
//         </TouchableOpacity>
//         <TouchableOpacity>
//           <Text style={styles.categoriesText}>Others...</Text>
//         </TouchableOpacity>
//       </View>
//       <View style={styles.itemTextContainer}>
//         <Text style={styles.itemText}>Items</Text>
//       </View>

//       {/* Items */}
//       <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
//         <View style={styles.itemContainer}>
//           <View style={styles.itemImageContainer}>
//             <Image source={require('../../../assets/splash-icon.png')} style={styles.itemImage} />
//             <View style={styles.itemRateContainer}>
//               <Text style={styles.itemName}>Hand Tools Set</Text>
//               <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 10 }}>
//                 <Image source={require('../../../assets/rate.png')} style={styles.rateImage} />
//                 <Text> 5.0</Text>
//               </View>
//             </View>
//             <View style={{ alignSelf: 'baseline', paddingLeft: 10 }}>
//               <Text style={styles.text}>Igpit, Opol</Text>
//               <Text style={styles.text}>April 11-12</Text>
//               <View style={styles.moneyRateContainer}>
//                 <Text style={styles.moneyText}>₱180.65</Text>
//                 <Image
//                   source={require('../../../assets/like.png')}
//                   style={styles.likeImage}
//                 />
//               </View>
//             </View>
//           </View>
//         </View>

//         <View style={styles.itemContainer}>
//           <View style={styles.itemImageContainer}>
//             <Image source={require('../../../assets/splash-icon.png')} style={styles.itemImage} />
//             <View style={styles.itemRateContainer}>
//               <Text style={styles.itemName}>Hand Tools Set</Text>
//               <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 10 }}>
//                 <Image source={require('../../../assets/rate.png')} style={styles.rateImage} />
//                 <Text> 5.0</Text>
//               </View>
//             </View>
//             <View style={{ alignSelf: 'baseline', paddingLeft: 10 }}>
//               <Text style={styles.text}>Igpit, Opol</Text>
//               <Text style={styles.text}>April 11-12</Text>
//               <View style={styles.moneyRateContainer}>
//                 <Text style={styles.moneyText}>₱180.65</Text>
//                 <Image
//                   source={require('../../../assets/like.png')}
//                   style={styles.likeImage}
//                 />
//               </View>
//             </View>
//           </View>
//         </View>
//       </View>
//     </View>
//   )
// }

// export default Home

// const styles = StyleSheet.create({
//   container: {
//     backgroundColor: '#FAF5EF',
//     flex: 1,
//     marginTop: 40
//   },
//   topMenuBar: {
//     flexDirection: 'row',
//     alignSelf: 'center'
//   },
//   searchContainer: {
//     width: '80%',
//     height: 50,
//     borderWidth: 1,
//     borderColor: '#000',
//     borderRadius: 20,
//     paddingLeft: 20
//   },
//   heartContainer: {
//     flexDirection: 'column',
//     paddingLeft: 10
//   },
//   heartLogo: {
//     width: 34,
//     height: 30.5
//   },
//   categoriesContainer: {
//     flexDirection: 'row',
//     paddingLeft: 10
//   },
//   categoriesText: {
//     fontFamily: 'DM-Bold',
//     margin: 5
//   },
//   itemTextContainer: {
//     paddingLeft: 10,
//     paddingVertical: 10
//   },
//   itemText: {
//     fontFamily: 'DM-Bold',
//     fontSize: 32,
//     paddingLeft: 10
//   },
//   itemContainer: {
//     flexDirection: 'row',
//     marginHorizontal: 10,
//     alignSelf: 'center',
//   },
//   itemImageContainer: {
//     backgroundColor: '#FFFFFF',
//     height: 200,
//     borderRadius: 10,
//     alignItems: 'center',
//   },
//   itemImage: {
//     width: 150,
//     height: 100,
//     borderRadius: 10
//   },
//   itemRateContainer: {
//     flexDirection: 'row',
//   },
//   itemName: {
//     paddingVertical: 10,
//     fontFamily: 'DM-Medium',
//     fontSize: 14
//   },
//   rateImage: {
//     width: 12,
//     height: 12,
//     alignSelf: 'center'
//   },
//   text: {
//     color: '#9C9894'
//   },
//   moneyText: {
//     color: '#FFAB00',
//     fontFamily: 'DM-Bold'
//   },
//   likeImage: {
//     width: 20, 
//     height: 20
//   },
//   moneyRateContainer:{ 
//     flexDirection: 'row', 
//     justifyContent: 'space-between', 
//     width: 130 
//   }
// })

import { Image, StyleSheet, Text, TextInput, TouchableOpacity, View, ScrollView, ActivityIndicator, Alert } from 'react-native'
import React, { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../../supbaseClient'
import FavoritesModal from '../../components/FavoriteModal'

const Home = () => {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [categories, setCategories] = useState([])
  const [selectedCategoryId, setSelectedCategoryId] = useState("")
  const [favorites, setFavorites] = useState([])
  const [currentUser, setCurrentUser] = useState(null)
  const [favoritesModalVisible, setFavoritesModalVisible] = useState(false)

  // Get current user
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUser(user)
    }
    getCurrentUser()
  }, [])

  // Fetch user's favorites
  const fetchFavorites = useCallback(async () => {
    if (!currentUser) return

    const { data, error } = await supabase
      .from('favorites')
      .select('item_id')
      .eq('user_id', currentUser.id)

    if (!error) {
      setFavorites(data.map(fav => fav.item_id))
    }
  }, [currentUser])

  // Toggle favorite
  const toggleFavorite = async (itemId) => {
    if (!currentUser) {
      Alert.alert('Login Required', 'Please log in to add items to favorites')
      return
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
          setFavorites(prev => prev.filter(id => id !== itemId))
        } else {
          console.error('Error removing favorite:', error)
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
          setFavorites(prev => [...prev, itemId])
        } else {
          console.error('Error adding favorite:', error)
        }
      }
    } catch (error) {
      console.error('Toggle favorite error:', error)
      Alert.alert('Error', 'Failed to update favorites')
    }
  }

  const getImageUrl = async (userId, itemId) => {
    try {
      const dir = `${userId}/${itemId}`
      const { data: files, error } = await supabase.storage
        .from("Items-photos")
        .list(dir, {
          limit: 1,
          sortBy: { column: "name", order: "desc" },
        })

      if (error || !files || files.length === 0) return undefined

      const file = files[0]
      const fullPath = `${dir}/${file.name}`
      const { data: pub } = supabase.storage
        .from("Items-photos")
        .getPublicUrl(fullPath)

      return pub?.publicUrl
    } catch (e) {
      console.warn("image list failed", e.message)
      return undefined
    }
  }

  const fetchCategories = useCallback(async () => {
    const { data, error } = await supabase
      .from("categories")
      .select("category_id,name")
      .order("name")
    if (!error) setCategories(data || [])
  }, [])

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      // First attempt: include item_status and filter to approved
      let baseSelect = "item_id,user_id,category_id,title,description,price_per_day,deposit_fee,location,available,created_at,item_status"
      let query = supabase
        .from("items")
        .select(baseSelect)
        .eq("available", true)
        .eq("item_status", "approved")
        .order("created_at", { ascending: false })

      if (selectedCategoryId) {
        query = query.eq("category_id", Number(selectedCategoryId))
      }

      let { data, error } = await query

      // Fallback if item_status column does not exist
      if (error && (error.code === "42703" || /item_status/i.test(error.message))) {
        console.warn("item_status column missing; showing all available items.")
        let fallbackQuery = supabase
          .from("items")
          .select("item_id,user_id,category_id,title,description,price_per_day,deposit_fee,location,available,created_at")
          .eq("available", true)
          .order("created_at", { ascending: false })

        if (selectedCategoryId) {
          fallbackQuery = fallbackQuery.eq("category_id", Number(selectedCategoryId))
        }

        const fallback = await fallbackQuery
        data = fallback.data
        error = fallback.error
      }

      if (error) throw error

      // Fetch images for each item
      const withImages = await Promise.all(
        (data || []).map(async (item) => {
          const imageUrl = await getImageUrl(item.user_id, item.item_id)
          return {
            ...item,
            imageUrl: imageUrl,
            formattedPrice: `₱${item.price_per_day}`,
            formattedDate: new Date(item.created_at).toLocaleDateString()
          }
        })
      )

      // Filter based on search term
      const filtered = withImages.filter((item) => {
        if (!searchTerm) return true
        const needle = searchTerm.toLowerCase()
        return (
          item.title.toLowerCase().includes(needle) ||
          (item.description && item.description.toLowerCase().includes(needle)) ||
          (item.location && item.location.toLowerCase().includes(needle))
        )
      })

      setItems(filtered)
    } catch (e) {
      console.error("Fetch items failed:", e.message)
    } finally {
      setLoading(false)
    }
  }, [searchTerm, selectedCategoryId])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  // Load favorites when user is available
  useEffect(() => {
    fetchFavorites()
  }, [fetchFavorites])

  // Real-time updates
  useEffect(() => {
    const channel = supabase
      .channel("items_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "items" },
        () => {
          fetchItems()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchItems])

  // Real-time updates for favorites
  useEffect(() => {
    if (!currentUser) return

    const channel = supabase
      .channel("favorites_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "favorites",
          filter: `user_id=eq.${currentUser.id}`
        },
        () => {
          fetchFavorites()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentUser, fetchFavorites])

  const renderItem = (item) => (
    <View style={styles.itemContainer}>
      <View style={styles.itemImageContainer}>
        {item.imageUrl ? (
          <Image
            source={{ uri: item.imageUrl }}
            style={styles.itemImage}
            resizeMode="cover"
          />
        ) : (
          <Image
            source={require('../../../assets/splash-icon.png')}
            style={styles.itemImage}
            resizeMode="cover"
          />
        )}
        <View style={styles.itemRateContainer}>
          <Text style={styles.itemName}>{item.title}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 10 }}>
            <Image source={require('../../../assets/rate.png')} style={styles.rateImage} />
            <Text> 5.0</Text>
          </View>
        </View>
        <View style={{ alignSelf: 'baseline' }}>
          <Text style={styles.text}>{item.location || 'Location not specified'}</Text>
          <Text style={styles.text}>{item.formattedDate}</Text>
          <View style={styles.moneyRateContainer}>
            <Text style={styles.moneyText}>{item.formattedPrice}</Text>
            <TouchableOpacity onPress={() => toggleFavorite(item.item_id)}>
              <Image
                source={favorites.includes(item.item_id)
                  ? require('../../../assets/liked.png')
                  : require('../../../assets/like.png')
                }
                style={styles.likeImage}
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  )

  return (
    <>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.topMenuBar}>
          <TextInput
            placeholder='Search'
            placeholderTextColor={'#000'}
            style={styles.searchContainer}
            value={searchTerm}
            onChangeText={setSearchTerm}
          />
          <TouchableOpacity onPress={() => setFavoritesModalVisible(true)}>
            <View style={styles.heartContainer}>
              <Image source={require('../../../assets/heart.png')} style={styles.heartLogo} />
              <Text>Likes({favorites.length})</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Categories */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoriesContainer}
        >
          <TouchableOpacity onPress={() => setSelectedCategoryId("")}>
            <Text style={[
              styles.categoriesText,
              selectedCategoryId === "" && styles.selectedCategoryText
            ]}>
              All
            </Text>
          </TouchableOpacity>
          {categories.map((category) => (
            <TouchableOpacity
              key={category.category_id}
              onPress={() => setSelectedCategoryId(selectedCategoryId === String(category.category_id) ? "" : String(category.category_id))}
            >
              <Text style={[
                styles.categoriesText,
                selectedCategoryId === String(category.category_id) && styles.selectedCategoryText
              ]}>
                {category.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.itemTextContainer}>
          <Text style={styles.itemText}>Items</Text>
        </View>

        {/* Items Grid */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FFAB00" />
            <Text style={styles.loadingText}>Loading items...</Text>
          </View>
        ) : items.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No items found</Text>
          </View>
        ) : (
          <View style={styles.itemsGrid}>
            {items.map((item, index) => (
              <View key={item.item_id.toString()} style={styles.itemWrapper}>
                {renderItem(item)}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <FavoritesModal
        visible={favoritesModalVisible}
        onClose={() => setFavoritesModalVisible(false)}
        currentUser={currentUser}
        onFavoriteRemoved={(itemId) => {
          // Update Home component's favorites state immediately
          setFavorites(prev => prev.filter(id => id !== itemId))
        }}
      />
    </>
  )
}

export default Home

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FAF5EF',
    flex: 1,
    marginTop: 40
  },
  topMenuBar: {
    flexDirection: 'row',
    alignSelf: 'center',
    paddingHorizontal: 10,
    marginBottom: 10
  },
  searchContainer: {
    width: '80%',
    height: 50,
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 20,
    paddingLeft: 20
  },
  heartContainer: {
    flexDirection: 'column',
    paddingLeft: 10,
    alignItems: 'center'
  },
  heartLogo: {
    width: 34,
    height: 30.5
  },
  categoriesContainer: {
    paddingLeft: 10,
    marginBottom: 10
  },
  categoriesText: {
    fontFamily: 'DM-Bold',
    margin: 5,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 15,
    backgroundColor: '#FFFFFF'
  },
  selectedCategoryText: {
    backgroundColor: '#FFAB00',
    color: '#FFFFFF'
  },
  itemTextContainer: {
    paddingLeft: 10,
    paddingVertical: 10
  },
  itemText: {
    fontFamily: 'DM-Bold',
    fontSize: 32,
    paddingLeft: 10
  },
  itemsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 10,
    justifyContent: 'space-between'
  },
  itemWrapper: {
    width: '48%',
    marginBottom: 15
  },
  itemContainer: {
    flex: 1
  },
  itemImageContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
  },
  itemImage: {
    width: '100%',
    height: 120,
    borderRadius: 10,
    marginBottom: 10
  },
  itemRateContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
    height: 50
  },
  itemName: {
    flex: 1,
    fontFamily: 'DM-Medium',
    fontSize: 14
  },
  rateImage: {
    width: 12,
    height: 12,
    marginRight: 3
  },
  text: {
    color: '#9C9894',
    fontSize: 12,
    marginBottom: 2
  },
  moneyText: {
    color: '#FFAB00',
    fontFamily: 'DM-Bold',
    fontSize: 16
  },
  likeImage: {
    width: 20,
    height: 20
  },
  moneyRateContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    width: 130
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50
  },
  loadingText: {
    marginTop: 10,
    color: '#9C9894',
    fontSize: 16
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50
  },
  emptyText: {
    color: '#9C9894',
    fontSize: 18,
    fontFamily: 'DM-Medium'
  }
})