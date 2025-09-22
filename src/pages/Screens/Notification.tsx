import { StyleSheet, Text, View, FlatList, ActivityIndicator } from 'react-native';
import React, { useEffect, useState } from 'react';
import { supabase } from '../../../supbaseClient';
import { useFavorites } from '../../components/FavoritesContext';

const Notification = () => {
  const { currentUser } = useFavorites(); // Assuming you already have the currentUser
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch notifications from Supabase
  const fetchNotifications = async () => {
    if (!currentUser?.id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotifications(data || []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();

    // Optional: set up realtime listener
    const channel = supabase
      .channel(`notifications_user_${currentUser?.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${currentUser?.id}` },
        (payload) => {
          console.log('New notification:', payload.new);
          setNotifications(prev => [payload.new, ...prev]); // prepend new notification
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [currentUser?.id]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFAB00" />
      </View>
    );
  }

  if (!notifications.length) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No notifications yet</Text>
      </View>
    );
  }

  const renderItem = ({ item }) => (
    <View style={styles.notificationItem}>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.message}>{item.message}</Text>
      <Text style={styles.date}>{new Date(item.created_at).toLocaleString()}</Text>
    </View>
  );

  return (
    <FlatList
      data={notifications}
      keyExtractor={(item) => item.notification_id}
      renderItem={renderItem}
      contentContainerStyle={{ padding: 10 }}
    />
  );
};

export default Notification;

const styles = StyleSheet.create({
  notificationItem: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    elevation: 2,
  },
  title: { fontWeight: 'bold', fontSize: 16, marginBottom: 5 },
  message: { fontSize: 14, marginBottom: 5 },
  date: { fontSize: 12, color: '#888' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 16, color: '#888' },
});
