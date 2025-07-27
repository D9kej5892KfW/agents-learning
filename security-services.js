// Security Services and Authentication
// Comprehensive security layer with multiple authentication methods

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');

class SecurityService {
    constructor(config) {
        this.config = config;
        this.jwtSecret = process.env.JWT_SECRET;
        this.encryptionKey = process.env.ENCRYPTION_KEY;
        this.rateLimiters = new Map();
        this.suspiciousActivityDetector = new SuspiciousActivityDetector();
    }
    
    // Password Security
    async hashPassword(password) {
        const saltRounds = 12;
        const salt = await crypto.randomBytes(16);
        
        // PBKDF2 with SHA-256
        return new Promise((resolve, reject) => {
            crypto.pbkdf2(password, salt, 100000, 64, 'sha256', (err, derivedKey) => {
                if (err) reject(err);
                else resolve(salt.toString('hex') + ':' + derivedKey.toString('hex'));
            });
        });
    }
    
    async verifyPassword(password, hash) {
        const [salt, key] = hash.split(':');
        
        return new Promise((resolve, reject) => {
            crypto.pbkdf2(password, Buffer.from(salt, 'hex'), 100000, 64, 'sha256', (err, derivedKey) => {
                if (err) reject(err);
                else resolve(key === derivedKey.toString('hex'));
            });
        });
    }
    
    validatePasswordStrength(password) {
        const requirements = {
            minLength: password.length >= 8,
            hasUppercase: /[A-Z]/.test(password),
            hasLowercase: /[a-z]/.test(password),
            hasNumbers: /\d/.test(password),
            hasSpecialChars: /[!@#$%^&*(),.?":{}|<>]/.test(password),
            notCommon: !this.isCommonPassword(password)
        };
        
        const score = Object.values(requirements).filter(Boolean).length;
        
        return {
            isValid: score >= 5,
            score,
            requirements,
            feedback: this.getPasswordFeedback(requirements)
        };
    }
    
    // JWT Token Management
    generateAccessToken(userId, permissions = []) {
        const payload = {
            userId,
            permissions,
            type: 'access',
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + (15 * 60) // 15 minutes
        };
        
        return jwt.sign(payload, this.jwtSecret, { algorithm: 'HS256' });
    }
    
    generateRefreshToken(userId) {
        const payload = {
            userId,
            type: 'refresh',
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days
        };
        
        return jwt.sign(payload, this.jwtSecret, { algorithm: 'HS256' });
    }
    
    verifyToken(token) {
        try {
            return jwt.verify(token, this.jwtSecret);
        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                throw new Error('Token has expired');
            } else if (error.name === 'JsonWebTokenError') {
                throw new Error('Invalid token');
            }
            throw error;
        }
    }
    
    // Two-Factor Authentication
    generateTOTPSecret(userEmail) {
        return speakeasy.generateSecret({
            name: `MyApp (${userEmail})`,
            issuer: 'MyApp',
            length: 32
        });
    }
    
    verifyTOTP(token, secret) {
        return speakeasy.totp.verify({
            secret: secret,
            encoding: 'base32',
            token: token,
            window: 2 // Allow for clock skew
        });
    }
    
    generateBackupCodes() {
        const codes = [];
        for (let i = 0; i < 10; i++) {
            codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
        }
        return codes;
    }
    
    // Rate Limiting
    async checkRateLimit(identifier, action, maxAttempts, windowMs) {
        const key = `${identifier}:${action}`;
        const now = Date.now();
        
        if (!this.rateLimiters.has(key)) {
            this.rateLimiters.set(key, { attempts: 0, resetTime: now + windowMs });
        }
        
        const limiter = this.rateLimiters.get(key);
        
        if (now > limiter.resetTime) {
            limiter.attempts = 0;
            limiter.resetTime = now + windowMs;
        }
        
        if (limiter.attempts >= maxAttempts) {
            throw new Error(`Rate limit exceeded for ${action}. Try again later.`);
        }
        
        limiter.attempts++;
        return true;
    }
    
    // Session Management
    async createSession(userId, metadata = {}) {
        const sessionId = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + (24 * 60 * 60 * 1000)); // 24 hours
        
        const sessionData = {
            id: sessionId,
            userId,
            createdAt: new Date(),
            expiresAt,
            lastAccessedAt: new Date(),
            ipAddress: metadata.ipAddress,
            userAgent: metadata.userAgent,
            isActive: true
        };
        
        // Store session (in Redis/database)
        await this.storeSession(sessionData);
        
        return sessionData;
    }
    
    async validateSession(sessionId) {
        const session = await this.getSession(sessionId);
        
        if (!session) {
            throw new Error('Session not found');
        }
        
        if (!session.isActive) {
            throw new Error('Session is inactive');
        }
        
        if (new Date() > session.expiresAt) {
            await this.invalidateSession(sessionId);
            throw new Error('Session has expired');
        }
        
        // Update last accessed time
        await this.updateSessionAccess(sessionId);
        
        return session;
    }
    
    // Data Encryption
    encrypt(data) {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipher('aes-256-gcm', this.encryptionKey);
        
        let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        const authTag = cipher.getAuthTag();
        
        return {
            encrypted,
            iv: iv.toString('hex'),
            authTag: authTag.toString('hex')
        };
    }
    
    decrypt(encryptedData) {
        const decipher = crypto.createDecipher('aes-256-gcm', this.encryptionKey);
        
        decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
        
        let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return JSON.parse(decrypted);
    }
    
    // Input Validation and Sanitization
    sanitizeInput(input, type) {
        switch (type) {
            case 'email':
                return this.sanitizeEmail(input);
            case 'username':
                return this.sanitizeUsername(input);
            case 'phone':
                return this.sanitizePhone(input);
            default:
                return this.sanitizeGeneral(input);
        }
    }
    
    sanitizeEmail(email) {
        if (typeof email !== 'string') return null;
        
        email = email.trim().toLowerCase();
        
        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            throw new Error('Invalid email format');
        }
        
        return email;
    }
    
    sanitizeUsername(username) {
        if (typeof username !== 'string') return null;
        
        username = username.trim();
        
        // Allow alphanumeric, underscore, and hyphen
        if (!/^[a-zA-Z0-9_-]{3,30}$/.test(username)) {
            throw new Error('Username must be 3-30 characters and contain only letters, numbers, underscore, or hyphen');
        }
        
        return username;
    }
}

// Suspicious Activity Detection
class SuspiciousActivityDetector {
    constructor() {
        this.activityLog = new Map();
        this.suspiciousPatterns = {
            rapidLoginAttempts: { threshold: 5, windowMs: 300000 }, // 5 attempts in 5 minutes
            unusualLocation: { enabled: true },
            deviceFingerprinting: { enabled: true },
            passwordSpray: { threshold: 10, windowMs: 3600000 } // 10 different users in 1 hour
        };
    }
    
    async analyzeActivity(userId, action, metadata) {
        const activity = {
            userId,
            action,
            timestamp: new Date(),
            ipAddress: metadata.ipAddress,
            userAgent: metadata.userAgent,
            location: await this.getLocationFromIP(metadata.ipAddress)
        };
        
        // Store activity
        this.logActivity(activity);
        
        // Check for suspicious patterns
        const suspiciousScore = await this.calculateSuspiciousScore(activity);
        
        if (suspiciousScore > 0.7) {
            await this.handleSuspiciousActivity(activity, suspiciousScore);
        }
        
        return {
            activity,
            suspiciousScore,
            requiresAdditionalVerification: suspiciousScore > 0.5
        };
    }
    
    async calculateSuspiciousScore(activity) {
        let score = 0;
        
        // Check for rapid login attempts
        score += this.checkRapidAttempts(activity.userId, activity.action);
        
        // Check for unusual location
        score += await this.checkUnusualLocation(activity.userId, activity.location);
        
        // Check for new device
        score += this.checkNewDevice(activity.userId, activity.userAgent);
        
        // Check for password spray attacks
        score += this.checkPasswordSpray(activity.ipAddress);
        
        return Math.min(score, 1.0); // Cap at 1.0
    }
    
    async handleSuspiciousActivity(activity, score) {
        // Log security event
        console.warn(`Suspicious activity detected for user ${activity.userId}:`, {
            score,
            activity
        });
        
        // Send security alert
        if (score > 0.8) {
            await this.sendSecurityAlert(activity);
        }
        
        // Implement additional security measures
        if (score > 0.9) {
            await this.lockAccount(activity.userId);
        }
    }
}

// Security Audit Service
class SecurityAuditService {
    constructor() {
        this.auditLog = [];
        this.complianceChecks = {
            passwordPolicy: true,
            sessionManagement: true,
            dataEncryption: true,
            accessLogging: true,
            rateLimit: true
        };
    }
    
    async performSecurityAudit() {
        const auditResults = {
            timestamp: new Date(),
            checks: {},
            overallScore: 0,
            recommendations: []
        };
        
        // Password Policy Check
        auditResults.checks.passwordPolicy = await this.auditPasswordPolicy();
        
        // Session Security Check
        auditResults.checks.sessionSecurity = await this.auditSessionSecurity();
        
        // Data Protection Check
        auditResults.checks.dataProtection = await this.auditDataProtection();
        
        // Access Control Check
        auditResults.checks.accessControl = await this.auditAccessControl();
        
        // Calculate overall score
        const scores = Object.values(auditResults.checks).map(check => check.score);
        auditResults.overallScore = scores.reduce((a, b) => a + b, 0) / scores.length;
        
        // Generate recommendations
        auditResults.recommendations = this.generateRecommendations(auditResults.checks);
        
        return auditResults;
    }
    
    async auditPasswordPolicy() {
        return {
            score: 0.85,
            issues: [
                'Consider increasing minimum password length to 12 characters',
                'Implement password history to prevent reuse'
            ],
            compliant: true
        };
    }
    
    generateRecommendations(checks) {
        const recommendations = [];
        
        Object.entries(checks).forEach(([category, result]) => {
            if (result.score < 0.8) {
                recommendations.push({
                    category,
                    priority: result.score < 0.6 ? 'high' : 'medium',
                    issues: result.issues
                });
            }
        });
        
        return recommendations;
    }
}

module.exports = {
    SecurityService,
    SuspiciousActivityDetector,
    SecurityAuditService
};