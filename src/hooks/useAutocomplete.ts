'use client';

import { useQuery } from '@tanstack/react-query';

export interface AutocompleteSuggestion {
  id: string;
  name: string;
  value?: string | number;
  category: 'function' | 'folder' | 'variable';
  inputs?: string;
}

const API_URL = 'https://652f91320b8d8ddac0b2b62b.mockapi.io/autocomplete';

async function fetchSuggestions(query: string): Promise<AutocompleteSuggestion[]> {
  const response = await fetch(API_URL);
  if (!response.ok) {
    throw new Error('Failed to fetch suggestions');
  }
  
  const apiData = await response.json();
  
  // Transform API data to match our interface
  return apiData
    .filter((item: any) => 
      item.name.toLowerCase().includes(query.toLowerCase()) ||
      (item.inputs && item.inputs.toLowerCase().includes(query.toLowerCase()))
    )
    .map((item: any) => ({
      id: item.id,
      name: item.name,
      value: item.value !== undefined ? item.value : undefined,
      category: 'variable' as const,
      inputs: item.inputs,
    }));
}

export function useAutocomplete(query: string) {
  const { data = [], isLoading, error, refetch } = useQuery({
    queryKey: ['autocomplete', query],
    queryFn: () => fetchSuggestions(query),
    enabled: !!query,
    staleTime: 60 * 1000, // 1 minute
  });

  return {
    data,
    isLoading,
    error,
    refetch,
  };
} 