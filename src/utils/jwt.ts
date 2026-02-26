import jwt from 'jsonwebtoken'

const generateAccessToken = (userId: string, tokenVersion: number): string => {
    const expiresIn = process.env.ACCESS_TOKEN_EXPIRES_IN || "1d";

    return jwt.sign(
        { userId, tokenVersion },
        process.env.ACCESS_TOKEN_SECRET as string,
        { expiresIn: expiresIn as jwt.SignOptions['expiresIn'] }
    )
}

const generateRefreshToken = (userId: string, tokenVersion: number): string => {
    const expiresIn = process.env.REFRESH_TOKEN_EXPIRES_IN || "7d";

    return jwt.sign(
        { userId, tokenVersion },
        process.env.REFRESH_TOKEN_SECRET as string,
        { expiresIn: expiresIn as jwt.SignOptions['expiresIn'] }
    )
}

export { generateAccessToken, generateRefreshToken };
