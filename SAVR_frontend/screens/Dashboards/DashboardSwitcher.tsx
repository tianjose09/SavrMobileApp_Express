import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { StorageUtils, StorageKeys } from '../../utils/storage';
import DonorDashboard from './DonorDashboard';
import OrgDashboard from './OrgDashboard';
import BeneficiaryDashboard from './BeneficiaryDashboard';
import PkDashboard from './PkDashboard';

export default function DashboardSwitcher(props: any) {
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    const fetchRole = async () => {
      // Prioritize explicit role, otherwise check user info
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
      setRole(userRole?.toLowerCase() || 'donor');
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
