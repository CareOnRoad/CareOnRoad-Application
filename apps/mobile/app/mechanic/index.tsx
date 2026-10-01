import React from 'react';
import { Redirect } from 'expo-router';

/**
 * Entry của nhóm Mechanic - chuyển sang tab group chính.
 * Role check đã được thực hiện ở `app/mechanic/_layout.tsx`.
 */
export default function MechanicIndex() {
  return <Redirect href="/mechanic/(tabs)" />;
}
