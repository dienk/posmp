import { execute, query } from '../../db/database'

export type Platform = 'SHOPEE' | 'TOKOPEDIA' | 'TIKTOK'

export interface MarketplaceChannel {
  id: number
  platform_name: Platform
  shop_id: string
  shop_name: string | null
  is_active: number
  last_synced_at: string | null
  mapping_count?: number
}

export interface ProductMappingRow {
  id: number
  product_id: number
  product_name: string
  sku: string | null
  external_sku: string
  external_product_id: string
}

export function listChannels(): MarketplaceChannel[] {
  return query<MarketplaceChannel>(
    `SELECT c.id, c.platform_name, c.shop_id, c.shop_name, c.is_active, c.last_synced_at,
            COUNT(m.id) AS mapping_count
     FROM marketplace_channels c
     LEFT JOIN product_marketplace_mappings m ON m.channel_id = c.id
     GROUP BY c.id
     ORDER BY c.id`,
  )
}

export async function addChannel(
  platform: Platform,
  shopId: string,
  shopName: string,
): Promise<number> {
  return execute(
    `INSERT INTO marketplace_channels (platform_name, shop_id, shop_name, is_active)
     VALUES (?, ?, ?, 1)`,
    [platform, shopId, shopName],
  )
}

export async function toggleChannel(id: number, active: boolean): Promise<void> {
  await execute('UPDATE marketplace_channels SET is_active = ? WHERE id = ?', [active ? 1 : 0, id])
}

export async function removeChannel(id: number): Promise<void> {
  await execute('DELETE FROM product_marketplace_mappings WHERE channel_id = ?', [id])
  await execute('DELETE FROM marketplace_channels WHERE id = ?', [id])
}

export function listMappings(channelId: number): ProductMappingRow[] {
  return query<ProductMappingRow>(
    `SELECT m.id, m.product_id, p.name AS product_name, p.sku,
            m.external_sku, m.external_product_id
     FROM product_marketplace_mappings m
     JOIN products p ON p.id = m.product_id
     WHERE m.channel_id = ?
     ORDER BY p.name`,
    [channelId],
  )
}

export async function addMapping(
  productId: number,
  channelId: number,
  externalSku: string,
  externalProductId: string,
): Promise<number> {
  return execute(
    `INSERT INTO product_marketplace_mappings (product_id, channel_id, external_sku, external_product_id)
     VALUES (?, ?, ?, ?)`,
    [productId, channelId, externalSku, externalProductId],
  )
}

/**
 * Simulasi push sinkronisasi stok ke marketplace.
 *
 * CATATAN: Integrasi nyata memerlukan kredensial & panggilan API resmi tiap
 * platform (Shopee/Tokopedia/TikTok). Pada mode offline-first, perubahan stok
 * seharusnya masuk Sync Queue dan dikirim saat internet pulih (Milestone 4).
 * Fungsi ini hanya menandai waktu sinkron terakhir sebagai placeholder.
 */
export async function markSynced(channelId: number): Promise<void> {
  await execute(
    `UPDATE marketplace_channels SET last_synced_at = datetime('now','localtime') WHERE id = ?`,
    [channelId],
  )
}
