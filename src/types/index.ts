// ============================================
// VoxSpend Type Definitions
// ============================================

export interface Expense {
  id: string
  amount: number
  currency: string
  type: 'expense' | 'income'
  category: string
  merchant: string
  note: string
  date: string          // ISO date string
  momoAccountId?: string
  createdAt: string
  updatedAt: string
  synced: boolean
}

export interface Category {
  id: string
  name: string
  icon: string          // Material Symbols icon name
  color: string         // Hex color
  isCustom: boolean
  createdAt: string
}

export interface MomoAccount {
  id: string
  provider: 'mtn' | 'telecel' | 'airteltigo'
  phoneNumber: string
  nickname: string
  linkedAt: string
}

export interface UserProfile {
  name: string
  avatarInitials: string
  currency: string
  groqApiKey: string
  onboardingComplete: boolean
  notificationsEnabled?: boolean
  createdAt: string
}

export interface ParsedExpense {
  amount: number
  currency: string
  type: 'expense' | 'income'
  category: string
  merchant: string
  note: string
  date: string
}

export interface SyncQueueItem {
  id?: number
  action: 'create' | 'update' | 'delete'
  table: string
  entityId: string
  data: Record<string, unknown>
  createdAt: string
  retries: number
}

export interface PendingVoiceNote {
  id?: number
  audio: Blob
  createdAt: string
}


export interface CategoryBreakdown {
  category: string
  color: string
  icon: string
  total: number
  percentage: number
  count: number
}

export interface DayGroup {
  label: string
  date: string
  expenses: Expense[]
}

export type ThemeMode = 'light' | 'dark' | 'system'

export type MomoProvider = 'mtn' | 'telecel' | 'airteltigo'

export const MOMO_PROVIDERS: Record<MomoProvider, { name: string; color: string; logo: string }> = {
  mtn: { name: 'MTN Mobile Money', color: '#FFCC00', logo: '📱' },
  telecel: { name: 'Telecel Cash', color: '#E40521', logo: '📱' },
  airteltigo: { name: 'AirtelTigo Money', color: '#E40000', logo: '📱' }
}

export const DEFAULT_CATEGORIES: Omit<Category, 'id' | 'createdAt'>[] = [
  { name: 'Food', icon: 'restaurant', color: '#2D7FF9', isCustom: false },
  { name: 'Family', icon: 'family_restroom', color: '#8B5CF6', isCustom: false },
  { name: 'Entertainment', icon: 'sports_esports', color: '#F43F5E', isCustom: false },
  { name: 'Study', icon: 'school', color: '#F59E0B', isCustom: false },
  { name: 'Transport', icon: 'directions_car', color: '#10B981', isCustom: false },
  { name: 'Utilities', icon: 'bolt', color: '#06B6D4', isCustom: false },
  { name: 'Health', icon: 'health_and_safety', color: '#EC4899', isCustom: false },
  { name: 'Shopping', icon: 'shopping_bag', color: '#6366F1', isCustom: false },
  { name: 'Other', icon: 'more_horiz', color: '#64748B', isCustom: false }
]
