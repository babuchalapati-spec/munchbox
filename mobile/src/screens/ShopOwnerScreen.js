import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Image } from 'react-native';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { useAuth } from '../context/AuthContext';
import { listOrders, updateOrderStatus, listDeliveryPartners, assignDelivery } from '../api/orders';
import { listProducts, createProduct, updateProduct, deleteProduct } from '../api/products';
import { getShop } from '../api/shops';
import { uploadImage } from '../api/upload';
import DeliveryTrackingMap from '../components/DeliveryTrackingMap';
import { listLedger, getPaymentInfo, requestTopUp } from '../api/ledger';
import { Linking } from 'react-native';
import { imageUri } from '../api/client';
import { colors } from '../theme';

const CATEGORIES = ['Cake', 'Food', 'Catering'];
// Next status a shop can move an order to, with a friendly label.
const NEXT_STAGE = {
  placed: { next: 'confirmed', label: '✅ Accept order' },
  confirmed: { next: 'baking', label: '👨‍🍳 Start cooking' },
  baking: { next: 'ready', label: '📦 Ready — call delivery' },
};
const STAGE_LABEL = {
  placed: '🆕 New — needs accepting',
  confirmed: '✅ Accepted',
  baking: '👨‍🍳 Cooking',
  ready: '📦 Ready · waiting for delivery boy',
  heading_to_shop: '🛵 Delivery partner coming',
  out_for_delivery: '🚚 Out for delivery',
  delivered: '✓ Delivered',
  cancelled: '✕ Cancelled',
};

export default function ShopOwnerScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [shop, setShop] = useState(null);
  const [partners, setPartners] = useState([]);
  const [ledger, setLedger] = useState({ entries: [], balance: 0 });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [newItem, setNewItem] = useState({ name: '', category: 'Cake', basePrice: '', addOns: '', image: null, imageLink: '', isVeg: true, eggless: false, cakeType: 'Cake' });
  const [adding, setAdding] = useState(false);
  const [topUp, setTopUp] = useState({ amount: '', reference: '', open: false, busy: false });
  const [editingItemId, setEditingItemId] = useState(null);
  const [editDraft, setEditDraft] = useState({ name: '', basePrice: '' });
  const [editImage, setEditImage] = useState(null);
  const [brokenImages, setBrokenImages] = useState(() => new Set());
  const markBroken = (id) => setBrokenImages((prev) => new Set(prev).add(id));

  const shopId = user?.shop?._id || user?.shop;

  async function load() {
    try {
      const [ordersData, productsData, ledgerData, partnersData, shopData] = await Promise.all([
        listOrders().catch(() => []),
        (shopId ? listProducts(shopId) : Promise.resolve([])).catch(() => []),
        listLedger({ ownerId: user?._id || user?.id }).catch(() => ({ entries: [], balance: 0 })),
        listDeliveryPartners().catch(() => []),
        (shopId ? getShop(shopId) : Promise.resolve(null)).catch(() => null),
      ]);
      setOrders(ordersData || []);
      setProducts(productsData || []);
      setLedger(ledgerData || { entries: [], balance: 0 });
      setPartners(partnersData || []);
      setShop(shopData);
    } finally {
      setLoading(false);
    }
  }

  function pickItemImage() {
    Alert.alert('Item photo', 'Choose a source', [
      { text: 'Camera', onPress: () => grabImage(launchCamera) },
      { text: 'Gallery', onPress: () => grabImage(launchImageLibrary) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function grabImage(launcher) {
    const res = await launcher({ mediaType: 'photo', quality: 0.7 });
    if (res.didCancel || !res.assets?.[0]) return;
    setNewItem((s) => ({ ...s, image: { uri: res.assets[0].uri, uploading: true } }));
    try {
      const url = await uploadImage(res.assets[0]);
      setNewItem((s) => ({ ...s, image: { uri: res.assets[0].uri, url } }));
    } catch (err) {
      setNewItem((s) => ({ ...s, image: null }));
      Alert.alert('Upload failed', 'Could not upload the photo. Try again.');
    }
  }

  async function addItem() {
    if (!newItem.name.trim() || !newItem.basePrice) {
      Alert.alert('Missing info', 'Enter an item name and price.');
      return;
    }
    setAdding(true);

    // Parse "Extra cheese +40, Olives +20" into add-on objects.
    const addOns = newItem.addOns
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((part) => {
        const m = part.match(/(.+?)\s*\+?\s*(\d+)?\s*$/);
        return { name: (m?.[1] || part).trim(), price: Number(m?.[2] || 0) };
      });
    // An online image link (https://...) wins; otherwise use the uploaded photo.
    const link = newItem.imageLink.trim();

    let saved = false;
    try {
      const created = await createProduct({
        name: newItem.name.trim(),
        category: newItem.category,
        basePrice: Number(newItem.basePrice),
        available: true,
        imageUrl: link || newItem.image?.url || '',
        addOns,
        isVeg: newItem.category === 'Cake' ? true : newItem.isVeg,
        eggless: newItem.category === 'Cake' ? newItem.eggless : false,
        cakeType: newItem.category === 'Cake' ? newItem.cakeType : 'Cake',
      });
      saved = true;
      if (created?._id) {
        const refreshed = await listProducts(shopId);
        setProducts(refreshed || []);
      }
    } catch (err) {
      // Show the REAL reason (server message, or the network/timeout error).
      const reason =
        err.response?.data?.message ||
        (err.code === 'ECONNABORTED' ? 'The server took too long to respond.' : null) ||
        err.message ||
        'Try again';
      Alert.alert('Could not add item', reason);
    } finally {
      setAdding(false);
    }

    // Only after a confirmed save: clear the form and refresh. A refresh problem must
    // never be reported as "could not add item" — the item is already saved.
    if (saved) {
      setNewItem({ name: '', category: 'Cake', basePrice: '', addOns: '', image: null, imageLink: '', isVeg: true, eggless: false, cakeType: 'Cake' });
      try {
        await load();
      } catch (err) {
        // ignore: the item is saved; the list will refresh on next load
      }
      Alert.alert('Item added', 'Your item is saved and is now available to customers. Turn it off anytime if you want to hide it.');
    }
  }

  // Opens the shop owner's UPI app (GPay/PhonePe/Paytm) to pay the admin the advance.
  async function payByUpi() {
    const amount = Number(topUp.amount);
    if (!amount || amount <= 0) {
      Alert.alert('Enter amount', 'How much advance do you want to add?');
      return;
    }
    try {
      const info = await getPaymentInfo();
      if (!info?.upiId) {
        Alert.alert('UPI not set up', 'The admin has not added a UPI ID yet. Please contact the admin.');
        return;
      }
      const url =
        `upi://pay?pa=${encodeURIComponent(info.upiId)}` +
        `&pn=${encodeURIComponent(info.payeeName || 'Munchbox')}` +
        `&am=${amount}&cu=INR` +
        `&tn=${encodeURIComponent('Munchbox shop advance')}`;
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert('No UPI app', `Pay ₹${amount} to UPI ID:\n\n${info.upiId}\n\nThen enter the reference number below.`);
        return;
      }
      await Linking.openURL(url);
    } catch (err) {
      Alert.alert('Error', 'Could not open your UPI app. Pay the admin and enter the reference below.');
    }
  }

  // After paying, the shop submits the UPI reference; admin confirms and credits it.
  async function submitTopUp() {
    const amount = Number(topUp.amount);
    if (!amount || amount <= 0) {
      Alert.alert('Enter amount', 'Enter the amount you paid.');
      return;
    }
    setTopUp((s) => ({ ...s, busy: true }));
    try {
      const res = await requestTopUp(amount, topUp.reference.trim());
      setTopUp({ amount: '', reference: '', open: false, busy: false });
      await load();
      Alert.alert('Payment submitted', res.message || 'The admin will confirm and credit your balance.');
    } catch (err) {
      Alert.alert('Could not submit', err.response?.data?.message || 'Try again');
      setTopUp((s) => ({ ...s, busy: false }));
    }
  }

  async function advanceStage(order) {
    const stage = NEXT_STAGE[order.status];
    if (!stage) return;
    setBusyId(order._id);
    try {
      await updateOrderStatus(order._id, stage.next);
      await load();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Could not update order');
    } finally {
      setBusyId(null);
    }
  }

  function assignToPartner(order) {
    if (!partners.length) {
      Alert.alert('No delivery partners', 'No delivery partners are available to assign yet.');
      return;
    }
    Alert.alert(
      'Assign delivery partner',
      `Order for ${order.user?.name || 'customer'}`,
      [
        ...partners.slice(0, 6).map((p) => ({
          text: `${p.name}${p.kyc?.status === 'verified' ? ' ✅' : ''}`,
          onPress: async () => {
            setBusyId(order._id);
            try {
              await assignDelivery(order._id, p._id);
              await load();
            } catch (err) {
              Alert.alert('Error', err.response?.data?.message || 'Could not assign');
            } finally {
              setBusyId(null);
            }
          },
        })),
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  }

  async function toggleAvailable(item) {
    setBusyId(item._id);
    try {
      await updateProduct(item._id, { available: !item.available });
      const refreshed = await listProducts(shopId);
      setProducts(refreshed || []);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Could not update item');
    } finally {
      setBusyId(null);
    }
  }

  function startEditItem(item) {
    setEditingItemId(item._id);
    setEditDraft({ name: item.name, basePrice: String(item.basePrice), isVeg: item.isVeg !== false, eggless: Boolean(item.eggless), cakeType: item.cakeType || 'Cake' });
    setEditImage(null);
  }

  function pickEditImage() {
    Alert.alert('Item photo', 'Choose a source', [
      { text: 'Camera', onPress: () => grabEditImage(launchCamera) },
      { text: 'Gallery', onPress: () => grabEditImage(launchImageLibrary) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function grabEditImage(launcher) {
    const res = await launcher({ mediaType: 'photo', quality: 0.7 });
    if (res.didCancel || !res.assets?.[0]) return;
    setEditImage({ uri: res.assets[0].uri, uploading: true });
    try {
      const url = await uploadImage(res.assets[0]);
      setEditImage({ uri: res.assets[0].uri, url });
    } catch (err) {
      setEditImage(null);
      Alert.alert('Upload failed', 'Could not upload the photo. Try again.');
    }
  }

  async function saveEditItem(itemId) {
    if (!editDraft.name.trim() || !editDraft.basePrice) {
      Alert.alert('Missing info', 'Enter a name and price.');
      return;
    }
    setBusyId(itemId);
    try {
      const payload = { name: editDraft.name.trim(), basePrice: Number(editDraft.basePrice), isVeg: editDraft.isVeg, eggless: editDraft.eggless, cakeType: editDraft.cakeType };
      if (editImage?.url) payload.imageUrl = editImage.url;
      await updateProduct(itemId, payload);
      const refreshed = await listProducts(shopId);
      setProducts(refreshed || []);
      setEditingItemId(null);
      setEditImage(null);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Could not save changes');
    } finally {
      setBusyId(null);
    }
  }

  function removeItem(item) {
    Alert.alert('Delete item', `Remove "${item.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusyId(item._id);
          try {
            await deleteProduct(item._id);
            const refreshed = await listProducts(shopId);
            setProducts(refreshed || []);
          } catch (err) {
            Alert.alert('Error', err.response?.data?.message || 'Could not delete');
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  }

  useEffect(() => {
    if (user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{shop?.name || 'Shop owner'}</Text>
      <Text style={styles.subtitle}>{user?.name}</Text>

      {shop?.deposit?.required && !shop.deposit.paid && (
        <View style={[styles.card, styles.depositCard]}>
          <Text style={styles.cardTitle}>⏳ Activation deposit required</Text>
          <Text style={styles.muted}>
            Pay ₹{shop.deposit.amount} via UPI below to activate your shop. Customers won't see your shop until the
            admin confirms this payment.
          </Text>
        </View>
      )}

      <View style={styles.card}>
        <View style={styles.cardHead}>
          <Text style={styles.cardTitle}>Advance balance</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Earnings')}>
            <Text style={styles.refresh}>View ledger ›</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.amount}>₹{Number(ledger.balance || 0).toFixed(2)}</Text>
        {Number(ledger.balance || 0) < 500 && (
          <Text style={styles.lowBal}>⚠️ Below ₹500 — customers can't order from your shop until you top up.</Text>
        )}
        {ledger.pendingTopUps?.length ? (
          <Text style={styles.pendingBal}>
            ⏳ ₹{ledger.pendingTopUps.reduce((t, e) => t + Number(e.amount || 0), 0)} awaiting admin confirmation
          </Text>
        ) : null}

        {!topUp.open ? (
          <TouchableOpacity style={styles.readyBtn} onPress={() => setTopUp((s) => ({ ...s, open: true }))}>
            <Text style={styles.readyBtnText}>＋ Add balance (UPI)</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.addBox}>
            <TextInput
              style={styles.addInput}
              placeholder="Amount ₹ (e.g. 1000)"
              keyboardType="number-pad"
              value={topUp.amount}
              onChangeText={(v) => setTopUp((s) => ({ ...s, amount: v.replace(/[^0-9]/g, '') }))}
            />
            <TouchableOpacity style={styles.readyBtn} onPress={payByUpi}>
              <Text style={styles.readyBtnText}>💳 Pay ₹{topUp.amount || '0'} via UPI</Text>
            </TouchableOpacity>
            <Text style={styles.muted}>After paying, enter the UPI reference number and submit:</Text>
            <TextInput
              style={styles.addInput}
              placeholder="UPI reference / transaction ID"
              value={topUp.reference}
              onChangeText={(v) => setTopUp((s) => ({ ...s, reference: v }))}
            />
            <View style={styles.addRow}>
              <TouchableOpacity style={[styles.assignBtn, { flex: 1 }]} onPress={() => setTopUp({ amount: '', reference: '', open: false, busy: false })}>
                <Text style={styles.assignBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.addBtn} onPress={submitTopUp} disabled={topUp.busy}>
                {topUp.busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.addBtnText}>Submit payment</Text>}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Recent payments</Text>
        {ledger.entries?.length ? ledger.entries.slice(0, 5).map((entry) => (
          <View key={entry._id} style={styles.row}>
            <Text style={styles.rowText}>{entry.description}</Text>
            <Text style={styles.rowAmount}>{entry.direction === 'credit' ? '+' : '-'}₹{Number(entry.amount || 0).toFixed(2)}</Text>
          </View>
        )) : <Text style={styles.muted}>No payments yet.</Text>}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Menu items ({products.length})</Text>
        <Text style={styles.muted}>Add what you sell. Customers see available items in the app.</Text>

        <View style={styles.addBox}>
          <View style={styles.addRow}>
            <TouchableOpacity style={styles.photoBox} onPress={pickItemImage}>
              {newItem.image?.uri ? (
                <Image source={{ uri: newItem.image.uri }} style={styles.photoThumb} />
              ) : (
                <Text style={styles.photoPlus}>📷{'\n'}Photo</Text>
              )}
              {newItem.image?.uploading ? <ActivityIndicator style={styles.photoLoad} color={colors.primary} /> : null}
            </TouchableOpacity>
            <TextInput
              style={[styles.addInput, { flex: 1, marginBottom: 0 }]}
              placeholder="Item name (e.g. Chocolate cake)"
              value={newItem.name}
              onChangeText={(v) => setNewItem((s) => ({ ...s, name: v }))}
            />
          </View>
          <View style={styles.addRow}>
            <View style={styles.catPick}>
              {CATEGORIES.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.catChip, newItem.category === c && styles.catChipActive]}
                  onPress={() => setNewItem((s) => ({ ...s, category: c }))}
                >
                  <Text style={[styles.catChipText, newItem.category === c && styles.catChipTextActive]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          {newItem.category !== 'Cake' && (
            <View style={styles.addRow}>
              <TouchableOpacity
                style={[styles.catChip, newItem.isVeg && { backgroundColor: '#2e7d32', borderColor: '#2e7d32' }]}
                onPress={() => setNewItem((s) => ({ ...s, isVeg: true }))}
              >
                <Text style={[styles.catChipText, newItem.isVeg && styles.catChipTextActive]}>🟢 Veg</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.catChip, !newItem.isVeg && { backgroundColor: '#c62828', borderColor: '#c62828' }]}
                onPress={() => setNewItem((s) => ({ ...s, isVeg: false }))}
              >
                <Text style={[styles.catChipText, !newItem.isVeg && styles.catChipTextActive]}>🔴 Non-veg</Text>
              </TouchableOpacity>
            </View>
          )}
          {newItem.category === 'Cake' && (
            <View style={styles.addRow}>
              <View style={styles.catPick}>
                {['Cake', 'Pastry', 'Pudding', 'Other'].map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.catChip, newItem.cakeType === t && styles.catChipActive]}
                    onPress={() => setNewItem((s) => ({ ...s, cakeType: t }))}
                  >
                    <Text style={[styles.catChipText, newItem.cakeType === t && styles.catChipTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
          {newItem.category === 'Cake' && (
            <View style={styles.addRow}>
              <TouchableOpacity
                style={[styles.catChip, !newItem.eggless && { backgroundColor: '#8d6e63', borderColor: '#8d6e63' }]}
                onPress={() => setNewItem((s) => ({ ...s, eggless: false }))}
              >
                <Text style={[styles.catChipText, !newItem.eggless && styles.catChipTextActive]}>🥚 With egg</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.catChip, newItem.eggless && { backgroundColor: '#2e7d32', borderColor: '#2e7d32' }]}
                onPress={() => setNewItem((s) => ({ ...s, eggless: true }))}
              >
                <Text style={[styles.catChipText, newItem.eggless && styles.catChipTextActive]}>🌱 Eggless</Text>
              </TouchableOpacity>
            </View>
          )}
          <TextInput
            style={styles.addInput}
            placeholder="Or paste a direct image URL (ends in .jpg/.png, not a webpage)"
            autoCapitalize="none"
            value={newItem.imageLink}
            onChangeText={(v) => setNewItem((s) => ({ ...s, imageLink: v }))}
          />
          <TextInput
            style={styles.addInput}
            placeholder={
              newItem.category === 'Catering'
                ? 'Curries (e.g. Dal +20, Rice +0, Sambar +15, Vankaya curry +25)'
                : 'Toppings / add-ons (e.g. Extra cheese +40, Olives +20)'
            }
            value={newItem.addOns}
            onChangeText={(v) => setNewItem((s) => ({ ...s, addOns: v }))}
          />
          <View style={styles.addRow}>
            <TextInput
              style={[styles.addInput, { flex: 1, marginBottom: 0 }]}
              placeholder="Price ₹"
              keyboardType="number-pad"
              value={newItem.basePrice}
              onChangeText={(v) => setNewItem((s) => ({ ...s, basePrice: v.replace(/[^0-9]/g, '') }))}
            />
            <TouchableOpacity style={styles.addBtn} onPress={addItem} disabled={adding}>
              {adding ? <ActivityIndicator color="#fff" /> : <Text style={styles.addBtnText}>+ Add item</Text>}
            </TouchableOpacity>
          </View>
        </View>

        {products.length ? products.map((p) => (
          editingItemId === p._id ? (
            <View key={p._id} style={styles.addBox}>
              <TextInput style={styles.addInput} placeholder="Item name" value={editDraft.name} onChangeText={(v) => setEditDraft((d) => ({ ...d, name: v }))} />
              <TextInput style={styles.addInput} placeholder="Price ₹" keyboardType="number-pad" value={editDraft.basePrice} onChangeText={(v) => setEditDraft((d) => ({ ...d, basePrice: v.replace(/[^0-9]/g, '') }))} />
              <TouchableOpacity style={styles.photoBox} onPress={pickEditImage}>
                {editImage?.uri ? (
                  <Image source={{ uri: editImage.uri }} style={styles.photoThumb} />
                ) : p.imageUrl ? (
                  <Image source={{ uri: imageUri(p.imageUrl) }} style={styles.photoThumb} />
                ) : (
                  <Text style={styles.photoPlus}>📷{'\n'}Photo</Text>
                )}
                {editImage?.uploading ? <ActivityIndicator style={styles.photoLoad} color={colors.primary} /> : null}
              </TouchableOpacity>
              {p.category !== 'Cake' && (
                <View style={styles.addRow}>
                  <TouchableOpacity
                    style={[styles.catChip, editDraft.isVeg && { backgroundColor: '#2e7d32', borderColor: '#2e7d32' }]}
                    onPress={() => setEditDraft((d) => ({ ...d, isVeg: true }))}
                  >
                    <Text style={[styles.catChipText, editDraft.isVeg && styles.catChipTextActive]}>🟢 Veg</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.catChip, !editDraft.isVeg && { backgroundColor: '#c62828', borderColor: '#c62828' }]}
                    onPress={() => setEditDraft((d) => ({ ...d, isVeg: false }))}
                  >
                    <Text style={[styles.catChipText, !editDraft.isVeg && styles.catChipTextActive]}>🔴 Non-veg</Text>
                  </TouchableOpacity>
                </View>
              )}
              {p.category === 'Cake' && (
                <>
                  <View style={styles.addRow}>
                    <View style={styles.catPick}>
                      {['Cake', 'Pastry', 'Pudding', 'Other'].map((t) => (
                        <TouchableOpacity
                          key={t}
                          style={[styles.catChip, editDraft.cakeType === t && styles.catChipActive]}
                          onPress={() => setEditDraft((d) => ({ ...d, cakeType: t }))}
                        >
                          <Text style={[styles.catChipText, editDraft.cakeType === t && styles.catChipTextActive]}>{t}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                  <View style={styles.addRow}>
                    <TouchableOpacity
                      style={[styles.catChip, !editDraft.eggless && { backgroundColor: '#8d6e63', borderColor: '#8d6e63' }]}
                      onPress={() => setEditDraft((d) => ({ ...d, eggless: false }))}
                    >
                      <Text style={[styles.catChipText, !editDraft.eggless && styles.catChipTextActive]}>🥚 With egg</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.catChip, editDraft.eggless && { backgroundColor: '#2e7d32', borderColor: '#2e7d32' }]}
                      onPress={() => setEditDraft((d) => ({ ...d, eggless: true }))}
                    >
                      <Text style={[styles.catChipText, editDraft.eggless && styles.catChipTextActive]}>🌱 Eggless</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
              <View style={styles.addRow}>
                <TouchableOpacity style={[styles.assignBtn, { flex: 1 }]} onPress={() => setEditingItemId(null)}>
                  <Text style={styles.assignBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.addBtn} onPress={() => saveEditItem(p._id)} disabled={busyId === p._id}>
                  {busyId === p._id ? <ActivityIndicator color="#fff" /> : <Text style={styles.addBtnText}>Save</Text>}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View key={p._id} style={styles.itemRow}>
              {p.imageUrl && !brokenImages.has(p._id) ? (
                <Image source={{ uri: imageUri(p.imageUrl) }} style={styles.itemThumb} onError={() => markBroken(p._id)} />
              ) : (
                <View style={[styles.itemThumb, styles.itemThumbEmpty]}><Text style={styles.itemThumbIcon}>🍽️</Text></View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>
                  {p.category !== 'Cake' ? (p.isVeg !== false ? '🟢 ' : '🔴 ') : (p.eggless ? '🌱 ' : '🥚 ')}
                  {p.name}
                </Text>
                <Text style={styles.itemMeta}>
                  {p.category === 'Cake' && p.cakeType && p.cakeType !== 'Cake' ? p.cakeType : p.category} · ₹{p.basePrice}{p.available ? '' : ' · out of stock'}
                </Text>
                {p.available ? null : (
                  <Text style={styles.pendingTag}>⏸️ Hidden from customers — turn it on to show it again</Text>
                )}
                {p.addOns?.length ? <Text style={styles.itemAddons}>+ {p.addOns.map((a) => a.name).join(', ')}</Text> : null}
                <TouchableOpacity onPress={() => startEditItem(p)}>
                  <Text style={styles.editLink}>✏️ Edit</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={[styles.availBtn, p.available ? styles.availOn : styles.availOff]}
                onPress={() => toggleAvailable(p)}
                disabled={busyId === p._id}
              >
                <Text style={styles.availText}>{p.available ? 'In stock' : 'Out'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => removeItem(p)} disabled={busyId === p._id} style={styles.delBtn}>
                <Text style={styles.delText}>✕</Text>
              </TouchableOpacity>
            </View>
          )
        )) : <Text style={styles.muted}>No items yet. Add your first item above.</Text>}
      </View>

      <View style={styles.card}>
        <View style={styles.cardHead}>
          <Text style={styles.cardTitle}>Orders</Text>
          <TouchableOpacity onPress={load}><Text style={styles.refresh}>↻ Refresh</Text></TouchableOpacity>
        </View>
        {orders.length ? orders.slice(0, 15).map((order) => (
          <View key={order._id} style={styles.orderCard}>
            <View style={styles.orderTop}>
              <Text style={styles.orderName}>{order.user?.name || 'Customer'}</Text>
              <Text style={styles.rowAmount}>₹{Number(order.totalAmount || 0).toFixed(2)}</Text>
            </View>
            <Text style={styles.orderItems}>
              {(order.items || []).map((i) => `${i.quantity}× ${i.name}`).join(', ') || 'Items'}
            </Text>
            <Text style={styles.orderStatus}>Stage: {STAGE_LABEL[order.status] || order.status}</Text>
            {order.assignedTo ? <Text style={styles.assignedTag}>🛵 {order.assignedTo.name}</Text> : null}

            {/* Advance the order stage: Accept → Cooking → Ready */}
            {NEXT_STAGE[order.status] && (
              <TouchableOpacity style={styles.readyBtn} onPress={() => advanceStage(order)} disabled={busyId === order._id}>
                {busyId === order._id ? <ActivityIndicator color="#fff" /> : <Text style={styles.readyBtnText}>{NEXT_STAGE[order.status].label}</Text>}
              </TouchableOpacity>
            )}

            {/* Assign a delivery partner (once ready / waiting) */}
            {['ready', 'heading_to_shop'].includes(order.status) && (
              <TouchableOpacity style={styles.assignBtn} onPress={() => assignToPartner(order)} disabled={busyId === order._id}>
                <Text style={styles.assignBtnText}>{order.assignedTo ? '🔁 Reassign delivery partner' : '🛵 Assign delivery partner'}</Text>
              </TouchableOpacity>
            )}

            {['ready', 'heading_to_shop'].includes(order.status) && order.pickupCode && (
              <View style={styles.codeBox}>
                <Text style={styles.codeBoxLabel}>Pickup code — give to delivery partner</Text>
                <Text style={styles.codeBoxValue}>{order.pickupCode}</Text>
              </View>
            )}
            {order.status === 'out_for_delivery' && <Text style={styles.pickedUp}>📦 Picked up — on the way to customer</Text>}
            {order.status === 'delivered' && <Text style={styles.deliveredTag}>✓ Delivered</Text>}

            {['heading_to_shop', 'out_for_delivery'].includes(order.status) && order.assignedTo && (
              <DeliveryTrackingMap orderId={order._id} />
            )}

            {/* Message the customer */}
            <TouchableOpacity
              style={styles.msgBtn}
              onPress={() => navigation.navigate('Chat', { orderId: order._id, title: order.user?.name || 'Customer' })}
            >
              <Text style={styles.msgBtnText}>💬 Message customer</Text>
            </TouchableOpacity>

            {/* Message the assigned delivery partner (e.g. confirm identity before handoff) */}
            {order.assignedTo && (
              <TouchableOpacity
                style={styles.msgBtn}
                onPress={() => navigation.navigate('Chat', { orderId: order._id, channel: 'pickup', title: order.assignedTo?.name || 'Delivery partner' })}
              >
                <Text style={styles.msgBtnText}>🛵 Message {order.assignedTo?.name || 'delivery partner'}</Text>
              </TouchableOpacity>
            )}
          </View>
        )) : <Text style={styles.muted}>No orders yet.</Text>}
      </View>

      <TouchableOpacity style={styles.logout} onPress={logout}>
        <Text style={styles.logoutText}>Log out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 14, color: colors.muted, marginBottom: 16 },
  card: { backgroundColor: colors.card, borderRadius: 10, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  depositCard: { borderColor: '#c62828', borderWidth: 1 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 8 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  refresh: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  amount: { fontSize: 22, fontWeight: '800', color: colors.primary },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.border },
  rowText: { color: colors.text, flex: 1 },
  rowAmount: { color: colors.primary, fontWeight: '700' },
  muted: { color: colors.muted },
  addBox: { backgroundColor: colors.bg, borderRadius: 10, padding: 10, marginTop: 10, marginBottom: 8 },
  addInput: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, marginBottom: 8 },
  addRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 8 },
  catPick: { flexDirection: 'row', gap: 6, flex: 1 },
  catChip: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingVertical: 8, alignItems: 'center', backgroundColor: colors.card },
  catChipActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  catChipText: { fontSize: 12, color: colors.text, fontWeight: '600' },
  catChipTextActive: { color: '#fff' },
  addBtn: { backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12, alignItems: 'center' },
  addBtnText: { color: '#fff', fontWeight: '700' },
  photoBox: { width: 64, height: 64, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  photoThumb: { width: 64, height: 64 },
  photoPlus: { fontSize: 11, color: colors.muted, textAlign: 'center' },
  photoLoad: { position: 'absolute' },
  itemThumb: { width: 44, height: 44, borderRadius: 6, backgroundColor: colors.border },
  itemThumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  itemThumbIcon: { fontSize: 20 },
  itemAddons: { color: colors.muted, fontSize: 11, marginTop: 2, fontStyle: 'italic' },
  pendingTag: { color: colors.warning, fontSize: 11, marginTop: 3, fontWeight: '600' },
  lowBal: { color: '#c62828', fontSize: 12, marginTop: 6, lineHeight: 16 },
  pendingBal: { color: colors.warning, fontSize: 12, marginTop: 4, fontWeight: '600' },
  assignedTag: { color: colors.success, fontSize: 12, marginTop: 2, fontWeight: '600' },
  assignBtn: { borderWidth: 1, borderColor: colors.primary, borderRadius: 8, padding: 10, alignItems: 'center', marginTop: 8 },
  assignBtnText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  msgBtn: { borderRadius: 8, padding: 10, alignItems: 'center', marginTop: 8, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border },
  msgBtnText: { color: colors.text, fontWeight: '600', fontSize: 13 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: 10 },
  itemName: { color: colors.text, fontWeight: '600' },
  itemMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  editLink: { color: colors.primary, fontSize: 12, fontWeight: '600', marginTop: 4 },
  availBtn: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  availOn: { backgroundColor: '#e8f5e9' },
  availOff: { backgroundColor: '#ffebee' },
  availText: { fontSize: 11, fontWeight: '700', color: colors.text },
  delBtn: { paddingHorizontal: 6, paddingVertical: 6 },
  delText: { color: '#c62828', fontWeight: '700', fontSize: 16 },
  orderCard: { borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: 10 },
  orderTop: { flexDirection: 'row', justifyContent: 'space-between' },
  orderName: { color: colors.text, fontWeight: '700', flex: 1 },
  orderItems: { color: colors.muted, fontSize: 12, marginTop: 2 },
  orderStatus: { color: colors.muted, fontSize: 12, marginTop: 4, textTransform: 'capitalize' },
  readyBtn: { backgroundColor: colors.primary, borderRadius: 8, padding: 10, alignItems: 'center', marginTop: 8 },
  readyBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  codeBox: { backgroundColor: '#0d3b2e', borderRadius: 8, padding: 10, alignItems: 'center', marginTop: 8 },
  codeBoxLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '600' },
  codeBoxValue: { color: '#fff', fontSize: 26, fontWeight: '800', letterSpacing: 6, marginTop: 2 },
  pickedUp: { color: colors.success, fontSize: 12, marginTop: 8, fontWeight: '600' },
  deliveredTag: { color: colors.success, fontSize: 13, marginTop: 8, fontWeight: '700' },
  logout: { backgroundColor: colors.primary, borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 8 },
  logoutText: { color: '#fff', fontWeight: '700' },
});
