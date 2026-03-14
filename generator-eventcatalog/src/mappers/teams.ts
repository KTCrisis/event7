/**
 * Teams mapper — creates EventCatalog teams from event7 owner_team values.
 */

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function mapTeams(
  teams: string[],
  utils: Record<string, Function>,
  debug: boolean,
): Promise<void> {
  const { writeTeam } = utils;

  for (const team of teams) {
    const id = slugify(team);

    await writeTeam({
      id,
      name: team,
      markdown: `Team imported from event7.`,
    });

    if (debug) {
      console.log(`[event7] Team: ${team} → ${id}`);
    }
  }
}