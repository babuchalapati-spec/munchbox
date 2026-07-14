export const colors = {
  bg: '#f6f3f0',
  card: '#ffffff',
  text: '#2c2420',
  muted: '#776b63',
  primary: '#c2185b',
  border: '#e6e0da',
  success: '#2e7d32',
  warning: '#a86b00',
};

// The app's own brand gradient (hero banner, splash-like moments) — distinct from
// the per-category gradients below, which color a specific shop type.
export const brandGradient = ['#FF7A59', '#E23364', '#8E24AA'];

// Consistent card elevation across the app — spread across iOS shadow props and
// Android's single `elevation`, since RN doesn't unify them.
export function cardShadow(level = 1) {
  return {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: level * 2 },
    shadowOpacity: 0.08 + level * 0.02,
    shadowRadius: level * 4,
    elevation: level * 2,
  };
}

// Each shop category gets its own accent + feel so cakes, restaurants and
// catering look distinct inside the app.
export const categoryThemes = {
  cake: {
    label: 'Cakes',
    icon: '🎂',
    primary: '#c2185b', // sweet pink
    soft: '#fce4ec',
    gradient: ['#FF7A59', '#E23364', '#C2185B'],
    tagline: 'Freshly baked & customised',
  },
  restaurant: {
    label: 'Restaurants',
    icon: '🍔',
    primary: '#e65100', // appetising orange
    soft: '#fff1e6',
    gradient: ['#FFB74D', '#FB8C00', '#E65100'],
    tagline: 'Hot meals, delivered fast',
  },
  catering: {
    label: 'Catering',
    icon: '🍽️',
    primary: '#6a1b9a', // premium purple
    soft: '#f3e5f5',
    gradient: ['#9C6ADE', '#7E57C2', '#6A1B9A'],
    tagline: 'Book feasts for your events',
  },
};

export function categoryTheme(category) {
  return categoryThemes[category] || categoryThemes.cake;
}
