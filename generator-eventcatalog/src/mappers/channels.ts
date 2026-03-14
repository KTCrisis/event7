/**
 * Channels mapper — creates EventCatalog channels from event7 channel model.
 * Links events to channels via bindings.
 */

import type { ExportChannel } from "../types";

export async function mapChannels(
  channels: ExportChannel[],
  utils: Record<string, Function>,
  debug: boolean,
): Promise<void> {
  const { writeChannel, addEventToChannel } = utils;

  for (const channel of channels) {
    // 1. Create channel
    await writeChannel({
      id: channel.address,
      name: channel.name,
      address: channel.address,
      protocols: [channel.broker_type],
      markdown:
        `Channel imported from event7.\n\n` +
        `| Key | Value |\n|-----|-------|\n` +
        `| Broker | ${channel.broker_type} |\n` +
        `| Resource | ${channel.resource_kind} |\n` +
        (channel.data_layer
          ? `| Data Layer | ${channel.data_layer.toUpperCase()} |\n`
          : ""),
    });

    if (debug) {
      console.log(
        `[event7] Channel: ${channel.name} (${channel.address}) — ${channel.bindings.length} bindings`,
      );
    }

    // 2. Link events to channel
    for (const binding of channel.bindings) {
      try {
        await addEventToChannel(channel.address, {
          id: binding.subject,
          version: "latest",
        });

        if (debug) {
          console.log(
            `[event7]   → ${binding.subject} (${binding.schema_role})`,
          );
        }
      } catch (e) {
        if (debug) {
          console.warn(
            `[event7]   ⚠ Could not link ${binding.subject} to ${channel.address}:`,
            e,
          );
        }
      }
    }
  }
}