import "server-only";

import type { Connector } from "@/lib/ingestion/types";
import { companiesHouseConnector } from "@/lib/sources/companies-house/connector";
import {
  getPlanningConnector,
  listPlanningConnectors,
  PLANNING_CONNECTOR_PREFIX,
} from "@/lib/sources/planning/connector";
import { sell2walesConnector } from "@/lib/sources/sell2wales/connector";

/**
 * Registry of runnable connectors, keyed by connector key.
 *
 * Adding a source means implementing the Connector contract and registering it
 * here; the runner, admin screens and cron routes need no changes.
 */

// The connector generics differ per source, so the registry is typed loosely
// here and precisely at each implementation.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyConnector = Connector<any, any>;

const CONNECTORS: AnyConnector[] = [companiesHouseConnector, sell2walesConnector];

export function getConnector(key: string): AnyConnector | undefined {
  return CONNECTORS.find((connector) => connector.key === key);
}

/**
 * Resolves a connector by key, including the planning connectors.
 *
 * Planning is one connector per authority, built from that authority's stored
 * configuration, so those cannot live in a static array — there is one for
 * every authority that has been configured, and none for the rest.
 */
export async function resolveConnector(key: string): Promise<AnyConnector | undefined> {
  if (key.startsWith(PLANNING_CONNECTOR_PREFIX)) {
    return getPlanningConnector(key);
  }
  return getConnector(key);
}

/** Every runnable connector, static and per-authority. */
export async function listAllConnectors(): Promise<AnyConnector[]> {
  return [...CONNECTORS, ...(await listPlanningConnectors())];
}

export function listConnectors(): AnyConnector[] {
  return [...CONNECTORS];
}

/** Connectors belonging to a given DataSource key. */
export function getConnectorsForSource(dataSourceKey: string): AnyConnector[] {
  return CONNECTORS.filter((connector) => connector.dataSourceKey === dataSourceKey);
}
