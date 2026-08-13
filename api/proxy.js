export default async function handler(req, res) {
    const { url } = req.query;
    if (!url) {
        return res.status(400).send("Missing url parameter");
    }
    
    try {
        const decodedUrl = decodeURIComponent(url);
        
        const response = await fetch(decodedUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/xml, text/xml, */*'
            }
        });
        
        if (!response.ok) {
            return res.status(response.status).send(`Failed to fetch: ${response.statusText}`);
        }
        
        const contentType = response.headers.get('content-type') || 'text/xml; charset=utf-8';
        res.setHeader('Content-Type', contentType);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET');
        
        const data = await response.text();
        return res.status(200).send(data);
    } catch (error) {
        console.error("Proxy server error:", error);
        return res.status(500).send(error.toString());
    }
}
