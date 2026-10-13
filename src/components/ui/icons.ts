/**
 * Curated lucide icon map (explicit imports keep the bundle tree-shaken).
 * Node types reference icons by name; UI uses the components directly.
 */
import {
  Activity, AlertOctagon, ArrowDownRight, ArrowUpRight, BadgeCheck, Bell, Bot, Box, Boxes, Braces, Briefcase, Bug,
  Building2, CalendarClock, CalendarDays, Check, ChevronDown, ChevronRight, Circle, CircleAlert, CircleCheck, CircleX,
  ClipboardList, Clock, Command, Copy, CreditCard, Database, ExternalLink, Eye, FileText, Filter, Flame, Focus,
  Gauge, GitBranch, GitMerge, Globe, Grid3x3, Hand, HardDrive, Hash, History, Hourglass, Inbox, KeyRound, Layers,
  LayoutDashboard, LayoutGrid, Lightbulb, Link2, List, Lock, LogOut, Mail, MailCheck, MailOpen, Maximize2,
  MessageCircle, MessageSquare, MessageSquareText, Minus, MoreHorizontal, MousePointer2, MousePointerClick, Newspaper,
  Network, OctagonX, Orbit, PanelLeftClose, PanelLeftOpen, Pause, PenLine, Pencil, Phone, Pin, PinOff, Play, Plug, Plus,
  Radio, Receipt, Repeat, Reply, RefreshCw, Rss, Search, Send, Settings, Share2, Shield, ShieldCheck, ShoppingBag,
  ShoppingCart, Shuffle, SlidersHorizontal, Sparkles, Split, Star, Store, Table2, Timer, TriangleAlert, Truck, UserPlus,
  Users, Waypoints, Webhook, Workflow, X, Zap, Crown, Siren, Wrench, Frame, Scan, Locate, Compass, ListFilter, Tag,
  ChartNoAxesColumn, TrendingUp, TrendingDown, Rocket, Package, UsersRound, Megaphone, Fingerprint, Monitor,
  type LucideIcon,
} from 'lucide-react';

export const ICONS: Record<string, LucideIcon> = {
  Activity, AlertOctagon, ArrowDownRight, ArrowUpRight, BadgeCheck, Bell, Bot, Box, Boxes, Braces, Briefcase, Bug,
  Building2, CalendarClock, CalendarDays, Check, ChevronDown, ChevronRight, Circle, CircleAlert, CircleCheck, CircleX,
  ClipboardList, Clock, Command, Copy, CreditCard, Database, ExternalLink, Eye, FileText, Filter, Flame, Focus,
  Gauge, GitBranch, GitMerge, Globe, Grid3x3, Hand, HardDrive, Hash, History, Hourglass, Inbox, KeyRound, Layers,
  LayoutDashboard, LayoutGrid, Lightbulb, Link2, List, Lock, LogOut, Mail, MailCheck, MailOpen, Maximize2,
  MessageCircle, MessageSquare, MessageSquareText, Minus, MoreHorizontal, MousePointer2, MousePointerClick, Newspaper,
  Network, OctagonX, Orbit, PanelLeftClose, PanelLeftOpen, Pause, PenLine, Pencil, Phone, Pin, PinOff, Play, Plug, Plus,
  Radio, Receipt, Repeat, Reply, RefreshCw, Rss, Search, Send, Settings, Share2, Shield, ShieldCheck, ShoppingBag,
  ShoppingCart, Shuffle, SlidersHorizontal, Sparkles, Split, Star, Store, Table2, Timer, TriangleAlert, Truck, UserPlus,
  Users, Waypoints, Webhook, Workflow, X, Zap, Crown, Siren, Wrench, Frame, Scan, Locate, Compass, ListFilter, Tag,
  ChartNoAxesColumn, TrendingUp, TrendingDown, Rocket, Package, UsersRound, Megaphone, Fingerprint, Monitor,
};

export function iconByName(name: string): LucideIcon {
  return ICONS[name] ?? Box;
}
export type { LucideIcon };
