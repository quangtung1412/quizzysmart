/**
 * Logging Middleware
 * 
 * Provides detailed request/response logging for debugging
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Log all incoming requests with detailed information
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  const { method, originalUrl, ip, headers } = req;
  
  // Log request
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`[${timestamp}] ${method} ${originalUrl}`);
  console.log(`[Request] IP: ${ip}`);
  console.log(`[Request] User-Agent: ${headers['user-agent']}`);
  console.log(`[Request] Content-Type: ${headers['content-type']}`);
  
  // Log query params if present
  if (Object.keys(req.query).length > 0) {
    console.log(`[Request] Query Params:`, JSON.stringify(req.query, null, 2));
  }
  
  // Log body for non-GET requests (but hide sensitive fields)
  if (method !== 'GET' && req.body) {
    const sanitizedBody = sanitizeBody(req.body);
    console.log(`[Request] Body:`, JSON.stringify(sanitizedBody, null, 2));
  }
  
  // Log authenticated user if present
  if ((req as any).user) {
    console.log(`[Request] User: ${(req as any).user.email} (ID: ${(req as any).user.id})`);
  }

  // Capture response
  const originalSend = res.send;
  let responseBody: any;
  
  res.send = function(data: any) {
    responseBody = data;
    return originalSend.call(this, data);
  };

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const { statusCode } = res;
    
    // Color code based on status
    let statusColor = '✓';
    if (statusCode >= 500) statusColor = '✗ ERROR';
    else if (statusCode >= 400) statusColor = '⚠ WARN';
    else if (statusCode >= 300) statusColor = '→ REDIRECT';
    
    console.log(`[${timestamp}] ${statusColor} ${method} ${originalUrl} - ${statusCode} (${duration}ms)`);
    
    // Log response body for non-streaming responses (limit size)
    if (responseBody && !res.getHeader('content-type')?.toString().includes('text/event-stream')) {
      try {
        const body = typeof responseBody === 'string' ? JSON.parse(responseBody) : responseBody;
        const sanitized = sanitizeBody(body);
        const preview = JSON.stringify(sanitized).slice(0, 500);
        console.log(`[Response] Body: ${preview}${preview.length >= 500 ? '...(truncated)' : ''}`);
      } catch (e) {
        // Ignore JSON parse errors
      }
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  });

  next();
};

/**
 * Sanitize request/response body by hiding sensitive fields
 */
function sanitizeBody(body: any): any {
  if (!body || typeof body !== 'object') return body;
  
  const sensitiveFields = ['password', 'token', 'apiKey', 'secret', 'authorization'];
  const sanitized = Array.isArray(body) ? [...body] : { ...body };
  
  for (const key in sanitized) {
    if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
      sanitized[key] = '***REDACTED***';
    } else if (typeof sanitized[key] === 'object') {
      sanitized[key] = sanitizeBody(sanitized[key]);
    }
  }
  
  return sanitized;
}

/**
 * Log errors with stack trace
 */
export const errorLogger = (err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('\n❌ ERROR OCCURRED ❌');
  console.error(`[Error] Route: ${req.method} ${req.originalUrl}`);
  console.error(`[Error] Message: ${err.message}`);
  console.error(`[Error] Stack:`, err.stack);
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  next(err);
};

/**
 * Route-specific logger for high-value endpoints
 */
export const routeLogger = (routeName: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    console.log(`[${routeName}] Called by ${(req as any).user?.email || 'Anonymous'}`);
    next();
  };
};
