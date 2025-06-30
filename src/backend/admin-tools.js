// src/backend/admin-tools.js
// Admin tools module (separated from HTTP functions)

import { currentMember, members, authentication } from 'wix-members-backend';
import wixData from 'wix-data';
import { elevate } from 'wix-auth';

const MEMBERS_COLLECTION_ID = "Members/PrivateMembersData";
const APPLICATIONS_COLLECTION_ID = "StudioMembershipApplications"; // Updated from "Import1"

/**
 * Helper function to check if current user is admin
 */
export async function requireAdmin() {
    // Fix: Use getMember() method from currentMember object
    const member = await currentMember.getMember();
    if (!member) {
        throw new Error('Unauthorized: Not logged in');
    }
    
    const roles = await currentMember.getRoles();
    const isAdmin = roles.some(role => role.name === 'Admin');
    
    if (!isAdmin) {
        throw new Error('Unauthorized: Admin access required');
    }
    
    return member;
}

/**
 * Find applications without linked members
 */
export async function findOrphanedApplications() {
    // TODO: Update to use 'wixMemberId' field when schema is updated
    const applications = await wixData.query(APPLICATIONS_COLLECTION_ID)
        .isEmpty('applicantProfile') // TODO: Change to 'wixMemberId'
        .limit(1000)
        .find();
        
    console.log(`Found ${applications.items.length} applications without members`);
    
    if (applications.items.length === 1000) {
        console.warn('Query limit reached. There may be more orphaned applications.');
    }
    
    return applications.items;
}

/**
 * Find members without profile records in MemberProfiles collection
 * Updated to check the custom MemberProfiles collection instead of system collection
 */
export async function findMembersWithoutProfiles() {
    // Fix: Use listMembers for v2 API
    const authMembersResult = await elevate(members.listMembers)({
        paging: { limit: 1000 }
    });
    
    if (!authMembersResult.members || authMembersResult.members.length === 0) {
        return [];
    }
    
    const authMemberMap = new Map(
        authMembersResult.members.map(m => [m._id, m])
    );
    
    // Get all profile IDs from the custom MemberProfiles collection
    const memberIds = Array.from(authMemberMap.keys());
    const profileQuery = await wixData.query('MemberProfiles')
        .hasSome("_id", memberIds)
        .limit(1000)
        .find({ suppressAuth: true });
    
    const profileIds = new Set(profileQuery.items.map(p => p._id));
    
    // Find members without profiles
    const orphaned = [];
    for (const [memberId, authMember] of authMemberMap.entries()) {
        if (!profileIds.has(memberId)) {
            orphaned.push({
                memberId: authMember._id,
                email: authMember.loginEmail,
                // Fix: Use _createdDate instead of registrationDate
                registrationDate: authMember._createdDate
            });
        }
    }
    
    console.log(`Found ${orphaned.length} members without profiles in MemberProfiles collection`);
    
    if (authMembersResult.members.length === 1000) {
        console.warn('Query limit reached. There may be more members to check.');
    }
    
    return orphaned;
}

/**
 * Create member profile in MemberProfiles collection
 * Updated to work with custom collection instead of system collection
 */
export async function createMemberProfile(memberId) {
    try {
        // Get auth member data
        const authMember = await elevate(members.getMember)(memberId, { fieldsets: ['FULL'] });
        if (!authMember) {
            throw new Error(`Member ${memberId} not found in auth system`);
        }
        
        // Check if profile exists in MemberProfiles collection
        const existingProfile = await wixData.get('MemberProfiles', memberId)
            .catch(() => null);
            
        if (existingProfile) {
            console.log('Profile already exists in MemberProfiles');
            return existingProfile;
        }
        
        // Create profile in custom MemberProfiles collection
        const profile = {
            _id: memberId, // Use member ID as profile ID
            loginEmail: authMember.loginEmail,
            // Fix: Use _createdDate instead of registrationDate
            registrationDate: authMember._createdDate,
            // Phase 3 onboarding fields
            hasSignedWaiver: false,
            hasSignedRules: false,
            hasScheduledOrientation: false,
            hasPurchasedPlan: false,
            // Phase 4 promotion field
            inviteeStatus: 'active', // or whatever default status you want
            createdDate: new Date()
        };
        
        const newProfile = await wixData.insert('MemberProfiles', profile, { suppressAuth: true });
        
        console.log(`Created profile for member ${memberId} in MemberProfiles collection`);
        return newProfile;
        
    } catch (error) {
        console.error(`Failed to create member profile for ${memberId}:`, error);
        throw error;
    }
}

/**
 * Link an orphaned application to a member by email
 * This might be needed for applications created before the approval workflow was implemented
 */
export async function linkOrphanedApplication(applicationId) {
    try {
        // Get the application
        const application = await wixData.get(APPLICATIONS_COLLECTION_ID, applicationId);
        if (!application) {
            throw new Error('Application not found');
        }
        
        // TODO: Update to use 'wixMemberId' field when schema is updated
        if (application.applicantProfile) { // TODO: Change to 'wixMemberId'
            console.log('Application already has a member');
            return application;
        }
        
        // Find member by email - Fix: Use queryMembers with v2 API
        const authQuery = await elevate(members.queryMembers)()
            .eq('loginEmail', application.email)
            .find();
        
        if (!authQuery.items || authQuery.items.length === 0) {
            throw new Error(`No member found with email ${application.email}`);
        }
        
        const member = authQuery.items[0];
        
        // Update application with member ID
        // TODO: Update to use 'wixMemberId' field when schema is updated
        application.applicantProfile = member._id; // TODO: Change to 'wixMemberId'
        const updated = await wixData.update(APPLICATIONS_COLLECTION_ID, application);
        
        console.log(`Linked application ${applicationId} to member ${member._id}`);
        return updated;
        
    } catch (error) {
        console.error(`Failed to link application ${applicationId}:`, error);
        throw error;
    }
}

/**
 * Resend password setup email to a member
 */
export async function resendPasswordEmail(email) {
    try {
        await elevate(authentication.sendSetPasswordEmail)(email);
        console.log(`Password email sent to ${email}`);
        return { success: true, email };
    } catch (error) {
        console.error(`Failed to send password email to ${email}:`, error);
        throw error;
    }
}

/**
 * Generate admin report of application/member status
 */
export async function generateSystemReport() {
    const report = {
        timestamp: new Date().toISOString(),
        applications: {
            total: 0,
            withMembers: 0,
            orphaned: 0,
            byStatus: {}
        },
        members: {
            total: 0,
            withProfiles: 0,
            withoutProfiles: 0
        },
        recentActivity: {
            last24Hours: 0,
            last7Days: 0,
            last30Days: 0
        }
    };
    
    const now = new Date();
    const day = 24 * 60 * 60 * 1000;
    
    // Fix: Create proper Date objects for comparisons
    const dayAgo = new Date(now.getTime() - day);
    const weekAgo = new Date(now.getTime() - (7 * day));
    const monthAgo = new Date(now.getTime() - (30 * day));
    
    // Run all queries in parallel
    const [
        allApps,
        orphanedApps,
        submittedApps,
        approvedApps,
        last24Hours,
        last7Days,
        last30Days,
        authMembersResult,
        profilesCount
    ] = await Promise.all([
        // Application queries
        wixData.query(APPLICATIONS_COLLECTION_ID).count(),
        // TODO: Update to use 'wixMemberId' field when schema is updated
        wixData.query(APPLICATIONS_COLLECTION_ID).isEmpty('applicantProfile').count(), // TODO: Change to 'wixMemberId'
        wixData.query(APPLICATIONS_COLLECTION_ID).eq('status', 'Submitted').count(),
        wixData.query(APPLICATIONS_COLLECTION_ID).eq('status', 'Approved').count(),
        wixData.query(APPLICATIONS_COLLECTION_ID)
            .ge('submissionDate', dayAgo)
            .count(),
        wixData.query(APPLICATIONS_COLLECTION_ID)
            .ge('submissionDate', weekAgo)
            .count(),
        wixData.query(APPLICATIONS_COLLECTION_ID)
            .ge('submissionDate', monthAgo)
            .count(),
        // Member queries - Fix: Use listMembers for count
        elevate(members.listMembers)({ paging: { limit: 1 } }),
        wixData.query('MemberProfiles').count() // Updated to use MemberProfiles
    ]);
    
    // Populate report
    report.applications.total = allApps;
    report.applications.orphaned = orphanedApps;
    report.applications.withMembers = allApps - orphanedApps;
    report.applications.byStatus = {
        submitted: submittedApps,
        approved: approvedApps
    };
    
    // Fix: Get total count from metadata
    report.members.total = authMembersResult.metadata?.total || 0;
    report.members.withProfiles = profilesCount;
    report.members.withoutProfiles = Math.max(0, report.members.total - profilesCount);
    
    report.recentActivity.last24Hours = last24Hours;
    report.recentActivity.last7Days = last7Days;
    report.recentActivity.last30Days = last30Days;
    
    console.log('System Report:', JSON.stringify(report, null, 2));
    return report;
}