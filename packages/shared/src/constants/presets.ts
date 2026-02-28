import type { Account, Category } from '../types'

export const PRESET_ACCOUNTS: Omit<Account, 'id' | 'currentBalance' | 'isDeleted' | 'createdAt' | 'updatedAt'>[] = [
  { name: '支付宝', icon: 'alipay', currency: 'CNY', initialBalance: 0, isPreset: true },
  { name: '微信支付', icon: 'wechat', currency: 'CNY', initialBalance: 0, isPreset: true },
]

export const PRESET_EXPENSE_CATEGORIES: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>[] = [
  { name: '餐饮', icon: 'restaurant', type: 'expense', parentId: null, isPreset: true },
  { name: '交通', icon: 'car', type: 'expense', parentId: null, isPreset: true },
  { name: '购物', icon: 'shopping-cart', type: 'expense', parentId: null, isPreset: true },
  { name: '娱乐', icon: 'game-controller', type: 'expense', parentId: null, isPreset: true },
  { name: '居住', icon: 'home', type: 'expense', parentId: null, isPreset: true },
  { name: '医疗', icon: 'medicine-box', type: 'expense', parentId: null, isPreset: true },
  { name: '教育', icon: 'book', type: 'expense', parentId: null, isPreset: true },
  { name: '社交', icon: 'gift', type: 'expense', parentId: null, isPreset: true },
  { name: '其他', icon: 'more', type: 'expense', parentId: null, isPreset: true },
]

export const PRESET_INCOME_CATEGORIES: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>[] = [
  { name: '工资', icon: 'dollar', type: 'income', parentId: null, isPreset: true },
  { name: '兼职', icon: 'laptop', type: 'income', parentId: null, isPreset: true },
  { name: '投资', icon: 'stock', type: 'income', parentId: null, isPreset: true },
  { name: '其他', icon: 'more', type: 'income', parentId: null, isPreset: true },
]

export const PRESET_EXPENSE_SUBCATEGORIES: Record<string, Omit<Category, 'id' | 'type' | 'parentId' | 'createdAt' | 'updatedAt'>[]> = {
  '餐饮': [
    { name: '早餐', icon: 'coffee', isPreset: true },
    { name: '午餐', icon: 'restaurant', isPreset: true },
    { name: '晚餐', icon: 'restaurant', isPreset: true },
    { name: '夜宵', icon: 'coffee', isPreset: true },
    { name: '饮料', icon: 'coffee', isPreset: true },
  ],
  '交通': [
    { name: '公交', icon: 'bus', isPreset: true },
    { name: '地铁', icon: 'subway', isPreset: true },
    { name: '打车', icon: 'car', isPreset: true },
    { name: '共享单车', icon: 'bike', isPreset: true },
    { name: '加油', icon: 'gas-station', isPreset: true },
  ],
  '购物': [
    { name: '日用品', icon: 'shopping', isPreset: true },
    { name: '服饰', icon: 'skin', isPreset: true },
    { name: '数码', icon: 'mobile', isPreset: true },
    { name: '家电', icon: 'desktop', isPreset: true },
  ],
  '娱乐': [
    { name: '电影', icon: 'video-camera', isPreset: true },
    { name: '游戏', icon: 'game-controller', isPreset: true },
    { name: '旅游', icon: 'airplane', isPreset: true },
    { name: '运动', icon: 'trophy', isPreset: true },
  ],
  '居住': [
    { name: '房租', icon: 'home', isPreset: true },
    { name: '水电', icon: 'thunderbolt', isPreset: true },
    { name: '物业', icon: 'home', isPreset: true },
    { name: '装修', icon: 'tool', isPreset: true },
  ],
  '医疗': [
    { name: '药品', icon: 'medicine-box', isPreset: true },
    { name: '门诊', icon: 'hospital', isPreset: true },
    { name: '住院', icon: 'hospital', isPreset: true },
  ],
  '教育': [
    { name: '书籍', icon: 'book', isPreset: true },
    { name: '课程', icon: 'read', isPreset: true },
    { name: '培训', icon: 'solution', isPreset: true },
  ],
  '社交': [
    { name: '红包', icon: 'gift', isPreset: true },
    { name: '礼物', icon: 'gift', isPreset: true },
    { name: '请客', icon: 'team', isPreset: true },
  ],
  '其他': [],
}

export const PRESET_INCOME_SUBCATEGORIES: Record<string, Omit<Category, 'id' | 'type' | 'parentId' | 'createdAt' | 'updatedAt'>[]> = {
  '工资': [
    { name: '基本工资', icon: 'dollar', isPreset: true },
    { name: '奖金', icon: 'dollar', isPreset: true },
    { name: '津贴', icon: 'dollar', isPreset: true },
  ],
  '兼职': [
    { name: '兼职收入', icon: 'laptop', isPreset: true },
    { name: '稿费', icon: 'edit', isPreset: true },
  ],
  '投资': [
    { name: '股票', icon: 'stock', isPreset: true },
    { name: '基金', icon: 'stock', isPreset: true },
    { name: '理财', icon: 'stock', isPreset: true },
  ],
  '其他': [],
}
