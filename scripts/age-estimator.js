const CACHE_KEY = 'uvae-token';

class AgeEstimator {
    constructor() {
        this._jwk = {
            alg: "PS256",
            e: "AQAB",
            kty: "RSA",
            n: "oZcuAKQFI3jGMXr6hjGyshDYD-msQuvuMm6ytVYbKci9pwIpEAyErulo_KcYR3jQkX-BDkTF-3bxKuIRfIe1fAyOTDyQIvIpvJfymmSudL-Uu0eOTb3GEkewPRVBo1jyKu5q3HY0bAX8lPCsXJ0X3QJfb6COhm1rOJcMUmv18ryZgauvQ18w9ZmP4yPtqW4jh4jLuPoHaFex_zHO9T6a1fDDnx1rk1ircHkVii8DViAkFf9O65SasZOcXkWuVrjWIivGMHg_lVwxwksmNqPa6pBdmdfAhljF63hYeP7ska1RuDCwaWNNVcqq1LFyUEV7Hdf88lQeozCi6Z8Cv7l1qQ",
            use: "sig"
        };
    }

    /**
     * Estimates user's age
     * @param {Object} params - The parameters for the age estimation
     * @param {boolean} params.livenessCheck - Whether to also perform a liveness check on the user (optional)
     * @param {boolean} params.enableCache - Whether to enable caching of the age estimation (optional)
     * @param {number} params.cacheDuration - The duration of the cache in milliseconds (optional)
     * @returns {Promise} Resolves with the estimated age on success, rejects on error
     */
    async estimateAge(params = {}) {
        const token = localStorage.getItem(CACHE_KEY);
        if(token) {
            if(params.enableCache) {
                try {
                    let decoded = await this.verifyToken(token);
                    if(decoded) {
                        return decoded.age;
                    } else {
                        localStorage.removeItem(CACHE_KEY);
                    }
                } catch(e) {
                    localStorage.removeItem(CACHE_KEY);
                }
            } else {
                localStorage.removeItem(CACHE_KEY);
            }
        }
        return new Promise(async (resolve, reject) => {
            let settled = false;
            const nonce = Math.random().toString(36).substring(2, 15);
            const url = params.localTesting ? '../index.html' : 'https://universal-verify.github.io/age-estimator/';
            const origin = params.localTesting ? window.location.origin : 'https://universal-verify.github.io';
            const livenessCheck = params.livenessCheck || false;
            const cacheDuration = params.cacheDuration || 1000 * 60 * 60 * 24;
            const newTab = window.open(url, '_blank');

            if (!newTab) {
                reject('POPUP_BLOCKED');
                return;
            }

            function cleanup() {
                window.removeEventListener('message', handler);
                clearInterval(tabCheckInterval);
            }

            const handler = async (event) => {
                if (event.source !== newTab || event.origin !== origin) return;
                if (event.data.type === 'age-estimation-result') {
                    if (event.data.nonce !== nonce) return;
                    settled = true;
                    try {
                        let decoded = await this.verifyToken(event.data.token);
                        if(decoded) {
                            if(params.enableCache)
                                localStorage.setItem(CACHE_KEY, event.data.token);
                            resolve(event.data.age);
                        } else {
                            reject('INVALID_SIGNATURE');
                        }
                    } catch(e) {
                        reject('INVALID_SIGNATURE');
                    }
                    newTab.close();
                    cleanup();
                } else if (event.data.type === 'age-estimation-error') {
                    if (event.data.nonce !== nonce) return;
                    settled = true;
                    if(event.data.error.includes('webcam')) {
                        reject('WEBCAM_ERROR');
                    } else if(event.data.error.includes('Different face')) {
                        reject('DIFFERENT_FACE_ERROR');
                    } else {
                        reject('INTERNAL_ERROR');
                    }
                    newTab.close();
                    cleanup();
                } else if (event.data.type === 'check-parent-commandeer') {
                    let origin = window.location.origin;
                    newTab.postMessage({ type: 'confirm-parent-commandeer', nonce, livenessCheck, cacheDuration, origin }, origin);
                }
            }

            window.addEventListener('message', handler);

            // Check if the tab is closed before resolving/rejecting
            const tabCheckInterval = setInterval(() => {
                if (newTab.closed && !settled) {
                    settled = true;
                    reject('CANCELLED');
                    cleanup();
                }
            }, 500);
        });
    }

    /**
     * Clears the cache
     */
    clearCache() {
        localStorage.removeItem(CACHE_KEY);
    }

    /**
     * Gets the cached age
     * @returns {Promise} Resolves with the cached age if found, null otherwise
     */
    async getCachedAge() {
        const token = localStorage.getItem(CACHE_KEY);
        if(token) {
            try {
                let decoded = await this.verifyToken(token);
                if(decoded) {
                    return decoded.age;
                } else {
                    localStorage.removeItem(CACHE_KEY);
                }
            } catch(e) {
                localStorage.removeItem(CACHE_KEY);
            }
        }
        return null;
    }

    /**
     * Gets the cached token
     * @returns {string} The cached token or null if not found
     */
    getCachedToken() {
        const token = localStorage.getItem(CACHE_KEY);
        return token || null;
    }

    /**
     * Verifies the token
     * @param {string} token - The token to verify
     * @returns {Promise} Resolves with the decoded result on success, rejects on error
     */
    async verifyToken(token) {
        const publicKey = await crypto.subtle.importKey(
            'jwk',
            this._jwk,
            {
              name: 'RSA-PSS',
              hash: 'SHA-256',
            },
            false,
            ['verify']
        );
        const [base64UrlSafeResult, signature] = token.split('.');
        const result = JSON.parse(atob(base64UrlSafeResult));
        if(result.exp < Date.now()) {
            throw new Error('EXPIRED');
        } else if(result.sub !== simpleHash(navigator.userAgent + window.location.origin)) {
            throw new Error('INVALID_SUB');
        }
        const verified = await crypto.subtle.verify(
            { name: 'RSA-PSS', saltLength: 32 },
            publicKey,
            hexToArrayBuffer(signature),
            new TextEncoder().encode(base64UrlSafeResult)
        );
        if(!verified) throw new Error('INVALID_SIGNATURE');
        return result;
    }
}

// Convert hex to ArrayBuffer
function hexToArrayBuffer(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes.buffer;
}

function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
    }
    return hash;
}

const ageEstimator = new AgeEstimator();
export default ageEstimator;