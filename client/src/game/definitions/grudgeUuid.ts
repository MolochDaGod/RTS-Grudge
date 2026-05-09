/**
 * GRUDGE UUID System
 * Generates and tracks UUIDs for all game entities with full history
 * Browser-compatible version using Web Crypto API
 */

export interface GrudgeUuidMetadata {
  entityType:
    | 'character' | 'item' | 'crafted_item' | 'island' | 'recipe'
    | 'transaction' | 'session' | 'account' | 'building' | 'node'
    | 'ship'              // a player-owned ship instance (not the tier template)
    | 'weapon_instance'   // a player-owned weapon copy (not the catalogue entry)
    | 'flag_design';      // a saved Jolly Roger painting
  entityId: string;
  entityName: string;
  tier?: number;
  quality?: string;
  owner?: string;
  attributes?: Record<string, any>;
}

export interface GrudgeUuidParsed {
  prefix: string;
  timestamp: string;
  sequence: string;
  hash: string;
  full: string;
}

const PREFIX_MAP: Record<GrudgeUuidMetadata['entityType'], string> = {
  character:        'CHAR',
  item:             'ITEM',
  crafted_item:     'CRAF',
  island:           'ISLE',
  recipe:           'RECP',
  transaction:      'TRAN',
  session:          'SESS',
  account:          'ACCT',
  building:         'BLDG',
  node:             'NODE',
  ship:             'SHIP',
  weapon_instance:  'WPNI',
  flag_design:      'FLAG',
};

const VALID_PREFIXES = Object.values(PREFIX_MAP);

/**
 * Generate random hex string using Web Crypto API (browser compatible)
 */
function randomHex(bytes: number): string {
  const array = new Uint8Array(bytes);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array);
  } else {
    for (let i = 0; i < bytes; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(array)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

/**
 * Generate simple hash from string (browser compatible)
 */
async function simpleHash(input: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 8).toUpperCase();
  }
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0').substring(0, 8).toUpperCase();
}

/**
 * Generate synchronous hash (for non-async contexts)
 */
function syncHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0').substring(0, 8).toUpperCase();
}

/**
 * Generate a GRUDGE UUID in format: PREFIX-TIMESTAMP-SEQUENCE-HASH
 * Example: CHAR-20260103143022-A3F5E2-9B4C7A8D
 */
export function generateGrudgeUuid(
  entityType: GrudgeUuidMetadata['entityType'],
  metadata: Partial<GrudgeUuidMetadata> = {}
): string {
  const prefix = PREFIX_MAP[entityType];
  
  const now = new Date();
  const timestamp = now.toISOString()
    .replace(/[-:T.Z]/g, '')
    .substring(0, 14);
  
  const sequence = randomHex(3);
  
  const metadataString = JSON.stringify(metadata) + now.getTime();
  const hash = syncHash(metadataString);
  
  return `${prefix}-${timestamp}-${sequence}-${hash}`;
}

/**
 * Parse a GRUDGE UUID into its components
 */
export function parseGrudgeUuid(grudgeUuid: string): GrudgeUuidParsed | null {
  const parts = grudgeUuid.split('-');
  if (parts.length !== 4) return null;
  
  const [prefix, timestamp, sequence, hash] = parts;
  
  if (!prefix || timestamp.length !== 14 || sequence.length !== 6 || hash.length !== 8) {
    return null;
  }
  
  return {
    prefix,
    timestamp,
    sequence,
    hash,
    full: grudgeUuid,
  };
}

/**
 * Validate UUID format
 */
export function isValidGrudgeUuid(grudgeUuid: string): boolean {
  const parsed = parseGrudgeUuid(grudgeUuid);
  if (!parsed) return false;
  return VALID_PREFIXES.includes(parsed.prefix);
}

/**
 * Get entity type from UUID prefix
 */
export function getEntityTypeFromUuid(grudgeUuid: string): GrudgeUuidMetadata['entityType'] | null {
  const parsed = parseGrudgeUuid(grudgeUuid);
  if (!parsed) return null;
  
  const entry = Object.entries(PREFIX_MAP).find(([_, prefix]) => prefix === parsed.prefix);
  return entry ? entry[0] as GrudgeUuidMetadata['entityType'] : null;
}

/**
 * Extract timestamp from UUID
 */
export function getTimestampFromUuid(grudgeUuid: string): Date | null {
  const parsed = parseGrudgeUuid(grudgeUuid);
  if (!parsed) return null;
  
  const ts = parsed.timestamp;
  const year = parseInt(ts.substring(0, 4));
  const month = parseInt(ts.substring(4, 6)) - 1;
  const day = parseInt(ts.substring(6, 8));
  const hour = parseInt(ts.substring(8, 10));
  const minute = parseInt(ts.substring(10, 12));
  const second = parseInt(ts.substring(12, 14));
  
  return new Date(year, month, day, hour, minute, second);
}

/**
 * UUID Generator for specific entity types
 */
export const UuidGenerators = {
  character: (name: string, race?: string, classId?: string, ownerId?: string) =>
    generateGrudgeUuid('character', {
      entityType: 'character',
      entityId: randomHex(8),
      entityName: name,
      owner: ownerId,
      attributes: race || classId ? { race, class: classId } : undefined,
    }),
    
  item: (name: string, tier: number = 1, ownerId?: string) =>
    generateGrudgeUuid('item', {
      entityType: 'item',
      entityId: randomHex(4),
      entityName: name,
      tier,
      owner: ownerId,
    }),
    
  craftedItem: (name: string, tier: number, crafterId: string, materials: string[]) =>
    generateGrudgeUuid('crafted_item', {
      entityType: 'crafted_item',
      entityId: randomHex(8),
      entityName: name,
      tier,
      owner: crafterId,
      attributes: { craftedFrom: materials },
    }),
    
  island: (name: string, biome?: string, gridX?: number, gridY?: number) =>
    generateGrudgeUuid('island', {
      entityType: 'island',
      entityId: randomHex(4),
      entityName: name,
      attributes: biome ? { biome, gridX, gridY } : undefined,
    }),
    
  building: (name: string, type: string, islandId?: string) =>
    generateGrudgeUuid('building', {
      entityType: 'building',
      entityId: randomHex(4),
      entityName: name,
      attributes: { type, islandId },
    }),
    
  node: (type: string, tier: number, islandId?: string) =>
    generateGrudgeUuid('node', {
      entityType: 'node',
      entityId: randomHex(4),
      entityName: `${type}-T${tier}`,
      tier,
      attributes: islandId ? { islandId } : undefined,
    }),
    
  account: (username: string, email?: string) =>
    generateGrudgeUuid('account', {
      entityType: 'account',
      entityId: randomHex(8),
      entityName: username,
      attributes: email ? { email } : undefined,
    }),
    
  session: (accountId: string) =>
    generateGrudgeUuid('session', {
      entityType: 'session',
      entityId: randomHex(8),
      entityName: 'session',
      owner: accountId,
    }),
    
  transaction: (type: string, fromId?: string, toId?: string) =>
    generateGrudgeUuid('transaction', {
      entityType: 'transaction',
      entityId: randomHex(8),
      entityName: type,
      attributes: fromId || toId ? { from: fromId, to: toId } : undefined,
    }),
    
  recipe: (name: string, tier: number = 1) =>
    generateGrudgeUuid('recipe', {
      entityType: 'recipe',
      entityId: randomHex(4),
      entityName: name,
      tier,
    }),
};

/**
 * Export UUID system info for debugging
 */
export function getUuidSystemInfo(): {
  version: string;
  format: string;
  example: string;
  prefixes: Record<string, string>;
} {
  return {
    version: '1.0.0',
    format: 'PREFIX-TIMESTAMP-SEQUENCE-HASH',
    example: generateGrudgeUuid('item', {
      entityType: 'item',
      entityId: 'example-123',
      entityName: 'Example Sword',
      tier: 1,
    }),
    prefixes: PREFIX_MAP,
  };
}
