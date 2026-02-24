import { Request, Response, NextFunction } from 'express';
import xss from 'xss';

// Recursively sanitize all string properties in an object
function sanitizeObject(obj: any): any {
    if (typeof obj !== 'object' || obj === null) return obj;
    for (const key in obj) {
        if (typeof obj[key] === 'string') {
            obj[key] = xss(obj[key]);
        } else if (typeof obj[key] === 'object') {
            obj[key] = sanitizeObject(obj[key]);
        }
    }
    return obj;
}

export function inputSanitizer(req: Request, res: Response, next: NextFunction) {
    req.body = sanitizeObject(req.body);
    req.query = sanitizeObject(req.query);
    req.params = sanitizeObject(req.params);
    next();
}
