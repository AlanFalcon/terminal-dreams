function createSceneManager(world) {
  function loadScene(roomId) {
    for (const zone of Object.values(world.zones)) {
      if (!zone) continue;
      const room = zone.rooms.find(r => r.id === roomId);
      if (room) return room;
    }
    throw new Error(`Room not found: ${roomId}`);
  }

  function resolveExit(room, direction) {
    const raw = room.exits[direction];
    if (!raw) return null;
    return raw; // room id, __complete__, __gate_*, or __gate_unlocked__
  }

  function resolveGate(room, direction, world) {
    const { gateMechanic, gateTarget } = room;

    if (gateMechanic === 'open') {
      if (world.pendingZone && world.zones[gateTarget]?.status !== 'ready') return '__stall__';
      return world.zones[gateTarget]?.startRoomId || null;
    }

    if (gateMechanic === 'narrative') {
      if (!gateTarget || !world.pendingZone) return null;
      const exitVal = room.exits[direction];
      if (exitVal !== '__gate_unlocked__') return null;
      if (world.zones[gateTarget]?.status !== 'ready') return '__stall__';
      return world.zones[gateTarget].startRoomId;
    }

    if (gateMechanic === 'completion') {
      const currentZone = Object.values(world.zones).find(z => z?.rooms.some(r => r.id === room.id));
      const threshold = Math.ceil((currentZone?.rooms.length || 1) / 2);
      if (world.discoveredLatents < threshold) return null;
      if (world.zones[gateTarget]?.status !== 'ready') return '__stall__';
      return world.zones[gateTarget].startRoomId;
    }

    return null;
  }

  function setPivotTaken(value) {
    world.pivotTaken = value;
    const act1 = world.zones.act1;
    if (act1) {
      const gateRoom = act1.rooms.find(r => r.isGate);
      if (gateRoom) gateRoom.gateTarget = value ? 'act2a' : 'act2b';
    }
  }

  function resolveFork() {
    return world.pivotTaken ? 'act2a' : 'act2b';
  }

  return { loadScene, resolveExit, resolveGate, setPivotTaken, isPivotTaken: () => world.pivotTaken, resolveFork };
}

module.exports = { createSceneManager };
