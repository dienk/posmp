// Tipe domain inti POSMerahPutih (dipetakan dari skema SQLite).

export interface Outlet {
  id: number
  name: string
  address: string | null
  phone: string | null
  is_active: number
}

export interface Cashier {
  id: number
  outlet_id: number
  name: string
  code: string | null
  location: string | null
  is_active: number
  outlet_name?: string | null
}

export interface Category {
  id: number
  name: string
  color_code: string | null
}

export interface Product {
  id: number
  category_id: number | null
  name: string
  sku: string | null
  barcode: string | null
  price: number
  cost_price: number
  unit: string | null
  min_stock: number
  description: string | null
  is_active: number
  image_path: string | null
  images: string | null // JSON array data URL semua gambar
  category_name?: string | null
  stock?: number
}

export type FacilityType = 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY'

export type OrderSource =
  | 'POS_OFFLINE'
  | 'SELF_ORDER'
  | 'SHOPEE'
  | 'TOKOPEDIA'
  | 'TIKTOK'

export type TableStatus = 'EMPTY' | 'OCCUPIED' | 'WAITING_BILL'

export interface DiningTable {
  id: number
  outlet_id: number
  table_number: string
  section_name: string
  grid_x: number
  grid_y: number
  capacity: number
  max_capacity: number
  status: TableStatus
}

export interface CartItem {
  product: Product
  quantity: number
  notes?: string
}
