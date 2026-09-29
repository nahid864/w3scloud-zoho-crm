const {
    getLeads,
    getLeadById,
    searchLeadByEmail,
    createLead,
} = require('../services/zohoCrmService');

function isValidEmail(email) {
    return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function formatLead(lead) {
    return {
        id: lead.id,
        full_name: lead.Full_Name,
        email: lead.Email,
        company: lead.Company,
        phone: lead.Phone,
    };
}

function sendZohoError(res, error, fallback) {
    const zoho = error.response?.data;
    const code = Array.isArray(zoho?.data) ? zoho.data[0]?.code : zoho?.code;
    const status = error.response?.status;
    const descriptions = {
        OAUTH_SCOPE_MISMATCH: 'Zoho authorization is missing a required CRM scope. Reauthorize with the documented scopes.',
        INVALID_MODULE: 'The requested Zoho CRM module is invalid.',
        INVALID_DATA: Array.isArray(zoho?.data) ? zoho.data[0]?.message : undefined,
    };
    if (error.message === 'Zoho authentication is required' || error.message.includes('authorize again')) {
        return res.status(401).json({ success: false, message: error.message });
    }
    if (code === 'OAUTH_SCOPE_MISMATCH') {
        return res.status(403).json({ success: false, code, message: descriptions[code] });
    }
    if (status === 400 || status === 401 || status === 403 || status === 404) {
        return res.status(status).json({ success: false, ...(code ? { code } : {}), message: descriptions[code] || (status === 404 ? 'Lead not found' : fallback) });
    }
    if (error.code === 'ECONNABORTED' || error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || !error.response) {
        return res.status(502).json({ success: false, message: 'Unable to reach Zoho CRM. Please try again.' });
    }
    return res.status(500).json({ success: false, message: fallback });
}

async function getLeadsController(req, res) {
    try {
        const data = await getLeads();

        const leads = (data.data || []).map(formatLead);

        return res.json({
            success: true,
            data: leads,
        });
    } catch (error) {
        console.error(
            'Get Leads failed:',
            error.response?.data || error.message
        );

        return sendZohoError(res, error, 'Failed to retrieve leads from Zoho CRM');
    }
}

async function getLeadByIdController(req, res) {
    const { id } = req.params;

    if (!id) {
        return res.status(400).json({
            success: false,
            message: 'Lead ID is required',
        });
    }

    try {
        const data = await getLeadById(id);

        const lead = data.data?.[0];

        if (!lead) {
            return res.status(404).json({
                success: false,
                message: 'Lead not found',
            });
        }

        return res.json({
            success: true,
            data: formatLead(lead),
        });
    } catch (error) {
        console.error(
            'Get Lead by ID failed:',
            error.response?.data || error.message
        );

        return sendZohoError(res, error, 'Failed to retrieve lead from Zoho CRM');
    }
}

async function createLeadController(req, res) {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
        return res.status(400).json({ success: false, message: 'A JSON request body is required' });
    }
    const { firstName, lastName, email, company, phone } = req.body;

    // Required field validation
    if (typeof lastName !== 'string' || !lastName.trim()) {
        return res.status(400).json({
            success: false,
            message: 'Last name is required',
        });
    }

    if (typeof email !== 'string' || !email.trim()) {
        return res.status(400).json({
            success: false,
            message: 'Email is required',
        });
    }

    if (!isValidEmail(email)) {
        return res.status(400).json({
            success: false,
            message: 'A valid email address is required',
        });
    }

    if (typeof company !== 'string' || !company.trim()) {
        return res.status(400).json({
            success: false,
            message: 'Company is required',
        });
    }

    try {
        // Step 1: Search existing lead by email
        const existingData = await searchLeadByEmail(email);

        const existingLead = existingData.data?.[0];

        // Step 2: Prevent duplicate
        if (existingLead) {
            return res.status(200).json({
                success: true,
                created: false,
                message: 'Lead already exists',
                data: formatLead(existingLead),
            });
        }

        // Step 3: Prepare Zoho Lead payload
        const leadPayload = {
            Last_Name: lastName,
            Email: email,
            Company: company,
        };

        if (firstName) {
            leadPayload.First_Name = firstName;
        }

        if (phone) {
            leadPayload.Phone = phone;
        }

        // Step 4: Create new lead
        const createdData = await createLead(leadPayload);

        const createdLead = createdData.data?.[0];

        return res.status(201).json({
            success: true,
            created: true,
            message: 'Lead created successfully',
            data: {
                id: createdLead?.details?.id || createdLead?.id,
                status: createdLead?.status,
            },
        });
    } catch (error) {
        console.error(
            'Create Lead failed:',
            error.response?.data || error.message
        );

        if (error.message === 'Zoho authentication is required') {
            return res.status(401).json({
                success: false,
                message: error.message,
            });
        }

        return sendZohoError(res, error, 'Failed to create lead in Zoho CRM');
    }
}

module.exports = {
    getLeadsController,
    getLeadByIdController,
    createLeadController,
};
