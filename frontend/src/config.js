/**
 * Resolves api route paths dynamically.
 * In local development (localhost/127.0.0.1), it queries the local dev backend directly.
 * In production (deployed via CloudFront), it maps to relative URLs so CloudFront 
 * intercepts and proxies the requests to the Fargate Application Load Balancer.
 */
export const getApiUrl = (path) => {
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const base = isLocal ? 'http://localhost:8000' : '';
  return `${base}${path}`;
};
