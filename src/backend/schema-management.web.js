// src/backend/schema-management.web.js
import { replaceCollectionSchema, verifySchema } from './schema-complete-replacement.js';
import { currentMember } from 'wix-members-backend';

// Check if user is admin
async function isAdmin() {
    const member = await currentMember.getMember();
    if (!member) return false;
    
    const roles = await currentMember.getRoles();
    return roles.some(role => 
        role.name === 'Admin' || 
        role._id === 'c4b5c14b-0bf9-4095-ba9a-6e30b1ae5098' // CCS_ADMIN
    );
}

export async function replaceSchema() {
    // Security check
    if (!await isAdmin()) {
        throw new Error('Admin access required');
    }
    
    return replaceCollectionSchema();
}

export async function verifyCurrentSchema() {
    // Security check
    if (!await isAdmin()) {
        throw new Error('Admin access required');
    }
    
    return verifySchema();
}