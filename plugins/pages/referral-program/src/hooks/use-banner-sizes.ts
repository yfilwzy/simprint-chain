import { useState, useEffect } from 'react';
import type { PromoBannerSize } from '../types';
import { get } from '@/lib/request';
import { API_ENDPOINTS } from '../constants';

export interface UseBannerSizesReturn {
  bannerSizes: PromoBannerSize[];
  selectedBannerSize: string;
  setSelectedBannerSize: (size: string) => void;
}

export function useBannerSizes(): UseBannerSizesReturn {
  const [bannerSizes, setBannerSizes] = useState<PromoBannerSize[]>([]);
  const [selectedBannerSize, setSelectedBannerSize] = useState<string>('630x330');

  useEffect(() => {
    const fetchBannerSizes = async () => {
      try {
        const result = await get<PromoBannerSize[]>(API_ENDPOINTS.BANNER_SIZES);
        if (!result || result.code !== 1) {
          throw new Error(result?.message || '获取推广物料尺寸失败');
        }
        const data = result.data ?? [];
        setBannerSizes(data);
        if (data.length > 0) {
          setSelectedBannerSize(data[0].id);
        }
      } catch (e) {
        console.error('Failed to fetch banner sizes:', e);
      }
    };
    void fetchBannerSizes();
  }, []);

  return {
    bannerSizes,
    selectedBannerSize,
    setSelectedBannerSize,
  };
}
