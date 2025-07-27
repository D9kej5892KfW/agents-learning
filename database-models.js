// Database Models and Schemas
// Multiple data models with relationships and constraints

const UserSchema = {
    id: { type: 'UUID', primaryKey: true },
    email: { type: 'STRING', unique: true, required: true },
    username: { type: 'STRING', unique: true, required: true },
    password: { type: 'STRING', required: true }, // Should be hashed
    firstName: { type: 'STRING', required: true },
    lastName: { type: 'STRING', required: true },
    dateOfBirth: { type: 'DATE' },
    phoneNumber: { type: 'STRING' },
    address: { type: 'JSON' },
    preferences: { type: 'JSON' },
    status: { type: 'ENUM', values: ['active', 'inactive', 'suspended', 'pending_verification'] },
    emailVerified: { type: 'BOOLEAN', default: false },
    phoneVerified: { type: 'BOOLEAN', default: false },
    twoFactorEnabled: { type: 'BOOLEAN', default: false },
    lastLoginAt: { type: 'TIMESTAMP' },
    createdAt: { type: 'TIMESTAMP', default: 'NOW()' },
    updatedAt: { type: 'TIMESTAMP', default: 'NOW()' },
    version: { type: 'INTEGER', default: 0 } // For optimistic locking
};

const AccountSchema = {
    id: { type: 'UUID', primaryKey: true },
    userId: { type: 'UUID', foreignKey: 'users.id', required: true },
    accountType: { type: 'ENUM', values: ['checking', 'savings', 'credit', 'investment'] },
    accountNumber: { type: 'STRING', unique: true, required: true },
    balance: { type: 'DECIMAL', precision: 10, scale: 2, default: 0 },
    currency: { type: 'STRING', default: 'USD' },
    status: { type: 'ENUM', values: ['active', 'frozen', 'closed'] },
    overdraftLimit: { type: 'DECIMAL', precision: 10, scale: 2, default: 0 },
    interestRate: { type: 'DECIMAL', precision: 5, scale: 4 },
    createdAt: { type: 'TIMESTAMP', default: 'NOW()' },
    updatedAt: { type: 'TIMESTAMP', default: 'NOW()' }
};

const TransactionSchema = {
    id: { type: 'UUID', primaryKey: true },
    fromAccountId: { type: 'UUID', foreignKey: 'accounts.id' },
    toAccountId: { type: 'UUID', foreignKey: 'accounts.id' },
    amount: { type: 'DECIMAL', precision: 10, scale: 2, required: true },
    currency: { type: 'STRING', required: true },
    type: { type: 'ENUM', values: ['transfer', 'deposit', 'withdrawal', 'payment', 'fee'] },
    status: { type: 'ENUM', values: ['pending', 'completed', 'failed', 'cancelled'] },
    description: { type: 'TEXT' },
    reference: { type: 'STRING' },
    metadata: { type: 'JSON' },
    processedAt: { type: 'TIMESTAMP' },
    createdAt: { type: 'TIMESTAMP', default: 'NOW()' },
    updatedAt: { type: 'TIMESTAMP', default: 'NOW()' }
};

const PaymentMethodSchema = {
    id: { type: 'UUID', primaryKey: true },
    userId: { type: 'UUID', foreignKey: 'users.id', required: true },
    type: { type: 'ENUM', values: ['credit_card', 'debit_card', 'bank_account', 'digital_wallet'] },
    provider: { type: 'STRING' }, // Visa, MasterCard, PayPal, etc.
    last4: { type: 'STRING' }, // Last 4 digits for display
    expiryMonth: { type: 'INTEGER' },
    expiryYear: { type: 'INTEGER' },
    cardholderName: { type: 'STRING' },
    billingAddress: { type: 'JSON' },
    isDefault: { type: 'BOOLEAN', default: false },
    isVerified: { type: 'BOOLEAN', default: false },
    token: { type: 'STRING' }, // Tokenized payment method
    createdAt: { type: 'TIMESTAMP', default: 'NOW()' },
    updatedAt: { type: 'TIMESTAMP', default: 'NOW()' }
};

const AuditLogSchema = {
    id: { type: 'UUID', primaryKey: true },
    userId: { type: 'UUID', foreignKey: 'users.id' },
    action: { type: 'STRING', required: true },
    resource: { type: 'STRING', required: true },
    resourceId: { type: 'STRING' },
    oldValues: { type: 'JSON' },
    newValues: { type: 'JSON' },
    ipAddress: { type: 'STRING' },
    userAgent: { type: 'TEXT' },
    sessionId: { type: 'STRING' },
    timestamp: { type: 'TIMESTAMP', default: 'NOW()' }
};

// Database Connection and Migration Management
class DatabaseManager {
    constructor(config) {
        this.config = config;
        this.connections = new Map();
        this.migrations = [];
    }
    
    async initialize() {
        // Initialize multiple database connections
        this.connections.set('primary', await this.createConnection(this.config.primary));
        this.connections.set('readonly', await this.createConnection(this.config.readonly));
        this.connections.set('analytics', await this.createConnection(this.config.analytics));
        
        // Run pending migrations
        await this.runMigrations();
        
        // Set up connection pooling and monitoring
        this.setupConnectionMonitoring();
    }
    
    async createConnection(config) {
        // Connection creation with retry logic and health checks
        const connection = new DatabaseConnection(config);
        
        await connection.connect();
        await connection.healthCheck();
        
        return connection;
    }
    
    async runMigrations() {
        const migrationLock = await this.acquireMigrationLock();
        
        try {
            const pendingMigrations = await this.getPendingMigrations();
            
            for (const migration of pendingMigrations) {
                console.log(`Running migration: ${migration.name}`);
                await migration.up();
                await this.recordMigration(migration);
            }
        } finally {
            await this.releaseMigrationLock(migrationLock);
        }
    }
    
    setupConnectionMonitoring() {
        // Monitor connection health and performance
        setInterval(async () => {
            for (const [name, connection] of this.connections) {
                try {
                    await connection.ping();
                } catch (error) {
                    console.error(`Connection ${name} health check failed:`, error);
                    await this.handleConnectionFailure(name, connection);
                }
            }
        }, 30000); // Check every 30 seconds
    }
}

// Repository Pattern Implementation
class UserRepository {
    constructor(dbManager) {
        this.db = dbManager.connections.get('primary');
        this.readDb = dbManager.connections.get('readonly');
    }
    
    async create(userData) {
        const transaction = await this.db.beginTransaction();
        
        try {
            const user = await this.db.query(
                'INSERT INTO users (id, email, username, password, firstName, lastName, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [userData.id, userData.email, userData.username, userData.password, userData.firstName, userData.lastName, new Date()]
            );
            
            // Create audit log entry
            await this.db.query(
                'INSERT INTO audit_logs (userId, action, resource, newValues, timestamp) VALUES (?, ?, ?, ?, ?)',
                [user.id, 'CREATE', 'user', JSON.stringify(userData), new Date()]
            );
            
            await transaction.commit();
            return user;
            
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }
    
    async findById(userId) {
        // Use read replica for queries
        const result = await this.readDb.query(
            'SELECT * FROM users WHERE id = ? AND status != ?',
            [userId, 'deleted']
        );
        
        return result[0] || null;
    }
    
    async findByEmail(email) {
        const result = await this.readDb.query(
            'SELECT * FROM users WHERE email = ? AND status != ?',
            [email, 'deleted']
        );
        
        return result[0] || null;
    }
    
    async update(userId, updateData) {
        const transaction = await this.db.beginTransaction();
        
        try {
            // Get current data for audit trail
            const currentUser = await this.findById(userId);
            if (!currentUser) {
                throw new Error('User not found');
            }
            
            // Optimistic locking check
            if (updateData.version !== currentUser.version) {
                throw new Error('User data has been modified by another process');
            }
            
            // Increment version
            updateData.version = currentUser.version + 1;
            updateData.updatedAt = new Date();
            
            // Update user
            await this.db.query(
                'UPDATE users SET email = ?, firstName = ?, lastName = ?, version = ?, updatedAt = ? WHERE id = ?',
                [updateData.email, updateData.firstName, updateData.lastName, updateData.version, updateData.updatedAt, userId]
            );
            
            // Create audit log entry
            await this.db.query(
                'INSERT INTO audit_logs (userId, action, resource, oldValues, newValues, timestamp) VALUES (?, ?, ?, ?, ?, ?)',
                [userId, 'UPDATE', 'user', JSON.stringify(currentUser), JSON.stringify(updateData), new Date()]
            );
            
            await transaction.commit();
            return { ...currentUser, ...updateData };
            
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }
}

module.exports = {
    UserSchema,
    AccountSchema,
    TransactionSchema,
    PaymentMethodSchema,
    AuditLogSchema,
    DatabaseManager,
    UserRepository
};