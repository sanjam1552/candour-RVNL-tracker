export default async function handler(req, res) {
    const { 
        endpoint = 'stats', 
        reportId = '01KZ32Y3BSH4E19NQHF9G31MGD', 
        startDate = '2026-08-01', 
        endDate = '2026-08-26', 
        country = 'in', 
        engines, 
        limit = '10', 
        offset = '0' 
    } = req.query;
    
    // Construct the target URL
    const targetBase = `https://data.otterly.ai/v1/reports/brand/${reportId}/${endpoint}`;
    
    // Prepare params
    const params = new URLSearchParams({
        startDate,
        endDate,
        country
    });
    
    if (engines) {
        if (Array.isArray(engines)) {
            engines.forEach(eng => params.append('engines', eng));
        } else {
            params.append('engines', engines);
        }
    }
    
    if (endpoint === 'citations' || endpoint === 'citations/stats') {
        params.append('limit', limit);
        params.append('offset', offset);
    }
    
    const targetUrl = `${targetBase}?${params.toString()}`;
    
    try {
        const response = await fetch(targetUrl, {
            headers: {
                'Authorization': 'Bearer oai_live_90373c968c8530ba92b8b39ffb70a6cf5928a629242403ed981cb3a833d20da2807ac2c3',
                'Accept': 'application/json'
            }
        });
        
        const data = await response.json();
        
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET');
        
        return res.status(response.status).json(data);
    } catch (error) {
        console.error("Otterly Proxy error:", error);
        return res.status(500).json({ error: error.toString() });
    }
}
