/*************************************************************************
 * MEASUREMENTS Controller
 *
 * In a series like 1Q84@HI.A, "1Q84" is the measurement. It specifies
 * the concept being measured. A measurement likely includes multiple
 * series, for example:
 *
 * - 1Q84@HI.A, 1Q84@HI.Q, 1Q84@HI.M — annual, quarterly, monthly
 * - 1Q84@MAU.A, 1Q84@KAU.A, 1Q84@HI.A — Maui, Kauai, State
 *************************************************************************/

export async function getMeasurements() {
  // TODO: implement list
  return { data: [] };
}

export async function getMeasurement({ id }: { id: number }) {
  // TODO: implement get by id
  return { data: null, id };
}
