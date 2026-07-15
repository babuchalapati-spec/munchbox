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

export const brandGradient = 'linear-gradient(135deg, #FF7A59 0%, #E23364 55%, #8E24AA 100%)';

export const categoryThemes = {
  cake: { label: 'Cakes', icon: '🎂', primary: '#c2185b', soft: '#fce4ec', gradient: 'linear-gradient(135deg, #FF7A59, #E23364, #C2185B)', tagline: 'Freshly baked & customised' },
  restaurant: { label: 'Restaurants', icon: '🍔', primary: '#e65100', soft: '#fff1e6', gradient: 'linear-gradient(135deg, #FFB74D, #FB8C00, #E65100)', tagline: 'Hot meals, delivered fast' },
  catering: { label: 'Catering', icon: '🍽️', primary: '#6a1b9a', soft: '#f3e5f5', gradient: 'linear-gradient(135deg, #9C6ADE, #7E57C2, #6A1B9A)', tagline: 'Book feasts for your events' },
};

export function categoryTheme(category) {
  return categoryThemes[category] || categoryThemes.cake;
}
