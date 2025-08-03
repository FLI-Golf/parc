# French Menu Import Guide

## 🇫🇷 Authentic French Restaurant Menu Data

This package includes a complete French-themed menu with 29 authentic dishes, 6 categories, and 16 modifiers.

### 📋 What's Included

#### **Menu Categories** (6 items)
- **Entrées** 🥗 - Elegant appetizers and starters
- **Plats Principaux** 🍽️ - Main courses featuring classic French cuisine  
- **Vins & Cocktails** 🍷 - Fine French wines and signature cocktails
- **Fromages** 🧀 - Artisanal cheese selection
- **Desserts** 🍰 - Decadent French pastries and desserts
- **Spécialités** ⭐ - Chef's seasonal specialties

#### **Menu Items** (29 authentic dishes)
**Entrées:**
- Escargots de Bourgogne - Classic snails in garlic butter
- Foie Gras Terrine - House-made with fig compote
- Soupe à l'Oignon Gratinée - French onion soup
- Plateau de Charcuterie - Cured meats selection
- Salade Niçoise - Traditional Riviera salad
- Moules Marinières - Fresh mussels in white wine

**Plats Principaux:**
- Coq au Vin - Braised chicken in red wine
- Boeuf Bourguignon - Slow-braised beef in Burgundy
- Bouillabaisse Marseillaise - Traditional fish stew
- Magret de Canard - Duck breast with cherry gastrique
- Cassoulet Toulousain - White bean stew
- Sole Meunière - Dover sole in brown butter
- Ratatouille Niçoise - Traditional vegetable stew
- Confit de Canard - Duck leg confit

**Vins & Cocktails:**
- Bordeaux Rouge - Premium Château Margaux
- Champagne Brut - Dom Pérignon vintage
- Pastis - Traditional anise aperitif
- Kir Royale - Champagne with cassis
- Côtes du Rhône Blanc - Crisp white wine
- French 75 - Classic gin cocktail

**Desserts:**
- Plateau de Fromages - Five French cheeses
- Crème Brûlée Vanille - Classic vanilla custard
- Tarte Tatin - Upside-down apple tart
- Mousse au Chocolat - Rich dark chocolate mousse
- Mille-feuille - Layered puff pastry
- Soufflé au Grand Marnier - Hot orange soufflé

**Spécialités:**
- Bouillabaisse du Chef - Special with lobster
- Côte de Boeuf - Dry-aged ribeye for two
- Homard Thermidor - Lobster in brandy cream

#### **Menu Modifiers** (16 items)
- French sauces (Béarnaise, Hollandaise)
- Luxury add-ons (Truffle oil, Foie gras, Fresh truffle)
- Cooking styles (Saignant, À Point, Bien Cuit)
- Special preparations (Flambé table-side)
- Dietary accommodations

### 🚀 Import Instructions

#### **Step 1: Install Dependencies**
```bash
npm install csv-parser
```

#### **Step 2: Run the Import**

**Option A: Fresh Import (recommended)**
```bash
node import-enhanced-menu.js --clear
```
This will clear existing menu data and import the fresh French menu.

**Option B: Add to Existing Menu**
```bash
node import-enhanced-menu.js
```
This will add the French items to your existing menu.

#### **Step 3: Verify Import**
The script will show progress for each category:
- ✅ Menu categories imported
- ✅ Menu modifiers imported  
- ✅ Menu items imported

### 📊 Data Features

Each menu item includes:
- **Basic Info**: Name, description, category, price
- **Kitchen Details**: Ingredients, prep time, kitchen notes
- **Dietary Info**: Allergens, dietary flags, calories
- **Marketing**: Tags (popular, chef_special, etc.), featured status
- **Customization**: Portion size, spice level, subcategory
- **Cost Control**: Item cost for profit tracking

### 🎨 POS Integration

The data is designed to work perfectly with your enhanced POS system:
- **Category icons** for visual navigation
- **Search tags** for quick filtering
- **Allergen warnings** prominently displayed
- **Featured items** highlighted with badges
- **Dietary filters** for dietary restrictions
- **French terminology** for authentic experience

### 💡 Customization Tips

After import, you can:
1. **Add images**: Upload food photos to menu items
2. **Adjust prices**: Modify pricing for your market
3. **Seasonal items**: Toggle availability for seasonal dishes
4. **Customize modifiers**: Add house-specific sauces or preparations
5. **Featured rotation**: Change which items are featured
6. **Categories**: Add more categories like "Brunch" or "Lunch Specials"

### 🔧 Troubleshooting

**If import fails:**
1. Check PocketBase connection in the script
2. Ensure collections exist (run collection imports first)
3. Verify CSV files are in `static/sample-data/`
4. Check admin credentials

**Missing collections:**
Import the enhanced collections first:
```bash
# Import the enhanced menu collections to PocketBase admin panel
# Files: enhanced_menu_collections.json, enhanced_menu_items_update.json
```

### 📈 Next Steps

After successful import:
1. **Test the POS**: Click tables to see the new French menu
2. **Train staff**: Familiarize servers with French dishes
3. **Add wine pairings**: Enhance beverage recommendations
4. **Photography**: Professional food photography for menu items
5. **Seasonal updates**: Plan rotating seasonal specials

Your restaurant now has a complete, authentic French menu ready for service! 🇫🇷✨
