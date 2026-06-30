export const RESTAURANT = {
  name: 'Pizza City',
  tagline: 'Authentic New York Style Pizza',
  address: '125 Main Street',
  phone: '(555) 555-PIZZA',
  footer: 'Big Slices. Fresh Dough. Real New York Flavor.',
};

export const TAX_RATE = 0.08875;

export const TOPPINGS = [
  'Pepperoni',
  'Sausage',
  'Bacon',
  'Ham',
  'Chicken',
  'Mushrooms',
  'Onions',
  'Green Peppers',
  'Black Olives',
  'Banana Peppers',
  'Jalapeños',
  'Extra Cheese',
];

export const TOPPING_PRICE = 2.5;

export const CATEGORIES = [
  {
    id: 'slices',
    name: 'Pizza by the Slice',
    items: [
      { id: 'cheese-slice', name: 'Cheese Slice', price: 3.5, description: 'Classic mozzarella and pizza sauce.' },
      { id: 'pepperoni-slice', name: 'Pepperoni Slice', price: 4.25, description: 'Loaded with crispy pepperoni.' },
      { id: 'sausage-slice', name: 'Sausage Slice', price: 4.5, description: 'Italian sausage and mozzarella.' },
      { id: 'meat-lovers-slice', name: 'Meat Lovers Slice', price: 5.0, description: 'Pepperoni, sausage, bacon, and ham.' },
      { id: 'veggie-slice', name: 'Veggie Slice', price: 4.5, description: 'Mushrooms, onions, peppers, and black olives.' },
    ],
  },
  {
    id: 'whole-pies',
    name: 'Whole Pies — 18" Large',
    items: [
      { id: 'plain-cheese-pizza', name: 'Plain Cheese', price: 18.99 },
      { id: 'pepperoni-pizza', name: 'Pepperoni Pizza', price: 22.99 },
      { id: 'sausage-pizza', name: 'Sausage Pizza', price: 23.99 },
      { id: 'meat-lovers-pizza', name: 'Meat Lovers Pizza', price: 28.99 },
      { id: 'supreme-pizza', name: 'Supreme Pizza', price: 29.99, description: 'Pepperoni, sausage, mushrooms, onions, peppers, and olives.' },
      { id: 'veggie-pizza', name: 'Veggie Pizza', price: 25.99 },
      { id: 'buffalo-chicken-pizza', name: 'Buffalo Chicken Pizza', price: 27.99 },
      { id: 'bbq-chicken-pizza', name: 'BBQ Chicken Pizza', price: 27.99 },
    ],
  },
  {
    id: 'byo-pizza',
    name: 'Build Your Own Pizza',
    items: [
      {
        id: 'byo-cheese-pizza',
        name: '18" Cheese Pizza',
        price: 18.99,
        description: `Additional toppings $${TOPPING_PRICE.toFixed(2)} each`,
        customizable: true,
      },
    ],
  },
  {
    id: 'garlic-knots',
    name: 'Garlic Knots',
    items: [
      { id: 'garlic-knots-6', name: '6 Garlic Knots', price: 4.99 },
      { id: 'garlic-knots-12', name: '12 Garlic Knots', price: 8.99 },
      { id: 'garlic-knots-cheese', name: 'Garlic Knots with Cheese', price: 10.99 },
    ],
  },
  {
    id: 'appetizers',
    name: 'Appetizers',
    items: [
      { id: 'mozzarella-sticks', name: 'Mozzarella Sticks (6)', price: 7.99 },
      { id: 'french-fries', name: 'French Fries', price: 4.99 },
      { id: 'cheese-fries', name: 'Cheese Fries', price: 6.99 },
      { id: 'buffalo-wings', name: 'Buffalo Wings (10)', price: 12.99 },
      { id: 'chicken-tenders', name: 'Chicken Tenders (4)', price: 8.99 },
    ],
  },
  {
    id: 'hot-subs',
    name: 'Hot Subs',
    items: [
      { id: 'meatball-parm', name: 'Meatball Parmesan', price: 10.99 },
      { id: 'chicken-parm', name: 'Chicken Parmesan', price: 11.99 },
      { id: 'philly-cheesesteak', name: 'Philly Cheesesteak', price: 12.99 },
      { id: 'italian-cold-cut', name: 'Italian Cold Cut', price: 10.99 },
    ],
  },
  {
    id: 'salads',
    name: 'Salads',
    items: [
      { id: 'house-salad', name: 'House Salad', price: 7.99 },
      { id: 'caesar-salad', name: 'Caesar Salad', price: 8.99 },
      { id: 'grilled-chicken-caesar', name: 'Grilled Chicken Caesar Salad', price: 11.99 },
    ],
  },
  {
    id: 'desserts',
    name: 'Desserts',
    items: [
      { id: 'ny-cheesecake', name: 'New York Cheesecake', price: 5.99 },
      { id: 'chocolate-cake', name: 'Chocolate Cake', price: 5.99 },
      { id: 'cannoli', name: 'Cannoli', price: 4.99 },
    ],
  },
  {
    id: 'drinks',
    name: 'Drinks',
    items: [
      { id: 'can-soda', name: 'Can Soda', price: 1.99 },
      { id: 'bottle-soda-20oz', name: '20 oz Bottle Soda', price: 2.99 },
      { id: '2-liter-soda', name: '2-Liter Soda', price: 4.49 },
      { id: 'bottled-water', name: 'Bottled Water', price: 1.49 },
    ],
  },
  {
    id: 'specials',
    name: 'Pizza City Specials',
    items: [
      { id: 'special-two-slices-drink', name: 'Two Cheese Slices & Fountain Drink', price: 7.99 },
      { id: 'special-pep-wings', name: 'Large Pepperoni Pizza & 10 Wings', price: 32.99 },
      {
        id: 'special-family-deal',
        name: 'Family Deal',
        price: 49.99,
        description: '2 Large Cheese Pizzas, 20 Wings & 2-Liter Soda',
      },
    ],
  },
];

const ITEM_INDEX = new Map();
for (const category of CATEGORIES) {
  for (const item of category.items) {
    ITEM_INDEX.set(item.id, { ...item, categoryId: category.id, categoryName: category.name });
  }
}

export function findMenuItem(itemId) {
  return ITEM_INDEX.get(itemId) || null;
}

export function allMenuItems() {
  return Array.from(ITEM_INDEX.values());
}
