// Mock Standard Operating Procedures
// tags match overlay types or 'general' (always shown)

export const SOPS = [
  {
    id: 'SOP-IPM-001',
    title: 'IPM Spray Application',
    version: '3.2',
    tags: ['ipm'],
    steps: [
      'Review pest ID log — confirm target species before selecting product.',
      'Select registered pesticide from approved product list. Confirm with master grower.',
      'Don full PPE: disposable coverall, N95/P100 respirator, nitrile gloves, safety glasses.',
      'Mix to label rate — confirm ratio and batch IDs before filling sprayer.',
      'Post RE-ENTRY PROHIBITED signage on all room entry points.',
      'Apply foliar spray ensuring uniform full-canopy coverage.',
      'Record batch IDs, product name, ratio, and quantity on F-005 form.',
      'Remove PPE safely on exit — bag and seal disposable items.',
      'Log spray event in Mission Control and set re-entry countdown.',
    ],
  },
  {
    id: 'SOP-IPM-002',
    title: 'Re-Entry During Restricted Period',
    version: '1.1',
    tags: ['ipm'],
    steps: [
      'Confirm re-entry countdown has NOT expired before entering.',
      'If entry is operationally required, obtain written authorization from master grower.',
      'Don full PPE: coverall, P100 respirator, nitrile gloves, safety glasses, face shield.',
      'Limit time in room to minimum required — do not linger.',
      'Remove and dispose of all PPE in sealed bag immediately on exit.',
      'Log early re-entry event in Mission Control with authorization note.',
    ],
  },
  {
    id: 'SOP-NET-001',
    title: 'Net Lowering Procedure',
    version: '2.1',
    tags: ['net'],
    steps: [
      'Confirm room is in CROP mode — do not lower net in FILL or OFF mode.',
      'Identify net tier: 1st net or 2nd net.',
      'Two-person operation required — one person per side of the canopy.',
      'Lower net evenly across all trellis anchors in a single coordinated motion.',
      'Secure all zip ties along the full perimeter — minimum one tie per 30 cm.',
      'Verify plant canopy remains at least 5 cm below the net after securing.',
      'Check all ties are snug — no loose ends that could entangle fans.',
      'Log net number and confirm all zip ties in Mission Control.',
    ],
  },
  {
    id: 'SOP-DEFOL-001',
    title: 'Defoliation Protocol',
    version: '1.5',
    tags: ['defoliation'],
    steps: [
      'Confirm defoliation stage and scope with master grower before beginning.',
      'Don nitrile gloves — change gloves between rooms to prevent cross-contamination.',
      'Remove fan leaves blocking primary bud sites — maximum 20% canopy removal per session.',
      'Work systematically table by table from one end of the room to the other.',
      'Log each completed table in Mission Control as you go.',
      'Bag and remove all cuttings from the room before leaving — do not leave on floor.',
      'Sanitize shears with 70% isopropyl between tables and on room exit.',
    ],
  },
  {
    id: 'SOP-XFER-001',
    title: 'Room Transfer Procedure',
    version: '1.0',
    tags: ['transfer'],
    steps: [
      'Confirm destination room is clean, sanitized, and in FILL mode.',
      'Verify tray layout and spacing plan is approved by master grower.',
      'Stage carts in the corridor — do not block room entry during transfer.',
      'Transfer plants row by row — maintain consistent spacing per layout plan.',
      'Record origin room, destination room, plant count, and operator in Mission Control.',
      'Remove transfer overlay from origin room on completion.',
      'Switch destination room to CROP mode only after all plants are placed.',
    ],
  },
  {
    id: 'SOP-HARVEST-001',
    title: 'Harvest Ready — Pre-Harvest Checklist',
    version: '2.0',
    tags: ['harvest_ready'],
    steps: [
      'Confirm harvest authorization from master grower or director.',
      'Verify dry room availability and target environment (temp 18°C, RH 55–60%).',
      'Prepare harvest carts, bins, and hangers — sanitize all equipment.',
      'Cut plants at base — remove any flagged or diseased material separately.',
      'Weigh and record wet weight per room before transferring to dry room.',
      'Remove all plant material from the room — clean and sanitize on completion.',
      'Log harvest event in Mission Control and update room mode to OFF.',
    ],
  },
  {
    id: 'SOP-POT-001',
    title: 'Pot Check Procedure',
    version: '2.0',
    tags: ['general'],
    steps: [
      'Inspect each pot and drainage tray for standing water.',
      'Remove standing water with pump or absorbent towel — record if found.',
      'Assess root health via drainage color, root visibility, and odor.',
      'Look for early signs of root disease: brown slime, foul smell, root discoloration.',
      'Record findings in Mission Control: healthy / concern / critical.',
      'For Concern or Critical findings — add notes and attach a photo.',
      'Escalate Critical findings to master grower immediately — do not wait.',
    ],
  },
  {
    id: 'SOP-FILTER-001',
    title: 'Carbon Filter Change',
    version: '1.8',
    tags: ['general'],
    steps: [
      'Confirm replacement filter is the correct size, type, and rating for this room.',
      'Power off the HVAC/exhaust unit at the breaker before touching the filter housing.',
      'Remove the exhausted filter — note its condition (normal / heavily loaded / damaged).',
      'Inspect the housing seal for cracks or debris before installing the new filter.',
      'Install new filter with correct airflow direction — confirm airtight seal.',
      'Restore HVAC power — confirm airflow returns to normal readings within 2 minutes.',
      'Log equipment number, filter type, size, and old condition in Mission Control.',
    ],
  },
  {
    id: 'SOP-MODE-001',
    title: 'Room Mode Change Authorization',
    version: '1.0',
    tags: ['mode_change'],
    steps: [
      'Confirm the requested mode change with the master grower or director before proceeding.',
      'Verify the room environment is stable — check temp, RH, and CO₂ are within range.',
      'Ensure all plants in the room are suitable for the destination mode (e.g., crop-ready for CROP, cleared for OFF).',
      'Update the room mode in Mission Control — do not change at the controller without logging.',
      'Post a mode change notice on the room entry door with the new mode and operator name.',
      'Monitor environment for the first 30 minutes post-change — log any deviations.',
    ],
  },
  {
    id: 'SOP-SUPPLY-001',
    title: 'Supply Ready — Intake Checklist',
    version: '1.0',
    tags: ['supply_ready'],
    steps: [
      'Verify delivery manifest matches the purchase order — flag discrepancies before signing.',
      'Inspect all incoming supplies for damage, expiry, or incorrect items.',
      'Move supplies to the staging area — do not place directly into the grow space without inspection.',
      'Log received items in Mission Control: product name, quantity, lot number, and expiry date.',
      'Store chemicals, nutrients, and media in designated locked storage with correct labeling.',
      'Notify the master grower that supplies are ready and logged before distribution.',
    ],
  },
  {
    id: 'SOP-ISSUE-001',
    title: 'Open Issue — Escalation and Documentation',
    version: '1.2',
    tags: ['issue'],
    steps: [
      'Stop any activity that may worsen the issue — secure the area if needed.',
      'Assess severity: Minor (cosmetic/non-urgent), Moderate (affects yield/quality), Critical (safety/regulatory).',
      'Log the issue in Mission Control immediately — attach a photo if possible.',
      'For Moderate or Critical issues: notify the master grower verbally within 15 minutes.',
      'Do not attempt repairs or remediation without authorization from master grower or director.',
      'Document all actions taken, personnel involved, and time of resolution in Mission Control.',
      'For Critical issues affecting food safety or compliance: escalate to the director immediately.',
    ],
  },
  {
    id: 'SOP-ENTRY-001',
    title: 'General Room Entry — Standard PPE',
    version: '1.3',
    tags: ['general'],
    steps: [
      'Check Mission Control for any active IPM or re-entry restrictions before entering.',
      'Don nitrile gloves and safety glasses — minimum standard for all rooms.',
      'Change into clean room boots or use boot covers at room entry.',
      'Do not bring food, drink, or personal items into the grow space.',
      'Report any unusual observations (pests, mold, equipment issues) immediately.',
      'Log your entry in Mission Control if performing a scheduled check.',
    ],
  },
]

// Returns SOPs relevant to the given set of active overlay types
export function getRelevantSops(activeSymbols = []) {
  return SOPS.filter(sop =>
    sop.tags.includes('general') || sop.tags.some(tag => activeSymbols.includes(tag))
  )
}

// Returns the primary SOP for a specific overlay type (first match)
export function getSopForOverlay(overlayType) {
  return SOPS.find(sop => sop.tags.includes(overlayType)) ?? null
}
