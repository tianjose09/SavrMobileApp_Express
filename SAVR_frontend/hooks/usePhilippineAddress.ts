import { useState, useEffect } from 'react';
import axios from 'axios';

export function usePhilippineAddress() {
  const [provinces, setProvinces] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);
  const [barangays, setBarangays] = useState<any[]>([]);

  const [selectedProvinceCode, setSelectedProvinceCode] = useState('');
  const [selectedCityCode, setSelectedCityCode] = useState('');
  
  const [isLoadingProvinces, setIsLoadingProvinces] = useState(false);
  const [isLoadingCities, setIsLoadingCities] = useState(false);
  const [isLoadingBarangays, setIsLoadingBarangays] = useState(false);

  useEffect(() => {
    const fetchProvinces = async () => {
      setIsLoadingProvinces(true);
      try {
        const response = await axios.get('https://psgc.gitlab.io/api/provinces/');
        const provs = response.data.map((p: any) => ({
          label: p.name,
          value: p.name,
          code: p.code,
          type: 'province'
        }));
        
        // Add NCR as a "province/region"
        provs.push({
          label: 'Metro Manila (NCR)',
          value: 'Metro Manila (NCR)',
          code: '130000000',
          type: 'region'
        });

        provs.sort((a: any, b: any) => a.label.localeCompare(b.label));
        setProvinces(provs);
      } catch (error) {
        console.error('Error fetching provinces:', error);
      } finally {
        setIsLoadingProvinces(false);
      }
    };

    fetchProvinces();
  }, []);

  const handleProvinceChange = async (provName: string) => {
    const prov = provinces.find(p => p.value === provName);
    if (!prov) {
        setCities([]);
        setBarangays([]);
        return;
    }
    
    setSelectedProvinceCode(prov.code);
    setIsLoadingCities(true);
    try {
      const endpoint = prov.type === 'region' 
        ? `https://psgc.gitlab.io/api/regions/${prov.code}/cities-municipalities/`
        : `https://psgc.gitlab.io/api/provinces/${prov.code}/cities-municipalities/`;
        
      const response = await axios.get(endpoint);
      const cits = response.data.map((c: any) => ({
        label: c.name,
        value: c.name,
        code: c.code
      })).sort((a: any, b: any) => a.label.localeCompare(b.label));
      
      setCities(cits);
      setBarangays([]); // Reset barangays
    } catch (error) {
      console.error('Error fetching cities:', error);
    } finally {
      setIsLoadingCities(false);
    }
  };

  const handleCityChange = async (cityName: string) => {
    const city = cities.find(c => c.value === cityName);
    if (!city) {
        setBarangays([]);
        return;
    }
    
    setSelectedCityCode(city.code);
    setIsLoadingBarangays(true);
    try {
      const response = await axios.get(`https://psgc.gitlab.io/api/cities-municipalities/${city.code}/barangays/`);
      const brgys = response.data.map((b: any) => ({
        label: b.name,
        value: b.name,
        code: b.code
      })).sort((a: any, b: any) => a.label.localeCompare(b.label));
      
      setBarangays(brgys);
    } catch (error) {
      console.error('Error fetching barangays:', error);
    } finally {
      setIsLoadingBarangays(false);
    }
  };

  return {
    provinces,
    cities,
    barangays,
    handleProvinceChange,
    handleCityChange,
    isLoadingProvinces,
    isLoadingCities,
    isLoadingBarangays
  };
}
