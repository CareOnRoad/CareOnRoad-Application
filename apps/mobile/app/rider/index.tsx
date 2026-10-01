import React from 'react';
import { Redirect } from 'expo-router';

/**
 * Entry của nhóm Rider - chuyển sang tab group chính.
 * Role check đã được thực hiện ở `app/rider/_layout.tsx`.
 */
export default function RiderIndex() {
  return <Redirect href="/rider/(tabs)" />;
}
