import { EntityManager, Time } from "yuka";

let _manager: EntityManager | null = null;
let _time: Time | null = null;

export function getYukaWorld(): { manager: EntityManager; time: Time } {
  if (!_manager) _manager = new EntityManager();
  if (!_time) _time = new Time();
  return { manager: _manager, time: _time };
}

export function tickYuka(deltaSeconds?: number) {
  const { manager, time } = getYukaWorld();
  const delta = deltaSeconds ?? time.update().getDelta();
  manager.update(delta);
  return delta;
}

export function resetYukaWorld() {
  _manager = null;
  _time = null;
}
