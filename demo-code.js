// Demo JavaScript code for agent testing
// This file contains various code patterns for agents to analyze

// Security vulnerability example - hardcoded credentials
const API_KEY = "sk-1234567890abcdef"; // BAD: Hardcoded API key
const db_password = "admin123"; // BAD: Hardcoded password

// Performance issue example - inefficient nested loops
function findDuplicates(arr1, arr2) {
    const duplicates = [];
    for (let i = 0; i < arr1.length; i++) {
        for (let j = 0; j < arr2.length; j++) {
            if (arr1[i] === arr2[j]) {
                duplicates.push(arr1[i]);
            }
        }
    }
    return duplicates; // O(n²) complexity
}

// Code quality issues - no error handling, unclear naming
function calc(x, y) {
    return x / y; // No zero division check
}

// Architecture issue - tight coupling
class UserService {
    constructor() {
        this.db = new MySQLDatabase(); // Tight coupling to specific DB
        this.emailer = new SMTPEmailer(); // Tight coupling to SMTP
    }
    
    createUser(userData) {
        const user = this.db.save(userData);
        this.emailer.sendWelcomeEmail(user.email);
        return user;
    }
}

// Missing documentation and tests
export function processPayment(amount, cardNumber, expiryDate, cvv) {
    // Complex payment processing logic without documentation
    if (amount <= 0) return false;
    
    const isValidCard = validateCard(cardNumber, expiryDate, cvv);
    if (!isValidCard) return false;
    
    // Missing: transaction logging, error handling, security measures
    return chargeCard(amount, cardNumber);
}

// Good example for comparison - well-structured, documented code
/**
 * Calculates compound interest with proper error handling
 * @param {number} principal - Initial amount
 * @param {number} rate - Annual interest rate (as decimal)
 * @param {number} time - Time period in years
 * @param {number} compound - Compounding frequency per year
 * @returns {number} Final amount after compound interest
 * @throws {Error} If any parameter is invalid
 */
function calculateCompoundInterest(principal, rate, time, compound = 1) {
    if (principal <= 0) throw new Error("Principal must be positive");
    if (rate < 0) throw new Error("Interest rate cannot be negative");
    if (time <= 0) throw new Error("Time must be positive");
    if (compound <= 0) throw new Error("Compound frequency must be positive");
    
    return principal * Math.pow((1 + rate / compound), compound * time);
}