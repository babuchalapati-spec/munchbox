import React, {useRef, useState} from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import {colors} from '../theme';

// Canned FAQ answers, matched by keyword. Free, instant, works with no internet-based
// AI service — good enough for the common questions a food-delivery customer asks.
// Order/complaint-specific replies still go through the real Chat screen with a human.
const FAQ = [
  {
    keywords: ['order status', 'where is my order', 'track', 'tracking'],
    question: 'Where is my order?',
    answer: 'Open "My orders" and tap your order to see live status and, once a delivery partner is on the way, their live location on the map.',
  },
  {
    keywords: ['cancel'],
    question: 'How do I cancel an order?',
    answer: 'You can cancel from "My orders" only while the order is still in "Placed" status — before the shop starts preparing it. After that, please contact the shop directly from the order screen.',
  },
  {
    keywords: ['refund', 'money back'],
    question: 'How do refunds work?',
    answer: 'If you paid online and an order is cancelled or a payment fails after money was deducted, it is refunded automatically to the original payment method within a few business days. Cash on Delivery orders have nothing to refund unless already paid.',
  },
  {
    keywords: ['delivery time', 'how long', 'eta', 'when will'],
    question: 'How long does delivery take?',
    answer: 'Delivery time depends on distance from the shop and how busy they are. Once a delivery partner picks up your order you’ll see a live ETA on the tracking screen.',
  },
  {
    keywords: ['delivery fee', 'delivery charge', 'why is delivery'],
    question: 'How is the delivery fee calculated?',
    answer: 'The delivery fee is based on the distance between the shop and your delivery address, at the shop’s per-km rate. You can see the exact distance and fee on the checkout screen before you pay.',
  },
  {
    keywords: ['payment', 'pay', 'upi', 'gpay', 'phonepe', 'card'],
    question: 'What payment methods are supported?',
    answer: 'You can pay online with any UPI app (PhonePe, Google Pay, etc.), a debit/credit card, or choose Cash on Delivery at checkout.',
  },
  {
    keywords: ['payment failed', 'money deducted', 'payment not working'],
    question: 'My payment failed but money was deducted',
    answer: 'Don’t worry — we log every failed payment attempt and our team is notified automatically. If money left your account but the order wasn’t placed, it will be refunded within a few business days. You can also place the order again with Cash on Delivery in the meantime.',
  },
  {
    keywords: ['coupon', 'discount', 'promo', 'offer'],
    question: 'How do coupons work?',
    answer: 'Coupons are tied to your account and applied at checkout by entering the code. You earn coupons through referrals and occasional promotions — check "My orders" > coupons for what you have.',
  },
  {
    keywords: ['wrong item', 'missing item', 'quality', 'complaint', 'bad'],
    question: 'I have a problem with my order',
    answer: 'Sorry about that! Please use the Chat on your order screen to message the shop directly, or tap Rate order after delivery to let us know — our team reviews low ratings.',
  },
  {
    keywords: ['delivery partner', 'rider', 'contact delivery'],
    question: 'How do I contact my delivery partner?',
    answer: 'Once a delivery partner is assigned, open the order tracking screen — you can message them from there.',
  },
];

const SUGGESTIONS = FAQ.map((f) => f.question);

function findAnswer(text) {
  const lower = text.toLowerCase();
  const hit = FAQ.find((f) => f.keywords.some((k) => lower.includes(k)));
  if (hit) return hit.answer;
  return 'I don’t have an answer for that yet. Please use Chat on your order to reach the shop, or contact Munchbox support.';
}

export default function HelpChatScreen({navigation}) {
  const [messages, setMessages] = useState([
    {id: 'welcome', mine: false, text: 'Hi! I’m the Munchbox help bot. Tap a question below or type your own.'},
  ]);
  const listRef = useRef(null);

  function ask(question) {
    const userMsg = {id: `u-${Date.now()}`, mine: true, text: question};
    const botMsg = {id: `b-${Date.now()}`, mine: false, text: findAnswer(question)};
    setMessages((prev) => [...prev, userMsg, botMsg]);
    setTimeout(() => listRef.current?.scrollToEnd({animated: true}), 100);
  }

  return (
    <View style={styles.container}>
      <FlatList
        ref={listRef}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={messages}
        keyExtractor={(m) => m.id}
        onContentSizeChange={() => listRef.current?.scrollToEnd({animated: false})}
        renderItem={({item}) => (
          <View style={[styles.bubbleRow, item.mine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
            <View style={[styles.bubble, item.mine ? styles.bubbleMine : styles.bubbleTheirs]}>
              <Text style={item.mine ? styles.bubbleTextMine : styles.bubbleTextTheirs}>{item.text}</Text>
            </View>
          </View>
        )}
      />
      <View style={styles.suggestions}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={SUGGESTIONS}
          keyExtractor={(q) => q}
          contentContainerStyle={{paddingHorizontal: 10, gap: 8}}
          renderItem={({item}) => (
            <TouchableOpacity style={styles.chip} onPress={() => ask(item)}>
              <Text style={styles.chipText}>{item}</Text>
            </TouchableOpacity>
          )}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.bg},
  list: {flex: 1},
  listContent: {padding: 12, flexGrow: 1},
  bubbleRow: {flexDirection: 'row', marginBottom: 8},
  bubbleRowMine: {justifyContent: 'flex-end'},
  bubbleRowTheirs: {justifyContent: 'flex-start'},
  bubble: {maxWidth: '82%', borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12},
  bubbleMine: {backgroundColor: colors.primary, borderBottomRightRadius: 2},
  bubbleTheirs: {backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 2},
  bubbleTextMine: {color: '#fff'},
  bubbleTextTheirs: {color: colors.text},
  suggestions: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
    paddingVertical: 10,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  chipText: {color: colors.primary, fontSize: 12, fontWeight: '600'},
});
