// src/backend/http-functions.js
// Minimal version - Step by step testing

import { ok, serverError, forbidden, badRequest } from 'wix-http-functions';
import { isValidApiKey } from 'backend/auth-utils.web.js';
import { testCollectionAccess, insertHelloWorld, getRecentTestEntries, createApplication, buildApplicationData, linkApplicationToMember } from 'backend/data-access.js';
import { findOrCreateContact } from 'backend/contact-logic.web.js';
import { findOrCreateMember, ensureMemberProfile } from 'backend/member-logic.web.js';

const CODE_VERSION = "v.9126c65";

// === STEP 1: Basic connectivity ===
export async function get_ping(request) {
    console.log(`⚡ Executing /ping | 📍 Version: ${CODE_VERSION} | 🕐 ${new Date().toISOString()}`);
    
    return ok({
        body: {
            status: "alive",
            timestamp: new Date().toISOString(),
            version: CODE_VERSION
        }
    });
}

// === STEP 2: Test collection access ===
export async function get_testAccess(request) {
    console.log(`⚡ Executing /testAccess | 📍 Version: ${CODE_VERSION} | 🕐 ${new Date().toISOString()}`);
    
    try {
        const result = await testCollectionAccess();
        
        console.log(`${result.success ? '✅' : '❌'} Collection access test: ${result.message || result.error}`);
        
        return ok({
            body: {
                status: result.success ? "success" : "failed",
                timestamp: new Date().toISOString(),
                version: CODE_VERSION,
                collectionTest: result
            }
        });
    } catch (error) {
        console.error(`❌ TestAccess error: ${error.message}`);
        return serverError({
            body: {
                error: "Test failed",
                message: error.message,
                version: CODE_VERSION
            }
        });
    }
}

// === STEP 3: Hello World Insert ===
export async function post_helloInsert(request) {
    console.log(`⚡ Executing /helloInsert | 📍 Version: ${CODE_VERSION} | 🕐 ${new Date().toISOString()}`);
    
    try {
        console.log('📝 Attempting hello world insert...');
        const result = await insertHelloWorld();
        
        if (result.success) {
            console.log(`✅ Insert successful! ID: ${result.id}`);
            return ok({
                body: {
                    status: "success",
                    message: "Hello World inserted successfully",
                    timestamp: new Date().toISOString(),
                    version: CODE_VERSION,
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
                    status: "error",
                    message: "Insert failed",
                    error: result.error,
                    code: result.code,
                    version: CODE_VERSION
                }
            });
        }
    } catch (error) {
        console.error(`❌ HelloInsert error: ${error.message}`);
        return serverError({
            body: {
                error: "Insert operation failed",
                message: error.message,
                version: CODE_VERSION
            }
        });
    }
}

// === STEP 4: View recent test entries ===
export async function get_recentTests(request) {
    console.log(`⚡ Executing /recentTests | 📍 Version: ${CODE_VERSION} | 🕐 ${new Date().toISOString()}`);
    
    try {
        const result = await getRecentTestEntries();
        
        console.log(`${result.success ? '✅' : '❌'} Found ${result.count || 0} recent test entries`);
        
        return ok({
            body: {
                status: result.success ? "success" : "failed",
                timestamp: new Date().toISOString(),
                version: CODE_VERSION,
                testEntries: result
            }
        });
    } catch (error) {
        console.error(`❌ RecentTests error: ${error.message}`);
        return serverError({
            body: {
                error: "Query failed",
                message: error.message,
                version: CODE_VERSION
            }
        });
    }
}

// === STEP 5: Full Webhook Handler ===
export async function post_studioApplication(request) {
    console.log(`⚡ Executing /studioApplication | 📍 Version: ${CODE_VERSION} | 🕐 ${new Date().toISOString()}`);
    
    try {
        // Simple API key check - ONLY for webhook
        if (!(await isValidApiKey(request))) {
            return forbidden({ body: { error: "Invalid API Key" } });
        }
        
        // Parse payload
        const payload = await request.body.json();
        console.log(`📦 Received payload for: ${payload.email}`);
        
        // Validate required fields
        if (!payload.email) {
            return badRequest({
                body: {
                    error: "Email is required",
                    version: CODE_VERSION
                }
            });
        }
        
        // === ORCHESTRATE THE FULL PROCESS ===
        
        // 1. Create/Find Contact
        console.log('📋 Step 1: Creating/finding contact...');
        const contactResult = await findOrCreateContact(
            payload.email, 
            payload.firstName || '', 
            payload.lastName || ''
        );
        console.log(`✅ Contact ready: ${contactResult.contactId} (new: ${contactResult.isNew})`);
        
        // 2. Create/Find Member
        console.log('👤 Step 2: Creating/finding member...');
        const memberResult = await findOrCreateMember(
            contactResult.contactId,
            payload.email
        );
        console.log(`✅ Member ready: ${memberResult.memberId} (new: ${memberResult.isNew})`);
        
        // 3. Ensure Member Profile exists
        if (!memberResult.hasProfile && !memberResult.memberId.startsWith('pending_')) {
            console.log('📝 Step 3: Creating member profile...');
            await ensureMemberProfile(memberResult.memberId, payload.email);
        }
        
        // 4. Build Application Data
        console.log('🏗️ Step 4: Building application data...');
        const applicationData = buildApplicationData(payload, memberResult.memberId);
        
        // 5. Create Application
        console.log('💾 Step 5: Creating application record...');
        const appResult = await createApplication(applicationData);
        
        if (!appResult.success) {
            throw new Error(`Failed to create application: ${appResult.error}`);
        }
        
        // 6. Link Application to Member (non-critical)
        if (!memberResult.memberId.startsWith('pending_')) {
            console.log('🔗 Step 6: Linking application to member...');
            await linkApplicationToMember(memberResult.memberId, appResult.applicationId);
        }
        
        console.log(`✅ Full process complete for ${payload.email}`);
        
        return ok({
            body: {
                status: "success",
                message: "Studio application processed successfully",
                timestamp: new Date().toISOString(),
                version: CODE_VERSION,
                data: {
                    contactId: contactResult.contactId,
                    contactIsNew: contactResult.isNew,
                    memberId: memberResult.memberId,
                    memberIsNew: memberResult.isNew,
                    applicationId: appResult.applicationId
                }
            }
        });
        
    } catch (error) {
        console.error(`❌ StudioApplication error: ${error.message}`);
        console.error('Stack:', error.stack);
        
        return serverError({
            body: {
                error: "Failed to process application",
                message: error.message,
                version: CODE_VERSION
            }
        });
    }
}