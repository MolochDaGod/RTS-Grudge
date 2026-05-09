import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Unit, Ability } from "@shared/schema";
import { Move, Crosshair, Sparkles, SkipForward, X, Eye, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActionBarProps {
  selectedUnit: Unit | null;
  currentAction: "idle" | "move" | "attack" | "ability";
  selectedAbility: Ability | null;
  onMove: () => void;
  onAttack: () => void;
  onAbility: (ability: Ability) => void;
  onEndTurn: () => void;
  onCancel: () => void;
  canAct: boolean;
  isPlayerTurn: boolean;
  hasMovedThisTurn: boolean;
  hasActedThisTurn: boolean;
}

export function ActionBar({
  selectedUnit,
  currentAction,
  selectedAbility,
  onMove,
  onAttack,
  onAbility,
  onEndTurn,
  onCancel,
  canAct,
  isPlayerTurn,
  hasMovedThisTurn,
  hasActedThisTurn,
}: ActionBarProps) {
  const getAbilityTypeColor = (type: string) => {
    switch (type) {
      case "attack":
        return "text-red-500";
      case "heal":
        return "text-green-500";
      case "buff":
        return "text-blue-500";
      case "debuff":
        return "text-purple-500";
      case "movement":
        return "text-cyan-500";
      default:
        return "text-muted-foreground";
    }
  };

  const showUnitActions = selectedUnit && !selectedUnit.isEnemy;

  return (
    <Card className="p-4">
      {showUnitActions ? (
        <>
          <div className="flex items-center justify-between gap-2 mb-3">
            <h3 className="font-serif font-semibold">{selectedUnit.name}</h3>
            {currentAction !== "idle" && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onCancel}
                data-testid="button-cancel-action"
              >
                <X className="w-4 h-4 mr-1" />
                Cancel
              </Button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 mb-3">
            <Button
              variant={currentAction === "move" ? "default" : "secondary"}
              onClick={onMove}
              disabled={!canAct || hasMovedThisTurn}
              className="justify-start gap-2"
              data-testid="button-move"
            >
              <Move className="w-4 h-4" />
              Move
              {hasMovedThisTurn && (
                <Badge variant="outline" className="ml-auto text-xs">
                  Done
                </Badge>
              )}
            </Button>
            
            <Button
              variant={currentAction === "attack" ? "default" : "secondary"}
              onClick={onAttack}
              disabled={!canAct || hasActedThisTurn}
              className="justify-start gap-2"
              data-testid="button-attack"
            >
              <Crosshair className="w-4 h-4" />
              Attack
              {hasActedThisTurn && (
                <Badge variant="outline" className="ml-auto text-xs">
                  Done
                </Badge>
              )}
            </Button>
          </div>

          <div className="border-t border-border pt-3 mb-3">
            <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              ABILITIES
            </p>
            <div className="grid grid-cols-1 gap-1.5">
              {selectedUnit.abilities.map((ability) => {
                const isSelected = selectedAbility?.id === ability.id;
                const onCooldown = ability.currentCooldown > 0;
                
                return (
                  <Tooltip key={ability.id}>
                    <TooltipTrigger asChild>
                      <Button
                        variant={isSelected ? "default" : "ghost"}
                        size="sm"
                        onClick={() => onAbility(ability)}
                        disabled={!canAct || hasActedThisTurn || onCooldown}
                        className={cn(
                          "justify-between h-auto py-2",
                          isSelected && "ring-1 ring-primary"
                        )}
                        data-testid={`button-ability-${ability.id}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={cn("font-medium", getAbilityTypeColor(ability.type))}>
                            {ability.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          {ability.damage && (
                            <span className="text-red-500">DMG:{ability.damage}</span>
                          )}
                          {ability.healing && (
                            <span className="text-green-500">+{ability.healing}</span>
                          )}
                          <span className="flex items-center gap-0.5 text-muted-foreground">
                            <Eye className="w-3 h-3" />
                            {ability.range}
                          </span>
                          {onCooldown && (
                            <Badge variant="destructive" className="text-xs px-1.5">
                              CD:{ability.currentCooldown}
                            </Badge>
                          )}
                          {ability.manaCost > 0 && !onCooldown && (
                            <span className="flex items-center gap-0.5 text-blue-400">
                              <Zap className="w-3 h-3" />
                              {ability.manaCost}
                            </span>
                          )}
                        </div>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="max-w-xs">
                      <p className="font-semibold">{ability.name}</p>
                      <p className="text-sm text-muted-foreground">{ability.description}</p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        <p className="text-center text-muted-foreground text-sm mb-3">
          Select a friendly unit to view actions
        </p>
      )}

      <Button
        onClick={onEndTurn}
        variant="outline"
        className="w-full"
        disabled={!isPlayerTurn}
        data-testid="button-end-turn"
      >
        <SkipForward className="w-4 h-4 mr-2" />
        End Turn
      </Button>
    </Card>
  );
}
