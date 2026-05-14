import { useCampaign } from "@/lib/stores/useCampaign";

const UI = "/textures/ui";
const GOLD = "#c9950a";

export default function CampaignHUD() {
  const active = useCampaign((s) => s.active);
  const daysSurvived = useCampaign((s) => s.daysSurvived);
  const islandsDiscovered = useCampaign((s) => s.islandsDiscovered);
  const dungeonsCleared = useCampaign((s) => s.dungeonsCleared);
  const totalKills = useCampaign((s) => s.totalKills);
  const activeQuests = useCampaign((s) => s.activeQuests);
  const homeBaseLevel = useCampaign((s) => s.homeBaseLevel);

  if (!active) return null;

  return (
    <>
      <div style={{
        position: "fixed",
        top: 8,
        right: 8,
        display: "flex",
        flexDirection: "column",
        gap: 4,
        zIndex: 9990,
        pointerEvents: "none",
      }}>
        <div style={{
          background: "rgba(10,8,5,0.85)",
          border: `1px solid ${GOLD}`,
          borderRadius: 8,
          padding: "8px 12px",
          minWidth: 180,
        }}>
          <div style={{
            color: GOLD,
            fontSize: 11,
            fontFamily: "'Cinzel', serif",
            letterSpacing: 1,
            marginBottom: 6,
            textTransform: "uppercase",
          }}>
            Campaign
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <StatRow icon="☀" label="Day" value={daysSurvived} />
            <StatRow icon="🏝" label="Islands" value={islandsDiscovered} />
            <StatRow icon="⚔" label="Dungeons" value={dungeonsCleared} />
            <StatRow icon="💀" label="Kills" value={totalKills} />
            <StatRow icon="🏰" label="Base Lv" value={homeBaseLevel} />
          </div>
        </div>

        {activeQuests.length > 0 && (
          <div style={{
            background: "rgba(10,8,5,0.85)",
            border: "1px solid rgba(201,149,10,0.4)",
            borderRadius: 8,
            padding: "8px 12px",
            maxWidth: 220,
          }}>
            <div style={{
              color: "#b8a060",
              fontSize: 10,
              fontFamily: "'Cinzel', serif",
              letterSpacing: 1,
              marginBottom: 4,
              textTransform: "uppercase",
            }}>
              Quests
            </div>
            {activeQuests.slice(0, 3).map((quest) => {
              const hasProgress = typeof quest.target === "number" && quest.target > 0;
              return (
                <div key={quest.id} style={{
                  marginBottom: 4,
                  borderLeft: "2px solid rgba(201,149,10,0.3)",
                  paddingLeft: 6,
                }}>
                  <div style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                  }}>
                    <div style={{ color: "#e0d0a0", fontSize: 10, fontWeight: "bold" }}>
                      {quest.title}
                    </div>
                    {hasProgress && (
                      <div style={{ color: "#ffd166", fontSize: 9, fontFamily: "monospace" }}>
                        {quest.progress ?? 0}/{quest.target}
                      </div>
                    )}
                  </div>
                  <div style={{ color: "#8a7a5a", fontSize: 9, lineHeight: 1.3 }}>
                    {quest.description}
                  </div>
                </div>
              );
            })}
            {activeQuests.length > 3 && (
              <div style={{ color: "#666", fontSize: 9 }}>
                +{activeQuests.length - 3} more
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function StatRow({ icon, label, value }: { icon: string; label: string; value: number }) {
  return (
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      fontSize: 10,
    }}>
      <span style={{ color: "#9a8a6a" }}>
        <span style={{ marginRight: 4 }}>{icon}</span>
        {label}
      </span>
      <span style={{ color: "#e0d0a0", fontWeight: "bold", fontFamily: "monospace" }}>
        {value}
      </span>
    </div>
  );
}
