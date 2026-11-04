import Icon0 from 'lucide-react-native/icons/wallet';
import Icon1 from 'lucide-react-native/icons/banknote';
import Icon2 from 'lucide-react-native/icons/landmark';
import Icon3 from 'lucide-react-native/icons/credit-card';
import Icon4 from 'lucide-react-native/icons/piggy-bank';
import Icon5 from 'lucide-react-native/icons/smartphone';
import Icon6 from 'lucide-react-native/icons/utensils';
import Icon7 from 'lucide-react-native/icons/shopping-basket';
import Icon8 from 'lucide-react-native/icons/coffee';
import Icon9 from 'lucide-react-native/icons/bus';
import Icon10 from 'lucide-react-native/icons/fuel';
import Icon11 from 'lucide-react-native/icons/receipt';
import Icon12 from 'lucide-react-native/icons/zap';
import Icon13 from 'lucide-react-native/icons/house';
import Icon14 from 'lucide-react-native/icons/shopping-bag';
import Icon15 from 'lucide-react-native/icons/shirt';
import Icon16 from 'lucide-react-native/icons/heart-pulse';
import Icon17 from 'lucide-react-native/icons/dumbbell';
import Icon18 from 'lucide-react-native/icons/graduation-cap';
import Icon19 from 'lucide-react-native/icons/clapperboard';
import Icon20 from 'lucide-react-native/icons/plane';
import Icon21 from 'lucide-react-native/icons/gift';
import Icon22 from 'lucide-react-native/icons/paw-print';
import Icon23 from 'lucide-react-native/icons/baby';
import Icon24 from 'lucide-react-native/icons/briefcase';
import Icon25 from 'lucide-react-native/icons/store';
import Icon26 from 'lucide-react-native/icons/trending-up';
import Icon27 from 'lucide-react-native/icons/sparkles';
import Icon28 from 'lucide-react-native/icons/circle-ellipsis';
import Icon29 from 'lucide-react-native/icons/receipt-text';
import Icon30 from 'lucide-react-native/icons/chart-column';
import Icon31 from 'lucide-react-native/icons/target';
import Icon32 from 'lucide-react-native/icons/layout-grid';
import Icon33 from 'lucide-react-native/icons/plus';
import Icon34 from 'lucide-react-native/icons/x';
import Icon35 from 'lucide-react-native/icons/check';
import Icon36 from 'lucide-react-native/icons/delete';
import Icon37 from 'lucide-react-native/icons/menu';
import Icon38 from 'lucide-react-native/icons/ellipsis';
import Icon39 from 'lucide-react-native/icons/chevron-left';
import Icon40 from 'lucide-react-native/icons/chevron-right';
import Icon41 from 'lucide-react-native/icons/chevron-down';
import Icon42 from 'lucide-react-native/icons/calendar';
import Icon43 from 'lucide-react-native/icons/pencil';
import Icon44 from 'lucide-react-native/icons/trash';
import Icon45 from 'lucide-react-native/icons/copy';
import Icon46 from 'lucide-react-native/icons/undo-2';
import Icon47 from 'lucide-react-native/icons/archive';
import Icon48 from 'lucide-react-native/icons/repeat';
import Icon49 from 'lucide-react-native/icons/arrow-down-left';
import Icon50 from 'lucide-react-native/icons/arrow-up-right';
import Icon51 from 'lucide-react-native/icons/arrow-left-right';
import Icon52 from 'lucide-react-native/icons/triangle-alert';
import Icon53 from 'lucide-react-native/icons/info';
import Icon54 from 'lucide-react-native/icons/lock';
import Icon55 from 'lucide-react-native/icons/fingerprint-pattern';
import Icon56 from 'lucide-react-native/icons/settings';

export const icons = {
  'wallet': Icon0,
  'cash': Icon1,
  'bank': Icon2,
  'card': Icon3,
  'savings': Icon4,
  'ewallet': Icon5,
  'food': Icon6,
  'groceries': Icon7,
  'coffee': Icon8,
  'transport': Icon9,
  'fuel': Icon10,
  'bills': Icon11,
  'utilities': Icon12,
  'home': Icon13,
  'shopping': Icon14,
  'clothing': Icon15,
  'health': Icon16,
  'fitness': Icon17,
  'education': Icon18,
  'entertainment': Icon19,
  'travel': Icon20,
  'gifts': Icon21,
  'pets': Icon22,
  'kids': Icon23,
  'salary': Icon24,
  'business': Icon25,
  'investment': Icon26,
  'bonus': Icon27,
  'other': Icon28,
  'records': Icon29,
  'analysis': Icon30,
  'budgets': Icon31,
  'categories': Icon32,
  'plus': Icon33,
  'close': Icon34,
  'check': Icon35,
  'backspace': Icon36,
  'menu': Icon37,
  'more': Icon38,
  'back': Icon39,
  'next': Icon40,
  'down': Icon41,
  'calendar': Icon42,
  'edit': Icon43,
  'trash': Icon44,
  'duplicate': Icon45,
  'refund': Icon46,
  'archive': Icon47,
  'recurring': Icon48,
  'income': Icon49,
  'expense': Icon50,
  'transfer': Icon51,
  'warning': Icon52,
  'info': Icon53,
  'lock': Icon54,
  'fingerprint': Icon55,
  'settings': Icon56,
} as const;
export function iconForKey(key: string) { return Object.hasOwn(icons, key) ? icons[key as keyof typeof icons] : icons.other; }
