import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { db } from '@/db/client';
import { findFoodByBarcode, saveExternalFood } from '@/db/repos/foods';
import type { Meal } from '@/db/schema';
import { foodApi, FoodApiError } from '@/services/food/api';
import { barcodeKey, normalizeBarcode } from '@/services/food/off';
import { Button, Card, Screen, Text, space } from '@/ui';

type State = { kind: 'scanning' } | { kind: 'looking' } | { kind: 'notFound'; code: string } | { kind: 'offline'; code: string };

export default function Scan() {
  const params = useLocalSearchParams<{ date?: string; meal?: Meal }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [state, setState] = useState<State>({ kind: 'scanning' });
  const busy = useRef(false);

  const openFood = (id: string) => router.replace({ pathname: '/food/[id]', params: { id, date: params.date, meal: params.meal } });

  const lookup = async (code: string) => {
    const local = findFoodByBarcode(db, barcodeKey(code));
    if (local) return openFood(local.id);
    setState({ kind: 'looking' });
    try {
      const found = await foodApi.lookupBarcode(code);
      if (found) return openFood(saveExternalFood(db, { ...found, barcode: found.barcode ?? code }));
      setState({ kind: 'notFound', code });
    } catch (e) {
      setState(e instanceof FoodApiError && e.kind === 'offline' ? { kind: 'offline', code } : { kind: 'notFound', code });
    }
  };

  const onScanned = (r: BarcodeScanningResult) => {
    const code = normalizeBarcode(r.data);
    if (!code || busy.current) return;
    busy.current = true;
    lookup(code);
  };

  const scanAgain = () => {
    busy.current = false;
    setState({ kind: 'scanning' });
  };

  if (!permission) return null;
  if (!permission.granted) {
    return (
      <Screen>
        <Text variant="title">Scan barcodes</Text>
        <Text>Burnrate needs camera access to scan food barcodes. Photos aren&apos;t taken or stored.</Text>
        {permission.canAskAgain ? (
          <Button title="Allow camera" onPress={requestPermission} />
        ) : (
          <Button title="Open Settings" onPress={() => Linking.openSettings()} />
        )}
        <Button title="Cancel" variant="ghost" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
        onBarcodeScanned={state.kind === 'scanning' ? onScanned : undefined}
        accessibilityLabel="Camera viewfinder. Point at a barcode."
      />
      <SafeAreaView style={{ flex: 1, justifyContent: 'space-between', padding: space.lg }}>
        <View style={{ alignSelf: 'center', marginTop: '40%', width: '80%', height: 160, borderWidth: 2, borderColor: '#FFFFFFCC', borderRadius: 16 }} importantForAccessibility="no" />
        <Card>
          {state.kind === 'scanning' ? <Text>Point the camera at a barcode.</Text> : null}
          {state.kind === 'looking' ? (
            <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
              <ActivityIndicator />
              <Text>Looking it up…</Text>
            </View>
          ) : null}
          {state.kind === 'notFound' ? (
            <>
              <Text>We couldn&apos;t find this product. You can add it once and it&apos;ll be here next time.</Text>
              <Button
                title="Create this food"
                onPress={() => router.replace({ pathname: '/food/custom', params: { barcode: state.code, date: params.date, meal: params.meal } })}
              />
              <Button title="Scan again" variant="ghost" onPress={scanAgain} />
            </>
          ) : null}
          {state.kind === 'offline' ? (
            <>
              <Text>Looking up new barcodes needs a connection. Foods you&apos;ve scanned before work offline.</Text>
              <Button title="Try again" onPress={() => lookup(state.code)} />
              <Button title="Scan again" variant="ghost" onPress={scanAgain} />
            </>
          ) : null}
          <Button title="Close" variant="ghost" compact onPress={() => router.back()} />
        </Card>
      </SafeAreaView>
    </View>
  );
}
