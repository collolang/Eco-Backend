// src/controllers/emissionsController.js
import prisma from '../config/database.js';
import { calculateEmissions, calculateGreenScore, generateRecommendations } from '../utils/carbonCalculator.js';

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// Helper: ensure entry belongs to user's company
async function verifyOwnership(entryId, userId) {
  return prisma.emissionEntry.findFirst({
    where: { id: entryId, userId },
    include: { company: true },
  });
}

//  List all entries for a company 
export const getAllEntries = async (req, res, next) => {
  try {
    const { companyId } = req.params;
    const { month, year } = req.query;

    // Security: verify the company belongs to the user
    const company = await prisma.company.findFirst({ 
      where: { id: companyId, userId: req.user.id, isActive: true },
      select: { numberOfEmployees: true }
    });
    if (!company) return res.status(403).json({ success: false, message: 'Access denied' });

    const where = { companyId, userId: req.user.id };
    if (month) where.month = parseInt(month);
    if (year)  where.year  = parseInt(year);

    const entries = await prisma.emissionEntry.findMany({
      where, orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });

    const entriesWithScore = entries.map(entry => ({
      ...entry,
      score: calculateGreenScore(entry.totalEmissions, company.numberOfEmployees).score
    }));

    res.json({ success: true, data: entriesWithScore });
  } catch (error) { next(error); }
};

// Get single entry 
export const getEntryById = async (req, res, next) => {
  try {
    const entry = await verifyOwnership(req.params.id, req.user.id);
    if (!entry) return res.status(404).json({ success: false, message: 'Entry not found' });
    res.json({ success: true, data: entry });
  } catch (error) { next(error); }
};

// Create entry
export const createEntry = async (req, res, next) => {
  try {
    const { companyId } = req.params;
    const { month, year, electricityKwh, fuelType, fuelQuantity, wasteKg, wasteType, flightKm, notes } = req.body;

    const company = await prisma.company.findFirst({ where: { id: companyId, userId: req.user.id, isActive: true } });
    if (!company) return res.status(403).json({ success: false, message: 'Access denied' });

    const calculated = calculateEmissions(
      { electricityKwh, fuelType, fuelQuantity, wasteKg, wasteType, flightKm },
      company.country
    );

    const entry = await prisma.emissionEntry.create({
      data: {
        userId:        req.user.id,
        companyId,
        month:         parseInt(month),
        year:          parseInt(year),
        electricityKwh:electricityKwh ? parseFloat(electricityKwh) : null,
        fuelType:      fuelType || null,
        fuelQuantity:  fuelQuantity ? parseFloat(fuelQuantity) : null,
        wasteKg:       wasteKg ? parseFloat(wasteKg) : null,
        wasteType:     wasteType || 'LANDFILL',
        flightKm:      flightKm ? parseFloat(flightKm) : null,
        notes,
        ...calculated,
      },
    });

    res.status(201).json({ success: true, message: 'Emission entry created', data: entry });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'An entry already exists for this month/year for this company. Use PUT to update.' });
    }
    next(error);
  }
};

// Update entry 
export const updateEntry = async (req, res, next) => {
  try {
    const existing = await verifyOwnership(req.params.id, req.user.id);
    if (!existing) return res.status(404).json({ success: false, message: 'Entry not found' });

    const { electricityKwh, fuelType, fuelQuantity, wasteKg, wasteType, flightKm, notes } = req.body;

    const merged = {
      electricityKwh: electricityKwh ?? existing.electricityKwh,
      fuelType:       fuelType       ?? existing.fuelType,
      fuelQuantity:   fuelQuantity   ?? existing.fuelQuantity,
      wasteKg:        wasteKg        ?? existing.wasteKg,
      wasteType:      wasteType      ?? existing.wasteType,
      flightKm:       flightKm       ?? existing.flightKm,
    };

    const calculated = calculateEmissions(merged, existing.company.country);

    const entry = await prisma.emissionEntry.update({
      where: { id: req.params.id },
      data: {
        electricityKwh: merged.electricityKwh ? parseFloat(merged.electricityKwh) : null,
        fuelType:       merged.fuelType || null,
        fuelQuantity:   merged.fuelQuantity ? parseFloat(merged.fuelQuantity) : null,
        wasteKg:        merged.wasteKg ? parseFloat(merged.wasteKg) : null,
        wasteType:      merged.wasteType || 'LANDFILL',
        flightKm:       merged.flightKm ? parseFloat(merged.flightKm) : null,
        notes:          notes ?? existing.notes,
        ...calculated,
      },
    });

    res.json({ success: true, message: 'Entry updated', data: entry });
  } catch (error) { next(error); }
};

//  Delete entry 
export const deleteEntry = async (req, res, next) => {
  try {
    const entry = await verifyOwnership(req.params.id, req.user.id);
    if (!entry) return res.status(404).json({ success: false, message: 'Entry not found' });
    await prisma.emissionEntry.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Entry deleted' });
  } catch (error) { next(error); }
};

// Monthly chart data (per company) 
export const getMonthlyData = async (req, res, next) => {
  try {
    const { companyId } = req.params;
    const company = await prisma.company.findFirst({ where: { id: companyId, userId: req.user.id, isActive: true } });
    if (!company) return res.status(403).json({ success: false, message: 'Access denied' });

    const year = parseInt(req.query.year) || new Date().getFullYear();
    const entries = await prisma.emissionEntry.findMany({
      where: { companyId, userId: req.user.id, year },
      orderBy: { month: 'asc' },
      select: { month: true, totalEmissions: true, scope1Emissions: true, scope2Emissions: true, scope3Emissions: true },
    });

    const monthly = Array.from({ length: 12 }, (_, i) => {
      const found = entries.find((e) => e.month === i + 1);
      return {
        month:     MONTH_NAMES[i],
        emissions: found?.totalEmissions  || 0,
        scope1:    found?.scope1Emissions || 0,
        scope2:    found?.scope2Emissions || 0,
        scope3:    found?.scope3Emissions || 0,
        target:    500,
      };
    });

    res.json({ success: true, data: monthly });
  } catch (error) { next(error); }
};

// Breakdown data (per company, per month) 
export const getBreakdownData = async (req, res, next) => {
  try {
    const { companyId } = req.params;
    const company = await prisma.company.findFirst({ where: { id: companyId, userId: req.user.id, isActive: true } });
    if (!company) return res.status(403).json({ success: false, message: 'Access denied' });

    const year  = parseInt(req.query.year)  || new Date().getFullYear();
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;

    const entry = await prisma.emissionEntry.findFirst({ where: { companyId, userId: req.user.id, year, month } });

    if (!entry) {
      return res.json({ success: true, data: [
        { name: 'Electricity', value: 0, percentage: 0, color: '#10b981' },
        { name: 'Fuel',        value: 0, percentage: 0, color: '#3b82f6' },
        { name: 'Waste & Travel', value: 0, percentage: 0, color: '#f59e0b' },
      ]});
    }

    const total = entry.totalEmissions || 1;
    res.json({ success: true, data: [
      { name: 'Electricity',   value: entry.scope2Emissions, percentage: Math.round((entry.scope2Emissions / total) * 100), color: '#10b981' },
      { name: 'Fuel',          value: entry.scope1Emissions, percentage: Math.round((entry.scope1Emissions / total) * 100), color: '#3b82f6' },
      { name: 'Waste & Travel',value: entry.scope3Emissions, percentage: Math.round((entry.scope3Emissions / total) * 100), color: '#f59e0b' },
    ]});
  } catch (error) { next(error); }
};

//  Total for current month (per company) 
export const getTotalEmissions = async (req, res, next) => {
  try {
    const { companyId } = req.params;
    const company = await prisma.company.findFirst({ where: { id: companyId, userId: req.user.id, isActive: true } });
    if (!company) return res.status(403).json({ success: false, message: 'Access denied' });

    const now = new Date();
    const entry = await prisma.emissionEntry.findFirst({
      where: { companyId, userId: req.user.id, month: now.getMonth() + 1, year: now.getFullYear() },
      select: { totalEmissions: true },
    });
// ------------------------------------------------------------
// const entry = await prisma.emissionEntry.findMany({
//   where, orderBy: [{ year: 'desc' }, { month: 'desc' }],
// });

// // get company once
// const company = await prisma.company.findFirst({
//   where: { id: companyId },
//   select: { numberOfEmployees: true }
// });

// // attach score per entry
// const entriesWithScore = entries.map(entry => {
//   const { score } = calculateGreenScore(
//     entry.totalEmissions,
//     company.numberOfEmployees
//   );

//   return {
//     ...entry,
//     score
//   };
// });

// res.json({ success: true, data: entriesWithScore });



    // ------------------------------------------------------------------------------------------------------------
    res.json({ success: true, data: entry?.totalEmissions || 0 });
  } catch (error) { next(error); }
};

// Yearly comparison (per company) 
export const getYearlyComparison = async (req, res, next) => {
  try {
    const { companyId } = req.params;
    const company = await prisma.company.findFirst({ where: { id: companyId, userId: req.user.id, isActive: true } });
    if (!company) return res.status(403).json({ success: false, message: 'Access denied' });

    const currentYear = new Date().getFullYear();
    const results = await prisma.$queryRaw`
      SELECT year, SUM("totalEmissions") as total
      FROM emission_entries
      WHERE "companyId" = ${companyId} AND "userId" = ${req.user.id}
        AND year >= ${currentYear - 4}
      GROUP BY year ORDER BY year ASC
    `;

    const formatted = results.map((r) => ({
      year:      r.year.toString(),
      emissions: Math.round(parseFloat(r.total) * 100) / 100,
    }));
    res.json({ success: true, data: formatted });
  } catch (error) { next(error); }
};

// Get emissions score / green score (per company)
export const getEmissionsScore = async (req, res, next) => {
  try {
    const { companyId } = req.params;
    const { year, month } = req.query;

    const company = await prisma.company.findFirst({
      where: { id: companyId, userId: req.user.id, isActive: true },
      select: { numberOfEmployees: true }
    });
    if (!company) return res.status(403).json({ success: false, message: 'Access denied' });

    // Build filter for emissions entries
    const where = { companyId, userId: req.user.id };
    if (year) where.year = parseInt(year);
    if (month) where.month = parseInt(month);

    // Aggregate total emissions
    const totalResult = await prisma.emissionEntry.aggregate({
      where,
      _sum: { totalEmissions: true }
    });
    const totalEmissions = totalResult._sum.totalEmissions || 0;

    // Calculate green score
    const { score, description, emissionsPerEmployee } = calculateGreenScore(totalEmissions, company.numberOfEmployees);

    res.json({
      success: true,
      data: {
        score,
        description,
        emissionsPerEmployee,
        totalEmissions,
        period: year && month ? `${month}/${year}` : year ? `${year}` : 'all-time',
        employeeCount: company.numberOfEmployees
      }
    });
  } catch (error) { next(error); }
};

// Predict future yearly emissions using linear regression (per company)
export const getPrediction = async (req, res, next) => {
  try {
    const { companyId } = req.params;
    const targetYear = parseInt(req.query.year);
    if (!targetYear || targetYear < 2020 || targetYear > 2050) {
      return res.status(400).json({ success: false, message: 'Valid target year (2020-2050) required' });
    }

    // Verify company ownership
    const company = await prisma.company.findFirst({ 
      where: { id: companyId, userId: req.user.id, isActive: true } 
    });
    if (!company) return res.status(403).json({ success: false, message: 'Access denied' });

    // Get last 5 years historical totals (group by year)
    const history = await prisma.emissionEntry.groupBy({
      by: ['year'],
      where: { companyId, userId: req.user.id },
      _sum: { totalEmissions: true },
      orderBy: { year: 'desc' },
      take: 5,
    });

    if (history.length === 0) {
      return res.json({ 
        success: true, 
        data: { predictedEmissions: 0, confidence: 'low', yearsUsed: [], message: 'No historical data' } 
      });
    }

    // Simple linear regression (oldest first)
    const years = history.map(h => h.year).reverse();
    const emissions = history.map(h => h._sum.totalEmissions || 0).reverse();
    const n = years.length;

    const sumX = years.reduce((a, b) => a + b, 0);
    const sumY = emissions.reduce((a, b) => a + b, 0);
    const sumXY = years.reduce((sum, x, i) => sum + x * emissions[i], 0);
    const sumX2 = years.reduce((sum, x) => sum + x * x, 0);

    const slope = n === 1 ? 0 : (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    const predicted = slope * targetYear + intercept;

    const finalPrediction = Math.max(0, Math.round(predicted * 100) / 100);

    res.json({ 
      success: true, 
      data: { 
        predictedEmissions: finalPrediction,
        confidence: history.length >= 3 ? 'high' : history.length >= 2 ? 'medium' : 'low',
        targetYear,
        yearsUsed: years,
        trend: slope > 0 ? 'increasing' : slope < 0 ? 'decreasing' : 'stable'
      } 
    });
  } catch (error) { next(error); }
};



