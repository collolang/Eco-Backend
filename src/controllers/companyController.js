// src/controllers/companyController.js
import prisma from '../config/database.js';

const KENYA_PHONE_REGEX = /^0[17]\d{8}$/;
const toEnum = (s) => (s ? s.toUpperCase().replace(/\s+/g, '_') : 'OTHER');

const sanitizeCompany = (company) => {
  if (!company) return company;
  const { country, ...rest } = company;
  return rest;
};

// List all companies for the authenticated user 
export const listCompanies = async (req, res, next) => {
  try {
    const companies = await prisma.company.findMany({
      where: { userId: req.user.id, isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ success: true, data: companies.map(sanitizeCompany) });
  } catch (error) { next(error); }
};

// Get one company (must belong to user) 
export const getCompany = async (req, res, next) => {
  try {
    const company = await prisma.company.findFirst({
      where: { id: req.params.companyId, userId: req.user.id, isActive: true },
    });
    if (!company) return res.status(404).json({ success: false, message: 'Company not found' });
    res.json({ success: true, data: sanitizeCompany(company) });
  } catch (error) { next(error); }
};

// Create a new company profile 
export const createCompany = async (req, res, next) => {
  try {
    const {
      businessName, industryType, location, numberOfEmployees,
      registrationNumber, contactEmail, contactPhone, businessDescription, yearEstablished,
    } = req.body;

    if (contactPhone) {
      const cleaned = String(contactPhone).replace(/\s|-/g, '');
      if (!KENYA_PHONE_REGEX.test(cleaned)) {
        return res.status(400).json({
          success: false,
          message: 'Contact phone must be a valid Kenyan number in the format 07XXXXXXXX or 01XXXXXXXX (10 digits, no letters, no country code).',
        });
      }
      req.body.contactPhone = cleaned;
    }

    const company = await prisma.company.create({
      data: {
        userId:             req.user.id,
        businessName:       businessName.trim(),
        industryType:       toEnum(industryType),
        location:           location?.trim(),
        numberOfEmployees:  numberOfEmployees ? parseInt(numberOfEmployees) : 1,
        registrationNumber: registrationNumber?.trim(),
        contactEmail:       contactEmail?.toLowerCase().trim(),
        contactPhone:       contactPhone?.trim(),
        businessDescription:businessDescription?.trim(),
        yearEstablished:    yearEstablished?.trim(),
      },
    });

    res.status(201).json({ success: true, message: 'Company profile created', data: sanitizeCompany(company) });
  } catch (error) { next(error); }
};

//  Update a company 
export const updateCompany = async (req, res, next) => {
  try {
    // Verify ownership
    const existing = await prisma.company.findFirst({
      where: { id: req.params.companyId, userId: req.user.id, isActive: true },
    });
    if (!existing) return res.status(404).json({ success: false, message: 'Company not found' });

    const {
      businessName, industryType, location, numberOfEmployees,
      registrationNumber, contactEmail, contactPhone, businessDescription, yearEstablished,
    } = req.body;

    if (contactPhone) {
      const cleaned = String(contactPhone).replace(/\s|-/g, '');
      if (!KENYA_PHONE_REGEX.test(cleaned)) {
        return res.status(400).json({
          success: false,
          message: 'Contact phone must be a valid Kenyan number in the format 07XXXXXXXX or 01XXXXXXXX (10 digits, no letters, no country code).',
        });
      }
      req.body.contactPhone = cleaned;
    }

    const company = await prisma.company.update({
      where: { id: req.params.companyId },
      data: {
        businessName:       businessName?.trim(),
        industryType:       industryType ? toEnum(industryType) : undefined,
        location:           location?.trim(),
        numberOfEmployees:  numberOfEmployees ? parseInt(numberOfEmployees) : undefined,
        registrationNumber: registrationNumber?.trim(),
        contactEmail:       contactEmail?.toLowerCase().trim(),
        contactPhone:       contactPhone?.trim(),
        businessDescription:businessDescription?.trim(),
        yearEstablished:    yearEstablished?.trim(),
      },
    });

    res.json({ success: true, message: 'Company profile updated', data: sanitizeCompany(company) });
  } catch (error) { next(error); }
};

//  Soft-delete a company 
export const deleteCompany = async (req, res, next) => {
  try {
    const existing = await prisma.company.findFirst({
      where: { id: req.params.companyId, userId: req.user.id, isActive: true },
    });
    if (!existing) return res.status(404).json({ success: false, message: 'Company not found' });

    await prisma.company.update({
      where: { id: req.params.companyId },
      data: { isActive: false },
    });

    res.json({ success: true, message: 'Company profile deleted' });
  } catch (error) { next(error); }
};
