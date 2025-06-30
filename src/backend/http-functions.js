// src/backend/http-functions.js
// HTTP endpoints for external integrations

import { ok, serverError, forbidden } from 'wix-http-functions';
import { isValidApiKey } from 'backend/auth-utils.web';
import { findOrCreateContact } from 'backend/contact-logic.web';
import { createApplication, buildApplicationData } from 'backend/data-access';
import { testCollectionAccess, insertHelloWorld, getRecentTestEntries } from 'backend/data-access';

// Version tracking for debugging
const VERSION = "v.7d25e6b";

/*
 * Studio Application Webhook - Phase 1: Application Submission Only
 * 
 * This webhook is called by Fillout when someone submits an application.
 * It performs Phase 1 of the workflow:
 * 1. Creates/finds a CRM contact (for email tracking)
 * 2. Saves the application with "Submitted" status
 * 3. TODO: Sends acknowledgment email
 * 
 * Member creation happens later via data hook when admin approves.
 */
export async function post_studioApplication(request) {
    const timestamp = new Date().toISOString();
    console.log(`⚡ Executing /studioApplication | 📍 Version: ${VERSION} | 🕐 ${timestamp}`);
    
    try {
        // Validate API key
        if (!await isValidApiKey(request)) {
            console.warn('❌ Invalid API key attempted');
            return forbidden({ 
                body: { 
                    error: 'Invalid API key',
                    version: VERSION 
                } 
            });
        }
        
        // Parse payload
        const payload = await request.body.json();
        console.log(`📦 Received payload for: ${payload.email}`);
        
        // Validate required fields
        if (!payload.email) {
            return serverError({ 
                body: { 
                    error: 'Email is required',
                    version: VERSION 
                } 
            });
        }
        
        // === PHASE 1 WORKFLOW ===
        
        // Step 1: Create/find CRM contact (for email tracking)
        console.log('📋 Step 1: Creating/finding contact...');
        const { contact, wasCreated: contactIsNew } = await findOrCreateContact(
            payload.email,
            payload.firstName,
            payload.lastName
        );
        console.log(`✅ Contact ready: ${contact._id} (new: ${contactIsNew})`);
        
        // Step 2: Create application record with "Submitted" status
        console.log('📝 Step 2: Creating application record...');
        
        // TODO: Update buildApplicationData to use 'wixMemberId' field name instead of 'applicantProfile'
        // TODO: Add all missing fields from actual membership application form
        const applicationData = {
            ...buildApplicationData(payload, null), // No member ID yet
            status: 'Submitted', // Required status for Phase 1
            submissionDate: new Date(),
            // TODO: Map all fields from Fillout form - currently only mapping basic fields
        };
        
        // Remove the member link field since we don't have a member yet
        delete applicationData.applicantProfile; // TODO: Change to wixMemberId when schema updated
        
        const { success, applicationId, error } = await createApplication(applicationData);
        
        if (!success) {
            throw new Error(`Failed to create application: ${error}`);
        }
        
        console.log(`✅ Application created: ${applicationId}`);
        
        // Step 3: Send acknowledgment email
        // TODO: Configure triggered email "application_received" in Wix Dashboard
        // TODO: Uncomment when email trigger is configured:
        // if (contactIsNew || true) { // Always send for now
        //     await contacts.emailContact(contact._id, {
        //         emailId: 'application_received' // Triggered email ID
        //     });
        //     console.log('📧 Acknowledgment email queued');
        // }
        
        // Return success response
        return ok({
            body: {
                status: 'success',
                message: 'Application submitted successfully',
                data: {
                    applicationId,
                    contactId: contact._id,
                    contactIsNew
                },
                version: VERSION,
                timestamp
            }
        });
        
    } catch (error) {
        console.error('❌ StudioApplication error:', error.message);
        console.error('Full error:', error);
        
        return serverError({
            body: {
                error: 'Failed to process application',
                message: error.message,
                version: VERSION
            }
        });
    }
}

// === TEST ENDPOINTS FOR DEBUGGING ===

/**
 * Simple ping endpoint to test connectivity
 */
export async function get_ping(request) {
    const timestamp = new Date().toISOString();
    console.log(`⚡ Executing /ping | 📍 Version: ${VERSION} | 🕐 ${timestamp}`);
    
    return ok({
        body: {
            status: 'alive',
            timestamp,
            version: VERSION
        }
    });
}

/**
 * Test collection access
 */
export async function get_testAccess(request) {
    const timestamp = new Date().toISOString();
    console.log(`⚡ Executing /testAccess | 📍 Version: ${VERSION} | 🕐 ${timestamp}`);
    
    const collectionTest = await testCollectionAccess();
    console.log(`✅ Collection access test: ${collectionTest.message}`);
    
    return ok({
        body: {
            status: 'success',
            timestamp,
            version: VERSION,
            collectionTest
        }
    });
}

/**
 * Test hello world insert
 */
export async function post_helloInsert(request) {
    const timestamp = new Date().toISOString();
    console.log(`⚡ Executing /helloInsert | 📍 Version: ${VERSION} | 🕐 ${timestamp}`);
    
    console.log('📝 Attempting hello world insert...');
    const result = await insertHelloWorld();
    
    if (result.success) {
        console.log(`✅ Insert successful! ID: ${result.id}`);
        return ok({
            body: {
                status: 'success',
                message: 'Hello World inserted successfully',
                timestamp,
                version: VERSION,
                insertResult: {
                    id: result.id,
                    email: result.data.email
                }
            }
        });
    } else {
        console.log(`❌ Insert failed: ${result.error}`);
        return serverError({
            body: {
                status: 'error',
                error: result.error,
                timestamp,
                version: VERSION
            }
        });
    }
}

/**
 * View recent test entries
 */
export async function get_recentTests(request) {
    const timestamp = new Date().toISOString();
    console.log(`⚡ Executing /recentTests | 📍 Version: ${VERSION} | 🕐 ${timestamp}`);
    
    const testEntries = await getRecentTestEntries();
    
    if (testEntries.success) {
        console.log(`✅ Found ${testEntries.count} recent test entries`);
    }
    
    return ok({
        body: {
            status: 'success',
            timestamp,
            version: VERSION,
            testEntries
        }
    });
}

// === ADMIN ENDPOINTS ===
// TODO: Move these to separate file as suggested in workflow doc

export { get_adminReport, post_adminFix } from 'backend/admin-tools';