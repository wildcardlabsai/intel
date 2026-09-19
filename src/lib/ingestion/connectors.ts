import "server-only";

import type { Connector } from "@/lib/ingestion/types";
import { companiesHouseConnector } from "@/lib/sources/companies-house/connector";
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

export function listConnectors(): AnyConnector[] {
  return [...CONNECTORS];
}

/** Connectors belonging to a given DataSource key. */
export function getConnectorsForSource(dataSourceKey: string): AnyConnector[] {
  return CONNECTORS.filter((connector) => connector.dataSourceKey === dataSourceKey);
}
