// src/backend/review-applications.web.js
// Backend functions for CCS Admin application review

import wixData from 'wix-data';
import { currentMember, members } from 'wix-members-backend';

const APPLICATIONS_COLLECTION = 'StudioMembershipApplications';
const CCS_ADMIN_ROLE_ID = 'c4b5c14b-0bf9-4095-ba9a-6e30b1ae5098';

/**
 * Check if current user has CCS_ADMIN role
 */
async function requireCCSAdmin() {
    const member = await currentMember.getMember();
    if (!member) {
        throw new Error('Not logged in');
    }
    
    const roles = await currentMember.getRoles();
    const isAdmin = roles.some(role => role._id === CCS_ADMIN_ROLE_ID);
    
    if (!isAdmin) {
        throw new Error('CCS Admin access required');
    }
    
    return member;
}

/**
 * Get all pending applications for review
 */
export async function getApplicationsForReview() {
    try {
        await requireCCSAdmin();
        
        const results = await wixData.query(APPLICATIONS_COLLECTION)
            .eq('status', 'Submitted')
            .descending('submissionDate')
            .limit(100) // More than enough for 50-member studio
            .find();
            
        return {
            success: true,
            applications: results.items
        };
        
    } catch (error) {
        console.error('Error fetching applications:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Get single application details
 */
export async function getApplicationDetails(applicationId) {
    try {
        await requireCCSAdmin();
        
        const application = await wixData.get(APPLICATIONS_COLLECTION, applicationId);
        
        if (!application) {
            throw new Error('Application not found');
        }
        
        return {
            success: true,
            application
        };
        
    } catch (error) {
        console.error('Error fetching application details:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Approve an application
 */
export async function approveApplication(applicationId, notes = '') {
    try {
        const admin = await requireCCSAdmin();
        
        // Get current application
        const application = await wixData.get(APPLICATIONS_COLLECTION, applicationId);
        
        if (!application) {
            throw new Error('Application not found');
        }
        
        if (application.status !== 'Submitted') {
            throw new Error(`Cannot approve application with status: ${application.status}`);
        }
        
        // Update the application
        const toUpdate = {
            _id: applicationId,
            status: 'Approved',
            approvalDate: new Date(),
            approvalNotes: notes,
            approvedBy: admin.loginEmail
        };
        
        const updated = await wixData.update(APPLICATIONS_COLLECTION, toUpdate);
        
        console.log(`Application ${applicationId} approved by ${admin.loginEmail}`);
        
        return {
            success: true,
            application: updated
        };
        
    } catch (error) {
        console.error('Error approving application:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Reject an application
 */
export async function rejectApplication(applicationId, notes = '') {
    try {
        const admin = await requireCCSAdmin();
        
        // Get current application
        const application = await wixData.get(APPLICATIONS_COLLECTION, applicationId);
        
        if (!application) {
            throw new Error('Application not found');
        }
        
        if (application.status !== 'Submitted') {
            throw new Error(`Cannot reject application with status: ${application.status}`);
        }
        
        // Update the application
        const toUpdate = {
            _id: applicationId,
            status: 'Rejected',
            rejectionDate: new Date(),
            rejectionNotes: notes,
            rejectedBy: admin.loginEmail
        };
        
        const updated = await wixData.update(APPLICATIONS_COLLECTION, toUpdate);
        
        console.log(`Application ${applicationId} rejected by ${admin.loginEmail}`);
        
        return {
            success: true,
            application: updated
        };
        
    } catch (error) {
        console.error('Error rejecting application:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Get summary stats for admin dashboard
 */
export async function getApplicationStats() {
    try {
        await requireCCSAdmin();
        
        const [pending, approved, rejected] = await Promise.all([
            wixData.query(APPLICATIONS_COLLECTION).eq('status', 'Submitted').count(),
            wixData.query(APPLICATIONS_COLLECTION).eq('status', 'Approved').count(),
            wixData.query(APPLICATIONS_COLLECTION).eq('status', 'Rejected').count()
        ]);
        
        return {
            success: true,
            stats: {
                pending,
                approved,
                rejected,
                total: pending + approved + rejected
            }
        };
        
    } catch (error) {
        console.error('Error fetching stats:', error);
        return {
            success: false,
            error: error.message
        };
    }
}