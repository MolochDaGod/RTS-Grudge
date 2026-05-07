import { useState, useCallback } from "react";
import { useHousing, FURNITURE_CATALOG, type FurnitureType, type StorageItem } from "@/lib/stores/useHousing";
import { useInventory } from "@/lib/stores/useInventory";

const c = {
  bg: "#1a120c",
  panel: "#2a1e13",
  panel2: "#1e1410",
  border: "#d4a400",
  borderDim: "#3a2a1a",
  text: "#f5e2c1",
  muted: "#b28a4f",
  slot: "#291f14",
  slotBorder: "#3a2a1a",
  green: "#9bdc9a",
  amber: "#ffd56a",
  red: "#e53935",
  blue: "#42a5f5",
};

function FurnitureCatalog() {
  const { placeFurniture, furniture, selectedFurnitureType, setSelectedFurnitureType } = useHousing();
  const { hasItem, removeItem } = useInventory();

  const handlePlace = useCallback((type: FurnitureType) => {
    const def = FURNITURE_CATALOG.find(f => f.type === type);
    if (!def) return;

    const canAfford = def.cost.every(c => hasItem(c.itemId, c.count));
    if (!canAfford) return;

    const x = (Math.random() - 0.5) * 6;
    const z = (Math.random() - 0.5) * 6;
    const ySize = def.size[1];

    for (const cost of def.cost) {
      removeItem(cost.itemId, cost.count);
    }

    placeFurniture(type, [x, ySize / 2, z], 0);
  }, [placeFurniture, hasItem, removeItem]);

  return (
    <div>
      <div style={{
        fontSize: 11, color: c.muted, textTransform: "uppercase",
        letterSpacing: 1, marginBottom: 8,
      }}>
        Furniture Catalog
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {FURNITURE_CATALOG.map(def => {
          const canAfford = def.cost.every(co => hasItem(co.itemId, co.count));
          const isSelected = selectedFurnitureType === def.type;

          return (
            <div
              key={def.type}
              onClick={() => isSelected ? setSelectedFurnitureType(null) : setSelectedFurnitureType(def.type)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "8px 10px", borderRadius: 6, cursor: "pointer",
                background: isSelected ? "rgba(212,164,0,0.15)" : "rgba(42,30,19,0.6)",
                border: `1px solid ${isSelected ? c.border : c.borderDim}`,
                opacity: canAfford ? 1 : 0.5,
                transition: "all 0.15s",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 22 }}>{def.icon}</span>
                <div>
                  <div style={{ color: c.amber, fontWeight: 700, fontSize: 12 }}>{def.name}</div>
                  <div style={{ fontSize: 9, color: c.muted }}>
                    {def.cost.map(co => `${co.count}x ${co.itemId.replace("_", " ")}`).join(", ")}
                  </div>
                </div>
              </div>
              <button
                disabled={!canAfford}
                onClick={(e) => { e.stopPropagation(); handlePlace(def.type); }}
                style={{
                  padding: "4px 10px", fontSize: 10, borderRadius: 4, fontWeight: 700,
                  background: canAfford ? "rgba(155,220,154,0.25)" : "rgba(100,100,100,0.2)",
                  border: canAfford ? `1px solid ${c.green}` : `1px solid ${c.borderDim}`,
                  color: canAfford ? c.green : c.muted,
                  cursor: canAfford ? "pointer" : "default",
                }}
              >
                Place
              </button>
            </div>
          );
        })}
      </div>

      {furniture.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{
            fontSize: 11, color: c.muted, textTransform: "uppercase",
            letterSpacing: 1, marginBottom: 6,
          }}>
            Placed Furniture ({furniture.length})
          </div>
          <PlacedFurnitureList />
        </div>
      )}
    </div>
  );
}

function PlacedFurnitureList() {
  const { furniture, removeFurniture } = useHousing();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 200, overflowY: "auto" }}>
      {furniture.map(f => {
        const def = FURNITURE_CATALOG.find(d => d.type === f.type);
        return (
          <div key={f.id} style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "4px 8px", borderRadius: 4,
            background: "rgba(30,20,16,0.6)", border: `1px solid ${c.borderDim}`,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 14 }}>{def?.icon}</span>
              <span style={{ fontSize: 11, color: c.text }}>{def?.name}</span>
            </div>
            <button
              onClick={() => removeFurniture(f.id)}
              style={{
                padding: "2px 6px", fontSize: 9,
                background: "rgba(229,57,53,0.2)", border: "1px solid rgba(229,57,53,0.4)",
                borderRadius: 3, color: c.red, cursor: "pointer",
              }}
            >
              Remove
            </button>
          </div>
        );
      })}
    </div>
  );
}

function StorageUI() {
  const { storage, maxStorage, addToStorage, removeFromStorage, hasStorageSpace } = useHousing();
  const { items, addItem, removeItem } = useInventory();
  const [selectedStorage, setSelectedStorage] = useState<number | null>(null);
  const [selectedInventory, setSelectedInventory] = useState<number | null>(null);

  const transferToStorage = useCallback((invIndex: number) => {
    const item = items[invIndex];
    if (!item || !hasStorageSpace()) return;

    const storageItem: StorageItem = {
      id: item.id,
      name: item.name,
      type: item.type,
      quantity: 1,
      damage: item.damage,
      healAmount: item.healAmount,
      icon: item.icon,
    };

    const success = addToStorage(storageItem);
    if (success) {
      removeItem(item.id, 1);
      setSelectedInventory(null);
    }
  }, [items, addToStorage, removeItem, hasStorageSpace]);

  const transferToInventory = useCallback((storageIndex: number) => {
    const item = storage[storageIndex];
    if (!item) return;

    addItem({
      id: item.id,
      name: item.name,
      type: item.type,
      quantity: 1,
      damage: item.damage,
      healAmount: item.healAmount,
      icon: item.icon,
    });
    removeFromStorage(item.id, 1);
    setSelectedStorage(null);
  }, [storage, addItem, removeFromStorage]);

  return (
    <div style={{ display: "flex", gap: 16 }}>
      <div style={{ flex: 1 }}>
        <div style={{
          fontSize: 11, color: c.muted, textTransform: "uppercase",
          letterSpacing: 1, marginBottom: 6,
        }}>
          Storage ({storage.length}/{maxStorage})
        </div>
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 4,
          background: "#1b130f", border: `2px solid ${c.border}`, borderRadius: 8, padding: 6,
        }}>
          {Array.from({ length: maxStorage }).map((_, i) => {
            const item = storage[i];
            const isSelected = selectedStorage === i;
            return (
              <div
                key={i}
                onClick={() => {
                  if (item) {
                    if (isSelected) {
                      transferToInventory(i);
                    } else {
                      setSelectedStorage(i);
                      setSelectedInventory(null);
                    }
                  }
                }}
                style={{
                  aspectRatio: "1", border: `2px solid ${isSelected ? c.border : c.borderDim}`,
                  borderRadius: 4, background: isSelected ? "rgba(212,164,0,0.15)" : "linear-gradient(#2b1e12, #1a120d)",
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  cursor: item ? "pointer" : "default", position: "relative", minHeight: 36,
                }}
              >
                {item && (
                  <>
                    <span style={{ fontSize: 14 }}>{item.icon}</span>
                    {item.quantity > 1 && (
                      <span style={{
                        position: "absolute", bottom: 1, right: 3,
                        fontSize: 8, color: c.text,
                      }}>
                        {item.quantity}
                      </span>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
        {selectedStorage !== null && storage[selectedStorage] && (
          <div style={{
            marginTop: 6, background: "rgba(42,30,19,0.8)", padding: 6,
            borderRadius: 4, border: `1px solid ${c.borderDim}`,
          }}>
            <div style={{ color: c.amber, fontWeight: 700, fontSize: 11 }}>
              {storage[selectedStorage].icon} {storage[selectedStorage].name}
            </div>
            <div style={{ fontSize: 9, color: c.muted }}>
              Click again to move to inventory
            </div>
          </div>
        )}
      </div>

      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", gap: 8,
      }}>
        <button
          onClick={() => {
            if (selectedInventory !== null) transferToStorage(selectedInventory);
          }}
          disabled={selectedInventory === null}
          style={{
            padding: "6px 10px", fontSize: 16, borderRadius: 4,
            background: selectedInventory !== null ? "rgba(155,220,154,0.25)" : "rgba(100,100,100,0.2)",
            border: `1px solid ${selectedInventory !== null ? c.green : c.borderDim}`,
            color: selectedInventory !== null ? c.green : c.muted,
            cursor: selectedInventory !== null ? "pointer" : "default",
          }}
        >
          ←
        </button>
        <button
          onClick={() => {
            if (selectedStorage !== null) transferToInventory(selectedStorage);
          }}
          disabled={selectedStorage === null}
          style={{
            padding: "6px 10px", fontSize: 16, borderRadius: 4,
            background: selectedStorage !== null ? "rgba(155,220,154,0.25)" : "rgba(100,100,100,0.2)",
            border: `1px solid ${selectedStorage !== null ? c.green : c.borderDim}`,
            color: selectedStorage !== null ? c.green : c.muted,
            cursor: selectedStorage !== null ? "pointer" : "default",
          }}
        >
          →
        </button>
      </div>

      <div style={{ flex: 1 }}>
        <div style={{
          fontSize: 11, color: c.muted, textTransform: "uppercase",
          letterSpacing: 1, marginBottom: 6,
        }}>
          Inventory ({items.length}/9)
        </div>
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4,
          background: "#1b130f", border: `2px solid ${c.border}`, borderRadius: 8, padding: 6,
        }}>
          {Array.from({ length: 9 }).map((_, i) => {
            const item = items[i];
            const isSelected = selectedInventory === i;
            return (
              <div
                key={i}
                onClick={() => {
                  if (item) {
                    if (isSelected) {
                      transferToStorage(i);
                    } else {
                      setSelectedInventory(i);
                      setSelectedStorage(null);
                    }
                  }
                }}
                style={{
                  aspectRatio: "1", border: `2px solid ${isSelected ? c.border : c.borderDim}`,
                  borderRadius: 4, background: isSelected ? "rgba(212,164,0,0.15)" : "linear-gradient(#2b1e12, #1a120d)",
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  cursor: item ? "pointer" : "default", position: "relative", minHeight: 36,
                }}
              >
                {item && (
                  <>
                    <span style={{ fontSize: 14 }}>{item.icon}</span>
                    {item.quantity > 1 && (
                      <span style={{
                        position: "absolute", bottom: 1, right: 3,
                        fontSize: 8, color: c.text,
                      }}>
                        {item.quantity}
                      </span>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
        {selectedInventory !== null && items[selectedInventory] && (
          <div style={{
            marginTop: 6, background: "rgba(42,30,19,0.8)", padding: 6,
            borderRadius: 4, border: `1px solid ${c.borderDim}`,
          }}>
            <div style={{ color: c.amber, fontWeight: 700, fontSize: 11 }}>
              {items[selectedInventory].icon} {items[selectedInventory].name}
            </div>
            <div style={{ fontSize: 9, color: c.muted }}>
              Click again to move to storage
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function HousingUI() {
  const { buildMode, setBuildMode, storageOpen, setStorageOpen } = useHousing();

  return (
    <>
      <div style={{
        position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)",
        display: "flex", gap: 8, zIndex: 150,
      }}>
        <button
          onClick={() => { setBuildMode(!buildMode); }}
          style={{
            padding: "8px 18px", fontSize: 13, fontWeight: 700,
            background: buildMode ? "rgba(212,164,0,0.3)" : "rgba(0,0,0,0.7)",
            border: buildMode ? `2px solid ${c.border}` : "2px solid #555",
            borderRadius: 6, color: buildMode ? c.amber : "#fff",
            cursor: "pointer", textTransform: "uppercase", letterSpacing: 1,
          }}
        >
          {buildMode ? "Exit Build" : "Build Mode [B]"}
        </button>
        <button
          onClick={() => { setStorageOpen(!storageOpen); }}
          style={{
            padding: "8px 18px", fontSize: 13, fontWeight: 700,
            background: storageOpen ? "rgba(212,164,0,0.3)" : "rgba(0,0,0,0.7)",
            border: storageOpen ? `2px solid ${c.border}` : "2px solid #555",
            borderRadius: 6, color: storageOpen ? c.amber : "#fff",
            cursor: "pointer", textTransform: "uppercase", letterSpacing: 1,
          }}
        >
          {storageOpen ? "Close Storage" : "Storage [V]"}
        </button>
        <div style={{
          padding: "8px 14px", fontSize: 11, color: "#aaa",
          background: "rgba(0,0,0,0.5)", borderRadius: 6,
          display: "flex", alignItems: "center",
        }}>
          Press T to exit house
        </div>
      </div>

      {buildMode && (
        <div style={{
          position: "absolute", top: 0, right: 0, bottom: 0, width: 340,
          background: `linear-gradient(${c.panel}, ${c.panel2})`,
          borderLeft: `2px solid ${c.border}`,
          boxShadow: "-4px 0 20px rgba(0,0,0,0.6)",
          padding: 16, overflowY: "auto", zIndex: 160,
        }}>
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            marginBottom: 12, paddingBottom: 8,
            borderBottom: `1px solid rgba(212,164,0,0.25)`,
          }}>
            <h2 style={{
              margin: 0, fontSize: 16, textTransform: "uppercase",
              letterSpacing: 1, color: "#f6e0ad", fontFamily: "Georgia, serif",
            }}>
              Build Mode
            </h2>
            <button
              onClick={() => setBuildMode(false)}
              style={{
                padding: "4px 10px", fontSize: 12,
                background: "rgba(229,57,53,0.15)", border: "1px solid rgba(229,57,53,0.3)",
                borderRadius: 4, color: c.red, cursor: "pointer", fontWeight: 700,
              }}
            >
              ✕
            </button>
          </div>
          <FurnitureCatalog />
        </div>
      )}

      {storageOpen && (
        <div
          style={{
            position: "absolute", inset: 0, zIndex: 200,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(0,0,0,0.6)", backdropFilter: "blur(2px)",
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setStorageOpen(false); }}
        >
          <div style={{
            width: "min(700px, 90vw)", maxHeight: "80vh",
            background: `linear-gradient(${c.panel}, ${c.panel2})`,
            border: `2px solid ${c.border}`, borderRadius: 10, padding: 16,
            boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.4), 0 6px 20px rgba(0,0,0,0.6)",
            overflowY: "auto",
          }}>
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              marginBottom: 12, paddingBottom: 8,
              borderBottom: `1px solid rgba(212,164,0,0.25)`,
            }}>
              <h2 style={{
                margin: 0, fontSize: 16, textTransform: "uppercase",
                letterSpacing: 1, color: "#f6e0ad", fontFamily: "Georgia, serif",
              }}>
                Storage Chest
              </h2>
              <button
                onClick={() => setStorageOpen(false)}
                style={{
                  padding: "4px 10px", fontSize: 12,
                  background: "rgba(229,57,53,0.15)", border: "1px solid rgba(229,57,53,0.3)",
                  borderRadius: 4, color: c.red, cursor: "pointer", fontWeight: 700,
                }}
              >
                ✕
              </button>
            </div>
            <StorageUI />
          </div>
        </div>
      )}
    </>
  );
}
