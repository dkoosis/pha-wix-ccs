// src/backend/admin-tools.js
// Admin tools with wixMemberId field name and CCS_Admin role

import { currentMember, members, authentication } from 'wix-members-backend';
import wixData from 'wix-data';
import { elevate } from 'wix-auth';

const MEMBERS_COLLECTION_ID = "Members/PrivateMembersData";
const APPLICATIONS_COLLECTION_ID = "StudioMembershipApplications";

const ADMIN_ROLE_IDS = {
    ADMIN: 'Admin', // Wix system admin (by name)
    CCS_ADMIN: 'c4b5c14b-0bf9-4095-ba9a-6e30b1ae5098' // Studio staff admin
};

export async function requireAdmin() {
    const member = await currentMember.getMember();
    if (!member) {
        throw new Error('Unauthorized: Not logged in');
    }
    
    const roles = await currentMember.getRoles();
    const isAdmin = roles.some(role => 
        role.name === ADMIN_ROLE_IDS.ADMIN || 
        role._id === ADMIN_ROLE_IDS.CCS_ADMIN
    );
    
    if (!isAdmin) {
        throw new Error('Unauthorized: Admin access required');
    }
    
    return member;
}

export async function findOrphanedApplications() {
    const applications = await wixData.query(APPLICATIONS_COLLECTION_ID)
        .isEmpty('wixMemberId')
        .limit(1000)
        .find();
        
    console.log(`Found ${applications.items.length} applications without members`);
    
    if (applications.items.length === 1000) {
        console.warn('Query limit reached. There may be more orphaned applications.');
    }
    
    return applications.items;
}

export async function findMembersWithoutProfiles() {
    const authMembersResult = await elevate(members.listMembers)({
        paging: { limit: 1000 }
    });
    
    if (!authMembersResult.members || authMembersResult.members.length === 0) {
        return [];
    }
    
    const authMemberMap = new Map(
        authMembersResult.members.map(m => [m._id, m])
    );
    
    const memberIds = Array.from(authMemberMap.keys());
    const profileQuery = await wixData.query('MemberProfiles')
        .hasSome("_id", memberIds)
        .limit(1000)
        .find({ suppressAuth: true });
    
    const profileIds = new Set(profileQuery.items.map(p => p._id));
    
    const orphaned = [];
    for (const [memberId, authMember] of authMemberMap.entries()) {
        if (!profileIds.has(memberId)) {
            orphaned.push({
                memberId: authMember._id,
                email: authMember.loginEmail,
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

export async function createMemberProfile(memberId) {
    try {
        const authMember = await elevate(members.getMember)(memberId, { fieldsets: ['FULL'] });
        if (!authMember) {
            throw new Error(`Member ${memberId} not found in auth system`);
        }
        
        const existingProfile = await wixData.get('MemberProfiles', memberId)
            .catch(() => null);
            
        if (existingProfile) {
            console.log('Profile already exists in MemberProfiles');
            return existingProfile;
        }
        
        const profile = {
            _id: memberId,
            loginEmail: authMember.loginEmail,
            registrationDate: authMember._createdDate,
            hasSignedWaiver: false,
            hasSignedRules: false,
            hasScheduledOrientation: false,
            hasPurchasedPlan: false,
            inviteeStatus: 'active',
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

export async function linkOrphanedApplication(applicationId) {
    try {
        const application = await wixData.get(APPLICATIONS_COLLECTION_ID, applicationId);
        if (!application) {
            throw new Error('Application not found');
        }
        
        if (application.wixMemberId) {
            console.log('Application already has a member');
            return application;
        }
        
        const authQuery = await elevate(members.queryMembers)()
            .eq('loginEmail', application.email)
            .find();
        
        if (!authQuery.items || authQuery.items.length === 0) {
            throw new Error(`No member found with email ${application.email}`);
        }
        
        const member = authQuery.items[0];
        
        application.wixMemberId = member._id;
        const updated = await wixData.update(APPLICATIONS_COLLECTION_ID, application);
        
        console.log(`Linked application ${applicationId} to member ${member._id}`);
        return updated;
        
    } catch (error) {
        console.error(`Failed to link application ${applicationId}:`, error);
        throw error;
    }
}

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
    
    const dayAgo = new Date(now.getTime() - day);
    const weekAgo = new Date(now.getTime() - (7 * day));
    const monthAgo = new Date(now.getTime() - (30 * day));
    
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
        wixData.query(APPLICATIONS_COLLECTION_ID).count(),
        wixData.query(APPLICATIONS_COLLECTION_ID).isEmpty('wixMemberId').count(),
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
        elevate(members.listMembers)({ paging: { limit: 1 } }),
        wixData.query('MemberProfiles').count()
    ]);
    
    report.applications.total = allApps;
    report.applications.orphaned = orphanedApps;
    report.applications.withMembers = allApps - orphanedApps;
    report.applications.byStatus = {
        submitted: submittedApps,
        approved: approvedApps
    };
    
    report.members.total = authMembersResult.metadata?.total || 0;
    report.members.withProfiles = profilesCount;
    report.members.withoutProfiles = Math.max(0, report.members.total - profilesCount);
    
    report.recentActivity.last24Hours = last24Hours;
    report.recentActivity.last7Days = last7Days;
    report.recentActivity.last30Days = last30Days;
    
    console.log('System Report:', JSON.stringify(report, null, 2));
    return report;
}