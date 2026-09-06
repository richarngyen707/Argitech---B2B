export interface SearchResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type?: string;
  importance?: number;
}

export async function searchNominatimLocations(query: string): Promise<SearchResult[]> {
  if (!query || query.trim().length < 2) return [];

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      query.trim()
    )}&limit=5&addressdetails=1`;
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error(`Nominatim error: ${res.status}`);
    }

    const data: SearchResult[] = await res.json();
    return data || [];
  } catch (error) {
    // Offline pre-programmed common agritech regions fallback
    const fallbackRegions: SearchResult[] = [
      {
        place_id: 1,
        display_name: 'Cần Thơ, Mekong Delta, Vietnam (Rice Granary)',
        lat: '10.0050',
        lon: '105.7220',
      },
      {
        place_id: 2,
        display_name: 'Mato Grosso, Central-West Region, Brazil (Soybean Belt)',
        lat: '-12.6819',
        lon: '-56.9211',
      },
      {
        place_id: 3,
        display_name: 'Central Valley, California, United States (Precision Orchards)',
        lat: '36.7378',
        lon: '-119.7871',
      },
      {
        place_id: 4,
        display_name: 'Beauceron Agricultural Plain, France (Wheat & Rapeseed)',
        lat: '48.3500',
        lon: '1.6000',
      },
      {
        place_id: 5,
        display_name: 'Heilongjiang Agricultural Reclamation Area, China (Corn & Grain)',
        lat: '45.7567',
        lon: '126.6424',
      },
      {
        place_id: 6,
        display_name: 'Andalusia Olive Groves, Seville, Spain',
        lat: '37.3891',
        lon: '-5.9845',
      },
    ];

    return fallbackRegions.filter((r) =>
      r.display_name.toLowerCase().includes(query.toLowerCase())
    );
  }
}
