const Order = require('../models/Order');
const Message = require('../models/Message');
const User = require('../models/User');

// Who may read/post in a given channel of an order's chat.
async function canAccessChannel(order, user, channel) {
  if (user.role === 'admin') return true; // admin monitors everything
  if (channel === 'pickup') {
    // shop <-> delivery: the shop owner of this order's shop, or the assigned partner
    if (user.role === 'shop') return user.shop && order.shop && order.shop.toString() === user.shop.toString();
    if (user.role === 'delivery') return order.assignedTo && order.assignedTo.toString() === user._id.toString();
    return false;
  }
  // 'customer' channel: the customer, the assigned delivery partner, or the shop that
  // received this order (so the shop can message the customer directly).
  if (order.user.toString() === user._id.toString()) return true;
  if (order.assignedTo && order.assignedTo.toString() === user._id.toString()) return true;
  if (user.role === 'shop' && user.shop && order.shop && order.shop.toString() === user.shop.toString()) return true;
  return false;
}

function channelFrom(req) {
  const ch = req.query.channel || req.body.channel;
  return ch === 'pickup' ? 'pickup' : 'customer';
}

async function listMessages(req, res) {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ message: 'Order not found' });
  const channel = channelFrom(req);
  if (!(await canAccessChannel(order, req.user, channel))) {
    return res.status(403).json({ message: 'Not authorized to view this chat' });
  }

  const messages = await Message.find({ order: order._id, channel })
    .populate('sender', 'name role')
    .sort({ createdAt: 1 });
  res.json({ messages });
}

async function sendMessage(req, res) {
  const { text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ message: 'text is required' });

  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ message: 'Order not found' });
  const channel = channelFrom(req);
  if (!(await canAccessChannel(order, req.user, channel))) {
    return res.status(403).json({ message: 'Not authorized to message on this order' });
  }

  const chatMessage = await Message.create({
    order: order._id,
    channel,
    sender: req.user._id,
    senderRole: req.user.role,
    text: text.trim(),
  });
  await chatMessage.populate('sender', 'name role');

  res.status(201).json({ chatMessage });
}

module.exports = { listMessages, sendMessage };
