import { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { SearchService } from '../services/supabaseServices';

const SEARCH_DEBOUNCE_MS = 500;

interface SearchResults {
  users: any[];
  items: any[];
}

export const useSearch = (searchTerm: string) => {
  const [searchResults, setSearchResults] = useState<SearchResults>({ users: [], items: [] });
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    // When the search term is cleared, immediately hide results.
    if (searchTerm.trim() === '') {
      setShowResults(false);
      setSearchResults({ users: [], items: [] });
      return;
    }

    // Set up a timer to debounce the search API call.
    const timerId = setTimeout(async () => {
      const trimmed = searchTerm.trim();

      setIsSearching(true);
      try {
        const results = await SearchService.search(trimmed);
        setSearchResults(results);
        setShowResults(true); // Show results only after a successful search
      } catch (error) {
        console.error("Search failed:", error);
        Alert.alert("Error", "Search failed. Please try again.");
        setShowResults(false); // Hide results on error
      } finally {
        setIsSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    // Cleanup function to clear the timer if the user types again.
    return () => clearTimeout(timerId);
  }, [searchTerm]);

  return { searchResults, isSearching, showResults, setShowResults };
};