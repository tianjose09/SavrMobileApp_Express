import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { StorageUtils, StorageKeys } from '../../utils/storage';
import DonorDashboard from './DonorDashboard';
import OrgDashboard from './OrgDashboard';
import BeneficiaryDashboard from './BeneficiaryDashboard';
import PkDashboard from './PkDashboard';

import { ApiService } from '../../services/api';

export default function DashboardSwitcher(props: any) {
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    const fetchRole = async () => {
      let userRole = await StorageUtils.getItem(StorageKeys.USER_ROLE);
      if (!userRole) {
        const userInfoRaw = await StorageUtils.getItem(StorageKeys.USER_INFO);
        if (userInfoRaw) {
          try {
            const parsed = JSON.parse(userInfoRaw);
            userRole = parsed?.role || parsed?.user_type || 'donor';
          } catch (e) { }
        }
      }
      const normalizedRole = userRole?.toLowerCase() || 'donor';
      setRole(normalizedRole);

      // Self-healing check: query profile to see if role has changed or needs update
      try {
        const response = await ApiService.getProfile();
        if (response.data && response.data.success) {
          const apiUser = response.data.user;
          const apiRole = apiUser?.role?.toLowerCase();
          if (apiRole && apiRole !== normalizedRole) {
            await StorageUtils.setItem(StorageKeys.USER_ROLE, apiRole);
            await StorageUtils.setItem(StorageKeys.DISPLAY_NAME, response.data.display_name || '');
            await StorageUtils.setItem(StorageKeys.USER_INFO, JSON.stringify(apiUser));
            setRole(apiRole);
          }
        }
      } catch (err: any) {
        console.log('Background dashboard switcher sync skipped:', err?.message || err);
      }
    };
    fetchRole();
  }, []);

  if (!role) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F3EFE6' }}>
        <ActivityIndicator size="large" color="#00592d" />
      </View>
    );
  }

  if (role === 'organization') {
    return <OrgDashboard {...props} />;
  }

  if (role === 'beneficiary') {
    return <BeneficiaryDashboard {...props} />;
  }

  if (role === 'partner_kitchen') {
    return <PkDashboard {...props} />;
  }

  return <DonorDashboard {...props} />;
}
