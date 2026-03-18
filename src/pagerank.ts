export interface GraphEdge {
  from: string;
  to: string;
  name: string;
}

export function pagerank(
  nodes: Set<string>,
  edges: GraphEdge[],
  personalization?: Map<string, number>,
  alpha = 0.85,
  maxIter = 100,
  tol = 1e-6,
): Map<string, number> {
  const nodeList = Array.from(nodes);
  const n = nodeList.length;
  if (n === 0) return new Map();

  const nodeIndex = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    nodeIndex.set(nodeList[i], i);
  }

  const outDegree = new Float64Array(n);
  const adjList: number[][] = Array.from({ length: n }, () => []);

  for (const edge of edges) {
    const fromIdx = nodeIndex.get(edge.from);
    const toIdx = nodeIndex.get(edge.to);
    if (fromIdx === undefined || toIdx === undefined) continue;
    adjList[fromIdx].push(toIdx);
    outDegree[fromIdx]++;
  }

  let ranks = new Float64Array(n).fill(1 / n);

  const personVec = new Float64Array(n);
  if (personalization && personalization.size > 0) {
    let total = 0;
    for (const [node, val] of personalization) {
      const idx = nodeIndex.get(node);
      if (idx !== undefined) {
        personVec[idx] = val;
        total += val;
      }
    }
    if (total > 0) {
      for (let i = 0; i < n; i++) personVec[i] /= total;
    } else {
      personVec.fill(1 / n);
    }
  } else {
    personVec.fill(1 / n);
  }

  for (let iter = 0; iter < maxIter; iter++) {
    const newRanks = new Float64Array(n);

    let danglingSum = 0;
    for (let i = 0; i < n; i++) {
      if (outDegree[i] === 0) danglingSum += ranks[i];
    }

    for (let i = 0; i < n; i++) {
      newRanks[i] = alpha * (danglingSum * personVec[i]);
      newRanks[i] += (1 - alpha) * personVec[i];
    }

    for (let i = 0; i < n; i++) {
      if (outDegree[i] === 0) continue;
      const contribution = alpha * ranks[i] / outDegree[i];
      for (const j of adjList[i]) {
        newRanks[j] += contribution;
      }
    }

    let diff = 0;
    for (let i = 0; i < n; i++) {
      diff += Math.abs(newRanks[i] - ranks[i]);
    }

    ranks = newRanks;
    if (diff < tol) break;
  }

  const result = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    result.set(nodeList[i], ranks[i]);
  }
  return result;
}
