import BookOpen from 'lucide-react-native/icons/book-open';
import House from 'lucide-react-native/icons/house';
import ListMusic from 'lucide-react-native/icons/list-music';
import MessageCircle from 'lucide-react-native/icons/message-circle';
// `History` is an alias on the root export; the file is named for the glyph.
import History from 'lucide-react-native/icons/rotate-ccw-clock';
import User from 'lucide-react-native/icons/user';

/**
 * The single list of nav destinations, shared by the web rail (canvas 2a) and
 * the web bottom bar (canvas 02) so the two cannot drift.
 *
 * `as const` is load-bearing: it keeps `href` as expo-router's typed-route
 * literals rather than widening them to `string`.
 */

/** Rail destinations above the spacer. */
export const PRIMARY = [
  { href: '/(app)/(main)/(tabs)', label: 'Home', match: '/', Icon: House },
  {
    href: '/(app)/(main)/(tabs)/routines',
    label: 'Routines',
    match: '/routines',
    Icon: ListMusic,
  },
  {
    href: '/(app)/(main)/(tabs)/library',
    label: 'Library',
    match: '/library',
    Icon: BookOpen,
  },
  { href: '/(app)/(main)/history', label: 'History', match: '/history', Icon: History },
] as const;

/** Rail destinations pushed to the bottom. */
export const SECONDARY = [
  { href: '/(app)/(main)/coach', label: 'AI Coach', match: '/coach', Icon: MessageCircle },
  {
    href: '/(app)/(main)/(tabs)/profile',
    label: 'Profile',
    match: '/profile',
    Icon: User,
  },
] as const;

/**
 * The four bottom-bar slots, in canvas order — Practice occupies the centre and
 * is an action, not a destination, so it is not in this list.
 *
 * History and AI Coach are deliberately absent: the canvas gives the narrow
 * viewport a four-tab budget and reaches both from Home instead. They are rail
 * entries only because the wide viewport has room.
 */
export const MOBILE_TABS = [
  PRIMARY[0], // Home
  PRIMARY[1], // Routines
  PRIMARY[2], // Library
  SECONDARY[1], // Profile
] as const;

/** Where Practice goes — the routines list is where a session starts. */
export const PRACTICE_HREF = '/(app)/(main)/(tabs)/routines' as const;

export type Destination = (typeof PRIMARY)[number] | (typeof SECONDARY)[number];

/** Home matches only the exact root; everything else owns its subtree. */
export function isRouteActive(pathname: string, match: string) {
  return match === '/' ? pathname === '/' : pathname.startsWith(match);
}
