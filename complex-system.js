// Complex system for wave orchestration testing
// This represents a realistic enterprise application with multiple concerns

// Authentication & Authorization System
class AuthService {
    constructor() {
        this.users = new Map();
        this.sessions = new Map();
        this.permissions = new Map();
    }
    
    async authenticate(credentials) {
        // Missing: encryption, rate limiting, audit logging
        const user = this.users.get(credentials.username);
        if (user && user.password === credentials.password) {
            const sessionId = this.generateSession(user);
            return { success: true, sessionId, user };
        }
        return { success: false };
    }
    
    authorize(sessionId, resource, action) {
        const session = this.sessions.get(sessionId);
        if (!session) return false;
        
        const userPermissions = this.permissions.get(session.userId);
        return userPermissions?.includes(`${resource}:${action}`);
    }
}

// Data Access Layer with Multiple Databases
class DataService {
    constructor() {
        this.primaryDb = new PostgreSQLConnection();
        this.cacheDb = new RedisConnection();
        this.analyticsDb = new MongoConnection();
        this.fileStorage = new S3Connection();
    }
    
    async saveUser(userData) {
        try {
            // Multi-database transaction simulation
            const userId = await this.primaryDb.insert('users', userData);
            await this.cacheDb.set(`user:${userId}`, userData, 3600);
            await this.analyticsDb.logUserEvent('user_created', userId);
            return userId;
        } catch (error) {
            // Missing: proper rollback, compensation patterns
            throw error;
        }
    }
    
    async getUser(userId) {
        // Cache-aside pattern with potential race conditions
        let user = await this.cacheDb.get(`user:${userId}`);
        if (!user) {
            user = await this.primaryDb.findById('users', userId);
            await this.cacheDb.set(`user:${userId}`, user, 3600);
        }
        return user;
    }
}

// Business Logic Layer
class UserManagementService {
    constructor(authService, dataService, notificationService) {
        this.auth = authService;
        this.data = dataService;
        this.notifications = notificationService;
        this.metrics = new MetricsCollector();
    }
    
    async registerUser(registrationData) {
        const startTime = Date.now();
        
        try {
            // Validation layer
            const validation = this.validateRegistration(registrationData);
            if (!validation.isValid) {
                throw new ValidationError(validation.errors);
            }
            
            // Check for existing user
            const existingUser = await this.data.findUserByEmail(registrationData.email);
            if (existingUser) {
                throw new ConflictError('User already exists');
            }
            
            // Create user account
            const hashedPassword = await this.hashPassword(registrationData.password);
            const userData = {
                ...registrationData,
                password: hashedPassword,
                createdAt: new Date(),
                status: 'pending_verification'
            };
            
            const userId = await this.data.saveUser(userData);
            
            // Send welcome email
            await this.notifications.sendWelcomeEmail(userData.email);
            
            // Record metrics
            this.metrics.recordUserRegistration(Date.now() - startTime);
            
            return { userId, status: 'success' };
            
        } catch (error) {
            this.metrics.recordError('user_registration', error);
            throw error;
        }
    }
    
    async processUserUpdate(userId, updateData, sessionId) {
        // Authorization check
        if (!this.auth.authorize(sessionId, 'user', 'update')) {
            throw new ForbiddenError('Insufficient permissions');
        }
        
        // Optimistic locking simulation
        const currentUser = await this.data.getUser(userId);
        if (currentUser.version !== updateData.version) {
            throw new ConcurrencyError('User data has been modified');
        }
        
        // Business rules validation
        if (updateData.email !== currentUser.email) {
            await this.validateEmailChange(updateData.email);
        }
        
        // Update with version increment
        const updatedData = {
            ...updateData,
            version: currentUser.version + 1,
            updatedAt: new Date()
        };
        
        await this.data.updateUser(userId, updatedData);
        await this.notifications.sendUpdateNotification(currentUser.email);
        
        return { success: true };
    }
}

// Payment Processing System
class PaymentService {
    constructor() {
        this.gateway = new PaymentGateway();
        this.fraud = new FraudDetectionService();
        this.compliance = new ComplianceService();
    }
    
    async processPayment(paymentRequest) {
        // Multi-stage payment processing with various failure points
        
        // Fraud detection
        const fraudScore = await this.fraud.analyze(paymentRequest);
        if (fraudScore > 0.8) {
            throw new FraudError('High fraud risk detected');
        }
        
        // Compliance checks
        await this.compliance.validateTransaction(paymentRequest);
        
        // Amount validation and currency conversion
        const normalizedAmount = this.normalizeAmount(paymentRequest.amount);
        
        // Reserve funds
        const reservation = await this.gateway.reserveFunds(
            paymentRequest.cardToken,
            normalizedAmount
        );
        
        try {
            // Capture payment
            const result = await this.gateway.capturePayment(reservation.id);
            
            // Update transaction records
            await this.recordTransaction(paymentRequest, result);
            
            return {
                transactionId: result.id,
                status: 'completed',
                amount: normalizedAmount
            };
            
        } catch (error) {
            // Rollback reservation
            await this.gateway.releaseReservation(reservation.id);
            throw error;
        }
    }
}

// API Layer with Multiple Endpoints
class UserController {
    constructor(userService, paymentService) {
        this.userService = userService;
        this.paymentService = paymentService;
        this.rateLimiter = new RateLimiter();
    }
    
    async handleUserRegistration(req, res) {
        try {
            await this.rateLimiter.checkLimit(req.ip, 'registration', 5, 3600);
            
            const result = await this.userService.registerUser(req.body);
            
            res.status(201).json({
                success: true,
                data: result,
                message: 'User registered successfully'
            });
            
        } catch (error) {
            this.handleError(error, res);
        }
    }
    
    async handlePayment(req, res) {
        try {
            const sessionId = req.headers['session-id'];
            if (!sessionId) {
                return res.status(401).json({ error: 'Authentication required' });
            }
            
            await this.rateLimiter.checkLimit(req.ip, 'payment', 10, 3600);
            
            const result = await this.paymentService.processPayment({
                ...req.body,
                sessionId,
                ip: req.ip,
                userAgent: req.headers['user-agent']
            });
            
            res.status(200).json({
                success: true,
                data: result
            });
            
        } catch (error) {
            this.handleError(error, res);
        }
    }
    
    handleError(error, res) {
        // Centralized error handling with logging
        console.error('API Error:', error);
        
        if (error instanceof ValidationError) {
            return res.status(400).json({ error: error.message, details: error.details });
        }
        
        if (error instanceof ForbiddenError) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        if (error instanceof ConflictError) {
            return res.status(409).json({ error: error.message });
        }
        
        // Default to 500 for unknown errors
        res.status(500).json({ error: 'Internal server error' });
    }
}

// System Configuration and Startup
class ApplicationBootstrap {
    constructor() {
        this.services = new Map();
        this.healthChecks = new Map();
    }
    
    async initialize() {
        // Service dependency resolution and startup
        const authService = new AuthService();
        const dataService = new DataService();
        const notificationService = new NotificationService();
        const userService = new UserManagementService(authService, dataService, notificationService);
        const paymentService = new PaymentService();
        const userController = new UserController(userService, paymentService);
        
        // Health check registration
        this.healthChecks.set('database', () => dataService.healthCheck());
        this.healthChecks.set('cache', () => dataService.cacheHealth());
        this.healthChecks.set('payments', () => paymentService.healthCheck());
        
        // Graceful shutdown handlers
        process.on('SIGTERM', () => this.gracefulShutdown());
        process.on('SIGINT', () => this.gracefulShutdown());
        
        return {
            authService,
            dataService,
            userService,
            paymentService,
            userController
        };
    }
    
    async gracefulShutdown() {
        console.log('Starting graceful shutdown...');
        
        // Close database connections
        await this.dataService.close();
        
        // Complete pending operations
        await this.paymentService.completePendingTransactions();
        
        console.log('Shutdown complete');
        process.exit(0);
    }
}

module.exports = {
    ApplicationBootstrap,
    AuthService,
    DataService,
    UserManagementService,
    PaymentService,
    UserController
};