// hand rolled async request and other goodies
const requestSync = require('request')

/**
 * An promisified wrapper around request
 * 
 * @param {string} uri URI to request
 * @param {any} options Passed to request directly
 */
function request(uri, options) {
    return new Promise(function (resolve, reject) {
        requestSync(uri, options, (err, response, _) => {
            if (err) {
                reject(err)
            } else {
                resolve(response)
            }
        })
    });
}

/**
 * Parse the body as JSON and return it, descarding everything else
 */
request.json = async function(uri, options) {
    let body = (await request(uri, options)).body
    try {
        return JSON.parse(body)
    } catch(e) {
        return null
    }
}

let _expandCache = new Map()

async function expandUri(uri, method) {
    if(!_expandCache.has(uri)) {
        let lastSeenUri = null
        let location = uri;
        let status = 300;
        let hops = 5;
        let bestGuess = uri

        try {
            while(status.toString()[0] === '3' && hops-- > 0) {
                if(!location.startsWith("http")) {
                    // relative to the host, not an absolute URL
                    // Flicker seems to do this
                    let seperator = location.startsWith('/') ? '' : '/'
                    location = `${lastSeenUri.protocol}//${lastSeenUri.host}${seperator}${location}`
                }
                let response = await request(location, { timeout:15000, followRedirect:false, method })
                status = response.statusCode
                location = response.headers.location || location
                if(status === 301)
                    bestGuess = location;
                lastSeenUri = response.request.uri;
            }

            // ran out of hops while iterating, use best guess
            if(status.toString()[0] === '3')
                location = bestGuess;
            _expandCache.set(uri, location);
        } catch(e) {
            // yolo i guess
            _expandCache.set(uri, bestGuess);
        }
    }

    return _expandCache.get(uri);
}

/**
 * Recursively follow redirects until a page returns 200
 * 
 * Useful for expanding shortened links
 */
request.expand = async function(uri) {
    try {
        // try to expand with HEAD first. faster, and works on correctly
        // configured servers
        return await expandUri(uri, 'HEAD')
    } catch(e) {
        // failing that try with GET instead. slower, but more closely
        // reproduces what a browser would do
        return await expandUri(uri, 'GET')
    }
}

module.exports = request