import { Request, Response, NextFunction } from "express";

export const globalRateLimiter = (
  _req: Request,
  _res: Response,
  next: NextFunction,
) => {
  next();
};
