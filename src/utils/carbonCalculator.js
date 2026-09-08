// src/utils/carbonCalculator.js
// GHG Protocol-based emission calculations

export const EMISSION_FACTORS = {
  fuel: {
    PETROL:   { factor: 2.31,  unit: 'litres' },
    DIESEL:   { factor: 2.68,  unit: 'litres' },
    KEROSENE: { factor: 2.52,  unit: 'litres' },
    LNG:      { factor: 1.91,  unit: 'kg'     },
    CNG:      { factor: 2.18,  unit: 'kg'     },
    LPG:      { factor: 1.51,  unit: 'litres' },
    WOOD:     { factor: 1.82,  unit: 'kg'     },
    COAL:     { factor: 2.42,  unit: 'kg'     },
  },
  electricity: {
    kenya: 0.15, // TODO confirm against current Kenya Power / IEA grid factor
  },
  waste: {
    LANDFILL:    0.58,
    RECYCLED:    0.02,
    COMPOSTED:   0.01,
    INCINERATED: 0.02,
    HAZARDOUS:   0.82,
  },
  flight: { shortHaul: 0.15, longHaul: 0.12, threshold: 1500 },
};

const round2 = (n) => Math.round(n * 100) / 100;

export function calculateWasteEmissions(wasteKg, wasteType) {
  if (!wasteKg) return 0;
  return round2(wasteKg * (EMISSION_FACTORS.waste[wasteType] ?? 0.58));
}

export function calculateFlightEmissions(flightKm) {
  if (!flightKm) return 0;
  const ff = flightKm > EMISSION_FACTORS.flight.threshold
    ? EMISSION_FACTORS.flight.longHaul
    : EMISSION_FACTORS.flight.shortHaul;
  return round2(flightKm * ff);
}

export function calculateEmissions(entry) {
  let scope1 = 0;
  if (entry.fuelQuantity && entry.fuelType) {
    scope1 = entry.fuelQuantity * (EMISSION_FACTORS.fuel[entry.fuelType]?.factor ?? 2.68);
  }

  let scope2 = 0;
  if (entry.electricityKwh) {
    scope2 = entry.electricityKwh * EMISSION_FACTORS.electricity.kenya;
  }

  let scope3 = 0;
  if (entry.wasteKg && entry.wasteType) {
    scope3 += calculateWasteEmissions(entry.wasteKg, entry.wasteType);
  }
  if (entry.flightKm) {
    scope3 += calculateFlightEmissions(entry.flightKm);
  }

  return {
    scope1Emissions: round2(scope1),
    scope2Emissions: round2(scope2),
    scope3Emissions: round2(scope3),
    totalEmissions:  round2(scope1 + scope2 + scope3),
  };
}

export function calculateGreenScore(totalEmissions, numberOfEmployees = 1) {
  const per = totalEmissions / Math.max(numberOfEmployees, 1);
  if (per < 50)  return { score: 'A', description: 'Excellent — Environmental leader',        emissionsPerEmployee: round2(per) };
  if (per < 150) return { score: 'B', description: 'Good — On the right track',               emissionsPerEmployee: round2(per) };
  if (per < 300) return { score: 'C', description: 'Average — Room for improvement',           emissionsPerEmployee: round2(per) };
  return             { score: 'D', description: 'Poor — Significant improvement needed',  emissionsPerEmployee: round2(per) };
}

export function generateRecommendations(breakdown, greenScore) {
  const recs = [];
  if ((breakdown.electricity || 0) > 200)
    recs.push({ category: 'Electricity',    priority: 'high',   suggestion: 'Install solar panels or switch to a renewable energy provider.',           potentialReduction: '30-60%' });
  if ((breakdown.fuel || 0) > 300)
    recs.push({ category: 'Fuel',           priority: 'high',   suggestion: 'Switch to electric or hybrid vehicles for your company fleet.',            potentialReduction: '20-40%' });
  if ((breakdown.waste || 0) > 150)
    recs.push({ category: 'Waste',          priority: 'medium', suggestion: 'Implement a company-wide recycling and composting programme.',              potentialReduction: '20-30%' });
  if ((breakdown.flights || 0) > 100)
    recs.push({ category: 'Business Travel',priority: 'medium', suggestion: 'Replace short-haul flights with virtual meetings or rail travel.',          potentialReduction: '20-40%' });
  if (greenScore?.score === 'D')
    recs.push({ category: 'Overall',        priority: 'high',   suggestion: 'Consider a comprehensive environmental audit to identify major reductions.', potentialReduction: '30-50%' });
  const order = { high: 1, medium: 2, low: 3 };
  return recs.sort((a, b) => order[a.priority] - order[b.priority]);
}
