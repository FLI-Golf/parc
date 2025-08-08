# Menu Filtering System Documentation

## Overview

The PARC Portal server dashboard features an advanced, multi-select checkbox filtering system that allows servers to efficiently browse menu items by category. The system is designed to be space-efficient with a collapsible interface while providing clear visual feedback about active filters.

## Features

### 1. Multi-Select Checkbox Filtering

Instead of traditional single-select radio buttons, the system uses checkboxes that allow servers to select multiple categories simultaneously:

- **🥐 Brunch** - Brunch items and morning specials
- **🥗 Lunch** - Lunch menu items  
- **🍽️ Dinner** - Dinner menu items (default selected)
- **🍷 Wine** - All wine varieties (default selected)
- **🍸 Cocktails** - Signature and classic cocktails (default selected)
- **🍻 Happy Hour** - Happy hour menu items
- **🍺 Beer** - Draft and bottled beer (default selected)
- **🍰 Desserts** - Dessert items and sweet treats

### 2. Default Selections

The system starts with commonly used categories pre-selected to optimize the initial user experience:
- ✅ Dinner
- ✅ Wine  
- ✅ Cocktails
- ✅ Beer

This ensures servers immediately see the most frequently ordered items when taking orders.

### 3. Collapsible Interface

To maximize screen real estate for menu items, the filter system is collapsible:

#### Collapsed State (Default)
```
🏷️ Filter Categories (4 selected) 🍽️ Dinner - 🍷 Wine - 🍸 Cocktails - 🍺 Beer ↓
```

#### Expanded State
Shows all filter checkboxes with icons and labels in a 2-column grid layout.

### 4. Visual Feedback

#### Active Filter Display
When collapsed, the header shows:
- **Selection count**: "(4 selected)"
- **Active filter icons with names**: "🍽️ Dinner - 🍷 Wine - 🍸 Cocktails - 🍺 Beer"
- **Animated chevron**: Rotates 180° when expanded

#### Hover Effects
- Filter header highlights on hover
- Individual checkbox labels highlight on hover

## Technical Implementation

### State Management

```javascript
let selectedCategories = {
    brunch: false,
    lunch: false, 
    dinner: true,    // Default checked
    wine: true,      // Default checked
    cocktails: true, // Default checked
    happy_hour: false,
    beer: true,      // Default checked
    desserts: false
};
let showFilters = false; // Collapsed by default
```

### Persistence

Filter preferences are automatically saved to localStorage:
- `selectedCategories` - Which filters are active
- `showFilters` - Whether the filter section is expanded/collapsed

### Menu Item Mapping

The filtering logic maps menu item subcategories to filter categories:

```javascript
// Wine filter includes multiple subcategories
if (selectedCategories.wine && ['wine_red', 'wine_white', 'wine_sparkling'].includes(item.subcategory)) {
    matchesCategory = true;
}

// Cocktails filter includes signature and classic cocktails
if (selectedCategories.cocktails && ['cocktail_classic', 'cocktail_signature'].includes(item.subcategory)) {
    matchesCategory = true;
}

// Beer filter includes draft and bottled beer
if (selectedCategories.beer && ['beer_draft', 'beer_bottle'].includes(item.subcategory)) {
    matchesCategory = true;
}

// Desserts filter includes dessert items and dessert category
if (selectedCategories.desserts && (item.category === 'desserts' || ['dessert_cake', 'dessert_ice_cream'].includes(item.subcategory))) {
    matchesCategory = true;
}
```

### Icon System

Each filter category has an associated emoji icon:

```javascript
function getCategoryCheckboxIcon(category) {
    switch (category) {
        case 'brunch': return '🥐';
        case 'lunch': return '🥗'; 
        case 'dinner': return '🍽️';
        case 'wine': return '🍷';
        case 'cocktails': return '🍸';
        case 'happy_hour': return '🍻';
        case 'beer': return '🍺';
        case 'desserts': return '🍰';
        default: return '🍴';
    }
}
```

## User Experience Benefits

### 1. Improved Efficiency
- **Quick filtering**: Servers can rapidly narrow down menu options
- **Multi-category selection**: View items from multiple categories simultaneously
- **Persistent preferences**: Settings remembered across sessions

### 2. Space Optimization
- **Collapsible design**: More screen space for menu items
- **At-a-glance status**: See active filters without expanding
- **Smooth animations**: Professional feel with 200ms transitions

### 3. Clear Visual Communication
- **Intuitive icons**: Universal symbols for food and drink categories
- **Selection feedback**: Clear indication of what's currently filtered
- **Contextual information**: Shows both count and specific active filters

## Usage Examples

### Common Workflows

1. **Taking a dinner order with wine pairing**:
   - Default state already shows Dinner + Wine filters ✅
   - No additional clicks needed

2. **Happy hour service**:
   - Uncheck Dinner
   - Check Happy Hour
   - Result: Shows only happy hour items and drinks

3. **Dessert and after-dinner drinks**:
   - Uncheck Dinner
   - Check Desserts  
   - Keep Wine and Cocktails for digestifs

4. **Lunch service**:
   - Uncheck Dinner
   - Check Lunch
   - Keep or adjust beverage filters as needed

## Performance Considerations

- **Client-side filtering**: Fast, responsive filtering without server requests
- **Optimized rendering**: Only re-renders menu grid when filters change
- **Efficient state updates**: Uses Svelte's reactive declarations for automatic updates

## Accessibility Features

- **Keyboard navigation**: All filters accessible via keyboard
- **Screen reader support**: Proper labels and ARIA attributes
- **High contrast**: Clear visual distinctions between states
- **Touch-friendly**: Adequate touch targets for mobile devices

## Future Enhancements

Potential improvements for future versions:
- Search within filtered results
- Quick filter presets (e.g., "Happy Hour", "Wine & Dine")
- Category-specific sorting options
- Integration with inventory status (hide out-of-stock items)
