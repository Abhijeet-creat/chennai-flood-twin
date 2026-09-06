/* ================================================================
   URBAN DRAINAGE NETWORK MODEL

   SIH Urban Flood Nowcasting

   PURPOSE
   -------
   Represent the underground stormwater network as a directed graph.

   NODE
   ----
   Manhole / inlet / outlet

   EDGE
   ----
   Pipe / drain / canal

   INPUT
   -----
   Surface runoff volume from runoff.ts

   OUTPUT
   ------
   - Flow through each pipe
   - Pipe capacity
   - Node storage
   - Surcharge
   - Overflow/backflow
   - Surface flooding contribution

   IMPORTANT
   ----------
   This is deliberately independent from the existing flood and
   earthquake systems.

   The real drainage GIS/network data can later be loaded into the
   same graph format without changing the hydraulic calculations.
================================================================ */

/* ================================================================
   TYPES
================================================================ */

export type DrainageNodeType =
  | "inlet"
  | "manhole"
  | "junction"
  | "outfall"
  | "storage";

export type DrainageNode = {
  id: string;

  type: DrainageNodeType;

  /*
   * Geographic location.
   */
  longitude: number;
  latitude: number;

  /*
   * Ground / invert elevations in metres.
   */
  groundElevationM: number;

  invertElevationM: number;

  /*
   * Maximum useful surface collection rate.
   *
   * Units:
   * m3/s
   */
  inletCapacityM3s: number;

  /*
   * Maximum temporary storage inside the node.
   */
  storageCapacityM3: number;

  /*
   * Current stored water.
   */
  storageM3: number;

  /*
   * Water returning to the street.
   */
  surchargeVolumeM3: number;

  /*
   * Whether this node is currently overloaded.
   */
  surcharged: boolean;
};

export type DrainagePipeShape =
  | "circular"
  | "rectangular"
  | "trapezoidal"
  | "open_channel";

export type DrainagePipe = {
  id: string;

  fromNode: string;

  toNode: string;

  shape: DrainagePipeShape;

  /*
   * Pipe dimensions.
   *
   * Circular:
   * diameterM
   *
   * Rectangular:
   * widthM + heightM
   */
  diameterM: number;

  widthM: number;

  heightM: number;

  /*
   * Pipe length.
   */
  lengthM: number;

  /*
   * Slope as a ratio.
   *
   * Example:
   * 0.005 = 0.5%
   */
  slope: number;

  /*
   * Manning roughness coefficient.
   *
   * Typical stormwater ranges are around 0.01–0.03,
   * but the final project should use network metadata.
   */
  manningN: number;

  /*
   * Optional blockage fraction.
   *
   * 0.0 = no blockage
   * 1.0 = completely blocked
   */
  blockageFraction: number;

  /*
   * Runtime hydraulic state.
   */
  flowM3s: number;

  capacityM3s: number;

  overloaded: boolean;

  overflowM3: number;
};

export type DrainageGraph = {
  nodes: DrainageNode[];

  pipes: DrainagePipe[];

  nodeById: Map<string, DrainageNode>;

  pipeById: Map<string, DrainagePipe>;
};

export type DrainageSimulation = {
  durationMinutes: number;

  timestepMinutes: number;

  graph: DrainageGraph;

  totalRunoffVolumeM3: number;

  totalCapturedVolumeM3: number;

  totalPipeFlowVolumeM3: number;

  totalSurfaceOverflowM3: number;

  overloadedNodes: string[];

  overloadedPipes: string[];
};

/* ================================================================
   CONSTANTS
================================================================ */

export const DEFAULT_MANNING_N =
  0.018;

/*
 * We don't allow negative geometry values.
 */
const MIN_DIMENSION_M =
  0.05;

const MIN_SLOPE =
  0.00001;

/*
 * Minimum hydraulic capacity for a tiny pipe.
 */
const MIN_CAPACITY_M3S =
  0.00001;

/* ================================================================
   BASIC HELPERS
================================================================ */

function clamp(
  value: number,
  min: number,
  max: number
): number {
  return Math.max(
    min,
    Math.min(
      max,
      value
    )
  );
}

function positive(
  value: number
): number {
  if (
    !Number.isFinite(value)
  ) {
    return 0;
  }

  return Math.max(
    0,
    value
  );
}

/* ================================================================
   MANNING HYDRAULICS
================================================================ */

/*
 * Manning equation:
 *
 * Q = (1/n) A R^(2/3) S^(1/2)
 *
 * where:
 *
 * Q = flow m3/s
 * n = Manning roughness
 * A = wetted cross-sectional area
 * R = hydraulic radius
 * S = slope
 */

/* ================================================================
   CIRCULAR PIPE
================================================================ */

function circularArea(
  diameterM: number
): number {
  const d =
    Math.max(
      MIN_DIMENSION_M,
      diameterM
    );

  return (
    Math.PI *
    d *
    d /
    4
  );
}

function circularWettedPerimeter(
  diameterM: number
): number {
  const d =
    Math.max(
      MIN_DIMENSION_M,
      diameterM
    );

  return (
    Math.PI * d
  );
}

/* ================================================================
   RECTANGULAR PIPE
================================================================ */

function rectangularArea(
  widthM: number,
  heightM: number
): number {
  return (
    Math.max(
      MIN_DIMENSION_M,
      widthM
    ) *
    Math.max(
      MIN_DIMENSION_M,
      heightM
    )
  );
}

function rectangularWettedPerimeter(
  widthM: number,
  heightM: number
): number {
  return (
    2 *
    (
      Math.max(
        MIN_DIMENSION_M,
        widthM
      ) +
      Math.max(
        MIN_DIMENSION_M,
        heightM
      )
    )
  );
}

/* ================================================================
   PIPE CROSS SECTION
================================================================ */

export function getPipeGeometry(
  pipe: DrainagePipe
): {
  areaM2: number;

  wettedPerimeterM: number;
} {
  switch (
    pipe.shape
  ) {
    case "circular":
      return {
        areaM2:
          circularArea(
            pipe.diameterM
          ),

        wettedPerimeterM:
          circularWettedPerimeter(
            pipe.diameterM
          ),
      };

    case "rectangular":
    case "trapezoidal":
    case "open_channel":
    default:
      return {
        areaM2:
          rectangularArea(
            pipe.widthM,
            pipe.heightM
          ),

        wettedPerimeterM:
          rectangularWettedPerimeter(
            pipe.widthM,
            pipe.heightM
          ),
      };
  }
}

/* ================================================================
   HYDRAULIC RADIUS
================================================================ */

export function getHydraulicRadius(
  pipe: DrainagePipe
): number {
  const geometry =
    getPipeGeometry(
      pipe
    );

  if (
    geometry.wettedPerimeterM <= 0
  ) {
    return 0;
  }

  return (
    geometry.areaM2 /
    geometry.wettedPerimeterM
  );
}

/* ================================================================
   THEORETICAL CAPACITY
================================================================ */

export function calculatePipeCapacity(
  pipe: DrainagePipe
): number {
  const geometry =
    getPipeGeometry(
      pipe
    );

  const area =
    geometry.areaM2;

  const radius =
    getHydraulicRadius(
      pipe
    );

  const slope =
    Math.max(
      MIN_SLOPE,
      positive(
        pipe.slope
      )
    );

  const manningN =
    Math.max(
      0.001,
      positive(
        pipe.manningN ||
          DEFAULT_MANNING_N
      )
    );

  /*
   * Manning formula.
   */
  const theoreticalFlow =
    (
      1 /
      manningN
    ) *
    area *
    Math.pow(
      radius,
      2 / 3
    ) *
    Math.sqrt(
      slope
    );

  /*
   * Blockage reduces available capacity.
   *
   * 0% blockage:
   * 100% capacity
   *
   * 50% blockage:
   * 50% effective capacity
   */
  const blockage =
    clamp(
      pipe.blockageFraction,
      0,
      1
    );

  const effectiveFlow =
    theoreticalFlow *
    (
      1 -
      blockage
    );

  return Math.max(
    MIN_CAPACITY_M3S,
    effectiveFlow
  );
}

/* ================================================================
   NODE CREATION
================================================================ */

export function createDrainageNode(
  input: Omit<
    DrainageNode,
    | "storageM3"
    | "surchargeVolumeM3"
    | "surcharged"
  >
): DrainageNode {
  return {
    ...input,

    storageM3: 0,

    surchargeVolumeM3: 0,

    surcharged: false,
  };
}

/* ================================================================
   PIPE CREATION
================================================================ */

export function createDrainagePipe(
  input: Omit<
    DrainagePipe,
    | "flowM3s"
    | "capacityM3s"
    | "overloaded"
    | "overflowM3"
  >
): DrainagePipe {
  const pipe: DrainagePipe = {
    ...input,

    diameterM:
      Math.max(
        MIN_DIMENSION_M,
        positive(
          input.diameterM
        )
      ),

    widthM:
      Math.max(
        MIN_DIMENSION_M,
        positive(
          input.widthM
        )
      ),

    heightM:
      Math.max(
        MIN_DIMENSION_M,
        positive(
          input.heightM
        )
      ),

    lengthM:
      Math.max(
        0.1,
        positive(
          input.lengthM
        )
      ),

    slope:
      Math.max(
        MIN_SLOPE,
        positive(
          input.slope
        )
      ),

    manningN:
      Math.max(
        0.001,
        positive(
          input.manningN ||
            DEFAULT_MANNING_N
        )
      ),

    blockageFraction:
      clamp(
        input.blockageFraction,
        0,
        1
      ),

    flowM3s: 0,

    capacityM3s: 0,

    overloaded: false,

    overflowM3: 0,
  };

  pipe.capacityM3s =
    calculatePipeCapacity(
      pipe
    );

  return pipe;
}

/* ================================================================
   GRAPH CREATION
================================================================ */

export function createDrainageGraph(
  nodes: DrainageNode[],
  pipes: DrainagePipe[]
): DrainageGraph {
  const nodeById =
    new Map<
      string,
      DrainageNode
    >();

  const pipeById =
    new Map<
      string,
      DrainagePipe
    >();

  for (
    const node of nodes
  ) {
    nodeById.set(
      node.id,
      node
    );
  }

  for (
    const pipe of pipes
  ) {
    /*
     * Only include valid network edges.
     */
    if (
      !nodeById.has(
        pipe.fromNode
      ) ||
      !nodeById.has(
        pipe.toNode
      )
    ) {
      continue;
    }

    pipe.capacityM3s =
      calculatePipeCapacity(
        pipe
      );

    pipeById.set(
      pipe.id,
      pipe
    );
  }

  return {
    nodes,

    pipes: Array.from(
      pipeById.values()
    ),

    nodeById,

    pipeById,
  };
}

/* ================================================================
   NODE RESET
================================================================ */

export function resetDrainageGraph(
  graph: DrainageGraph
): void {
  for (
    const node of
      graph.nodes
  ) {
    node.storageM3 = 0;

    node.surchargeVolumeM3 = 0;

    node.surcharged =
      false;
  }

  for (
    const pipe of
      graph.pipes
  ) {
    pipe.flowM3s = 0;

    pipe.capacityM3s =
      calculatePipeCapacity(
        pipe
      );

    pipe.overloaded =
      false;

    pipe.overflowM3 = 0;
  }
}

/* ================================================================
   OUTGOING PIPES
================================================================ */

export function getOutgoingPipes(
  graph: DrainageGraph,
  nodeId: string
): DrainagePipe[] {
  return graph.pipes.filter(
    (pipe) =>
      pipe.fromNode ===
      nodeId
  );
}

/* ================================================================
   INCOMING PIPES
================================================================ */

export function getIncomingPipes(
  graph: DrainageGraph,
  nodeId: string
): DrainagePipe[] {
  return graph.pipes.filter(
    (pipe) =>
      pipe.toNode ===
      nodeId
  );
}

/* ================================================================
   CAPACITY UTILIZATION
================================================================ */

export function getPipeUtilization(
  pipe: DrainagePipe
): number {
  if (
    pipe.capacityM3s <=
    0
  ) {
    return Infinity;
  }

  return (
    pipe.flowM3s /
    pipe.capacityM3s
  );
}

/* ================================================================
   NODE UTILIZATION
================================================================ */

export function getNodeUtilization(
  node: DrainageNode
): number {
  if (
    node.storageCapacityM3 <=
    0
  ) {
    return node.storageM3 >
      0
      ? Infinity
      : 0;
  }

  return (
    node.storageM3 /
    node.storageCapacityM3
  );
}

/* ================================================================
   ROUTING: NODE INFLOW
================================================================ */

/*
 * Add surface runoff to an inlet/manhole.
 *
 * Water above inlet capacity is immediately considered
 * potential surface surcharge.
 */
export function addSurfaceRunoff(
  node: DrainageNode,
  runoffVolumeM3: number,
  timestepSeconds: number
): {
  capturedM3: number;

  surchargeM3: number;
} {
  const runoff =
    Math.max(
      0,
      runoffVolumeM3
    );

  if (
    runoff <= 0
  ) {
    return {
      capturedM3: 0,
      surchargeM3: 0,
    };
  }

  const inletCapacityVolume =
    Math.max(
      0,
      node.inletCapacityM3s
    ) *
    Math.max(
      0,
      timestepSeconds
    );

  const availableStorage =
    Math.max(
      0,
      node.storageCapacityM3 -
        node.storageM3
    );

  /*
   * Water captured by the inlet can first enter the node.
   */
  const capturable =
    Math.min(
      runoff,
      inletCapacityVolume
    );

  /*
   * Then only the available node storage can hold it.
   */
  const stored =
    Math.min(
      capturable,
      availableStorage
    );

  const storageOverflow =
    Math.max(
      0,
      capturable -
        stored
    );

  const inletOverflow =
    Math.max(
      0,
      runoff -
        capturable
    );

  node.storageM3 +=
    stored;

  const surchargeM3 =
    inletOverflow +
    storageOverflow;

  if (
    surchargeM3 >
    0
  ) {
    node.surcharged =
      true;

    node.surchargeVolumeM3 +=
      surchargeM3;
  }

  return {
    capturedM3:
      stored,

    surchargeM3,
  };
}

/* ================================================================
   PIPE ROUTING
================================================================ */

/*
 * Route water from a node through each downstream pipe.
 *
 * The network is currently treated as a directed graph.
 *
 * If demand exceeds capacity:
 *
 * capacity -> downstream
 * excess   -> surcharge
 */
export function routeNodeOutflow(
  graph: DrainageGraph,
  nodeId: string,
  timestepSeconds: number
): {
  routedM3: number;

  overflowM3: number;
} {
  const node =
    graph.nodeById.get(
      nodeId
    );

  if (!node) {
    return {
      routedM3: 0,
      overflowM3: 0,
    };
  }

  const outgoing =
    getOutgoingPipes(
      graph,
      nodeId
    );

  if (
    outgoing.length ===
    0
  ) {
    /*
     * Outfall nodes represent discharge out of the model.
     *
     * Storage nodes without outgoing pipes surcharge.
     */
    if (
      node.type ===
      "outfall"
    ) {
      const discharged =
        node.storageM3;

      node.storageM3 = 0;

      return {
        routedM3:
          discharged,

        overflowM3: 0,
      };
    }

    const overflow =
      node.storageM3;

    node.storageM3 = 0;

    if (
      overflow >
      0
    ) {
      node.surcharged =
        true;

      node.surchargeVolumeM3 +=
        overflow;
    }

    return {
      routedM3: 0,

      overflowM3:
        overflow,
    };
  }

  const available =
    node.storageM3;

  if (
    available <=
    0
  ) {
    return {
      routedM3: 0,

      overflowM3: 0,
    };
  }

  /*
   * Distribute flow demand between downstream pipes.
   *
   * For this first hydraulic approximation we use capacity-weighted
   * splitting.
   */
  const totalCapacity =
    outgoing.reduce(
      (
        total,
        pipe
      ) =>
        total +
        pipe.capacityM3s,
      0
    );

  if (
    totalCapacity <=
    0
  ) {
    node.surchargeVolumeM3 +=
      available;

    node.surcharged =
      true;

    node.storageM3 = 0;

    return {
      routedM3: 0,

      overflowM3:
        available,
    };
  }

  let remaining =
    available;

  let routed =
    0;

  for (
    const pipe of
      outgoing
  ) {
    if (
      remaining <=
      0
    ) {
      break;
    }

    const share =
      pipe.capacityM3s /
      totalCapacity;

    const demand =
      available *
      share;

    const timestepCapacity =
      pipe.capacityM3s *
      timestepSeconds;

    const moved =
      Math.min(
        demand,
        timestepCapacity,
        remaining
      );

    /*
     * Convert volume over the timestep into average flow.
     */
    pipe.flowM3s =
      timestepSeconds >
      0
        ? moved /
          timestepSeconds
        : 0;

    if (
      pipe.flowM3s >
      pipe.capacityM3s
    ) {
      pipe.overloaded =
        true;
    }

    pipe.overflowM3 =
      Math.max(
        0,
        demand -
          moved
      );

    const downstream =
      graph.nodeById.get(
        pipe.toNode
      );

    if (
      downstream
    ) {
      downstream.storageM3 +=
        moved;
    }

    routed +=
      moved;

    remaining -=
      moved;
  }

  /*
   * Anything that couldn't enter the pipe network
   * returns to the surface.
   */
  if (
    remaining >
    0
  ) {
    node.surcharged =
      true;

    node.surchargeVolumeM3 +=
      remaining;
  }

  node.storageM3 =
    0;

  return {
    routedM3:
      routed,

    overflowM3:
      Math.max(
        0,
        remaining
      ),
  };
}

/* ================================================================
   FULL NETWORK STEP
================================================================ */

/*
 * Run one hydraulic timestep through the drainage graph.
 *
 * This is intentionally a compact network-routing model.
 * A future version can replace individual components with
 * a full dynamic-wave / Saint-Venant solver without changing
 * the graph interface.
 */
export function simulateDrainageStep(
  graph: DrainageGraph,
  runoffByNodeM3: Map<
    string,
    number
  >,
  timestepSeconds: number
): {
  capturedM3: number;

  routedM3: number;

  surfaceOverflowM3: number;
} {
  resetTransientPipeState(
    graph
  );

  let capturedM3 =
    0;

  let surfaceOverflowM3 =
    0;

  /*
   * 1. Inject surface runoff into nodes.
   */
  for (
    const node of
      graph.nodes
  ) {
    const runoff =
      runoffByNodeM3.get(
        node.id
      ) ?? 0;

    if (
      runoff <=
      0
    ) {
      continue;
    }

    const result =
      addSurfaceRunoff(
        node,
        runoff,
        timestepSeconds
      );

    capturedM3 +=
      result.capturedM3;

    surfaceOverflowM3 +=
      result.surchargeM3;
  }

  /*
   * 2. Route the network repeatedly from upstream nodes.
   *
   * A simple topological ordering is useful when possible.
   */
  const order =
    getTopologicalNodeOrder(
      graph
    );

  let routedM3 =
    0;

  for (
    const nodeId of
      order
  ) {
    const result =
      routeNodeOutflow(
        graph,
        nodeId,
        timestepSeconds
      );

    routedM3 +=
      result.routedM3;

    surfaceOverflowM3 +=
      result.overflowM3;
  }

  return {
    capturedM3,

    routedM3,

    surfaceOverflowM3,
  };
}

/* ================================================================
   RESET TRANSIENT PIPE STATE
================================================================ */

function resetTransientPipeState(
  graph: DrainageGraph
): void {
  for (
    const pipe of
      graph.pipes
  ) {
    pipe.flowM3s = 0;

    pipe.overloaded =
      false;

    pipe.overflowM3 = 0;
  }
}

/* ================================================================
   TOPOLOGICAL ORDER
================================================================ */

/*
 * Kahn's algorithm for a directed acyclic graph.
 *
 * Real drainage networks may contain cycles.
 * If a cycle exists, the remaining nodes are appended afterwards.
 */
export function getTopologicalNodeOrder(
  graph: DrainageGraph
): string[] {
  const indegree =
    new Map<
      string,
      number
    >();

  for (
    const node of
      graph.nodes
  ) {
    indegree.set(
      node.id,
      0
    );
  }

  for (
    const pipe of
      graph.pipes
  ) {
    indegree.set(
      pipe.toNode,
      (
        indegree.get(
          pipe.toNode
        ) ?? 0
      ) + 1
    );
  }

  const queue:
    string[] = [];

  for (
    const [
      nodeId,
      degree,
    ] of indegree
  ) {
    if (
      degree ===
      0
    ) {
      queue.push(
        nodeId
      );
    }
  }

  const order:
    string[] = [];

  while (
    queue.length >
    0
  ) {
    const nodeId =
      queue.shift();

    if (
      !nodeId
    ) {
      continue;
    }

    order.push(
      nodeId
    );

    for (
      const pipe of
        getOutgoingPipes(
          graph,
          nodeId
        )
    ) {
      const nextDegree =
        (
          indegree.get(
            pipe.toNode
          ) ?? 1
        ) - 1;

      indegree.set(
        pipe.toNode,
        nextDegree
      );

      if (
        nextDegree ===
        0
      ) {
        queue.push(
          pipe.toNode
        );
      }
    }
  }

  /*
   * If a cycle exists, include remaining nodes.
   */
  for (
    const node of
      graph.nodes
  ) {
    if (
      !order.includes(
        node.id
      )
    ) {
      order.push(
        node.id
      );
    }
  }

  return order;
}

/* ================================================================
   OVERLOAD SUMMARY
================================================================ */

export function getDrainageRiskSummary(
  graph: DrainageGraph
) {
  const overloadedNodes =
    graph.nodes.filter(
      (node) =>
        node.surcharged
    );

  const overloadedPipes =
    graph.pipes.filter(
      (pipe) =>
        pipe.overloaded ||
        pipe.flowM3s >
          pipe.capacityM3s
    );

  let totalSurchargeM3 =
    0;

  for (
    const node of
      overloadedNodes
  ) {
    totalSurchargeM3 +=
      node.surchargeVolumeM3;
  }

  let totalPipeOverflowM3 =
    0;

  for (
    const pipe of
      overloadedPipes
  ) {
    totalPipeOverflowM3 +=
      pipe.overflowM3;
  }

  return {
    overloadedNodeCount:
      overloadedNodes.length,

    overloadedPipeCount:
      overloadedPipes.length,

    overloadedNodeIds:
      overloadedNodes.map(
        (node) =>
          node.id
      ),

    overloadedPipeIds:
      overloadedPipes.map(
        (pipe) =>
          pipe.id
      ),

    totalSurchargeM3,

    totalPipeOverflowM3,
  };
}

/* ================================================================
   BUILD GRAPH FROM SIMPLE DATA
================================================================ */

/*
 * Convenience function for loading a graph from API/GeoJSON data.
 */
export function buildDrainageGraph(
  nodes: Array<
    Omit<
      DrainageNode,
      | "storageM3"
      | "surchargeVolumeM3"
      | "surcharged"
    >
  >,
  pipes: Array<
    Omit<
      DrainagePipe,
      | "flowM3s"
      | "capacityM3s"
      | "overloaded"
      | "overflowM3"
    >
  >
): DrainageGraph {
  const preparedNodes =
    nodes.map(
      (
        node
      ) =>
        createDrainageNode(
          node
        )
    );

  const preparedPipes =
    pipes.map(
      (
        pipe
      ) =>
        createDrainagePipe(
          pipe
        )
    );

  return createDrainageGraph(
    preparedNodes,
    preparedPipes
  );
}

/* ================================================================
   EXAMPLE NETWORK GENERATOR
================================================================ */

/*
 * This is NOT a Chennai drainage dataset.
 *
 * It exists only so that the hydraulic engine can be tested
 * while the real municipal drainage network is being ingested.

 * The final SIH implementation should replace it with actual
 * GIS/drainage-network data.
 */
export function createExampleDrainageGraph(): DrainageGraph {
  const nodes = [
    {
      id: "N1",

      type: "inlet" as const,

      longitude: 80.215,

      latitude: 12.975,

      groundElevationM: 4.2,

      invertElevationM: 3.5,

      inletCapacityM3s: 0.15,

      storageCapacityM3: 5,
    },

    {
      id: "N2",

      type: "manhole" as const,

      longitude: 80.218,

      latitude: 12.976,

      groundElevationM: 3.9,

      invertElevationM: 3.1,

      inletCapacityM3s: 0.20,

      storageCapacityM3: 8,
    },

    {
      id: "N3",

      type: "manhole" as const,

      longitude: 80.221,

      latitude: 12.978,

      groundElevationM: 3.5,

      invertElevationM: 2.8,

      inletCapacityM3s: 0.22,

      storageCapacityM3: 10,
    },

    {
      id: "N4",

      type: "outfall" as const,

      longitude: 80.225,

      latitude: 12.980,

      groundElevationM: 2.8,

      invertElevationM: 2.2,

      inletCapacityM3s: 1.0,

      storageCapacityM3: 20,
    },
  ];

  const pipes = [
    {
      id: "P1",

      fromNode: "N1",

      toNode: "N2",

      shape: "circular" as const,

      diameterM: 0.60,

      widthM: 0.60,

      heightM: 0.60,

      lengthM: 130,

      slope: 0.003,

      manningN:
        DEFAULT_MANNING_N,

      blockageFraction: 0.05,
    },

    {
      id: "P2",

      fromNode: "N2",

      toNode: "N3",

      shape: "circular" as const,

      diameterM: 0.75,

      widthM: 0.75,

      heightM: 0.75,

      lengthM: 180,

      slope: 0.004,

      manningN:
        DEFAULT_MANNING_N,

      blockageFraction: 0.10,
    },

    {
      id: "P3",

      fromNode: "N3",

      toNode: "N4",

      shape: "circular" as const,

      diameterM: 1.0,

      widthM: 1.0,

      heightM: 1.0,

      lengthM: 250,

      slope: 0.005,

      manningN:
        DEFAULT_MANNING_N,

      blockageFraction: 0.0,
    },
  ];

  return buildDrainageGraph(
    nodes,
    pipes
  );
}

/* ================================================================
   SINGLE PIPE CAPACITY
================================================================ */

export function getPipeCapacity(
  graph: DrainageGraph,
  pipeId: string
): number {
  const pipe =
    graph.pipeById.get(
      pipeId
    );

  if (!pipe) {
    return 0;
  }

  return pipe.capacityM3s;
}

/* ================================================================
   SINGLE NODE STATUS
================================================================ */

export function getNodeStatus(
  node: DrainageNode
): "normal" | "warning" | "surcharged" {
  if (
    node.surcharged
  ) {
    return "surcharged";
  }

  const utilization =
    getNodeUtilization(
      node
    );

  if (
    utilization >=
    0.8
  ) {
    return "warning";
  }

  return "normal";
}

/* ================================================================
   PIPE STATUS
================================================================ */

export function getPipeStatus(
  pipe: DrainagePipe
): "normal" | "warning" | "overloaded" {
  const utilization =
    getPipeUtilization(
      pipe
    );

  if (
    utilization >=
      1 ||
    pipe.overloaded
  ) {
    return "overloaded";
  }

  if (
    utilization >=
    0.8
  ) {
    return "warning";
  }

  return "normal";
}